import { resolveApplication, Application } from "@palakit/core";
import { DataType, DocumentStore } from "@palakit/db";
import { MongoDocumentStoreFeature } from "@palakit/mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { SequelizeDocumentStoreFeature } from "@palakit/sequelize";

let dbNumber = 0;
let mongoServer: MongoMemoryServer;
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
});

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
])("%s", (_name, getDocumentStoreFeature) => {
  let app: Application;
  let documentStore: DocumentStore;
  beforeEach(async () => {
    app = await resolveApplication({
      name: "test",
      parts: [...getDocumentStoreFeature()],
    });
    documentStore = app.resolve(DocumentStore);
  });

  afterEach(async () => {
    await documentStore.disconnect();
  });

  afterAll(async () => {
    await mongoServer.stop();
  });

  it("resolves successfully", () => {
    expect(documentStore).toEqual({
      connect: expect.any(Function),
      disconnect: expect.any(Function),
      createCollection: expect.any(Function),
    });
  });

  describe("connect", () => {
    it("connects successfully", async () => {
      await expect(documentStore.connect()).resolves.toBeUndefined();
    });
  });

  describe("createCollection", () => {
    it("returns collection", async () => {
      const collection = documentStore
        .createCollection({
          name: "mock-collection-name",
        })
        .addField({
          name: "mockStringField",
          dataType: DataType.STRING,
        })
        .addField({
          name: "mockIntegerField",
          dataType: DataType.INTEGER,
        });
      expect(collection).toEqual({
        name: "mock-collection-name",
        fields: {
          mockStringField: { dataType: DataType.STRING },
          mockIntegerField: { dataType: DataType.INTEGER },
        },
        addField: expect.any(Function),
        removeField: expect.any(Function),
        sync: expect.any(Function),
        create: expect.any(Function),
        find: expect.any(Function),
        count: expect.any(Function),
      });
    });
  });
});
