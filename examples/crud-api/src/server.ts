import { createSequelizeDocumentStore } from "@pala/db-sequelize";
import { ResourceServer } from "@pala/api";
import { createTrpcResourceServer } from "@pala/api-trpc";
import { LocalRuntime, createPart, resolveApplication } from "@pala/core";
import { z } from "zod";
import { DataType, DocumentStore } from "@pala/db";

const PORT = 3000;

const MyCrudApi = createPart(
  "MyCrudApi",
  [DocumentStore, ResourceServer],
  ([db, server]) => {
    const nameSchema = z.object({ name: z.string() });
    const storedNameSchema = z.object({
      id: z.string(),
      name: z.string(),
    });
    const nameCollection = db.createCollection({
      name: "names",
      fields: {
        name: {
          dataType: DataType.STRING,
          length: 255,
        },
      },
    });

    return {
      serverStarted: server.start.after("MyCrudApi.serverStarted", () => {
        console.log(`Server running is running on port ${PORT}!`);
      }),
      nameCollection,
      nameEndpoint: server.createEndpoint({
        name: "names",
        operations: {
          create: server.createMutation({
            input: nameSchema,
            output: storedNameSchema,
            handler: async ({ input }) => {
              const document = await nameCollection.create(input);
              return {
                response: {
                  type: "ok",
                  data: await document.get(),
                },
              };
            },
          }),
          update: server.createMutation({
            input: storedNameSchema,
            output: storedNameSchema,
            handler: async ({ input }) => {
              const { id, ...values } = input;
              const [document] = await nameCollection.find({
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
            input: storedNameSchema,
            output: null,
            handler: async ({ input }) => {
              const { id } = input;
              const [document] = await nameCollection.find({
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
            output: z.array(storedNameSchema),
            handler: async () => {
              const documents = await nameCollection.find({
                order: [["name", "ASC"]],
              });
              return {
                response: {
                  type: "ok",
                  data: await Promise.all(
                    documents.map((document) => document.get())
                  ),
                },
              };
            },
          }),
          count: server.createQuery({
            input: null,
            output: z.number().int().nonnegative(),
            handler: async () => {
              return {
                response: {
                  type: "ok",
                  data: await nameCollection.count(),
                },
              };
            },
          }),
        },
      }),
    };
  }
);

export const app = resolveApplication({
  name: "Crud API Example",
  parts: [
    LocalRuntime,
    createSequelizeDocumentStore({
      dialect: "sqlite",
      storage: ":memory:",
      logging: false,
    }),
    ResourceServer,
    createTrpcResourceServer({
      port: PORT,
      clientPath: __dirname + "/../generated/trpc.ts",
    }),
    MyCrudApi,
  ],
});
