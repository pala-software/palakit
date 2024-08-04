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
import { ResourceSchema } from "@pala/api";
import { createPart } from "@pala/core";
import { AnyRouter, initTRPC } from "@trpc/server";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { observable } from "@trpc/server/observable";
import { Schema, toJSONSchema, validate } from "@typeschema/main";
import { writeFile } from "fs/promises";
import { JSONSchema, compile } from "json-schema-to-typescript";
import WebSocket from "ws";

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
      input: any;
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
                    (path?.length ? ` (at ${path.join(".")})` : "")
                )
                .join("\n")
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
                } catch (_err) {
                  error("Output validation failed");
                }
              },
              complete,
              error,
            })
          );
        });

    const createProcedure = (operation: Operation) => {
      if (isQueryOperation(operation)) return createQuery(operation);
      if (isMutationOperation(operation)) return createMutation(operation);
      if (isSubscriptionOperation(operation))
        return createSubscription(operation);
      throw new Error("Invalid operation type encountered");
    };

    const createTypeName = (parts: string[]) => {
      const typeName = parts
        .map((part) => part.replace(/[^a-zA-Z0-9]/g, ""))
        .map((part) => part.replace(/^[0-9]+/, ""))
        .map((part) =>
          part.length < 1 ? part : part[0].toUpperCase() + part.slice(1)
        )
        .join("");
      if (typeName.length < 1) {
        throw new Error(
          `Type name ${parts.join(",")} is converted to empty string which is not valid TypeScript type name`
        );
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
                      entry
                    ): entry is [
                      (typeof entry)[0],
                      Exclude<(typeof entry)[1], undefined>,
                    ] => entry[1] !== undefined
                  )
                  .map(([name, operation]) => [
                    name,
                    createProcedure(operation),
                  ])
              ),
            });
          }

          const wss = new WebSocket.Server({ port: options.port });
          applyWSSHandler({ wss, router: t.router(routers) });
        },

        generateClient: async () => {
          if (!options.clientPath) {
            throw new Error(
              "Cannot generate client, because option 'clientPath' was not provided."
            );
          }

          let contents = `import { BuildProcedure, BuildRouter } from "@pala/api-trpc";\n`;
          contents += `\n`;

          const schemas: Record<string, JSONSchema> = {};
          const typeAliases: Record<string, string> = {};

          const createSchema = async (
            source: ResourceSchema,
            defaultName: string
          ) => {
            if (
              !source ||
              source.schema === null ||
              source.schema === undefined
            ) {
              typeAliases[defaultName] = "void";
              return;
            }

            const jsonSchema = (await toJSONSchema(
              source.schema
            )) as JSONSchema;
            const typeName = createTypeName([
              source.name ? source.name : defaultName,
            ]);
            if (
              jsonSchema.type &&
              typeof jsonSchema.type === "string" &&
              ["boolean", "bigint", "number", "string", "symbol"].includes(
                jsonSchema.type
              )
            ) {
              typeAliases[defaultName] = jsonSchema.type;
              return;
            }

            if (!(typeName in schemas)) {
              schemas[typeName] = jsonSchema;
              contents += await compile(jsonSchema, typeName, {
                bannerComment: "",
              });
            }
            typeAliases[defaultName] = source?.isArray
              ? typeName + "[]"
              : typeName;
          };

          for (const { name: endpointName, operations } of endpoints) {
            for (const [name, operation] of Object.entries(operations)) {
              if (!operation) continue;
              await createSchema(
                operation.input,
                createTypeName(["InputOf", endpointName, name])
              );
              await createSchema(
                operation.output,
                createTypeName(["OutputOf", endpointName, name])
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

              const getTypeName = (putOf: "InputOf" | "OutputOf") => {
                const tName = createTypeName([putOf, endpointName, name]);
                return tName in typeAliases ? typeAliases[tName] : tName;
              };

              const jsonName = JSON.stringify(name);
              contents += `    `;
              contents += jsonName;
              contents += `: BuildProcedure<"`;
              contents += type;
              contents += `", `;
              contents += getTypeName("InputOf");
              contents += `, `;
              contents += getTypeName("OutputOf");
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
