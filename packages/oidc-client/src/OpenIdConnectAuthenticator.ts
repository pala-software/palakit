import { createPart } from "@pala/core";
import {
  AuthorizationServer,
  Client,
  discoveryRequest,
  introspectionRequest,
  IntrospectionResponse,
  isOAuth2Error,
  processDiscoveryResponse,
  processIntrospectionResponse,
} from "oauth4webapi";

export type IdentityProvider = {
  client: Client;
  server: AuthorizationServer;
};

export const OpenIdConnectAuthenticator = createPart(
  "OpenIdConnectAuthenticator",
  [],
  () => {
    return {
      discover: async ({
        issuer,
        client,
      }: {
        /** URL for expected issuer. */
        issuer: URL;

        /**
         * Client options for the server to authenticate against the
         * authorization server.
         */
        client: Client;
      }): Promise<IdentityProvider> => {
        const server = await discoveryRequest(issuer).then((response) =>
          processDiscoveryResponse(issuer, response),
        );
        return { client, server };
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
          accessToken,
        ).then((response) =>
          processIntrospectionResponse(idp.server, idp.client, response),
        );
        if (isOAuth2Error(introspection)) {
          throw new Error(introspection.error);
        }
        if (!introspection.active) {
          throw new Error("Invalid token");
        }
        return introspection;
      },
    };
  },
);
