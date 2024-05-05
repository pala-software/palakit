import type { Collection } from "./Collection";
import type { FieldType } from "./FieldType";

export interface Context<T extends Context<any> = any> {
  fieldTypes: Record<string, FieldType>;
  collections: Record<string, Collection<T>>;
}
