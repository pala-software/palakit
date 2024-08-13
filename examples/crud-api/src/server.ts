import { createSequelizeDocumentStore } from "@pala/db-sequelize";
import { ResourceServer } from "@pala/api";
import { createTrpcResourceServer } from "@pala/api-trpc";
import { LocalRuntime, createPart, resolveApplication } from "@pala/core";
import { z } from "zod";
import { DataType } from "@pala/db";
import { CrudResourceRegistry } from "@pala/crud";

const PORT = 3000;

const MyCrudApi = createPart(
  "MyCrudApi",
  [ResourceServer, CrudResourceRegistry],
  async ([server, crud]) => {
    return {
      serverStarted: server.start.after("MyCrudApi.serverStarted", () => {
        console.log(`Server running is running on port ${PORT}!`);
      }),
      Name: await crud.createResource({
        name: "Name",
        fields: {
          name: {
            dataType: DataType.STRING,
            length: 255,
            schema: z.string(),
          },
        },
      }),
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
      clientPath: __dirname + "/../generated/trpc.ts",
    }),
    CrudResourceRegistry,
    MyCrudApi,
  ],
});
