import { Schema } from "@typeschema/main";
import { createPart } from "@palakit/core";

export enum DataType {
  STRING,
  BOOLEAN,
  INTEGER,
  FLOAT,
  DATE,
  BLOB,
  ARRAY,
  OBJECT,
  JSON,
  REFERENCE,
}

type BaseField = {
  dataType: DataType;
  schema?: Schema;
  nullable?: boolean;
  unique?: boolean;
};

export type StringField = BaseField & {
  dataType: DataType.STRING;

  /** @default unlimited */
  length?: number;
};

export type BooleanField = BaseField & {
  dataType: DataType.BOOLEAN;
};

export type IntegerField = BaseField & {
  dataType: DataType.INTEGER;

  /** @default 32 */
  size?: 8 | 16 | 24 | 32 | 64;
};

export type FloatField = BaseField & {
  dataType: DataType.FLOAT;

  /** @default 32 */
  size?: 32 | 64;
};

export type DateField = BaseField & {
  dataType: DataType.DATE;
};

export type BlobField = BaseField & {
  dataType: DataType.BLOB;
};

export type ReferenceField = BaseField & {
  dataType: DataType.REFERENCE;
  targetCollection: Collection;
};

export type Field =
  | StringField
  | BooleanField
  | IntegerField
  | FloatField
  | DateField
  | BlobField
  | ReferenceField;

export type Shape = Record<string, unknown>;

export type ShapeOf<T extends Collection> =
  T extends Collection<infer Shape> ? Shape : never;

export type Document<T extends Shape> = {
  id: string;
} & T;

export type DocumentHandle<T extends Shape> = {
  get: () => Promise<Document<T>>;
  update: (values: Partial<T>) => Promise<void>;
  delete: () => Promise<void>;
};

export type Where<T extends Shape> = {
  [K in keyof Document<T>]?: {
    equals?: Document<T>[K];
    notEquals?: Document<T>[K];
    is?: null;
    isNot?: null;
    in?: Document<T>[K][];
    notIn?: Document<T>[K][];
  } & (Document<T>[K] extends string
    ? { like?: string; notLike?: string }
    : Document<T>[K] extends number
      ? {
          gt?: number;
          gte?: number;
          lt?: number;
          lte?: number;
        }
      : object);
} & { and?: Where<T>[]; or?: Where<T>[] };

export type SortingRule<T extends Shape> = [
  keyof Document<T> extends string ? keyof Document<T> : never,
  "ASC" | "DESC",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Collection<T extends Shape = any> = {
  create: (values: T) => Promise<DocumentHandle<T>>;
  find: (options?: {
    where?: Where<T>;
    order?: SortingRule<T>[];
    limit?: number;
    offset?: number;
  }) => Promise<DocumentHandle<T>[]>;
  count: (options?: { where?: Where<T> }) => Promise<number>;
};

type TypeOfField<T extends Field> = T extends StringField | ReferenceField
  ? string
  : T extends BooleanField
    ? boolean
    : T extends IntegerField | FloatField
      ? number
      : T extends DateField
        ? Date
        : T extends BlobField
          ? Buffer
          : never;

type NonNullableFieldKey<T extends Record<string, Field>> = {
  [K in keyof T]: T[K]["nullable"] extends false ? K : never;
}[keyof T];

type NullableFieldKey<T extends Record<string, Field>> = Exclude<
  keyof T,
  NonNullableFieldKey<T>
>;

export type DocumentStore = {
  connect: () => Promise<void> | void;
  createCollection: <Fields extends Record<string, Field>>(options: {
    name: string;
    fields: Fields;
  }) => Collection<
    {
      [K in NonNullableFieldKey<Fields>]: TypeOfField<Fields[K]>;
    } & {
      [K in NullableFieldKey<Fields>]?: TypeOfField<Fields[K]>;
    }
  >;
};

export const DocumentStore = createPart<DocumentStore>("DocumentStore");
