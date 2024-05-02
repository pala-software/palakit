import type { Field } from "./Field";
import type { Context } from "./Context";

export type Collection<T extends Context<any>> = {
  fields: Record<string, Field<T>>;
};
