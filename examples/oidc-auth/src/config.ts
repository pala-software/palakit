import type { Client } from "oauth4webapi";

export const PORT = 3000;
export const HOSTNAME = "localhost";
export const TRPC_PATH = "/trpc";
export const AUTH_PATH = "/id";
export const ISSUER = new URL(`http://${HOSTNAME}:${PORT}${AUTH_PATH}`);

export const ACCOUNTS = [
  { email: "test@example.com", password: "test" },
] satisfies {
  email: string;
  password: string;
}[];

export const BACKEND_CLIENT = {
  client_id: "pala-backend",
  client_secret: crypto.randomUUID(),
  redirect_uris: [],
  response_types: [],
  grant_types: [],
} satisfies Client;

export const FRONTEND_CLIENT = {
  client_id: "pala-frontend",
  redirect_uris: ["http://localhost:5173"],
  token_endpoint_auth_method: "none",
} satisfies Client;

export const CLIENTS = [BACKEND_CLIENT, FRONTEND_CLIENT] satisfies Client[];
