import { ResourceServer } from "@palakit/api";
import {
  LocalRuntime,
  createPart,
  createPinoLogger,
  resolveApplication,
} from "@palakit/core";
import { CrudResourceRegistry } from "@palakit/crud";
import { DataType } from "@palakit/db";
import { createSequelizeDocumentStore } from "@palakit/sequelize";
import { createTrpcResourceServer } from "@palakit/trpc";
import pino from "pino";
import { z } from "zod";

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
        console.log(`Server is running on port ${PORT}!`);
      }),
      names,
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
    CrudResourceRegistry,
    MyCrudApi,
    createPinoLogger(
      pino({
        base: null,
        timestamp: pino.stdTimeFunctions.isoTime,
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
    ),
  ],
});
