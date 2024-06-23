import { Application } from "@pala/core";
import { createPart } from "part-di";
import {
  MutationOperation,
  MutationOperationOptions,
  QueryOperation,
  QueryOperationOptions,
  ResourceEndpoint,
  ResourceServerAdapter,
  SubscriptionOperation,
  SubscriptionOperationOptions,
} from "./types";

export const ResourceServer = createPart(
  "ResourceServer",
  [Application],
  ([application]) => {
    let initialized = false;
    const adapters: ResourceServerAdapter[] = [];
    const endpoints: ResourceEndpoint[] = [];

    return {
      start: application.start.on("ResourceServer.start", () => {
        initialized = true;
        for (const adapter of adapters) {
          for (const endpoint of endpoints) {
            adapter.addEndpoint(endpoint);
          }
          adapter.start();
        }
      }),

      createAdapter: (
        adapter: ResourceServerAdapter
      ): ResourceServerAdapter => {
        adapters.push(adapter);
        return adapter;
      },

      createEndpoint: <T extends ResourceEndpoint>(endpoint: T): T => {
        endpoints.push(endpoint);
        if (initialized) {
          for (const adapter of adapters) {
            adapter.addEndpoint(endpoint);
          }
        }
        return endpoint;
      },

      createQuery: <Input, Output>(
        query: QueryOperationOptions<Input, Output>
      ): QueryOperation<Input, Output> => {
        return { ...query, type: "query" };
      },

      createMutation: <Input, Output>(
        query: MutationOperationOptions<Input, Output>
      ): MutationOperation<Input, Output> => {
        return { ...query, type: "mutation" };
      },

      createSubscription: <Input, Output>(
        query: SubscriptionOperationOptions<Input, Output>
      ): SubscriptionOperation<Input, Output> => {
        return { ...query, type: "subscription" };
      },

      generateClients: async (): Promise<void> => {
        for (const adapter of adapters) {
          await adapter.generateClient?.();
        }
      },
    };
  }
);
