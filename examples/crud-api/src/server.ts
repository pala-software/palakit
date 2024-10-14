import { SequelizeDocumentStoreFeature } from "@palakit/sequelize";
import { ResourceServer, ResourceEndpoint } from "@palakit/api";
import { TrpcResourceServerFeature } from "@palakit/trpc";
import { LocalRuntime, createPart, resolveApplication } from "@palakit/core";
import { DocumentStore } from "@palakit/db";
import { CrudHelper } from "@palakit/crud";
import { KoaHttpServerFeature } from "@palakit/koa";
import { HOSTNAME, PORT, TRPC_PATH, SECRET } from "./config";
import { toJSONSchema } from "@typeschema/main";

const requireSecret = <T extends ResourceEndpoint>({
  endpointName,
  endpoint,
  operationNames,
}: {
  endpointName: string;
  endpoint: T;
  operationNames?: (keyof T["operations"])[];
}) => {
  if (!operationNames) {
    operationNames = Object.keys(endpoint.operations);
  }

  for (const operationName of operationNames as string[]) {
    endpoint.operations[operationName].getInputSchema.after(
      `${endpointName}.operations.${operationName}.getInputSchema.after`,
      async (value) => {
        if (value === null) {
          return null;
        }

        const { name } = value;
        const schema = await toJSONSchema(value.schema);
        schema.properties = {
          ...schema.properties,
          authorization: { type: "string" },
        };
        schema.required = [...(schema.required ?? []), "authorization"];

        return { name, schema };
      },
    );

    endpoint.operations[operationName].handler.before(
      `${endpointName}.operations.${operationName}.handler.before`,
      (request) => {
        if (
          typeof request.input !== "object" ||
          !request.input ||
          !("authorization" in request.input) ||
          request.input.authorization !== SECRET
        ) {
          throw new Error("Unauthorized");
        }
        return [request];
      },
    );
  }
};

const MyCrudApi = createPart(
  "MyCrudApi",
  [DocumentStore, ResourceServer, CrudHelper],
  async ([db, server, crud]) => {
    const collection = await db
      .createCollection({
        name: "names",
      })
      .addField({
        name: "name",
        dataType: "string",
        length: 255,
        nullable: false,
      });

    const endpoint = server.createEndpoint({
      name: "names",
      operations: await crud.createCrudOperations({ name: "name", collection }),
    });
    requireSecret({
      endpointName: "MyCrudApi.endpoint",
      endpoint,
    });

    return {
      serverStarted: server.start.after("MyCrudApi.serverStarted", () => {
        console.log(`Server running is running on port ${PORT}!`);
      }),
      dbConnected: db.connect.after("MyCrudApi.dbConnected", async () => {
        await collection.sync();
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
      path: TRPC_PATH,
      clientPath: import.meta.dirname + "/../build/trpc.ts",
    }),
    CrudHelper,
    MyCrudApi,
  ],
});
