import type { Collection } from "./Collection";
import type { FieldType } from "./FieldType";

export interface ContextProperties<T extends Context<any>> {
  fieldTypes: Record<string, FieldType>;
  collections: Record<string, Collection<T>>;
}

export type Context<T extends Context<any>> = ContextProperties<T>;
