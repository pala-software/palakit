import type {
  ContextFromExclusive,
  ContextFromInclusive,
  Plugin,
} from "./Plugin";
import { MergeTwoExclusive } from "./utils";

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

export const createApplication = <
  Plugins extends Plugin[],
  Override extends ContextFromInclusive<Plugins>
>(
  plugins: [...Plugins],
  override: Override
): MergeTwoExclusive<ContextFromExclusive<Plugins>, Override> => {
  checkDependencies(plugins, plugins);
  let context: any = {};
  for (const plugin of plugins ?? []) {
    context = plugin.factory(context);
  }
  return merge(context, override);
};
