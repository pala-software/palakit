import type { Field } from "./Field";
import type { Context } from "./Context";
import type { Operation } from "./Operation";

export type Collection<T extends Context> = {
  fields: Record<string, Field<T>>;
  operations?: Record<string, Operation>;
};
