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

const pick = <T>(array: T[]): T | undefined =>
  array[Math.round(Math.random() * (array.length - 1))];

const createName = async () => {
  const name = `${pick(firstNames)} ${pick(lastNames)}`;
  await client.name.create.mutate({ name });
  console.log("Created a new name: " + name);
};

const updateName = async () => {
  const documents = await client.name.read.query();
  const oldDocument = pick(documents);
  if (!oldDocument) return;
  const { name: oldName } = oldDocument;
  const [oldFirstName] = oldName.split(" ");
  const newFirstName = pick(
    firstNames.filter((firstName) => firstName !== oldFirstName),
  );
  let newName = [newFirstName, ...oldName.split(" ").slice(1)].join(" ");
  const newDocument = await client.name.update.mutate({
    ...oldDocument,
    name: newName,
  });
  newName = newDocument.name;
  console.log(`Updated ${oldName} to: ${newName}`);
};

const deleteName = async () => {
  const documents = await client.name.read.query();
  const document = pick(documents);
  if (!document) return;
  await client.name.delete.mutate(document);
  console.log("Deleted: " + document.name);
};

const mutations = [createName, updateName, deleteName];

const listNames = async () => {
  console.group("Current list of names:");
  for (const { name } of await client.name.read.query()) {
    console.log("- " + name);
  }
  console.groupEnd();
};

const wsClient = createWSClient({ url: "ws://localhost:3000/" });
const client = createTRPCProxyClient<Router>({
  links: [wsLink({ client: wsClient })],
});

const loop = async () => {
  const count = await client.name.count.query();
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
