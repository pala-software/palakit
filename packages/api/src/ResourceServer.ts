import { Application, Function, Runtime } from "@pala/core";
import { createPart } from "part-di";
import {
  MutationOperationOptions,
  QueryOperationOptions,
  Request,
  ResourceEndpoint,
  ResourceEndpointFromOptions,
  ResourceEndpointOptions,
  ResourceSchema,
  ResourceServerAdapter,
  Response,
  SubscriptionOperationOptions,
  TypedMutationOperationOptions,
  TypedOperationOptions,
  TypedQueryOperationOptions,
  TypedSubscriptionOperationOptions,
} from "./types";

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
            Object.entries(options.operations)
              .filter(
                (entry): entry is [string, TypedOperationOptions] => !!entry[1],
              )
              .map(([operationName, operationOptions]) => [
                operationName,
                {
                  ...operationOptions,
                  handler: runtime.createFunction(
                    `ResourceServer.${options.name}.operations.${operationName}`,
                    operationOptions.handler,
                  ),
                },
              ]),
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
          endpoint.operations,
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
      ): TypedQueryOperationOptions<InputSchema, OutputSchema> => {
        return { ...options, type: "query" };
      },

      createMutation: <
        InputSchema extends ResourceSchema | null,
        OutputSchema extends ResourceSchema | null,
      >(
        options: MutationOperationOptions<InputSchema, OutputSchema>,
      ): TypedMutationOperationOptions<InputSchema, OutputSchema> => {
        return { ...options, type: "mutation" };
      },

      createSubscription: <
        InputSchema extends ResourceSchema | null,
        OutputSchema extends ResourceSchema | null,
      >(
        options: SubscriptionOperationOptions<InputSchema, OutputSchema>,
      ): TypedSubscriptionOperationOptions<InputSchema, OutputSchema> => {
        return { ...options, type: "subscription" };
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
