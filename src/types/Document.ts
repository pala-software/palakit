import type { Context } from "./Context";

export type Document<T extends Context, K extends keyof T["collections"]> = {
  [F in keyof NonNullable<T["collections"]>[K]["fields"]]: ReturnType<
    NonNullable<T["fieldTypes"]>[Extract<
      NonNullable<T["collections"]>[K]["fields"][F]["type"],
      string
    >]["valueType"]
  >;
};
