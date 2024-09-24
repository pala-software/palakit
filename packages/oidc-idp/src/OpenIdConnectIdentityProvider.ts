import { Application, createPart } from "@pala/core";
import Provider from "oidc-provider";

export const OpenIdConnectIdentityProvider = createPart(
  "OpenIdConnectIdentityProvider",
  [Application],
  ([app]) => {
    const provider = new Provider("http://localhost:3001", {
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
      clientBasedCORS: (_ctx, origin, client) => {
        if (!client.redirectUris) {
          return false;
        }

        return client.redirectUris.some(
          (uri) => origin === new URL(uri).origin,
        );
      },
      features: {
        introspection: { enabled: true },
      },
    });
    return {
      start: app.start.on("OpenIdConnectIdentityProvider.start", () => {
        provider.listen(3001, "localhost");
      }),
    };
  },
);
