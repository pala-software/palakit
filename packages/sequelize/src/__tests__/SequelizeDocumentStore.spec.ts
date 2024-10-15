import { resolveApplication, Application } from "@palakit/core";
import { MockApplication } from "@palakit/core/src/__mocks__/Application";
import { DataType, DocumentStore } from "@palakit/db";
import { SequelizeDocumentStoreFeature } from "../SequelizeDocumentStore";

describe("SequelizeDocumentStore", () => {
  let app: Application;
  let documentStore: DocumentStore;
  beforeEach(async () => {
    app = await resolveApplication({
      name: "MockSequelizeApp",
      parts: [
        MockApplication,
        ...SequelizeDocumentStoreFeature.configure({
          dialect: "sqlite",
          storage: ":memory:",
          logging: false,
        }),
      ],
    });
    documentStore = app.resolve(DocumentStore);
  });

  afterEach(async () => {
    await documentStore.disconnect();
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
