import { Application, Runtime } from "@pala/core";
import { createPart } from "part-di";
import {
  MutationOperationOptions,
  QueryOperationOptions,
  ResourceEndpoint,
  ResourceEndpointFromOptions,
  ResourceEndpointOptions,
  ResourceServerAdapter,
  SubscriptionOperationOptions,
  TypedMutationOperationOptions,
  TypedOperationOptions,
  TypedQueryOperationOptions,
  TypedSubscriptionOperationOptions,
} from "./types";
import { Schema } from "@typeschema/main";

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
                    `${options.name}.${operationName}`,
                    operationOptions.handler,
                  ),
                },
              ]),
          ),
        } as ResourceEndpointFromOptions<T>;

        endpoints.push(endpoint);
        if (initialized) {
          for (const adapter of adapters) {
            adapter.addEndpoint(endpoint);
          }
        }
        return endpoint;
      },

      createQuery: <
        InputSchema extends Schema | null,
        OutputSchema extends Schema | null,
      >(
        options: QueryOperationOptions<InputSchema, OutputSchema>,
      ): TypedQueryOperationOptions<InputSchema, OutputSchema> => {
        return { ...options, type: "query" };
      },

      createMutation: <
        InputSchema extends Schema | null,
        OutputSchema extends Schema | null,
      >(
        options: MutationOperationOptions<InputSchema, OutputSchema>,
      ): TypedMutationOperationOptions<InputSchema, OutputSchema> => {
        return { ...options, type: "mutation" };
      },

      createSubscription: <
        InputSchema extends Schema | null,
        OutputSchema extends Schema | null,
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
