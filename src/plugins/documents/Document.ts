import { DocumentsPluginContext } from "./Context";

export type Document<
  T extends DocumentsPluginContext,
  K extends keyof NonNullable<T["collections"]>
> = {
  [F in keyof NonNullable<T["collections"]>[K]["fields"]]: ReturnType<
    NonNullable<T["collections"]>[K]["fields"][F]["valueType"]
  >;
};
