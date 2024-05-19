import type {
  Collection,
  DocumentsPluginContext,
  Field,
} from "@pala/documents";

const dataTypes = {
  serial: {
    selectType: Number,
    insertType: Number,
    updateType: Number,
  },
} satisfies Record<
  string,
  {
    selectType: new () => any;
    insertType: new () => any;
    updateType: new () => any;
  }
>;

export type KyselyPluginContext = DocumentsPluginContext & {
  collections: (Collection & {
    fields: (Field & {
      dataType: keyof typeof dataTypes;
    })[];
  })[];
};
