import { createPart } from "@pala/core";
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
} from "@pala/api";
import { AnyRouter, initTRPC } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import WebSocket from "ws";
import { writeFile } from "fs/promises";
import { Schema, toJSONSchema, validate } from "@typeschema/main";
import { JSONSchema, compile } from "json-schema-to-typescript";

export type Options = {
  /** Port where to host the tRPC WebSocket server. */
  port: number;

  /** Path where to generate client code. */
  clientPath?: string;
};

export const createTrpcResourceServer = (options: Options) =>
  createPart("TrpcServer", [ResourceServer], ([server]) => {
    const t = initTRPC.create();
    const endpoints: ResourceEndpoint[] = [];

    const executeOperation = async ({
      operation,
      input,
    }: {
      operation: Operation;
      input: unknown;
    }): Promise<unknown> => {
      const { response } = await operation.handler({ input });
      if (response.type === "error") {
        throw response.data;
      } else {
        return response.data;
      }
    };

    const createValidator =
      (schema: Schema | undefined) => async (value: unknown) => {
        if (!schema) {
          if (value === undefined) {
            return undefined;
          } else {
            throw new Error("Validation failed, expected nothing");
          }
        }

        const result = await validate(schema, value);
        if (result.success) {
          return value;
        } else {
          throw new Error(
            "Validation failed with following issues: \n" +
              result.issues
                .map(
                  ({ message, path }) =>
                    ` - ${message}` +
                    (path?.length ? ` (at ${path.join(".")})` : ""),
                )
                .join("\n"),
          );
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
                  // TODO: Log error in server log.
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                } catch (err) {
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
      throw new Error("Invalid operation type encountered");
    };

    const createTypeName = (parts: string[]) =>
      parts
        .map((part) => part.replace(/[^a-zA-Z0-9]/g, ""))
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join("");

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

          const wss = new WebSocket.Server({ port: options.port });
          applyWSSHandler({ wss, router: t.router(routers) });
        },

        generateClient: async () => {
          if (!options.clientPath) {
            throw new Error(
              "Cannot generate client, because option 'clientPath' was not provided.",
            );
          }

          let contents = `import { BuildProcedure, BuildRouter } from "@pala/api-trpc";\n`;
          contents += `\n`;
          for (const { name: endpointName, operations } of endpoints) {
            for (const [name, operation] of Object.entries(operations)) {
              if (!operation) continue;
              contents += await compile(
                (operation.input
                  ? await toJSONSchema(operation.input)
                  : { tsType: "void" }) as JSONSchema,
                createTypeName(["InputOf", endpointName, name]),
                { bannerComment: "" },
              );
              contents += await compile(
                (operation.output
                  ? await toJSONSchema(operation.output)
                  : { tsType: "unknown" }) as JSONSchema,
                createTypeName(["OutputOf", endpointName, name]),
                { bannerComment: "" },
              );
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
                throw new Error("Invalid operation type encountered");
              }

              const jsonName = JSON.stringify(name);
              // TODO: I/O types
              contents += `    `;
              contents += jsonName;
              contents += `: BuildProcedure<"`;
              contents += type;
              contents += `", `;
              contents += createTypeName(["InputOf", endpointName, name]);
              contents += `, `;
              contents += createTypeName(["OutputOf", endpointName, name]);
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
