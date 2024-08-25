import { ResourceServer } from "@pala/api";
import { app } from "../src/server";
import { mkdir } from "fs/promises";

// Ensure that target directory exists.
await mkdir(import.meta.dirname + "/../generated", { recursive: true });

const server = app.resolve(ResourceServer);
await server.generateClients();
