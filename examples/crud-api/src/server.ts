import { SequelizeDocumentStoreFeature } from "@palakit/sequelize";
import { ResourceServer } from "@palakit/api";
import { TrpcResourceServerFeature } from "@palakit/trpc";
import { LocalRuntime, createPart, resolveApplication } from "@palakit/core";
import { z } from "zod";
import { DataType } from "@palakit/db";
import { CrudResourceRegistry } from "@palakit/crud";

const PORT = 3000;
const SECRET = "bad secret";

const MyCrudApi = createPart(
  "MyCrudApi",
  [ResourceServer, CrudResourceRegistry],
  async ([server, crud]) => {
    const names = await crud.createResource({
      name: { singular: "name", plural: "names" },
      fields: {
        name: {
          dataType: DataType.STRING,
          length: 255,
          schema: z.string(),
        },
      },
      requireAuthorization: true,
    });

    names.endpoint.operation.before(
      "MyCrudApi.names.endpoint.operation.before",
      ({ request }) => {
        if (
          typeof request.input !== "object" ||
          !request.input ||
          !("authorization" in request.input) ||
          request.input.authorization !== SECRET
        ) {
          throw new Error("Unauthorized");
        }
        return request;
      },
    );

    return {
      serverStarted: server.start.after("MyCrudApi.serverStarted", () => {
        console.log(`Server running is running on port ${PORT}!`);
      }),
      names,
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
    ...TrpcResourceServerFeature.configure({
      port: PORT,
      clientPath: import.meta.dirname + "/../build/trpc.ts",
    }),
    CrudResourceRegistry,
    MyCrudApi,
  ],
});
