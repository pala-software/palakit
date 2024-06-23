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
      <Input>(schema: Schema) =>
      async (input: Input) => {
        const result = await validate(schema, input);
        if (result.success) {
          return input;
        } else {
          throw new Error("Validation failed", { cause: result.issues });
        }
      };

    const createProcedureBuilder = (operation: Operation) => {
      if (operation.input && operation.output) {
        return t.procedure
          .input(createValidator(operation.input))
          .output(createValidator(operation.output));
      } else if (operation.input) {
        return t.procedure.input(createValidator(operation.input));
      } else if (operation.output) {
        return t.procedure.output(createValidator(operation.output));
      } else {
        return t.procedure;
      }
    };

    const createQuery = (operation: QueryOperation) =>
      createProcedureBuilder(operation).query(async ({ input }) =>
        executeOperation({ operation, input })
      );

    const createMutation = (operation: MutationOperation) =>
      createProcedureBuilder(operation).mutation(async ({ input }) =>
        executeOperation({ operation, input })
      );

    const createSubscription = (operation: SubscriptionOperation) =>
      createProcedureBuilder(operation).subscription(async ({ input }) => {
        const output = await executeOperation({ operation, input });
        return observable(output as Observable);
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
          for (const { name: endpointName, operations } of endpoints) {
            for (const [name, operation] of Object.entries(operations)) {
              if (!operation) continue;
              contents += await compile(
                operation.input
                  ? ((await toJSONSchema(operation.input)) as JSONSchema)
                  : { tsType: "undefined" },
                createTypeName(["InputOf", endpointName, name]),
                { bannerComment: "" }
              );
              contents += await compile(
                operation.output
                  ? ((await toJSONSchema(operation.output)) as JSONSchema)
                  : { tsType: "undefined" },
                createTypeName(["OutputOf", endpointName, name]),
                { bannerComment: "" }
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
