import { createTRPCProxyClient, createWSClient, wsLink } from "@trpc/client";
import Router from "../generated/trpc";
import {
  generateRandomCodeVerifier,
  calculatePKCECodeChallenge,
  discoveryRequest,
  processDiscoveryResponse,
  validateAuthResponse,
  Client,
  skipStateCheck,
  isOAuth2Error,
  authorizationCodeGrantRequest,
  processAuthorizationCodeOpenIDResponse,
} from "oauth4webapi";

const ISSUER = new URL("http://localhost:3001");
const CLIENT: Client = {
  client_id: "pala-client",
  token_endpoint_auth_method: "none",
};

const wsClient = createWSClient({ url: "ws://localhost:3000/" });
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
  url.searchParams.set("client_id", CLIENT.client_id);
  url.searchParams.set("redirect_uri", location.origin);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email");
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  location.href = url.href;
} else {
  const codeVerifier = sessionStorage.getItem("pala-code-verifier");
  if (!codeVerifier) {
    throw new Error("No code verifier");
  }

  const params = validateAuthResponse(
    as,
    CLIENT,
    new URL(location.href),
    skipStateCheck,
  );
  if (isOAuth2Error(params)) {
    throw new Error(params.error);
  }
  // location.replace(location.pathname);

  const result = await authorizationCodeGrantRequest(
    as,
    CLIENT,
    params,
    location.origin,
    codeVerifier,
  ).then((response) =>
    processAuthorizationCodeOpenIDResponse(as, CLIENT, response),
  );
  if (isOAuth2Error(result)) {
    throw new Error(result.error);
  }

  await client.public.read.query();
  await client.protected.read.query({ token: result.access_token });
}
