import { ResourceSchema, ResourceServer } from "@pala/api";
import { createPart, Runtime } from "@pala/core";
import { DataType, DocumentStore, Field } from "@pala/db";
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
        }: {
          name: string | { singular: string; plural: string };
          fields: Fields;
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
          ) as Record<string, NullableJsonSchema>;
          const fieldSchemasWithId: Record<string, NullableJsonSchema> = {
            ...fieldSchemas,
            id: { type: "string", nullable: false },
          };
          const filterSchemas = {
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
          } satisfies JSONSchema7;

          const inputSchema = {
            name: "Input" + capitalize(singularName),
            schema: {
              type: "object",
              additionalProperties: false,
              properties: fieldSchemas,
              required: Object.entries(fields)
                .filter(([, field]) => !field.nullable)
                .map(([key]) => key),
            } satisfies JSONSchema7,
          } satisfies ResourceSchema;
          const schemaWithId = {
            name: capitalize(singularName),
            schema: {
              ...inputSchema.schema,
              properties: {
                id: { type: "string" },
                ...inputSchema.schema.properties,
              },
              required: [...inputSchema.schema.required, "id"],
            } satisfies JSONSchema7,
          } satisfies ResourceSchema;
          const listSchemaWithId = {
            name: capitalize(singularName) + "List",
            schema: {
              type: "array",
              items: schemaWithId.schema,
            } satisfies JSONSchema7,
          } satisfies ResourceSchema;
          const countSchema = {
            name: capitalize(singularName) + "Count",
            schema: {
              type: "integer",
              minimum: 0,
            } satisfies JSONSchema7,
          } satisfies ResourceSchema;
          const findOptions = {
            name: capitalize(singularName) + "FindOptions",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                where: filterSchemas,
                order: {
                  type: "array",
                  items: {
                    type: "array",
                    items: [
                      { enum: Object.keys(fieldSchemasWithId) },
                      { enum: ["ASC", "DESC"] },
                    ],
                    minItems: 2,
                  },
                },
                limit: { type: "integer", minimum: 0 },
                offset: { type: "integer", minimum: 0 },
              },
            } satisfies JSONSchema7,
          } satisfies ResourceSchema;
          const countOptions = {
            name: capitalize(singularName) + "CountOptions",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                where: filterSchemas,
              },
            } satisfies JSONSchema7,
          } satisfies ResourceSchema;

          const collection = db.createCollection({ name: pluralName, fields });
          const endpoint = server.createEndpoint({
            name: pluralName,
            operations: {
              create: server.createMutation({
                input: inputSchema,
                output: schemaWithId,
                handler: async ({ input }) => {
                  const document = await collection.create(input);
                  return {
                    response: {
                      type: "ok",
                      data: await document.get(),
                    },
                  };
                },
              }),
              update: server.createMutation({
                input: schemaWithId,
                output: schemaWithId,
                handler: async ({ input }) => {
                  const { id, ...values } = input;
                  const [document] = await collection.find({
                    where: { id: { equals: id } },
                    limit: 1,
                  });
                  if (!document) {
                    return { response: { type: "error", data: "Not found" } };
                  }
                  await document.update(values);
                  return {
                    response: {
                      type: "ok",
                      data: await document.get(),
                    },
                  };
                },
              }),
              delete: server.createMutation({
                input: schemaWithId,
                output: null,
                handler: async ({ input }) => {
                  const { id } = input;
                  const [document] = await collection.find({
                    where: { id: { equals: id } },
                    limit: 1,
                  });
                  if (!document) {
                    return { response: { type: "error", data: "Not found" } };
                  }
                  await document.delete();
                  return {
                    response: {
                      type: "ok",
                    },
                  };
                },
              }),
              find: server.createQuery({
                input: findOptions,
                output: listSchemaWithId,
                handler: async ({ input }) => {
                  const documents = await collection.find(input);
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
              count: server.createQuery({
                input: countOptions,
                output: countSchema,
                handler: async ({ input }) => {
                  return {
                    response: {
                      type: "ok",
                      data: await collection.count(input),
                    },
                  };
                },
              }),
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
