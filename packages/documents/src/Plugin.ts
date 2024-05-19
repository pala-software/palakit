import { Plugin } from "@pala/core";
import { DocumentsPluginContext } from "./Context";

export const DocumentsPlugin =
  Plugin.build<DocumentsPluginContext>("DocumentsPlugin");
