import { createTRPCProxyClient, createWSClient, wsLink } from "@trpc/client";
import Router from "../build/trpc";
import {
  generateRandomCodeVerifier,
  calculatePKCECodeChallenge,
  discoveryRequest,
  processDiscoveryResponse,
  validateAuthResponse,
  skipStateCheck,
  isOAuth2Error,
  authorizationCodeGrantRequest,
  processAuthorizationCodeOpenIDResponse,
} from "oauth4webapi";
import { FRONTEND_CLIENT, HOSTNAME, ISSUER, PORT, TRPC_PATH } from "./config";

try {
  const wsClient = createWSClient({
    url: `ws://${HOSTNAME}:${PORT}${TRPC_PATH}`,
  });
  const client = createTRPCProxyClient<Router>({
    links: [wsLink({ client: wsClient })],
  });

  const as = await discoveryRequest(ISSUER).then((response) =>
    processDiscoveryResponse(ISSUER, response),
  );
  if (!as.authorization_endpoint) {
    throw new Error("No authorization_endpoint");
  }

  const query = new URLSearchParams(location.search.slice(1));
  if (!query.has("code")) {
    const codeVerifier = generateRandomCodeVerifier();
    const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);
    sessionStorage.setItem("pala-code-verifier", codeVerifier);

    const url = new URL(as.authorization_endpoint);
    url.searchParams.set("client_id", FRONTEND_CLIENT.client_id);
    url.searchParams.set("redirect_uri", location.origin);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email");
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    location.href = url.href;
    document.body.textContent = "redirecting";
  } else {
    const codeVerifier = sessionStorage.getItem("pala-code-verifier");
    if (!codeVerifier) {
      throw new Error("No code verifier");
    }

    const params = validateAuthResponse(
      as,
      FRONTEND_CLIENT,
      new URL(location.href),
      skipStateCheck,
    );
    if (isOAuth2Error(params)) {
      throw new Error(params.error);
    }

    const result = await authorizationCodeGrantRequest(
      as,
      FRONTEND_CLIENT,
      params,
      location.origin,
      codeVerifier,
    ).then((response) =>
      processAuthorizationCodeOpenIDResponse(as, FRONTEND_CLIENT, response),
    );
    if (isOAuth2Error(result)) {
      throw new Error(result.error);
    }

    // Remove parameters
    history.replaceState(null, "", location.pathname);

    await client.public.read.query();
    await client.protected.read.query({ token: result.access_token });
    document.body.textContent = "success";
  }
} catch {
  document.body.textContent = "error";
}
