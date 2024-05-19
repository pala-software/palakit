import { Plugin } from "@pala/core";
import { DocumentsPlugin } from "@pala/documents";
import type { KyselyPluginContext } from "./Context";

export const KyselyPlugin = Plugin.withDependency(DocumentsPlugin)
  .withOutputType<KyselyPluginContext>()
  .build("KyselyPlugin", (input) => ({ ...input, collections: [] }));
