import { Schema } from "@typeschema/main";
import { createPart } from "part-di";

export enum DataType {
  STRING,
  BOOLEAN,
  INTEGER,
  FLOAT,
  BLOB,
}

type BaseField = {
  dataType: DataType;
  schema?: Schema;
  nullable?: boolean;
  unique?: boolean;
};

export type StringField = BaseField & {
  dataType: DataType.STRING;

  /**
   * @default unlimited
   */
  length?: number;
};

export type BooleanField = BaseField & {
  dataType: DataType.BOOLEAN;
};

export type IntegerField = BaseField & {
  dataType: DataType.INTEGER;

  /**
   * @default 32
   */
  size?: 8 | 16 | 24 | 32 | 64;
};

export type FloatField = BaseField & {
  dataType: DataType.FLOAT;

  /**
   * @default 32
   */
  size?: 32 | 64;
};

export type BlobField = BaseField & {
  dataType: DataType.BLOB;
};

export type Field =
  | StringField
  | BooleanField
  | IntegerField
  | FloatField
  | BlobField;

export type ShapeOf<T extends Collection> =
  T extends Collection<infer Shape> ? Shape : never;

export type Document<T extends Collection> = { id: string } & ShapeOf<T>;

export type DocumentHandle<T extends Collection> = {
  get: () => Promise<Document<T>>;
  update: (values: Partial<ShapeOf<T>>) => Promise<void>;
  delete: () => Promise<void>;
};

export type Where<T extends Collection> = {
  [K in keyof ShapeOf<T>]?: {
    equals?: ShapeOf<T>[K];
    notEquals?: ShapeOf<T>[K];
    is?: null;
    isNot?: null;
    in?: ShapeOf<T>[K][];
    notIn?: ShapeOf<T>[K][];
  } & (ShapeOf<T>[K] extends string
    ? { like?: string; notLike?: string }
    : ShapeOf<T>[K] extends number
      ? {
          gt?: number;
          gte?: number;
          lt?: number;
          lte?: number;
        }
      : {});
} & { and?: Where<T>[]; or?: Where<T>[] };

export type SortingRule<T extends Collection> = [
  keyof ShapeOf<T> extends string ? keyof ShapeOf<T> : never,
  "ASC" | "DESC",
];

export type Collection<Shape extends Record<string, any> = any> = {
  create: (values: Shape) => Promise<DocumentHandle<Collection<Shape>>>;
  find: (options?: {
    where?: Where<Collection<Shape>>;
    order?: SortingRule<Collection<Shape>>[];
    limit?: number;
    offset?: number;
  }) => Promise<DocumentHandle<Collection<Shape>>[]>;
  count: (options?: { where?: Where<Collection<Shape>> }) => Promise<number>;
};

export type DocumentStore = {
  createCollection: <Fields extends Record<string, Field>>(options: {
    name: string;
    fields: Fields;
  }) => Collection<{
    [K in keyof Fields]: Fields[K] extends StringField
      ? string
      : Fields[K] extends BooleanField
        ? boolean
        : Fields[K] extends IntegerField | FloatField
          ? number
          : Fields[K] extends BlobField
            ? Buffer
            : never;
  }>;
};

export const DocumentStore = createPart<DocumentStore>("DocumentStore");
