import type {
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
      input: infer Input extends Record<string, unknown>
    ) => infer Output extends Record<string, unknown>;
  }
    ? MergeTwoInclusive<Input, Output>
    : never;
}>;

export type ContextFromExclusive<Plugins extends Plugin[]> = MergeExclusive<{
  [K in keyof Plugins]: Plugins[K] extends {
    factory: (
      input: infer Input extends Record<string, unknown>
    ) => MergeTwoInclusive<any, infer Output extends Record<string, unknown>>;
  }
    ? MergeTwoExclusive<Input, Output>
    : never;
}>;

const createPluginBuilder = <
  Dependencies extends Plugin[],
  OutputType extends ContextFromInclusive<Dependencies>
>(
  dependencies: [...Dependencies]
) => ({
  dependencies,
  withDependency<P extends Plugin>(plugin: P) {
    return createPluginBuilder([...this.dependencies, plugin]);
  },
  withOutputType<O extends OutputType>() {
    return createPluginBuilder<Dependencies, O>(this.dependencies);
  },
  build<Output extends OutputType>(
    name: string,
    factory: (
      input: ContextFromExclusive<Dependencies>
    ) => MergeTwoInclusive<OutputType, Output>
  ) {
    return {
      name,
      dependencies: this.dependencies,
      factory,
    } as const;
  },
});

export const Plugin = {
  withDependency: <P extends Plugin>(plugin: P) =>
    createPluginBuilder([plugin]),
  withOutputType: <OutputType extends Record<string, unknown>>() =>
    createPluginBuilder<[], OutputType>([]),
  build: <Output extends Record<string, unknown>>(
    name: string,
    factory: (input: {}) => Output
  ) => createPluginBuilder([]).build(name, factory),
} as const;
