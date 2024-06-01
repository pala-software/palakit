import { createMethod } from "./method";
import { createRegistry } from "./registry";

export const createEvent = <Arguments extends unknown[] = []>() => {
  const listeners = createRegistry(
    (fn: (...args: Arguments) => Promise<void> | void) => createMethod(fn)
  );
  return Object.assign(
    async (...args: Arguments) => {
      for (const listener of listeners.registry) {
        await listener(...args);
      }
    },
    {
      listeners: listeners.registry,
      on: (fn: () => Promise<void> | void) => listeners.register(fn),
    }
  );
};
