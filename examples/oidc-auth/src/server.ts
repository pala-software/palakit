import { SequelizeDocumentStoreFeature } from "@palakit/sequelize";
import { ResourceServer } from "@palakit/api";
import { TrpcResourceServerFeature } from "@palakit/trpc";
import { LocalRuntime, createPart, resolveApplication } from "@palakit/core";
import { z } from "zod";
import { CrudResourceRegistry } from "@palakit/crud";
import { OpenIdConnectAuthenticator } from "@palakit/oidc-client";
import {
  OpenIdConnectIdentityProvider,
  OpenIdConnectIdentityProviderFeature,
} from "@palakit/oidc-idp";
import { IdentityProvider } from "@palakit/oidc-client";

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
    ...SequelizeDocumentStoreFeature.configure({
      dialect: "sqlite",
      storage: ":memory:",
      logging: false,
    }),
    ...TrpcResourceServerFeature.configure({
      port: PORT,
      clientPath: import.meta.dirname + "/../build/trpc.ts",
    }),
    ...OpenIdConnectIdentityProviderFeature.configure({
      clients: [
        {
          client_id: "pala-server",
          client_secret: "bad secret",
          redirect_uris: [],
          response_types: [],
          grant_types: [],
        },
        {
          client_id: "pala-client",
          redirect_uris: ["http://localhost:5173"],
          token_endpoint_auth_method: "none",
        },
      ],
    }),
    CrudResourceRegistry,
    MyCrudApi,
  ],
});
