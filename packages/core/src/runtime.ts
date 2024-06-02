import { createPart, Part, resolvePart } from "part-di";
import { EventBus } from "./eventBus";

const RuntimeConfiguration = createPart<{ appName: string }>(
  "RuntimeConfiguration"
);

export const Runtime = createPart(
  "Runtime",
  [RuntimeConfiguration, EventBus],
  ([config, eventBus]) => {
    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();
    const encode = (payload: unknown) =>
      textEncoder.encode(JSON.stringify(payload));
    const decode = (payload: Uint8Array) =>
      JSON.parse(textDecoder.decode(new Uint8Array(payload)));

    const createTrigger = <Arguments extends unknown[] = []>(
      eventName: string
    ) =>
      Object.assign(
        (...args: Arguments) =>
          eventBus.publish({
            subject: eventName,
            payload: encode(args),
          }),
        {
          on: (
            listenerName: string,
            fn: (...args: Arguments) => Promise<void> | void
          ) =>
            eventBus.subscribe({
              subject: eventName,
              queueGroup: listenerName,
              callback: (payload) => {
                fn(...(payload ? decode(payload) : []));
              },
            }),
        }
      );

    const createFunction = <Arguments extends unknown[], Return>(
      functionName: string,
      fn: (...args: Arguments) => Return
    ) => {
      const trigger = createTrigger<[{ replySubject: string }, ...Arguments]>(
        functionName + ".call"
      );
      const beforeHooks: ((
        ...args: Arguments
      ) => Promise<Arguments> | Arguments)[] = [];
      const afterHooks: ((
        value: Return,
        ...args: Arguments
      ) => Promise<Return> | Return)[] = [];

      trigger.on(functionName, async ({ replySubject }, ...args) => {
        for (const hook of beforeHooks) {
          args = await hook(...args);
        }
        let value = await fn(...args);
        for (const hook of afterHooks) {
          value = await hook(value, ...args);
        }
        eventBus.publish({ subject: replySubject, payload: encode(args) });
      });

      return Object.assign(
        (...args: Arguments) =>
          new Promise<Awaited<Return>>((resolve) => {
            const replySubject = crypto.randomUUID();
            eventBus.subscribe({
              subject: replySubject,
              callback: (payload) =>
                resolve(payload ? decode(payload) : undefined),
            });
            trigger({ replySubject }, ...args);
          }),
        {
          before: (
            hookName: string,
            fn: (...args: Arguments) => Promise<Arguments> | Arguments
          ) => beforeHooks.push(createFunction(hookName, fn)),
          after: (
            hookName: string,
            fn: (value: Return, ...args: Arguments) => Promise<Return> | Return
          ) => afterHooks.push(createFunction(hookName, fn)),
        }
      );
    };

    return {
      appName: config.appName,
      init: createTrigger("runtime.init"),
      createTrigger,
      createFunction,
    };
  }
);

export type RuntimeOptions = {
  appName: string;
  parts: Part[];
};

export const resolveRuntime = (options: RuntimeOptions) =>
  resolvePart(
    createPart(
      "RuntimeResolver",
      [Runtime, ...options.parts],
      ([runtime]) => runtime
    ),
    [
      createPart(RuntimeConfiguration, [], () => ({
        appName: options.appName,
      })),
      ...options.parts,
    ]
  );
