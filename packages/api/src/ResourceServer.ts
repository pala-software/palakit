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
import { Schema } from "@typeschema/main";

export const ResourceServer = createPart(
  "ResourceServer",
  [Application],
  ([application]) => {
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

      createQuery: <
        InputSchema extends Schema | null,
        OutputSchema extends Schema | null,
      >(
        query: QueryOperationOptions<InputSchema, OutputSchema>
      ): QueryOperation<InputSchema, OutputSchema> => {
        return { ...query, type: "query" };
      },

      createMutation: <
        InputSchema extends Schema | null,
        OutputSchema extends Schema | null,
      >(
        query: MutationOperationOptions<InputSchema, OutputSchema>
      ): MutationOperation<InputSchema, OutputSchema> => {
        return { ...query, type: "mutation" };
      },

      createSubscription: <
        InputSchema extends Schema | null,
        OutputSchema extends Schema | null,
      >(
        query: SubscriptionOperationOptions<InputSchema, OutputSchema>
      ): SubscriptionOperation<InputSchema, OutputSchema> => {
        return { ...query, type: "subscription" };
      },

      generateClients: async (): Promise<void> => {
        initialize();
        for (const adapter of adapters) {
          await adapter.generateClient?.();
        }
      },
    };
  }
);
