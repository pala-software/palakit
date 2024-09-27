import {
  MutationOperation,
  Observable,
  Operation,
  QueryOperation,
  ResourceEndpoint,
  ResourceSchema,
  ResourceServer,
  SubscriptionOperation,
  isMutationOperation,
  isQueryOperation,
  isSubscriptionOperation,
} from "@palakit/api";
import { Logger, createPart } from "@palakit/core";
import { AnyRouter, initTRPC } from "@trpc/server";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { observable } from "@trpc/server/observable";
import { toJSONSchema, validate } from "@typeschema/main";
import { writeFile } from "fs/promises";
import { JSONSchema, compile } from "json-schema-to-typescript";
import { WebSocketServer } from "ws";

export type Options = {
  /** Port where to host the tRPC WebSocket server. */
  port: number;

  /** Path where to generate client code. */
  clientPath?: string;
};

export const createTrpcResourceServer = (options: Options) =>
  createPart("TrpcServer", [ResourceServer, Logger], ([server, lg]) => {
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

    const createValidator =
      (schema: ResourceSchema | null) => async (value: unknown) => {
        if (!schema) {
          if (value === undefined) {
            return undefined;
          } else {
            logger.error("Validation failed, expected nothing");
            throw new Error("Validation failed, expected nothing");
          }
        }

        const result = await validate(schema.schema, value);
        if (result.success) {
          return value;
        } else {
          const msg =
            "Validation failed with following issues: \n" +
            result.issues
              .map(
                ({ message, path }) =>
                  ` - ${message}` +
                  (path?.length ? ` (at ${path.join(".")})` : ""),
              )
              .join("\n");
          logger.error(msg);
          throw new Error(msg);
        }
      };
    const createQuery = (operation: QueryOperation) =>
      t.procedure
        .input(createValidator(operation.input))
        .output(createValidator(operation.output))
        .query(async ({ input }) => executeOperation({ operation, input }));

    const createMutation = (operation: MutationOperation) =>
      t.procedure
        .input(createValidator(operation.input))
        .output(createValidator(operation.output))
        .mutation(async ({ input }) => executeOperation({ operation, input }));

    const createSubscription = (operation: SubscriptionOperation) =>
      t.procedure
        .input(createValidator(operation.input))
        .subscription(async ({ input }) => {
          const run = (await executeOperation({
            operation,
            input,
          })) as Observable;
          const validate = createValidator(operation.output);
          return observable(({ next, complete, error }) =>
            run({
              next: async (value) => {
                if (!operation.output) {
                  // No validation, allow anything.
                  next(value);
                  return;
                }

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
      logger.error("Invalid operation type encountered");
      throw new Error("Invalid operation type encountered");
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
        const msg = `Type name ${parts.join(",")} is converted to empty string which is not valid TypeScript type name`;
        logger.error(msg);
        throw new Error(msg);
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

          const wss = new WebSocketServer({ port: options.port });
          applyWSSHandler({ wss, router: t.router(routers) });
        },

        generateClient: async () => {
          if (!options.clientPath) {
            const msg =
              "Cannot generate client, because option 'clientPath' was not provided.";
            logger.error(msg);
            throw new Error(msg);
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
            if (!operation[target]) {
              typeAliases[target].set(operation, "void");
              return;
            }

            const jsonSchema = (await toJSONSchema(
              operation[target].schema,
            )) as JSONSchema;
            const typeName = operation[target].name
              ? createTypeName([operation[target].name])
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
                logger.error("Invalid operation type encountered");
                throw new Error("Invalid operation type encountered");
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

          await writeFile(options.clientPath, contents);
        },
      }),
    };
  });
