import type { Field } from "./Field";
import type { Operation } from "./Operation";

export type Collection = {
  name: string;
  fields: Field[];
  operations?: Operation[];
};
