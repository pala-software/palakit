import { createRegistry } from "./registry";

export const createFunction = <Arguments extends unknown[], Return>(
  fn: (...args: Arguments) => Return
) => {
  const beforeHook = createRegistry(
    (fn: (...args: Arguments) => Promise<Arguments> | Arguments) => fn
  );
  const afterHook = createRegistry(
    (fn: (value: Return, ...args: Arguments) => Promise<Return> | Return) => fn
  );
  return Object.assign(
    async (...args: Arguments): Promise<Awaited<Return>> => {
      for (const hook of beforeHook.registry) {
        args = await hook(...args);
      }
      let value = await fn(...args);
      for (const hook of afterHook.registry) {
        value = await hook(value, ...args);
      }
      return value;
    },
    {
      before: (fn: (...args: Arguments) => Promise<Arguments> | Arguments) =>
        beforeHook.register(createFunction(fn)),
      after: (
        fn: (value: Return, ...args: Arguments) => Promise<Return> | Return
      ) => afterHook.register(createFunction(fn)),
    }
  );
};
