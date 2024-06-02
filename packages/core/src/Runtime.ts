import { createPart } from "part-di";

export type Function<Arguments extends unknown[], Return> = ((
  ...args: Arguments
) => Promise<Awaited<Return>>) & {
  before: (
    hookName: string,
    hook: (...args: Arguments) => Arguments | Promise<Arguments>
  ) => Function<Arguments, Arguments>;
  after: (
    hookName: string,
    hook: (value: Awaited<Return>, ...args: Arguments) => Return
  ) => Function<[Awaited<Return>, ...Arguments], Return>;
};

export type Trigger<Arguments extends unknown[]> = ((
  ...args: Arguments
) => void) & {
  on: (
    listenerName: string,
    listener: (...args: Arguments) => void | Promise<void>
  ) => Function<Arguments, void>;
};

export type Runtime = {
  createFunction: <Arguments extends unknown[], Return>(
    functionName: string,
    fn: (...args: Arguments) => Return
  ) => Function<Arguments, Return>;

  createTrigger: <Arguments extends unknown[] = []>(
    triggerName: string
  ) => Trigger<Arguments>;
};

export const Runtime = createPart<Runtime>("Runtime");
