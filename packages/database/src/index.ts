import { createPart, createRegistry } from "@pala/core";

const fieldTypes = {
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

export type Collection = {
  name: string;
  fields: {
    name: string;
    type: keyof typeof fieldTypes;
  }[];
};

export const DatabasePlugin = createPart("DatabasePlugin", [], () => ({
  collections: createRegistry((collection: Collection) => collection),
}));
