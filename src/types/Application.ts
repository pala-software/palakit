import type { Context } from "./Context";
import type { Plugin } from "./Plugin";
import {
  DeepMergeBuiltInMetaData,
  DeepMergeHKT,
  DeepMergeMergeFunctionsDefaultURIs,
  deepmerge,
} from "deepmerge-ts";

export const createApplication = async <
  T1 extends Context,
  T2 extends Plugins extends [
    Plugin<infer P, infer P>,
    ...Plugin<infer P, infer P>[]
  ]
    ? Context<T1 & P>
    : Context<T1>,
  Plugins extends Plugin[] = []
>(
  application: DeepMergeHKT<
    [T1, T2],
    DeepMergeMergeFunctionsDefaultURIs,
    DeepMergeBuiltInMetaData
  >,
  plugins?: [...Plugins]
) => {
  return deepmerge(
    ...((await Promise.all(plugins?.map((plugin) => plugin()) ?? [])) as {
      [K in keyof Plugins]: Awaited<ReturnType<Plugins[K]>>;
    }),
    application
  );
};
