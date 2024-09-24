import { createSequelizeDocumentStore } from "@pala/sequelize";
import { ResourceServer } from "@pala/api";
import { createTrpcResourceServer } from "@pala/trpc";
import { LocalRuntime, createPart, resolveApplication } from "@pala/core";
import { z } from "zod";
import { CrudResourceRegistry } from "@pala/crud";
import { OpenIdConnectAuthenticator } from "@pala/oidc-client";
import { OpenIdConnectIdentityProvider } from "@pala/oidc-idp";
import { IdentityProvider } from "@pala/oidc-client";

const ISSUER = new URL("http://localhost:3001");
const PORT = 3000;

const MyCrudApi = createPart(
  "MyCrudApi",
  [ResourceServer, OpenIdConnectAuthenticator, OpenIdConnectIdentityProvider],
  async ([server, auth, idp]) => {
    let idpOptions: IdentityProvider;

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
            try {
              const payload = await auth.verifyAccessToken({
                idp: idpOptions,
                accessToken: input.token,
              });
              console.log(payload);
              return { response: { type: "ok" } };
            } catch (error) {
              console.error(error);
              return { response: { type: "error" } };
            }
          },
        }),
      },
    });

    return {
      serverStarted: server.start.after("MyCrudApi.serverStarted", () => {
        console.log(`Server running is running on port ${PORT}!`);
      }),
      idpStarted: idp.start.after("MyCrudApi.idpStarted", async () => {
        idpOptions = await auth.discover({
          issuer: ISSUER,
          client: {
            client_id: "pala-server",
            client_secret: "bad secret",
          },
        });
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
      clientPath: import.meta.dirname + "/../build/trpc.ts",
    }),
    CrudResourceRegistry,
    MyCrudApi,
    OpenIdConnectIdentityProvider,
  ],
});
