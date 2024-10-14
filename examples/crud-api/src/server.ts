import { ResourceEndpoint, ResourceServer } from "@palakit/api";
import { LocalRuntime, createPart, resolveApplication } from "@palakit/core";
import { CrudHelper } from "@palakit/crud";
import { DataType, DocumentStore } from "@palakit/db";
import { KoaHttpServerFeature } from "@palakit/koa";
import { PinoLoggerFeature } from "@palakit/pino";
import { SequelizeDocumentStoreFeature } from "@palakit/sequelize";
import { TrpcResourceServerFeature } from "@palakit/trpc";
import { toJSONSchema } from "@typeschema/main";
import { HOSTNAME, PORT, SECRET, TRPC_PATH } from "./config";

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
      operations: await crud.createCrudOperations({ name: "name", collection }),
    });
    requireSecret({
      endpointName: "MyCrudApi.endpoint",
      endpoint,
    });

    return {
      serverStarted: server.start.after("MyCrudApi.serverStarted", () => {
        console.log(`Server is running on port ${PORT}!`);
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
    ...PinoLoggerFeature.configure({
      base: null,
      transport: {
        targets: [
          {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: true,
            },
          },
          {
            target: "pino/file",
            options: {
              destination: "logs/server.log",
              mkdir: true,
            },
          },
        ],
      },
    }),
  ],
});
