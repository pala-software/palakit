import {
  MutationOperation,
  QueryOperation,
  Request,
  ResourceSchema,
  ResourceServer,
  Response,
} from "@palakit/api";
import { createPart } from "@palakit/core";
import {
  DataType,
  Field,
  Shape,
  Where,
  SortingRule,
  Collection,
  ShapeOf,
  Document,
} from "@palakit/db";
import { toJSONSchema } from "@typeschema/main";
import { JSONSchema7 } from "json-schema";

type NullableJsonSchema = JSONSchema7 & {
  nullable?: boolean;
};

export type CreateOptions<T extends Shape> = {
  data: T;
};

export type UpdateOptions<T extends Shape> = {
  id: string;
  data: Partial<T>;
};

export type DeleteOptions = {
  id: string;
};

export type FindOptions<T extends Shape> = {
  where?: Where<T>;
  order?: SortingRule<T>[];
  limit?: number;
  offset?: number;
};

export type CountOptions<T extends Shape> = {
  where?: Where<T>;
};

const capitalize = (str: string) =>
  str.length < 1 ? str : str[0].toUpperCase() + str.slice(1);

const schemaFromField = async (field: Field): Promise<NullableJsonSchema> => {
  if (field.schema) {
    return {
      ...(await toJSONSchema(field.schema)),
      nullable: field.nullable,
    };
  }

  switch (field.dataType) {
    case DataType.STRING:
      return {
        type: "string",
        nullable: field.nullable,
        maxLength: field.length,
      };
    case DataType.BOOLEAN:
      return { type: "boolean", nullable: field.nullable };
    case DataType.INTEGER:
      return {
        type: "integer",
        nullable: field.nullable,
      };
    case DataType.FLOAT:
      return { type: "number", nullable: field.nullable };
    case DataType.BLOB:
      // TODO: Support blobs
      return { type: "null", nullable: field.nullable };
    case DataType.DATE:
      // TODO: Support date
      return { type: "null", nullable: field.nullable };
    case DataType.REFERENCE:
      return {
        type: "string",
        nullable: field.nullable,
      };
  }
};

const getSchemas = async <Fields extends Record<string, Field>>({
  name,
  collection,
}: {
  name: string;
  collection: Collection<Fields>;
}) => {
  const fieldSchemas: Record<string, NullableJsonSchema> = Object.fromEntries(
    await Promise.all(
      Object.entries(collection.fields).map(([key, field]) =>
        schemaFromField(field).then((schema) => [key, schema]),
      ),
    ),
  );

  const fieldSchemasWithId: Record<string, NullableJsonSchema> = {
    ...fieldSchemas,
    id: { type: "string", nullable: false },
  };

  const filter = {
    name: capitalize(name) + "Filter",
    schema: {
      type: ["object"],
      additionalProperties: false,
      properties: Object.fromEntries(
        Object.entries(fieldSchemasWithId).map(([key, schema]) => [
          key,
          {
            type: "object",
            additionalProperties: false,
            properties: {
              equals: schema,
              notEquals: schema,
              in: { type: "array", items: schema },
              notIn: { type: "array", items: schema },
              ...(schema.nullable
                ? {
                    is: { type: "null" },
                    isNot: { type: "null" },
                  }
                : undefined),
              ...(schema.type === "string"
                ? {
                    like: schema,
                    notLike: schema,
                  }
                : undefined),
              ...(schema.type === "number" || schema.type === "integer"
                ? {
                    gt: schema,
                    gte: schema,
                    lt: schema,
                    lte: schema,
                  }
                : undefined),
            },
          } satisfies JSONSchema7,
        ]),
      ),
    } satisfies JSONSchema7,
  } satisfies ResourceSchema;

  const value = {
    name: capitalize(name) + "Value",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: fieldSchemas,
      required: Object.entries(fieldSchemas)
        .filter(([, schema]) => !schema.nullable)
        .map(([key]) => key) as {
        [K in keyof typeof fieldSchemas]: (typeof fieldSchemas)[K]["nullable"] extends false
          ? K
          : never;
      }[string][],
    } satisfies JSONSchema7,
  } satisfies ResourceSchema;

  const partialValue = {
    name: "Partial" + capitalize(name) + "Value",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: fieldSchemas,
    } satisfies JSONSchema7,
  } satisfies ResourceSchema;

  const document = {
    name: capitalize(name),
    schema: {
      type: "object",
      additionalProperties: false,
      properties: fieldSchemasWithId,
      required: Object.entries(fieldSchemasWithId)
        .filter(([, schema]) => !schema.nullable)
        .map(([key]) => key) as {
        [K in keyof typeof fieldSchemasWithId]: (typeof fieldSchemasWithId)[K]["nullable"] extends false
          ? K
          : never;
      }[string][],
    } satisfies JSONSchema7,
  } satisfies ResourceSchema;

  const list = {
    name: capitalize(name) + "List",
    schema: {
      type: "array",
      items: document.schema,
    } satisfies JSONSchema7,
  } satisfies ResourceSchema;

  const count = {
    name: capitalize(name) + "Count",
    schema: {
      type: "integer",
      minimum: 0,
    } satisfies JSONSchema7,
  } satisfies ResourceSchema;

  const order = {
    name: capitalize(name) + "Order",
    schema: {
      type: "array",
      items: {
        type: "array",
        items: [
          { enum: Object.keys(fieldSchemasWithId) },
          { enum: ["ASC", "DESC"] },
        ],
        minItems: 2,
        maxItems: 2,
      },
    } satisfies JSONSchema7,
  } satisfies ResourceSchema;

  return {
    filter,
    value,
    partialValue,
    document,
    list,
    count,
    order,
  };
};

export const CrudHelper = createPart(
  "CrudHelper",
  [ResourceServer],
  ([server]) => {
    const createCreateOperation = async <Fields extends Record<string, Field>>({
      name,
      collection,
    }: {
      name: string;
      collection: Collection<Fields>;
    }) => {
      const { value, document } = await getSchemas({
        name,
        collection,
      });
      const createOptions = {
        name: capitalize(name) + "CreateOptions",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            data: value.schema,
          },
          required: ["data"],
        } satisfies JSONSchema7,
      } satisfies ResourceSchema;

      return server.createMutation({
        name: `${name}.create`,
        input: createOptions as ResourceSchema,
        output: document as ResourceSchema,
        handler: (async ({
          input,
        }: Request<CreateOptions<ShapeOf<Fields>>>) => {
          const document = await collection.create(input.data);
          return {
            response: {
              type: "ok",
              data: await document.get(),
            },
          };
        }) as (request: Request<unknown>) => Promise<Response<unknown>>,
      }) as MutationOperation<
        CreateOptions<ShapeOf<Fields>>,
        Document<ShapeOf<Fields>>
      >;
    };

    const createUpdateOperation = async <Fields extends Record<string, Field>>({
      name,
      collection,
    }: {
      name: string;
      collection: Collection<Fields>;
    }) => {
      const { partialValue, document } = await getSchemas({
        name,
        collection,
      });
      const updateOptions = {
        name: capitalize(name) + "UpdateOptions",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            data: partialValue.schema,
          },
          required: ["id", "data"] as const,
        } satisfies JSONSchema7,
      } satisfies ResourceSchema;

      return server.createMutation({
        name: `${name}.update`,
        input: updateOptions as ResourceSchema,
        output: document as ResourceSchema,
        handler: (async ({
          input,
        }: Request<UpdateOptions<ShapeOf<Fields>>>) => {
          const [document] = await (collection as Collection).find({
            where: { id: { equals: input.id } },
            limit: 1,
          });
          if (!document) {
            return {
              response: {
                type: "error",
                data: "Not found",
              },
            };
          }
          await document.update(input.data);
          return {
            response: {
              type: "ok",
              data: await document.get(),
            },
          };
        }) as (request: Request<unknown>) => Promise<Response<unknown>>,
      }) as MutationOperation<
        UpdateOptions<ShapeOf<Fields>>,
        Document<ShapeOf<Fields>>
      >;
    };

    const createDeleteOperation = async <Fields extends Record<string, Field>>({
      name,
      collection,
    }: {
      name: string;
      collection: Collection<Fields>;
    }) => {
      const deleteOptions = {
        name: capitalize(name) + "DeleteOptions",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        } satisfies JSONSchema7,
      };

      return server.createMutation({
        name: `${name}.delete`,
        input: deleteOptions as ResourceSchema,
        output: null,
        handler: (async ({ input }: Request<DeleteOptions>) => {
          const [document] = await (collection as Collection).find({
            where: { id: { equals: input.id } },
            limit: 1,
          });
          if (!document) {
            return {
              response: {
                type: "error",
                data: "Not found",
              },
            };
          }
          await document.delete();
          return {
            response: {
              type: "ok",
            },
          };
        }) as (request: Request<unknown>) => Promise<Response<void>>,
      }) as MutationOperation<DeleteOptions, void>;
    };

    const createFindOperation = async <Fields extends Record<string, Field>>({
      name,
      collection,
    }: {
      name: string;
      collection: Collection<Fields>;
    }) => {
      const { filter, order, list } = await getSchemas({ name, collection });
      const findOptions = {
        name: capitalize(name) + "FindOptions",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            where: filter.schema,
            order: order.schema,
            limit: { type: "integer", minimum: 0 },
            offset: { type: "integer", minimum: 0 },
          },
        } satisfies JSONSchema7,
      } satisfies ResourceSchema;

      return server.createQuery({
        name: `${name}.find`,
        input: findOptions as ResourceSchema,
        output: list as ResourceSchema,
        handler: (async ({ input }: Request<FindOptions<ShapeOf<Fields>>>) => {
          const { where, order, limit, offset } = input;
          const documents = await collection.find({
            where,
            order,
            limit,
            offset,
          });
          return {
            response: {
              type: "ok",
              data: await Promise.all(
                documents.map((document) => document.get()),
              ),
            },
          };
        }) as (request: Request<unknown>) => Promise<Response<unknown>>,
      }) as QueryOperation<
        FindOptions<ShapeOf<Fields>>,
        Document<ShapeOf<Fields>>
      >;
    };

    const createCountOperation = async <Fields extends Record<string, Field>>({
      name,
      collection,
    }: {
      name: string;
      collection: Collection<Fields>;
    }) => {
      const { filter, count } = await getSchemas({ name, collection });
      const countOptions = {
        name: capitalize(name) + "CountOptions",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            where: filter.schema,
          },
        } satisfies JSONSchema7,
      } satisfies ResourceSchema;

      return server.createQuery({
        name: `${name}.count`,
        input: countOptions as ResourceSchema,
        output: count as ResourceSchema,
        handler: (async ({ input }: Request<FindOptions<ShapeOf<Fields>>>) => {
          const { where } = input;
          return {
            response: {
              type: "ok",
              data: await collection.count({ where }),
            },
          };
        }) as (request: Request<unknown>) => Promise<Response<unknown>>,
      }) as QueryOperation<
        FindOptions<ShapeOf<Fields>>,
        Document<ShapeOf<Fields>>
      >;
    };

    const createCrudOperations = async <Fields extends Record<string, Field>>({
      name,
      collection,
    }: {
      name: string;
      collection: Collection<Fields>;
    }) => ({
      create: await createCreateOperation({ name, collection }),
      update: await createUpdateOperation({ name, collection }),
      delete: await createDeleteOperation({ name, collection }),
      find: await createFindOperation({ name, collection }),
      count: await createCountOperation({ name, collection }),
    });

    return {
      createCreateOperation,
      createUpdateOperation,
      createDeleteOperation,
      createFindOperation,
      createCountOperation,
      createCrudOperations,
    };
  },
);
