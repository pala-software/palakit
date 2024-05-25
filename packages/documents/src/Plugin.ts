import { Plugin } from "@pala/core";
import { DocumentsPluginContext } from "./Context";

export const DocumentsPlugin =
  Plugin.withOutputType<DocumentsPluginContext>().build(
    "DocumentsPlugin",
    (input) => ({ ...input, collections: {} })
  );
