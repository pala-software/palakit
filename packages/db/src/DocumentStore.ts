import { Infer, Schema } from "@typeschema/main";
import { createPart, Function } from "@palakit/core";

type BaseField = {
  dataType: string;
  schema?: Schema;
  nullable?: boolean;
  unique?: boolean;
  serialize?: (value: unknown) => unknown | Promise<unknown>;
  deserialize?: (value: unknown) => unknown | Promise<unknown>;
};

export type StringField = BaseField & {
  dataType: "string";

  /** @default unlimited */
  length?: number;
};

export type BooleanField = BaseField & {
  dataType: "boolean";
};

export type IntegerField = BaseField & {
  dataType: "integer";

  /** @default 32 */
  size?: 8 | 16 | 24 | 32 | 64;
};

export type FloatField = BaseField & {
  dataType: "float";

  /** @default 32 */
  size?: 32 | 64;
};

export type DateField = BaseField & {
  dataType: "date";
};

export type BlobField = BaseField & {
  dataType: "blob";
};

export type JsonField = BaseField & {
  dataType: "json";
};

export type ReferenceField = BaseField & {
  dataType: "reference";
  targetCollection: Collection;
};

export type Field =
  | StringField
  | BooleanField
  | IntegerField
  | FloatField
  | DateField
  | BlobField
  | JsonField
  | ReferenceField;

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

type TypeOfField<T extends Field> = T["schema"] extends Schema
  ? Infer<T["schema"]>
  : T extends StringField | ReferenceField
    ? string
    : T extends BooleanField
      ? boolean
      : T extends IntegerField | FloatField
        ? number
        : T extends DateField
          ? Date
          : T extends BlobField
            ? Buffer
            : T extends JsonField
              ? JsonValue
              : never;

type NonNullableFieldKey<T extends Record<string, Field>> = {
  [K in keyof T]: T[K]["nullable"] extends false ? K : never;
}[keyof T];

type NullableFieldKey<T extends Record<string, Field>> = Exclude<
  keyof T,
  NonNullableFieldKey<T>
>;

export type Shape = Record<string, unknown>;

export type ShapeOf<Fields extends Record<string, Field>> = {
  [K in NonNullableFieldKey<Fields>]: TypeOfField<Fields[K]>;
} & {
  [K in NullableFieldKey<Fields>]?: TypeOfField<Fields[K]>;
};

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

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type Collection<Fields extends Record<string, Field> = {}> = {
  name: string;
  fields: Fields;
  addField: <T extends Field, Name extends string>(
    field: T & { name: Name },
  ) => Collection<Omit<Fields, Name> & Record<Name, T>>;
  removeField: <T extends keyof Fields>(name: T) => Collection<Omit<Fields, T>>;
  sync: () => Promise<Collection<Fields>>;
  create: (
    values: ShapeOf<Fields> & { id?: string },
  ) => Promise<DocumentHandle<ShapeOf<Fields>>>;
  find: (options?: {
    where?: Where<ShapeOf<Fields>>;
    order?: SortingRule<ShapeOf<Fields>>[];
    limit?: number;
    offset?: number;
  }) => Promise<DocumentHandle<ShapeOf<Fields>>[]>;
  count: (options?: { where?: Where<ShapeOf<Fields>> }) => Promise<number>;
};

export type DocumentStore = {
  connect: Function<[], void>;
  disconnect: Function<[], void>;
  createCollection: (options: { name: string }) => Collection;
};

export const DocumentStore = createPart<DocumentStore>("DocumentStore");
