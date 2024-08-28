import { createTRPCProxyClient, createWSClient, wsLink } from "@trpc/client";
import Router from "../generated/trpc";
import { connect } from "net";
import { WebSocket } from "ws";

/**
 * Secret that is used as a way of authentication. Both server and client knows
 * it. I wouldn't suggest implementing this kind of authentication in production
 * applications. For this example you can try and change the secret to see that
 * they are required to match.
 */
const SECRET = "bad secret";

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

const pick = <T>(array: T[]): T | undefined =>
  array[Math.round(Math.random() * (array.length - 1))];

const createName = async () => {
  const name = `${pick(firstNames)} ${pick(lastNames)}`;
  await client.names.create.mutate({ data: { name }, authorization: SECRET });
  console.log("Created a new name: " + name);
};

const updateName = async () => {
  const documents = await client.names.find.query({ authorization: SECRET });
  const oldDocument = pick(documents);
  if (!oldDocument) return;
  const { name: oldName } = oldDocument;
  const [oldFirstName] = oldName.split(" ");
  const newFirstName = pick(
    firstNames.filter((firstName) => firstName !== oldFirstName),
  );
  let newName = [newFirstName, ...oldName.split(" ").slice(1)].join(" ");
  const newDocument = await client.names.update.mutate({
    id: oldDocument.id,
    data: {
      name: newName,
    },
    authorization: SECRET,
  });
  newName = newDocument.name;
  console.log(`Updated ${oldName} to: ${newName}`);
};

const deleteName = async () => {
  const documents = await client.names.find.query({ authorization: SECRET });
  const document = pick(documents);
  if (!document) return;
  await client.names.delete.mutate({ id: document.id, authorization: SECRET });
  console.log("Deleted: " + document.name);
};

const mutations = [createName, updateName, deleteName];

const listNames = async () => {
  for (const { name } of await client.names.find.query({
    order: [["name", "ASC"]],
    authorization: SECRET,
  })) {
    console.log("- " + name);
  }
};

// Wait for port to be open.
while (true) {
  await new Promise<void>((resolve) => setTimeout(resolve, 100));
  try {
    await new Promise<void>((resolve, reject) => {
      const socket = connect(3000, "127.0.0.1");
      socket.on("connectionAttemptFailed", () => {
        socket.destroy();
        reject();
      });
      socket.on("connect", () => {
        socket.destroy();
        resolve();
      });
    });
    break;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // Ignore error.
  }
}

const wsClient = createWSClient({
  url: "ws://localhost:3000/",
  // NOTE: I couldn't get the types to align here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  WebSocket: WebSocket as any,
});
const client = createTRPCProxyClient<Router>({
  links: [wsLink({ client: wsClient })],
});

const loop = async () => {
  const count = await client.names.count.query({ authorization: SECRET });
  console.log("Current count of names: " + count);

  if (count > 0) {
    const mutateNames = pick(mutations);
    if (!mutateNames) throw new Error("No mutation functions");
    await mutateNames();
  } else {
    await createName();
  }

  await listNames();
  console.log("");
};
await loop();
setInterval(loop, 2000);
