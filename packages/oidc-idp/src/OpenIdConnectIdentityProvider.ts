import { createConfiguration, createFeature, createPart } from "@palakit/core";
import Provider, {
  ClientMetadata,
  Configuration,
  Grant,
  Interaction,
  JWKS,
  errors,
} from "oidc-provider";
import { KoaHttpServer } from "@palakit/koa";
import Router from "@koa/router";
import mount from "koa-mount";
import { koaBody } from "koa-body";
import { OidcProviderDatabaseAdapter } from "./OidcProviderDatabaseAdapter";
import { DataType, DocumentStore } from "@palakit/db";
import { compare, hash } from "bcrypt";

export type OpenIdConnectIdentityProviderConfiguration = {
  issuer: URL;
  clients: ClientMetadata[];
  jwks?: JWKS;
  cookieKeys?: (string | Buffer)[];
  ttl?: {
    AccessToken?: number;
    AuthorizationCode?: number;
    ClientCredentials?: number;
    DeviceCode?: number;
    BackchannelAuthenticationRequest?: number;
    IdToken?: number;
    RefreshToken?: number;
    Interaction?: number;
    Session?: number;
    Grant?: number;
  };
};

export const OpenIdConnectIdentityProviderConfiguration =
  createConfiguration<OpenIdConnectIdentityProviderConfiguration>(
    "OpenIdConnectIdentityProviderConfiguration",
  );

const escape = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const renderTemplate = (
  details: { title: string },
  contents: string,
) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escape(details.title)}</title>
</head>
<body>
<h1>${escape(details.title)}</h1>
${contents}
</body>
</html>`;

const renderLoginPrompt = (interaction: Interaction) =>
  renderTemplate(
    { title: "Login" },
    `<form
      autocomplete="off"
      action="${escape(interaction.uid)}/login"
      method="post"
    >
      <input
        required
        type="text"
        name="email"
        placeholder="Email"
        ${
          interaction.params.login_hint
            ? `value="${escape(interaction.params.login_hint as string)}"`
            : 'autofocus="on"'
        }
      >
      <input
        required
        type="password"
        name="password"
        placeholder="Password"
        ${interaction.params.login_hint ? 'autofocus="on"' : ""}
      >
      <button type="submit">
        Login
      </button>
    </form>`,
  );

const renderError = (error: unknown, interaction?: Interaction) =>
  renderTemplate(
    { title: "Error" },
    (error instanceof errors.OIDCProviderError && error.expose
      ? `<p>${
          escape(error.error) +
          (error.error_description
            ? `: ${escape(error.error_description)}`
            : "")
        }</p>`
      : "<p>an error occurred.</p>") +
      (interaction
        ? `<a href="${escape(interaction.returnTo)}" autofocus="on">Return</a>`
        : ""),
  );

export const OpenIdConnectIdentityProvider = createPart(
  "OpenIdConnectIdentityProvider",
  [
    OpenIdConnectIdentityProviderConfiguration,
    DocumentStore,
    KoaHttpServer,
    OidcProviderDatabaseAdapter,
  ],
  ([config, db, http, adapter]) => {
    const prefix = (path: string) =>
      new URL(path.slice(1), config.issuer.href + "/");

    const accounts = db.createCollection({
      name: "oidcAccounts",
      fields: {
        email: {
          dataType: DataType.STRING,
          nullable: false,
        },
        passwordHash: {
          dataType: DataType.STRING,
          nullable: false,
        },
      },
    });

    const providerConfig: Configuration = {
      adapter,
      clients: config.clients,
      jwks: config.jwks,
      cookies: { keys: config.cookieKeys },
      ttl: config.ttl,
      interactions: {
        url: (_ctx, interaction) =>
          prefix(`/interaction/${interaction.uid}`).href,
      },
      features: {
        devInteractions: { enabled: false },
        introspection: {
          enabled: true,
          allowedPolicy: (_ctx, client) =>
            client.tokenEndpointAuthMethod !== "none",
        },
      },
      findAccount: async (_ctx, id) => {
        const [account] = await accounts.find({
          where: { id: { equals: id } },
          limit: 1,
        });
        if (account) {
          return {
            accountId: id,
            claims: () => ({ sub: id }),
          };
        } else {
          return undefined;
        }
      },
      clientBasedCORS: (_ctx, origin, client) => {
        if (!client.redirectUris) {
          return false;
        }

        return client.redirectUris.some(
          (uri) => origin === new URL(uri).origin,
        );
      },
      renderError: (ctx, _out, error) => {
        console.error(error);
        ctx.type = "html";
        ctx.body = renderError(error);
      },
      loadExistingGrant: async (ctx) => {
        const { client, session } = ctx.oidc;
        if (!client) {
          throw new Error("No client");
        }
        if (!session) {
          throw new Error("No session");
        }

        const grantId =
          ctx.oidc.result?.consent?.grantId ||
          session.grantIdFor(client.clientId);
        let grant: Grant | undefined;
        if (grantId) {
          grant = await ctx.oidc.provider.Grant.find(grantId);
        }
        if (!grant) {
          grant = new provider.Grant({
            clientId: client.clientId,
            accountId: session.accountId,
          });
        }

        grant.addOIDCScope("openid");
        await grant.save();
        return grant;
      },
    };
    let provider: Provider;

    const interactionRouter = new Router<{ interaction: Interaction }>({
      host: config.issuer.host,
      prefix: prefix("/interaction").pathname,
    });
    interactionRouter.use(async (ctx, next) => {
      ctx.headers["cache-control"] = "no-store";
      try {
        ctx.state.interaction = await provider.interactionDetails(
          ctx.req,
          ctx.res,
        );
        await next();
      } catch (error) {
        console.error(error);
        if (error instanceof errors.OIDCProviderError) {
          ctx.status = error.status;
        }
        ctx.type = "html";
        ctx.body = renderError(error, ctx.state.interaction);
      }
    });
    interactionRouter.get("/:uid", (ctx) => {
      switch (ctx.state.interaction.prompt.name) {
        case "login": {
          ctx.type = "html";
          ctx.body = renderLoginPrompt(ctx.state.interaction);
          return;
        }
        default: {
          throw new Error("Unknown prompt");
        }
      }
    });
    interactionRouter.post(
      "/:uid/login",
      koaBody({ multipart: false, urlencoded: true, text: false, json: false }),
      async (ctx) => {
        if (ctx.state.interaction.prompt.name !== "login") {
          throw new Error("Unexpected type of prompt");
        }

        const { email, password } = ctx.request.body;
        if (
          typeof email !== "string" ||
          typeof password !== "string" ||
          !email ||
          !password
        ) {
          throw new errors.InvalidRequest("invalid email or password");
        }

        const [account] = await accounts.find({
          where: { email: { equals: email } },
          limit: 1,
        });
        if (!account) {
          throw new errors.AccessDenied("incorrect email or password");
        }

        const { id: accountId, passwordHash } = await account.get();
        const valid = await compare(password, passwordHash);
        if (!valid) {
          throw new errors.AccessDenied("incorrect email or password");
        }

        await provider.interactionFinished(ctx.req, ctx.res, {
          login: { accountId },
        });
      },
    );

    return {
      start: db.connect.after("OpenIdConnectIdentityProvider.start", () => {
        provider = new Provider(config.issuer.href, providerConfig);
        http.use(interactionRouter.routes());
        http.use(mount(config.issuer.pathname, provider.app));
      }),
      accounts,
      createPasswordHash: (password: string) => hash(password, 10),
    };
  },
);

export const OpenIdConnectIdentityProviderFeature = createFeature(
  [OpenIdConnectIdentityProvider, OidcProviderDatabaseAdapter],
  OpenIdConnectIdentityProviderConfiguration,
);
