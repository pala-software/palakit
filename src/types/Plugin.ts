import type { Context } from "./Context";

export type Plugin<T extends Context<any>> = () => T | Promise<T>;

export const createPlugin = <T1 extends Context<any>, T2 extends Context<T1>>(
  plugin: Plugin<T2>
): Plugin<T2> => plugin;
