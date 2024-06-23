import { createPart } from "@pala/core";
import {
  MutationOperation,
  Operation,
  QueryOperation,
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

export type Options = {
  port: number;
};

export const createTrpcResourceServer = (options: Options) =>
  createPart("TrpcServer", [ResourceServer], ([server]) => {
    const t = initTRPC.create();
    const routers: Record<string, AnyRouter> = {};

    const executeOperation = async <Input, Output>({
      operation,
      input,
    }: {
      operation: Operation<Input, Output>;
      input: Input;
    }): Promise<Output> => {
      const { response } = await operation.handler({ input });
      if (response.type === "error") {
        throw response.data;
      } else {
        return response.data;
      }
    };

    const createValidator =
      <Input>(validate: (input: Input) => boolean | string) =>
      (input: Input) => {
        const result = validate(input);
        if (result === true) {
          return input;
        } else if (result === false) {
          throw new Error("Validation failed");
        } else {
          throw new Error(result);
        }
      };

    const createProcedureBuilder = (operation: Operation) => {
      let procedure = t.procedure;
      if (operation.validateInput) {
        procedure = procedure.input(createValidator(operation.validateInput));
      }
      if (operation.validateOutput) {
        procedure = procedure.input(createValidator(operation.validateOutput));
      }
      return procedure;
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
        const observe = await executeOperation({ operation, input });
        return observable(observe);
      });

    const createProcedure = (operation: Operation) => {
      if (isQueryOperation(operation)) return createQuery(operation);
      if (isMutationOperation(operation)) return createMutation(operation);
      if (isSubscriptionOperation(operation))
        return createSubscription(operation);
      throw new Error("Invalid operation type encountered");
    };

    return {
      trpcResourceServerAdapter: server.createAdapter({
        addEndpoint: (endpoint) => {
          routers[endpoint.name] = t.router({
            ...Object.fromEntries(
              Object.entries(endpoint.operations)
                .filter(
                  (
                    entry
                  ): entry is [
                    (typeof entry)[0],
                    Exclude<(typeof entry)[1], undefined>
                  ] => entry[1] !== undefined
                )
                .map(([name, operation]) => [name, createProcedure(operation)])
            ),
          });
        },

        start: () => {
          const wss = new WebSocket.Server({ port: options.port });
          applyWSSHandler({ wss, router: t.router(routers) });
        },
      }),
    };
  });
