import { createTRPCProxyClient, createWSClient, wsLink } from "@trpc/client";
import Router from "../generated/trpc";

const firstNames = [
  "Matti",
  "Timo",
  "Juha",
  "Kari",
  "Antti",
  "Mikko",
  "Jari",
  "Pekka",
  "Jukka",
  "Markku",
];

const lastNames = [
  "Korhonen",
  "Virtanen",
  "Mäkinen",
  "Nieminen",
  "Mäkelä",
  "Hämäläinen",
  "Laine",
  "Heikkinen",
  "Koskinen",
  "Järvinen",
];

const pick = <T>(array: T[]): T =>
  array[Math.round(Math.random() * (array.length - 1))];

const createName = async () => {
  const name = `${pick(firstNames)} ${pick(lastNames)}`;
  await client.names.create.mutate({ name });
  console.log("Created a new name: " + name);
};

const listNames = async () => {
  console.group("Current list of names:");
  for (const { name } of await client.names.read.query()) {
    console.log("- " + name);
  }
  console.groupEnd();
};

const wsClient = createWSClient({ url: "ws://localhost:3000/" });
const client = createTRPCProxyClient<Router>({
  links: [wsLink({ client: wsClient })],
});

const loop = async () => {
  await createName();
  await listNames();
  console.log("");
};
await loop();
setInterval(loop, 2000);
