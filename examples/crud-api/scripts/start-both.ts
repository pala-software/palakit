import { $ } from "bun";

$.cwd(__dirname);
const server = $`bun run start-server.ts`.then();

// Wait for port to be open.
while (true) {
  await new Promise<void>((resolve) => setTimeout(resolve, 100));
  try {
    const socket = await Bun.connect({
      hostname: "127.0.0.1",
      port: 3000,
      socket: { drain: () => {} },
    });
    socket.terminate();
    break;
  } catch (_error) {
    // Ignore error.
  }
}

const client = $`bun run start-client.ts`;
await Promise.all([server, client]);
