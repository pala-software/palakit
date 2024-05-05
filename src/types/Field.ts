import type { Context } from "./Context";

export type Field<T extends Context> = {
  type: keyof T["fieldTypes"];
};
