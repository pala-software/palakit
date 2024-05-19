import type { Collection } from "./Collection";
import type { FieldType } from "./FieldType";

export type DocumentsPluginContext = {
  collections?: Record<string, Collection>;
};
