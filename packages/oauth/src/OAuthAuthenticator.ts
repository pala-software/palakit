import { createPart } from "@pala/core";
import {
  Client,
  discoveryRequest,
  processDiscoveryResponse,
  processUserInfoResponse,
  skipSubjectCheck,
  userInfoRequest,
} from "oauth4webapi";
import { createRemoteJWKSet, jwtVerify } from "jose";

export const createOAuthAuthenticator = ({
  issuer,
  client,
}: {
  /** URL for expected issuer. */
  issuer: URL;

  /**
   * Client options for the server to authenticate against the authorization
   * server.
   */
  client: Client;
}) =>
  createPart("OAuthAuthenticator", [], async () => {
    const authorizationServer = await discoveryRequest(issuer).then(
      (response) => processDiscoveryResponse(issuer, response),
    );
    if (!authorizationServer.jwks_uri) {
      throw new Error(
        "Discovered authorization server does not provide JWKS key set",
      );
    }
    const jwks = createRemoteJWKSet(new URL(authorizationServer.jwks_uri));

    return {
      getUserInfo: async ({
        accessToken,
      }: {
        /** Access token from a client. */
        accessToken: string;
      }) => {
        await jwtVerify(accessToken, jwks, {
          issuer: issuer.href,
          audience: client.client_id,
        });
        const userInfo = await userInfoRequest(
          authorizationServer,
          client,
          accessToken,
        ).then((response) =>
          processUserInfoResponse(
            authorizationServer,
            client,
            skipSubjectCheck,
            response,
          ),
        );
        return userInfo;
      },
    };
  });
