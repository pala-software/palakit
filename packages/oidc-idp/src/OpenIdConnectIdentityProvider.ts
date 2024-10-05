import { createConfiguration, createFeature, createPart } from "@palakit/core";
import Provider, { ClientMetadata, Interaction, errors } from "oidc-provider";
import { KoaHttpServer } from "@palakit/koa";
import Router from "@koa/router";
import mount from "koa-mount";
import { koaBody } from "koa-body";

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

const renderError = (error: unknown) =>
  renderTemplate(
    { title: "Error" },
    error instanceof errors.OIDCProviderError && error.expose
      ? `<p>${
          escape(error.error) +
          (error.error_description
            ? `: ${escape(error.error_description)}`
            : "")
        }</p>`
      : "<p>an error occurred.</p>",
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
      renderError: (ctx, _out, error) => {
        console.error(error);
        ctx.type = "html";
        ctx.body = renderError(error);
      },
    });

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
        ctx.body = renderError(error);
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
          ctx.status = 400;
          return;
        }

        // TODO: Check password.

        const accountId = email;
        const grant = new provider.Grant({
          accountId,
          clientId: ctx.state.interaction.params.client_id as
            | string
            | undefined,
        });
        grant.addOIDCScope("openid");
        const grantId = await grant.save();
        await provider.interactionFinished(ctx.req, ctx.res, {
          login: { accountId },
          consent: { grantId },
        });
      },
    );

    http.use(interactionRouter.routes());
    http.use(mount(config.issuer.pathname, provider.app));
  },
);

export const OpenIdConnectIdentityProviderFeature = createFeature(
  [OpenIdConnectIdentityProvider],
  OpenIdConnectIdentityProviderConfiguration,
);
