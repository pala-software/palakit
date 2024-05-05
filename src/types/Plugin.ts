import type {
  DeepMergeBuiltInMetaData,
  DeepMergeHKT,
  DeepMergeMergeFunctionsDefaultURIs,
} from "deepmerge-ts";
import type { Context } from "./Context";

export type Plugin<
  T1 extends Context = Context,
  T2 extends Context<T1> = Context<T1>
> = () =>
  | DeepMergeHKT<
      [T1, T2],
      DeepMergeMergeFunctionsDefaultURIs,
      DeepMergeBuiltInMetaData
    >
  | Promise<
      DeepMergeHKT<
        [T1, T2],
        DeepMergeMergeFunctionsDefaultURIs,
        DeepMergeBuiltInMetaData
      >
    >;

export const createPlugin = <T1 extends Context, T2 extends Context<T1>>(
  plugin: Plugin<T1, T2>
): Plugin<T1, T2> => plugin;
