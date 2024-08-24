import { createPart } from "@pala/core";
import {
  AuthorizationServer,
  Client,
  discoveryRequest,
  processDiscoveryResponse,
  processUserInfoResponse,
  skipSubjectCheck,
  userInfoRequest,
} from "oauth4webapi";
import { createRemoteJWKSet, jwtVerify } from "jose";

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
      }) => {
        if (!idp.server.jwks_uri) {
          throw new Error("Authorization server does not provide JWKS key set");
        }
        const jwks = createRemoteJWKSet(new URL(idp.server.jwks_uri));
        await jwtVerify(accessToken, jwks, {
          issuer: idp.server.issuer,
          audience: idp.client.client_id,
        });
      },

      getUserInfo: async ({
        idp,
        accessToken,
      }: {
        idp: IdentityProvider;

        /** Access token from a client. */
        accessToken: string;
      }) => {
        const userInfo = await userInfoRequest(
          idp.server,
          idp.client,
          accessToken,
        ).then((response) =>
          processUserInfoResponse(
            idp.server,
            idp.client,
            skipSubjectCheck,
            response,
          ),
        );
        return userInfo;
      },
    };
  },
);
