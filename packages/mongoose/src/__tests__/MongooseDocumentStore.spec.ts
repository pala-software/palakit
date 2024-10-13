import { resolveApplication, Application } from "@palakit/core";
import { MockApplication } from "@palakit/core/src/__mocks__/Application";
import { DataType, DocumentStore } from "@palakit/db";
import { MongooseDocumentStoreFeature } from "../MongooseDocumentStore";
import { MongoMemoryServer } from "mongodb-memory-server";

describe("MongooseDocumentStore", () => {
  let mongoServer: MongoMemoryServer;
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
  });

  let dbNumber = 0;
  let app: Application;
  let documentStore: DocumentStore;
  beforeEach(async () => {
    app = await resolveApplication({
      name: "MockMongoApp",
      parts: [
        MockApplication,
        ...MongooseDocumentStoreFeature.configure({
          connectionString: mongoServer.getUri(),
          connectOptions: { dbName: `db-${++dbNumber}` },
        }),
      ],
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

  describe("Collection", () => {
    describe("addField", () => {
      it("can be called after connection has been established", (done) => {
        const collection = documentStore.createCollection({
          name: "mock-collection-name",
        });

        documentStore.connect.after("test.documentStore.connect.after", () => {
          expect(() =>
            collection.addField({
              name: "mockStringField",
              dataType: DataType.STRING,
            }),
          ).not.toThrow();
          done();
        });
      });
    });

    describe("removeField", () => {
      it("can be called after connection has been established", (done) => {
        const collection = documentStore
          .createCollection({
            name: "mock-collection-name",
          })
          .addField({
            name: "mockStringField",
            dataType: DataType.STRING,
          });

        documentStore.connect.after("test.documentStore.connect.after", () => {
          expect(() => collection.removeField("mockStringField")).not.toThrow();
          done();
        });
      });
    });
  });
});
