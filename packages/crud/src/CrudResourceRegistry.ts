import { ResourceSchema, ResourceServer } from "@pala/api";
import { createPart, Runtime } from "@pala/core";
import { DataType, DocumentStore, Field } from "@pala/db";
import { toJSONSchema } from "@typeschema/main";
import { JSONSchema7 } from "json-schema";

const capitalize = (str: string) =>
  str.length < 1 ? str : str[0].toUpperCase() + str.slice(1);

const maxInteger = (bits: number) => 2 ** (bits - 1) - 1;

const schemaFromField = async (field: Field): Promise<JSONSchema7> => {
  if (field.schema) {
    return toJSONSchema(field.schema);
  }

  switch (field.dataType) {
    case DataType.STRING:
      return { type: "string", maxLength: field.length };
    case DataType.BOOLEAN:
      return { type: "boolean" };
    case DataType.INTEGER:
      return {
        type: "integer",
        ...(field.size && {
          minimum: -maxInteger(field.size),
          maximum: maxInteger(field.size),
        }),
      };
    case DataType.FLOAT:
      return { type: "number" };
    case DataType.BLOB:
      // TODO: Support blobs
      return { type: "null" };
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
          name: string;
          fields: Fields;
        }) => {
          const fieldSchemas = Object.fromEntries(
            await Promise.all(
              Object.entries(fields).map(([key, field]) =>
                schemaFromField(field).then((schema) => [key, schema]),
              ),
            ),
          ) as Record<string, JSONSchema7>;
          const filterSchemas = {
            type: ["object"],
            additionalProperties: false,
            properties: Object.fromEntries(
              Object.entries(fieldSchemas).map(([key, schema]) => [
                key,
                {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    equals: schema,
                    notEquals: schema,
                    is: { type: "null" },
                    isNot: { type: "null" },
                    in: { type: "array", items: schema },
                    notIn: { type: "array", items: schema },
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
            name: "Input" + capitalize(name),
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
            name: capitalize(name),
            schema: {
              ...inputSchema.schema,
              properties: {
                ...inputSchema.schema.properties,
                id: { type: "string" },
              },
              required: [...inputSchema.schema.required, "id"],
            } satisfies JSONSchema7,
          } satisfies ResourceSchema;
          const listSchemaWithId = {
            name: capitalize(name) + "List",
            schema: {
              type: "array",
              items: schemaWithId.schema,
            } satisfies JSONSchema7,
          } satisfies ResourceSchema;
          const countSchema = {
            name: capitalize(name) + "Count",
            schema: {
              type: "integer",
              minimum: 0,
            } satisfies JSONSchema7,
          } satisfies ResourceSchema;
          const findOptions = {
            name: capitalize(name) + "FindOptions",
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
                      { enum: Object.keys(fields) },
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
            name: capitalize(name) + "CountOptions",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                where: filterSchemas,
              },
            } satisfies JSONSchema7,
          } satisfies ResourceSchema;

          const collection = db.createCollection({ name, fields });
          const endpoint = server.createEndpoint({
            name,
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
