import {
  Application,
  createConfiguration,
  createFeature,
  createPart,
} from "@palakit/core";
import Provider, { ClientMetadata } from "oidc-provider";

export type OpenIdConnectIdentityProviderConfiguration = {
  clients: ClientMetadata[];
};

export const OpenIdConnectIdentityProviderConfiguration =
  createConfiguration<OpenIdConnectIdentityProviderConfiguration>(
    "OpenIdConnectIdentityProviderConfiguration",
  );

export const OpenIdConnectIdentityProvider = createPart(
  "OpenIdConnectIdentityProvider",
  [OpenIdConnectIdentityProviderConfiguration, Application],
  ([config, app]) => {
    const provider = new Provider("http://localhost:3001", {
      clients: config.clients,
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

export const OpenIdConnectIdentityProviderFeature = createFeature(
  [OpenIdConnectIdentityProvider],
  OpenIdConnectIdentityProviderConfiguration,
);
