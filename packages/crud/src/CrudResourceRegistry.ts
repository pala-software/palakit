import {
  InputFromResourceSchema,
  OutputFromResourceSchema,
  Request,
  ResourceSchema,
  ResourceServer,
  Response,
  TypedMutationOperationOptions,
  TypedQueryOperationOptions,
  TypedSubscriptionOperationOptions,
} from "@palakit/api";
import { createPart, Runtime } from "@palakit/core";
import { DataType, DocumentStore, Field } from "@palakit/db";
import { toJSONSchema } from "@typeschema/main";
import { JSONSchema7 } from "json-schema";

type NullableJsonSchema = JSONSchema7 & { nullable?: boolean };

const capitalize = (str: string) =>
  str.length < 1 ? str : str[0].toUpperCase() + str.slice(1);

const maxInteger = (bits: number) => 2 ** (bits - 1) - 1;

const schemaFromField = async (field: Field): Promise<NullableJsonSchema> => {
  if (field.schema) {
    return { ...(await toJSONSchema(field.schema)), nullable: field.nullable };
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
        ...(field.size && {
          minimum: -maxInteger(field.size),
          maximum: maxInteger(field.size),
        }),
      };
    case DataType.FLOAT:
      return { type: "number", nullable: field.nullable };
    case DataType.BLOB:
      // TODO: Support blobs
      return { type: "null", nullable: field.nullable };
  }
};

type FieldSchema<Fields extends Record<string, Field>> = Record<
  keyof Fields,
  NullableJsonSchema
>;

type FieldSchemaWithId<Fields extends Record<string, Field>> = Record<
  keyof Fields | "id",
  NullableJsonSchema
>;

type DocumentSchema<T extends FieldSchema<Record<string, Field>>> = {
  name: string;
  schema: {
    type: "object";
    additionalProperties: false;
    properties: T;
    required: (keyof T)[];
  };
};

type CreateOptions<T extends Record<string, Field>> = {
  name: string;
  schema: {
    type: "object";
    additionalProperties: false;
    properties: {
      data: DocumentSchema<FieldSchema<T>>["schema"];
    };
    required: string[];
  };
};

export const CrudResourceRegistry = createPart(
  "CrudResourceRegistry",
  [Runtime, DocumentStore, ResourceServer],
  ([runtime, db, server]) => {
    return {
      createResource: runtime.createFunction(
        "CrudResourceRegistry.createResource",
        async <Fields extends Record<string, Field>>({
          name,
          fields,
          requireAuthorization,
          operations = {
            create: true,
            update: true,
            find: true,
            delete: true,
            count: true,
          },
          extraOperations = {},
        }: {
          name: string | { singular: string; plural: string };
          fields: Fields;
          requireAuthorization?: boolean;
          operations?: {
            create?:
              | boolean
              | ((
                  o: Request<OutputFromResourceSchema<CreateOptions<Fields>>>,
                ) => Promise<
                  Response<InputFromResourceSchema<DocumentSchema<Fields>>>
                >);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            update?: boolean | ((o: any) => Promise<any>);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            find?: boolean | ((o: any) => Promise<any>);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete?: boolean | ((o: any) => Promise<any>);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            count?: boolean | ((o: any) => Promise<any>);
          };
          extraOperations?: Record<
            string,
            | TypedQueryOperationOptions
            | TypedMutationOperationOptions
            | TypedSubscriptionOperationOptions
          >;
        }) => {
          let singularName: string;
          let pluralName: string;
          if (typeof name === "string") {
            singularName = name;
            pluralName = name;
          } else {
            singularName = name.singular;
            pluralName = name.plural;
          }

          const fieldSchemas = Object.fromEntries(
            await Promise.all(
              Object.entries(fields).map(([key, field]) =>
                schemaFromField(field).then((schema) => [key, schema]),
              ),
            ),
          ) as FieldSchema<Fields>;
          const fieldSchemasWithId: FieldSchemaWithId<Fields> = {
            ...fieldSchemas,
            id: { type: "string", nullable: false },
          };

          const filterSchema = {
            name: capitalize(singularName) + "Filter",
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
                      ...(schema.nullable && {
                        is: { type: "null" },
                        isNot: { type: "null" },
                      }),
                      ...(schema.type === "string" && {
                        like: schema,
                        notLike: schema,
                      }),
                      ...((schema.type === "number" ||
                        schema.type === "integer") && {
                        gt: schema,
                        gte: schema,
                        lt: schema,
                        lte: schema,
                      }),
                    },
                  } satisfies JSONSchema7,
                ]),
              ),
            } satisfies JSONSchema7,
          } satisfies ResourceSchema;
          const valueSchema = {
            name: capitalize(singularName) + "Value",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: fieldSchemas,
              required: Object.entries(fieldSchemas)
                .filter(([, schema]) => !schema.nullable)
                .map(([key]) => key),
            } satisfies JSONSchema7,
          } satisfies DocumentSchema<FieldSchema<Fields>>;
          const documentSchema = {
            name: capitalize(singularName),
            schema: {
              type: "object",
              additionalProperties: false,
              properties: fieldSchemasWithId,
              required: Object.entries(fieldSchemasWithId)
                .filter(([, schema]) => !schema.nullable)
                .map(([key]) => key),
            } satisfies JSONSchema7,
          } satisfies DocumentSchema<FieldSchemaWithId<Fields>>;
          const partialValueSchema = {
            name: "Partial" + capitalize(singularName) + "Value",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: fieldSchemas,
            } satisfies JSONSchema7,
          } satisfies ResourceSchema;
          const listSchema = {
            name: capitalize(singularName) + "List",
            schema: {
              type: "array",
              items: documentSchema.schema,
            } satisfies JSONSchema7,
          } satisfies ResourceSchema;
          const countSchema = {
            name: capitalize(singularName) + "Count",
            schema: {
              type: "integer",
              minimum: 0,
            } satisfies JSONSchema7,
          } satisfies ResourceSchema;
          const orderSchema = {
            name: capitalize(singularName) + "Order",
            schema: {
              type: "array",
              items: {
                type: "array",
                items: [
                  { enum: Object.keys(fieldSchemasWithId) },
                  { enum: ["ASC", "DESC"] },
                ],
                minItems: 2,
              },
            } satisfies JSONSchema7,
          } satisfies ResourceSchema;

          const createOptions = {
            name: capitalize(singularName) + "CreateOptions",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                data: valueSchema.schema,
                ...(requireAuthorization && {
                  authorization: { type: "string" },
                }),
              },
              required: [
                "data",
                ...(requireAuthorization ? ["authorization"] : []),
              ],
            } satisfies JSONSchema7,
          } satisfies CreateOptions<Fields>;
          const findOptions = {
            name: capitalize(singularName) + "FindOptions",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                where: filterSchema.schema,
                order: orderSchema.schema,
                limit: { type: "integer", minimum: 0 },
                offset: { type: "integer", minimum: 0 },
                ...(requireAuthorization && {
                  authorization: { type: "string" },
                }),
              },
              required: [...(requireAuthorization ? ["authorization"] : [])],
            } satisfies JSONSchema7,
          } satisfies ResourceSchema;
          const updateOptions = {
            name: capitalize(singularName) + "UpdateOptions",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string" },
                data: partialValueSchema.schema,
                ...(requireAuthorization && {
                  authorization: { type: "string" },
                }),
              },
              required: [
                "id",
                "data",
                ...(requireAuthorization ? ["authorization"] : []),
              ],
            } satisfies JSONSchema7,
          } satisfies ResourceSchema;
          const deleteOptions = {
            name: capitalize(singularName) + "DeleteOptions",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string" },
                ...(requireAuthorization && {
                  authorization: { type: "string" },
                }),
              },
              required: [
                "id",
                ...(requireAuthorization ? ["authorization"] : []),
              ],
            } satisfies JSONSchema7,
          } satisfies ResourceSchema;
          const countOptions = {
            name: capitalize(singularName) + "CountOptions",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                where: filterSchema.schema,
                ...(requireAuthorization && {
                  authorization: { type: "string" },
                }),
              },
              required: [...(requireAuthorization ? ["authorization"] : [])],
            } satisfies JSONSchema7,
          } satisfies ResourceSchema;

          const collection = db.createCollection({ name: pluralName, fields });
          const endpoint = server.createEndpoint({
            name: pluralName,
            operations: {
              ...(operations?.create
                ? {
                    create: server.createMutation({
                      input: createOptions,
                      output: documentSchema,
                      handler:
                        typeof operations.create === "function"
                          ? operations.create
                          : async ({ input }) => {
                              const document = await collection.create(
                                input.data,
                              );
                              return {
                                response: {
                                  type: "ok",
                                  data: await document.get(),
                                },
                              };
                            },
                    }),
                  }
                : {}),
              ...(operations?.update
                ? {
                    update: server.createMutation({
                      input: updateOptions,
                      output: documentSchema,
                      handler:
                        typeof operations.update === "function"
                          ? operations.update
                          : async ({ input }) => {
                              const [document] = await collection.find({
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
                            },
                    }),
                  }
                : {}),
              ...(operations.delete
                ? {
                    delete: server.createMutation({
                      input: deleteOptions,
                      output: null,
                      handler:
                        typeof operations.delete === "function"
                          ? operations.delete
                          : async ({ input }) => {
                              const [document] = await collection.find({
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
                            },
                    }),
                  }
                : {}),
              ...(operations.find
                ? {
                    find: server.createQuery({
                      input: findOptions,
                      output: listSchema,
                      handler:
                        typeof operations.find === "function"
                          ? operations.find
                          : async ({ input }) => {
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
                            },
                    }),
                  }
                : {}),
              ...(operations.count
                ? {
                    count: server.createQuery({
                      input: countOptions,
                      output: countSchema,
                      handler:
                        typeof operations.count === "function"
                          ? operations.count
                          : async ({ input }) => {
                              const { where } = input;
                              return {
                                response: {
                                  type: "ok",
                                  data: await collection.count({ where }),
                                },
                              };
                            },
                    }),
                  }
                : {}),
              ...extraOperations,
            },
          });

          return {
            collection,
            endpoint,
          };
        },
      ),
    };
  },
);
