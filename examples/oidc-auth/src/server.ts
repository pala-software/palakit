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
import { KoaHttpServerFeature } from "@palakit/koa";
import {
  ACCOUNTS,
  BACKEND_CLIENT,
  CLIENTS,
  HOSTNAME,
  ISSUER,
  PORT,
  TRPC_PATH,
} from "./config";

const MyApi = createPart(
  "MyApi",
  [ResourceServer, OpenIdConnectIdentityProvider, OpenIdConnectAuthenticator],
  async ([server, idp, auth]) => {
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
      serverStarted: server.start.after("MyApi.serverStarted", async () => {
        console.log(`Server running is running on port ${PORT}!`);
      }),
      idpStarted: idp.start.after("MyApi.idpStarted", async () => {
        for (const { email, password } of ACCOUNTS) {
          idp.accounts.create({
            email,
            passwordHash: await idp.createPasswordHash(password),
          });
        }

        idpOptions = await auth.discover({
          issuer: ISSUER,
          client: BACKEND_CLIENT,
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
    ...KoaHttpServerFeature.configure({
      port: PORT,
      hostname: HOSTNAME,
    }),
    ...TrpcResourceServerFeature.configure({
      path: TRPC_PATH,
      clientPath: import.meta.dirname + "/../build/trpc.ts",
    }),
    ...OpenIdConnectIdentityProviderFeature.configure({
      issuer: ISSUER,
      clients: CLIENTS,
    }),
    CrudResourceRegistry,
    MyApi,
  ],
});
