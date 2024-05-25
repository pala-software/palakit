import type { Collection } from "./Collection";

export type DocumentsPluginContext = {
  collections: Record<string, Collection>;
};
