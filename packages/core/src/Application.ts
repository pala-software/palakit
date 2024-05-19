import type { ContextFromExclusive, Plugin } from "./Plugin";

const merge = (a: any, b: any) => {
  if (a && b && typeof a === "object" && typeof b === "object") {
    const result: Record<string, unknown> = {};
    for (const key of [...Object.keys(a), ...Object.keys(b)]) {
      if (key in a && key in b) {
        result[key] = merge(a[key], b[key]);
      } else if (key in a) {
        result[key] = a[key];
      } else {
        result[key] = b[key];
      }
    }
    return result;
  } else {
    return b;
  }
};

const checkDependencies = (plugins: Plugin[], dependencies: Plugin[]): void => {
  for (const plugin of dependencies) {
    if (!plugins.includes(plugin)) {
      throw new Error("Dependency missing: " + plugin.name);
    }
    checkDependencies(plugins, plugin.dependencies);
  }
};

export const createApplication = async <Plugins extends Plugin[]>(
  plugins: [...Plugins]
): Promise<ContextFromExclusive<Plugins>> => {
  checkDependencies(plugins, plugins);
  let context: any = {};
  for (const plugin of plugins ?? []) {
    context = merge(context, await plugin.factory(context));
  }
  return context;
};
