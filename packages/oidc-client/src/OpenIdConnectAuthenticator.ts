import { createPart } from "@palakit/core";
import {
  AuthorizationServer,
  Client,
  ClientAuth,
  discoveryRequest,
  introspectionRequest,
  IntrospectionResponse,
  processDiscoveryResponse,
  processIntrospectionResponse,
} from "oauth4webapi";

export type IdentityProvider = {
  server: AuthorizationServer;
  client: Client;
  clientAuth: ClientAuth;
};

export const OpenIdConnectAuthenticator = createPart(
  "OpenIdConnectAuthenticator",
  [],
  () => {
    return {
      discover: async ({
        issuer,
        client,
        clientAuth,
      }: {
        /** URL for expected issuer. */
        issuer: URL;

        /**
         * Client options for the server to authenticate against the
         * authorization server.
         */
        client: Client;

        /** Client authentication method. */
        clientAuth: ClientAuth;
      }): Promise<IdentityProvider> => {
        const server = await discoveryRequest(issuer).then((response) =>
          processDiscoveryResponse(issuer, response),
        );
        return { server, client, clientAuth };
      },

      verifyAccessToken: async ({
        idp,
        accessToken,
      }: {
        idp: IdentityProvider;

        /** Access token from a client. */
        accessToken: string;
      }): Promise<IntrospectionResponse> => {
        const introspection = await introspectionRequest(
          idp.server,
          idp.client,
          idp.clientAuth,
          accessToken,
        ).then((response) =>
          processIntrospectionResponse(idp.server, idp.client, response),
        );
        if (!introspection.active) {
          throw new Error("Invalid token");
        }
        return introspection;
      },
    };
  },
);
