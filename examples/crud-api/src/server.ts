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
