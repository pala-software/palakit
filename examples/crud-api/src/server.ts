import { SequelizeDocumentStoreFeature } from "@palakit/sequelize";
import { ResourceServer } from "@palakit/api";
import { TrpcResourceServerFeature } from "@palakit/trpc";
import { LocalRuntime, createPart, resolveApplication } from "@palakit/core";
import { DataType, DocumentStore } from "@palakit/db";
import { CrudHelper } from "@palakit/crud";
import { KoaHttpServerFeature } from "@palakit/koa";

const PORT = 3000;
const HOSTNAME = "localhost";

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
    ...SequelizeDocumentStoreFeature.configure({
      dialect: "sqlite",
      storage: ":memory:",
      logging: false,
    }),
    ...KoaHttpServerFeature.configure({ port: PORT, hostname: HOSTNAME }),
    ...TrpcResourceServerFeature.configure({
      path: "/trpc",
      clientPath: import.meta.dirname + "/../build/trpc.ts",
    }),
    CrudHelper,
    MyCrudApi,
  ],
});
