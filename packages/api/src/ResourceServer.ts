import { Application, Function, Runtime } from "@palakit/core";
import { createPart } from "@palakit/core";
import {
  InputFromResourceSchema,
  MutationOperation,
  MutationOperationOptions,
  Operation,
  OperationRecord,
  OutputFromResourceSchema,
  QueryOperation,
  QueryOperationOptions,
  Request,
  ResourceEndpoint,
  ResourceEndpointFromOptions,
  ResourceEndpointOptions,
  ResourceSchema,
  ResourceServerAdapter,
  Response,
  SubscriptionOperation,
  SubscriptionOperationOptions,
} from "./types";
import { validate } from "@typeschema/main";

const createValidator =
  <T extends ResourceSchema | null>(schema: T) =>
  async (value: unknown): Promise<OutputFromResourceSchema<T>> => {
    if (!schema) {
      if (value === undefined) {
        return undefined as OutputFromResourceSchema<T>;
      } else {
        throw new Error("Validation failed, expected nothing");
      }
    }

    const result = await validate(schema.schema, value);
    if (result.success) {
      return value as OutputFromResourceSchema<T>;
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

export const ResourceServer = createPart(
  "ResourceServer",
  [Application, Runtime],
  ([application, runtime]) => {
    let initialized = false;
    const adapters: ResourceServerAdapter[] = [];
    const endpoints: ResourceEndpoint[] = [];

    const initialize = () => {
      if (initialized) return;
      initialized = true;
      for (const adapter of adapters) {
        for (const endpoint of endpoints) {
          adapter.addEndpoint(endpoint);
        }
      }
    };

    return {
      start: application.start.on("ResourceServer.start", () => {
        initialize();
        for (const adapter of adapters) {
          adapter.start();
        }
      }),

      createAdapter: (
        adapter: ResourceServerAdapter,
      ): ResourceServerAdapter => {
        adapters.push(adapter);
        return adapter;
      },

      createEndpoint: <T extends ResourceEndpointOptions>(
        options: T,
      ): ResourceEndpointFromOptions<T> => {
        const operationBeforeHooks: {
          hookName: string;
          fn: Function<[{ operation: string; request: Request }], Request>;
        }[] = [];
        const operationAfterHooks: {
          hookName: string;
          fn: Function<
            [{ operation: string; request: Request; response: Response }],
            Response
          >;
        }[] = [];
        const endpoint = {
          name: options.name,
          operations: Object.fromEntries(
            Object.entries(options.operations).filter(
              (entry): entry is [string, Operation] => !!entry[1],
            ),
          ),
          operation: {
            before: (hookName, hook) => {
              operationBeforeHooks.push({
                hookName,
                fn: runtime.createFunction(hookName, hook),
              });
            },
            after: (hookName, hook) => {
              operationAfterHooks.push({
                hookName,
                fn: runtime.createFunction(hookName, hook),
              });
            },
          },
        } as ResourceEndpointFromOptions<T>;

        for (const [operationName, operation] of Object.entries(
          endpoint.operations as OperationRecord,
        )) {
          operation.handler.before(
            `ResourceServer.${options.name}.operations.${operationName}.before`,
            async (request) => {
              for (const { fn } of operationBeforeHooks) {
                request = await fn({ operation: operationName, request });
              }
              return [request];
            },
          );

          operation.handler.after(
            `ResourceServer.${options.name}.operations.${operationName}.before`,
            async (response, request) => {
              for (const { fn } of operationAfterHooks) {
                response = await fn({
                  operation: operationName,
                  request,
                  response,
                });
              }
              return response;
            },
          );
        }

        endpoints.push(endpoint);
        if (initialized) {
          for (const adapter of adapters) {
            adapter.addEndpoint(endpoint);
          }
        }
        return endpoint;
      },

      createQuery: <
        InputSchema extends ResourceSchema | null,
        OutputSchema extends ResourceSchema | null,
      >(
        options: QueryOperationOptions<InputSchema, OutputSchema>,
      ): QueryOperation<
        OutputFromResourceSchema<InputSchema>,
        InputFromResourceSchema<OutputSchema>
      > => {
        return {
          type: "query",
          inputSchema: options.input,
          outputSchema: options.output,
          inputValidator: createValidator(options.input),
          outputValidator: createValidator(options.output),
          handler: runtime.createFunction(
            `ResourceServer.operations.${options.name}`,
            options.handler,
          ),
        };
      },

      createMutation: <
        InputSchema extends ResourceSchema | null,
        OutputSchema extends ResourceSchema | null,
      >(
        options: MutationOperationOptions<InputSchema, OutputSchema>,
      ): MutationOperation<
        OutputFromResourceSchema<InputSchema>,
        InputFromResourceSchema<OutputSchema>
      > => {
        return {
          type: "mutation",
          inputSchema: options.input,
          outputSchema: options.output,
          inputValidator: createValidator(options.input),
          outputValidator: createValidator(options.output),
          handler: runtime.createFunction(
            `ResourceServer.operations.${options.name}`,
            options.handler,
          ),
        };
      },

      createSubscription: <
        InputSchema extends ResourceSchema | null,
        OutputSchema extends ResourceSchema | null,
      >(
        options: SubscriptionOperationOptions<InputSchema, OutputSchema>,
      ): SubscriptionOperation<
        OutputFromResourceSchema<InputSchema>,
        InputFromResourceSchema<OutputSchema>
      > => {
        return {
          type: "subscription",
          inputSchema: options.input,
          outputSchema: options.output,
          inputValidator: createValidator(options.input),
          outputValidator: createValidator(options.output),
          handler: runtime.createFunction(
            `ResourceServer.operations.${options.name}`,
            options.handler,
          ),
        };
      },

      generateClients: async (): Promise<void> => {
        initialize();
        for (const adapter of adapters) {
          await adapter.generateClient?.();
        }
      },
    };
  },
);
