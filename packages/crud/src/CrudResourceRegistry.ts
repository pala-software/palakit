import { ResourceSchema, ResourceServer } from "@pala/api";
import { createPart, Runtime } from "@pala/core";
import { DocumentStore, Field } from "@pala/db";
import { toJSONSchema } from "@typeschema/main";
import { JSONSchema7 } from "json-schema";

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
          const inputSchema = {
            name, // TODO: Format name
            schema: {
              type: "object",
              additionalProperties: false,
              properties: Object.fromEntries(
                await Promise.all(
                  Object.entries(fields).map(
                    ([key, field]) =>
                      field.schema
                        ? toJSONSchema(field.schema).then((schema) => [
                            key,
                            schema,
                          ])
                        : [key, {}], // TODO: Default schema based on data type
                  ),
                ),
              ),
              required: Object.entries(fields)
                .filter(([, field]) => !field.nullable)
                .map(([key]) => key),
            } satisfies JSONSchema7,
          } satisfies ResourceSchema;
          const schemaWithId = {
            name: "Stored" + name, // TODO: Format name
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
            name: "Stored" + name + "List", // TODO: Format name
            schema: {
              type: "array",
              items: schemaWithId.schema,
            } satisfies JSONSchema7,
          } satisfies ResourceSchema;
          const countSchema = {
            name: "Count",
            schema: {
              type: "integer",
              minimum: 0,
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
              read: server.createQuery({
                input: null,
                output: listSchemaWithId,
                handler: async () => {
                  const documents = await collection.find();
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
                input: null,
                output: countSchema,
                handler: async () => {
                  return {
                    response: {
                      type: "ok",
                      data: await collection.count(),
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
