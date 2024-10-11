export const PORT = 3000;
export const HOSTNAME = "localhost";
export const TRPC_PATH = "/trpc";

/**
 * Secret that is used as a way of authentication. Both server and client knows
 * it. I wouldn't suggest implementing this kind of authentication in production
 * applications. For this example you can try and change the secret to see that
 * they are required to match.
 */
export const SECRET = "bad secret";
