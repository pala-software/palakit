import type {
  Collection,
  DocumentsPluginContext,
  Field,
} from "@pala/documents";

const dataTypes = {
  smallint: Number,
  integer: Number,
  bigint: Number,
  decimal: Number,
  numeric: Number,
  real: Number,
  double: Number,
  smallserial: Number,
  serial: Number,
  bigserial: Number,
  varchar: String,
  char: String,
  text: String,
  bytea: ArrayBuffer,
  timestamp: Date,
  timestamptz: Date,
  boolean: Boolean,
} satisfies Record<string, (() => any) | (new (...args: any[]) => any)>;

export type KyselyPluginContext = DocumentsPluginContext & {
  collections: Record<
    string,
    Collection & {
      fields: Record<
        string,
        Field & {
          dataType: keyof typeof dataTypes;
        }
      >;
    }
  >;
};
