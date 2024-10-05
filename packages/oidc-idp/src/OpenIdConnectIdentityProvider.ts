import { createConfiguration, createFeature, createPart } from "@palakit/core";
import Provider, { ClientMetadata, Interaction, errors } from "oidc-provider";
import { KoaHttpServer } from "@palakit/koa";
import Router from "@koa/router";
import mount from "koa-mount";

export type OpenIdConnectIdentityProviderConfiguration = {
  issuer: URL;
  clients: ClientMetadata[];
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

const renderLogin = (interaction: Interaction) =>
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
        name="login"
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

export const OpenIdConnectIdentityProvider = createPart(
  "OpenIdConnectIdentityProvider",
  [OpenIdConnectIdentityProviderConfiguration, KoaHttpServer],
  ([config, http]) => {
    const prefix = (path: string) =>
      new URL(path.slice(1), config.issuer.href + "/");

    const provider = new Provider(config.issuer.href, {
      clients: config.clients,
      clientBasedCORS: (_ctx, origin, client) => {
        if (!client.redirectUris) {
          return false;
        }

        return client.redirectUris.some(
          (uri) => origin === new URL(uri).origin,
        );
      },
      interactions: {
        url: (_ctx, interaction) =>
          prefix(`/interaction/${interaction.uid}`).href,
      },
      features: {
        devInteractions: { enabled: false },
        introspection: { enabled: true },
      },
    });

    const interactionRouter = new Router<{ interaction: Interaction }>({
      prefix: "/interaction",
    });
    interactionRouter.use(async (ctx, next) => {
      try {
        ctx.state.interaction = await provider.interactionDetails(
          ctx.req,
          ctx.res,
        );
        await next();
      } catch (error) {
        if (error instanceof errors.SessionNotFound) {
          ctx.res.statusCode = error.status;
          ctx.res.setHeader("Content-Type", "text/plain");
          ctx.res.write(error.error + "\n\n" + error.error_description);
          ctx.res.end();
          return true;
        } else {
          throw error;
        }
      }
    });
    interactionRouter.get("/:uid", (ctx) => {
      switch (ctx.state.interaction.prompt.name) {
        case "login": {
          ctx.res.setHeader("Content-Type", "text/html");
          ctx.res.write(renderLogin(ctx.state.interaction));
          ctx.res.end();
          return;
        }
        default: {
          // TODO: Handle maybe
          return;
        }
      }
    });
    interactionRouter.post("/:uid/login", async (ctx) => {
      await provider.interactionFinished(ctx.req, ctx.res, {
        login: { accountId: "asd" },
      });
    });

    const router = new Router({
      host: config.issuer.host,
      prefix: config.issuer.pathname,
    });
    router.use(interactionRouter.routes());
    http.use(router.routes());
    http.use(mount(config.issuer.pathname, provider.app));
  },
);

export const OpenIdConnectIdentityProviderFeature = createFeature(
  [OpenIdConnectIdentityProvider],
  OpenIdConnectIdentityProviderConfiguration,
);
