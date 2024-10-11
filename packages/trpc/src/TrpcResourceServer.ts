import Router from "@koa/router";
import {
  MutationOperation,
  Observable,
  Operation,
  QueryOperation,
  ResourceEndpoint,
  ResourceServer,
  SubscriptionOperation,
  isMutationOperation,
  isQueryOperation,
  isSubscriptionOperation,
} from "@palakit/api";
import {
  Logger,
  createConfiguration,
  createFeature,
  createPart,
} from "@palakit/core";
import { KoaHttpServer } from "@palakit/koa";
import { AnyRouter, initTRPC } from "@trpc/server";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { observable } from "@trpc/server/observable";
import { toJSONSchema } from "@typeschema/main";
import { writeFile } from "fs/promises";
import { JSONSchema, compile } from "json-schema-to-typescript";
import { WebSocketServer } from "ws";

export type TrpcResourceServerConfiguration = {
  /** URL path where to mount tRPC server. */
  path: string;

  /** Path where to generate client code. */
  clientPath?: string;
};

export const TrpcResourceServerConfiguration =
  createConfiguration<TrpcResourceServerConfiguration>(
    "TrpcResourceServerConfiguration",
  );

export const TrpcResourceServer = createPart(
  "TrpcServer",
  [TrpcResourceServerConfiguration, ResourceServer, KoaHttpServer, Logger],
  ([config, server, http, lg]) => {
    const t = initTRPC.create();
    const endpoints: ResourceEndpoint[] = [];
    const logger = lg.createLogger("TrpcServer");

    const executeOperation = async ({
      operation,
      input,
    }: {
      operation: Operation;
      input: unknown;
    }): Promise<unknown> => {
      const { response } = await operation.handler({ input });
      if (response.type === "error") {
        logger.error(response.data);
        throw response.data;
      } else {
        return response.data;
      }
    };

    const createQuery = (operation: QueryOperation) =>
      t.procedure
        .input(async (value) =>
          operation.validateInput(await operation.getInputSchema(), value),
        )
        .output(async (value) =>
          operation.validateOutput(await operation.getOutputSchema(), value),
        )
        .query(async ({ input }) => executeOperation({ operation, input }));

    const createMutation = (operation: MutationOperation) =>
      t.procedure
        .input(async (value) =>
          operation.validateInput(await operation.getInputSchema(), value),
        )
        .output(async (value) =>
          operation.validateOutput(await operation.getOutputSchema(), value),
        )
        .mutation(async ({ input }) => executeOperation({ operation, input }));

    const createSubscription = (operation: SubscriptionOperation) =>
      t.procedure
        .input(async (value) =>
          operation.validateInput(await operation.getInputSchema(), value),
        )
        .subscription(async ({ input }) => {
          const run = (await executeOperation({
            operation,
            input,
          })) as Observable;
          const validate = async (value: unknown) =>
            operation.validateOutput(await operation.getOutputSchema(), value);
          return observable(({ next, complete, error }) =>
            run({
              next: async (value) => {
                try {
                  await validate(value);
                  next(value);
                } catch (err) {
                  logger.error(err);
                  error("Output validation failed");
                }
              },
              complete,
              error,
            }),
          );
        });

    const createProcedure = (operation: Operation) => {
      if (isQueryOperation(operation)) return createQuery(operation);
      if (isMutationOperation(operation)) return createMutation(operation);
      if (isSubscriptionOperation(operation))
        return createSubscription(operation);
      const e = new Error("Invalid operation type encountered");
      logger.error(e);
      throw e;
    };

    const createTypeName = (parts: string[]) => {
      const typeName = parts
        .map((part) => part.replace(/[^a-zA-Z0-9]/g, ""))
        .map((part) => part.replace(/^[0-9]+/, ""))
        .map((part) =>
          part.length < 1 ? part : part[0].toUpperCase() + part.slice(1),
        )
        .join("");
      if (typeName.length < 1) {
        const e = new Error(
          `Type name ${parts.join(",")} is converted to empty string which is not valid TypeScript type name`,
        );
        logger.error(e);
        throw e;
      }
      return typeName;
    };

    return {
      trpcResourceServerAdapter: server.createAdapter({
        addEndpoint: (endpoint) => {
          endpoints.push(endpoint);
        },

        start: () => {
          const routers: Record<string, AnyRouter> = {};
          for (const endpoint of endpoints) {
            routers[endpoint.name] = t.router({
              ...Object.fromEntries(
                Object.entries(endpoint.operations)
                  .filter(
                    (
                      entry,
                    ): entry is [
                      (typeof entry)[0],
                      Exclude<(typeof entry)[1], undefined>,
                    ] => entry[1] !== undefined,
                  )
                  .map(([name, operation]) => [
                    name,
                    createProcedure(operation),
                  ]),
              ),
            });
          }

          const wss = new WebSocketServer({ noServer: true });
          applyWSSHandler({ wss, router: t.router(routers) });

          const router = new Router();
          router.get(config.path, (ctx) => {
            if (ctx.req.headers.upgrade !== "websocket") {
              ctx.req.statusCode = 426;
              return;
            }

            wss.handleUpgrade(
              ctx.req,
              ctx.socket,
              Buffer.alloc(0),
              (client, request) => {
                wss.emit("connection", client, request);
              },
            );
            ctx.respond = false;
          });
          http.use(router.routes());
        },

        generateClient: async () => {
          if (!config.clientPath) {
            const e = new Error(
              "Cannot generate client, because option 'clientPath' was not provided.",
            );
            logger.error(e);
            throw e;
          }

          const generatedTypes: string[] = [];
          const typeAliases = {
            input: new Map<Operation, string>(),
            output: new Map<Operation, string>(),
          };
          const generateType = async (
            endpointName: string,
            operationName: string,
            operation: Operation,
            target: "input" | "output",
          ) => {
            const schema = await {
              input: operation.getInputSchema,
              output: operation.getOutputSchema,
            }[target]();
            if (!schema) {
              typeAliases[target].set(operation, "void");
              return;
            }

            const jsonSchema = (await toJSONSchema(
              schema.schema,
            )) as JSONSchema;
            const typeName = schema.name
              ? createTypeName([schema.name])
              : createTypeName([target, "of", endpointName, operationName]);

            // Do not create multiple types with the same name.
            if (!generatedTypes.includes(typeName)) {
              contents += await compile(jsonSchema, typeName, {
                bannerComment: "",
              });
              generatedTypes.push(typeName);
            }

            typeAliases[target].set(operation, typeName);
          };

          let contents = `import { BuildProcedure, BuildRouter } from "@palakit/trpc";\n`;
          contents += `\n`;
          for (const { name: endpointName, operations } of endpoints) {
            for (const [name, operation] of Object.entries(operations)) {
              if (!operation) continue;
              await generateType(endpointName, name, operation, "input");
              await generateType(endpointName, name, operation, "output");
            }
          }
          contents += `\n`;
          contents += `type GeneratedRouter = BuildRouter<{\n`;
          for (const { name: endpointName, operations } of endpoints) {
            const jsonName = JSON.stringify(endpointName);
            contents += `  ${jsonName}: BuildRouter<{\n`;
            for (const [name, operation] of Object.entries(operations)) {
              if (!operation) continue;

              const { type } = operation;
              if (!["query", "mutation", "subscription"].includes(type)) {
                const e = new Error("Invalid operation type encountered");
                logger.error(e);
                throw e;
              }

              const jsonName = JSON.stringify(name);
              contents += `    `;
              contents += jsonName;
              contents += `: BuildProcedure<"`;
              contents += type;
              contents += `", `;
              contents += typeAliases.input.get(operation);
              contents += `, `;
              contents += typeAliases.output.get(operation);
              contents += `>;\n`;
            }
            contents += `  }>;\n`;
          }
          contents += `}>;\n`;
          contents += `\n`;
          contents += `export default GeneratedRouter;\n`;

          await writeFile(config.clientPath, contents);
        },
      }),
    };
  },
);

export const TrpcResourceServerFeature = createFeature(
  [ResourceServer, TrpcResourceServer],
  TrpcResourceServerConfiguration,
);
