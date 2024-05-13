import { Plugin } from "../../core/Plugin";
import { DocumentsPluginContext } from "./Context";

export const DocumentsPlugin =
  Plugin.build<DocumentsPluginContext>("DocumentsPlugin");
