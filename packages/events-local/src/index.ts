import { createPart, EventBus } from "@pala/core";

export const LocalEventBus = createPart(EventBus, [], () => {
  const eventSubscriptions: Record<string, ((payload?: Uint8Array) => void)[]> =
    {};
  const queueSubscriptions: Record<
    string,
    Record<string, (payload?: Uint8Array) => void>
  > = {};

  return {
    publish: (options) => {
      for (const fn of eventSubscriptions[options.subject] ?? []) {
        fn(options.payload);
      }
      for (const fn of Object.values(
        queueSubscriptions[options.subject] ?? {}
      )) {
        fn(options.payload);
      }
    },
    subscribe: async (options) => {
      if (options.queueGroup) {
        if (!queueSubscriptions[options.subject]) {
          queueSubscriptions[options.subject] = {};
        }
        queueSubscriptions[options.subject][options.queueGroup] =
          options.callback;
        return {
          unsubscribe: () => {
            if (
              options.queueGroup &&
              queueSubscriptions[options.subject][options.queueGroup] ===
                options.callback
            ) {
              delete queueSubscriptions[options.subject][options.queueGroup];
            }
          },
        };
      } else {
        if (!eventSubscriptions[options.subject]) {
          eventSubscriptions[options.subject] = [];
        }
        eventSubscriptions[options.subject].push(options.callback);
        return {
          unsubscribe: () => {
            eventSubscriptions[options.subject] = eventSubscriptions[
              options.subject
            ].filter((subscription) => subscription !== options.callback);
          },
        };
      }
    },
  };
});
