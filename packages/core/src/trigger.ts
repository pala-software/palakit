import { createFunction } from "./function";
import { createRegistry } from "./registry";

export const createTrigger = <Arguments extends unknown[] = []>() => {
  const listeners = createRegistry(
    (fn: (...args: Arguments) => Promise<void> | void) => createFunction(fn)
  );
  return Object.assign(
    async (...args: Arguments) => {
      for (const listener of listeners.registry) {
        await listener(...args);
      }
    },
    {
      listeners: listeners.registry,
      on: (fn: (...args: Arguments) => Promise<void> | void) =>
        listeners.register(fn),
    }
  );
};
