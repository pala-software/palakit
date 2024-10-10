import { createPart } from "part-di";
import { Runtime, Function, Trigger } from "./Runtime";

export const LocalRuntime = createPart(Runtime, [], () => {
  const createFunction = <Arguments extends unknown[], Return>(
    _functionName: string,
    fn: (...args: Arguments) => Return,
  ): Function<Arguments, Return> => {
    const beforeHooks: Function<Arguments, Arguments>[] = [];
    const afterHooks: Function<[Awaited<Return>, ...Arguments], Return>[] = [];

    return Object.assign(
      async (...args: Arguments): Promise<Awaited<Return>> => {
        for (const hook of beforeHooks) {
          args = await hook(...args);
        }
        let value = await fn(...args);
        for (const hook of afterHooks) {
          value = await hook(value, ...args);
        }
        return value;
      },
      {
        before: (
          hookName: string,
          hook: (...args: Arguments) => Arguments | Promise<Arguments>,
        ) => {
          const fn = createFunction(hookName, hook);
          beforeHooks.push(fn);
          return fn;
        },
        after: (
          hookName: string,
          hook: (
            value: Awaited<Return>,
            ...args: Arguments
          ) => Awaited<Return> | Promise<Return>,
        ) => {
          const fn = createFunction(hookName, hook);
          afterHooks.push(fn);
          return fn;
        },
      },
    );
  };

  const createTrigger = <
    Arguments extends unknown[] = [],
  >(): Trigger<Arguments> => {
    const listeners: Function<Arguments, void>[] = [];

    return Object.assign(
      (...args: Arguments) => {
        for (const listener of listeners) {
          listener(...args);
        }
      },
      {
        on: (
          listenerName: string,
          listener: (...args: Arguments) => void | Promise<void>,
        ): Function<Arguments, void> => {
          const fn = createFunction(listenerName, listener);
          listeners.push(fn);
          return fn;
        },
      },
    );
  };

  return {
    createFunction,
    createTrigger,
  };
});
