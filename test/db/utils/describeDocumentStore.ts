import { MongoDocumentStoreFeature } from "@palakit/mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { SequelizeDocumentStoreFeature } from "@palakit/sequelize";
import { resolveApplication } from "@palakit/core";
import { DocumentStore } from "@palakit/db";

let dbNumber = 0;
let mongoServer: MongoMemoryServer;
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
});

afterAll(async () => {
  await mongoServer.stop();
});

export const describeDocumentStore = (
  fn: (getDocumentStore: () => DocumentStore) => void,
) => {
  describe.each([
    [
      "MongoDocumentStore",
      () =>
        MongoDocumentStoreFeature.configure({
          url: mongoServer.getUri(`db-${++dbNumber}`),
        }),
    ],
    [
      "SequelizeDocumentStore",
      () =>
        SequelizeDocumentStoreFeature.configure({
          dialect: "sqlite",
          storage: ":memory:",
          logging: false,
        }),
    ],
  ])("%s", (_name, getFeature) => {
    let documentStore: DocumentStore;
    beforeEach(async () => {
      const app = await resolveApplication({
        name: "test",
        parts: [...getFeature()],
      });
      documentStore = app.resolve(DocumentStore);
    });

    fn(() => documentStore);
  });
};
