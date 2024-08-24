import { createSequelizeDocumentStore } from "@pala/sequelize";
import { ResourceServer } from "@pala/api";
import { createTrpcResourceServer } from "@pala/trpc";
import { LocalRuntime, createPart, resolveApplication } from "@pala/core";
import { z } from "zod";
import { CrudResourceRegistry } from "@pala/crud";
import { OpenIdConnectAuthenticator } from "@pala/oidc-client";

const ISSUER = new URL("http://localhost:3001");
const PORT = 3000;

const MyCrudApi = createPart(
  "MyCrudApi",
  [ResourceServer, OpenIdConnectAuthenticator],
  async ([server, auth]) => {
    const idp = await auth.discover({
      issuer: ISSUER,
      client: {
        client_id: "pala",
      },
    });

    const publicEndpoint = await server.createEndpoint({
      name: "public",
      operations: {
        read: server.createQuery({
          input: null,
          output: null,
          handler: () => {
            return { response: { type: "ok" } };
          },
        }),
      },
    });

    const protectedEndpoint = await server.createEndpoint({
      name: "protected",
      operations: {
        read: server.createQuery({
          input: { schema: z.object({ token: z.string() }) },
          output: null,
          handler: async ({ input }) => {
            await auth.verifyAccessToken({ idp, accessToken: input.token });
            const userInfo = await auth.getUserInfo({
              idp,
              accessToken: input.token,
            });
            console.log(userInfo);
            return { response: { type: "ok" } };
          },
        }),
      },
    });

    return {
      serverStarted: server.start.after("MyCrudApi.serverStarted", () => {
        console.log(`Server running is running on port ${PORT}!`);
      }),
      publicEndpoint,
      protectedEndpoint,
    };
  },
);

export const app = await resolveApplication({
  name: "OAuth Example",
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
