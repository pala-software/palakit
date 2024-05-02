import type { Context } from "./Context";

export type Field<T extends Context<any>> = {
  type: keyof NonNullable<T["fieldTypes"]>;
};
