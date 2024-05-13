import type {
  DeepPartial,
  MergeExclusive,
  MergeInclusive,
  MergeTwoExclusive,
  MergeTwoInclusive,
} from "./utils";

export type Plugin = {
  name: string;
  dependencies: Plugin[];
  factory: (input: any) => any;
};

export type ContextFromInclusive<Plugins extends Plugin[]> = MergeInclusive<{
  [K in keyof Plugins]: Plugins[K] extends {
    factory: (
      input: infer In extends Record<string, unknown>
    ) => infer Out extends Record<string, unknown>;
  }
    ? MergeTwoInclusive<In, Out>
    : never;
}>;

export type ContextFromExclusive<Plugins extends Plugin[]> = MergeExclusive<{
  [K in keyof Plugins]: Plugins[K] extends {
    factory: (
      input: infer In extends Record<string, unknown>
    ) => infer Out extends Record<string, unknown>;
  }
    ? MergeTwoExclusive<In, Out>
    : never;
}>;

const createPluginBuilder = <Dependencies extends Plugin[]>(
  dependencies: [...Dependencies]
) => ({
  dependencies,
  with<P extends Plugin>(plugin: P) {
    return createPluginBuilder([...this.dependencies, plugin]);
  },
  build<Output extends DeepPartial<ContextFromInclusive<Dependencies>>>(
    name: string,
    factory: (input: ContextFromExclusive<Dependencies>) => Output = () =>
      ({} as Output)
  ) {
    return {
      name,
      dependencies: this.dependencies,
      factory,
    } as const;
  },
});

export const Plugin = {
  with: <P extends Plugin>(plugin: P) => createPluginBuilder([plugin]),
  build: <Output extends Record<string, unknown>>(
    name: string,
    factory: (input: {}) => Output = () => ({} as Output)
  ) => createPluginBuilder([]).build(name, factory),
} as const;
