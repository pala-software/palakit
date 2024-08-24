import { $ } from "bun";

$.cwd(__dirname + "/..");

await $`bun run generate-client`;
await $`bun run build-client`;

const server = $`bun run scripts/start-server.ts`.then();

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // Ignore error.
  }
}

const client = $`bun run serve-client`;
await Promise.all([server, client]);
