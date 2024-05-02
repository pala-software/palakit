import type { Context } from "./Context";
import type { Plugin } from "./Plugin";
import { deepmerge } from "deepmerge-ts";

export const createApplication = async <
  Plugins extends Plugin<any>[],
  T1 extends Context<Awaited<ReturnType<Plugins[number]>>>
>(
  application: {
    plugins?: [...Plugins];
  } & T1
) => {
  const { plugins = [], ...context } = application;
  return deepmerge(
    ...((await Promise.all((plugins as Plugins).map((plugin) => plugin()))) as {
      [K in keyof Plugins]: Awaited<ReturnType<Plugins[K]>>;
    }),
    context
  );
};
