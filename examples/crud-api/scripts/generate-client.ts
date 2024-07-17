import { ResourceServer } from "@pala/api";
import { app } from "../src/app";

const server = app.resolve(ResourceServer);
await server.generateClients();
