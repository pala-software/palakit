import { createSequelizeDocumentStore } from "@palakit/sequelize";
import { ResourceServer } from "@palakit/api";
import { createTrpcResourceServer } from "@palakit/trpc";
import { LocalRuntime, createPart, resolveApplication } from "@palakit/core";
import { DataType, DocumentStore } from "@palakit/db";
import { CrudHelper } from "@palakit/crud";

const PORT = 3000;

const MyCrudApi = createPart(
  "MyCrudApi",
  [DocumentStore, ResourceServer, CrudHelper],
  async ([db, server, crud]) => {
    const collection = await db.createCollection({
      name: "names",
      fields: {
        name: {
          dataType: DataType.STRING,
          length: 255,
          nullable: false,
        },
      },
    });

    const endpoint = server.createEndpoint({
      name: "names",
      operations: {
        ...(await crud.createCrudOperations({ name: "name", collection })),
      },
    });

    return {
      serverStarted: server.start.after("MyCrudApi.serverStarted", () => {
        console.log(`Server running is running on port ${PORT}!`);
      }),
      collection,
      endpoint,
    };
  },
);

export const app = await resolveApplication({
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
      clientPath: import.meta.dirname + "/../generated/trpc.ts",
    }),
    CrudHelper,
    MyCrudApi,
  ],
});
