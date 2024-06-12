import { createPart } from "part-di";

type FieldBase = {
  nullable?: boolean;
  unique?: boolean;
};

export type TextField = FieldBase & {
  type: "text";
};

export type NumberField = FieldBase & {
  type: "number";
};

export type BooleanField = FieldBase & {
  type: "boolean";
};

export type Field = TextField | NumberField | BooleanField;

export type Document<T extends Collection> = T extends Collection<infer Shape>
  ? { id: string } & Shape & {
        update: (values: Partial<Shape>) => Promise<void>;
        delete: () => Promise<void>;
      }
  : never;

export type Where<T extends Collection> = {
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
    : {});
} & { and?: Where<T>[]; or?: Where<T>[] };

export type SortingRule<T extends Collection> = T extends Collection<
  infer Shape
>
  ? [keyof Shape extends string ? keyof Shape : never, "ASC" | "DESC"]
  : never;

export type Collection<Shape extends Record<string, any> = any> = {
  create: (values: Shape) => Promise<Document<Collection<Shape>>>;
  find: (options?: {
    where?: Where<Collection<Shape>>;
    order?: SortingRule<Collection<Shape>>[];
    limit?: number;
    offset?: number;
  }) => Promise<Document<Collection<Shape>>[]>;
  count: (options?: { where?: Where<Collection<Shape>> }) => Promise<number>;
};

export type DocumentStore = {
  createCollection: <Fields extends Record<string, Field>>(options: {
    name: string;
    fields: Fields;
  }) => Collection<{
    [K in keyof Fields]: Fields[K] extends TextField
      ? string
      : Fields[K] extends NumberField
      ? number
      : Fields[K] extends BooleanField
      ? boolean
      : never;
  }>;
};

export const DocumentStore = createPart<DocumentStore>("DocumentStore");
