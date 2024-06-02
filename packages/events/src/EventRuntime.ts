import { EventBus } from "./EventBus";
import { createPart, Function, Runtime, Trigger } from "@pala/core";

export const EventRuntime = createPart(Runtime, [EventBus], ([eventBus]) => {
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();
  const encode = (payload: unknown) =>
    textEncoder.encode(JSON.stringify(payload));
  const decode = (payload: Uint8Array) =>
    JSON.parse(textDecoder.decode(new Uint8Array(payload)));

  const createFunction = <Arguments extends unknown[], Return>(
    functionName: string,
    fn: (...args: Arguments) => Return
  ): Function<Arguments, Return> => {
    const beforeHooks: Function<Arguments, Arguments>[] = [];
    const afterHooks: Function<[Awaited<Return>, ...Arguments], Return>[] = [];

    eventBus.subscribe({
      subject: functionName,
      callback: async (payload) => {
        if (!payload) return;
        let [{ replySubject }, ...args] = decode(payload);
        for (const hook of beforeHooks) {
          args = await hook(...args);
        }
        let value = await fn(...args);
        for (const hook of afterHooks) {
          value = await hook(value, ...args);
        }
        eventBus.publish({
          subject: replySubject,
          payload: value !== undefined ? encode(value) : undefined,
        });
      },
    });

    return Object.assign(
      (...args: Arguments) =>
        new Promise<Awaited<Return>>(async (resolve) => {
          const replySubject = crypto.randomUUID();
          const { unsubscribe } = await eventBus.subscribe({
            subject: replySubject,
            callback: (payload) => {
              unsubscribe();
              resolve(
                payload !== undefined && payload.length > 0
                  ? decode(payload)
                  : undefined
              );
            },
          });
          eventBus.publish({
            subject: functionName,
            payload: encode([{ replySubject }, ...args]),
          });
        }),
      {
        before: (
          hookName: string,
          hook: (...args: Arguments) => Arguments | Promise<Arguments>
        ) => {
          const fn = createFunction(hookName, hook);
          beforeHooks.push(fn);
          return fn;
        },
        after: (
          hookName: string,
          hook: (value: Awaited<Return>, ...args: Arguments) => Return
        ) => {
          const fn = createFunction(hookName, hook);
          afterHooks.push(fn);
          return fn;
        },
      }
    );
  };

  const createTrigger = <Arguments extends unknown[] = []>(
    triggerName: string
  ): Trigger<Arguments> =>
    Object.assign(
      (...args: Arguments) =>
        eventBus.publish({
          subject: triggerName,
          payload: encode(args),
        }),
      {
        on: (
          listenerName: string,
          listener: (...args: Arguments) => void | Promise<void>
        ): Function<Arguments, void> => {
          const fn = createFunction(listenerName, listener);
          eventBus
            .subscribe({
              subject: triggerName,
              queueGroup: listenerName,
              callback: (payload) => {
                fn(
                  ...(payload !== undefined && payload.length > 0
                    ? decode(payload)
                    : [])
                );
              },
            })
            .then((subscription) => subscription.unsubscribe);
          return fn;
        },
      }
    );

  return {
    createFunction,
    createTrigger,
  };
});
