import type { Field } from "./Field";
import type { Operation } from "./Operation";

export type Collection = {
  fields: Record<string, Field>;
  operations: Record<string, Operation>;
};
