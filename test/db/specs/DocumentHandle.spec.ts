import { Collection, DocumentHandle } from "@palakit/db";
import { describeDocumentStore } from "../utils/describeDocumentStore";

describeDocumentStore((getDocumentStore) => {
  let collection: Collection<{
    number: { dataType: "integer"; nullable: false };
  }>;
  let documentHandle: DocumentHandle<{ number: number }>;
  beforeEach(async () => {
    await getDocumentStore().connect();
    collection = getDocumentStore()
      .createCollection({ name: "test" })
      .addField({
        name: "number",
        dataType: "integer",
        nullable: false,
      });
    await collection.sync();
    await collection.create({ number: 1 });
    [documentHandle] = await collection.find();
  });

  afterEach(async () => {
    await getDocumentStore().disconnect();
  });

  describe("get", () => {
    it("returns document", async () => {
      await expect(documentHandle.get()).resolves.toEqual({
        id: expect.any(String),
        number: 1,
      });
    });
  });

  describe("update", () => {
    it("modifies document", async () => {
      await documentHandle.update({ number: 2 });
      await expect(documentHandle.get()).resolves.toEqual({
        id: expect.any(String),
        number: 2,
      });
    });
  });

  describe("delete", () => {
    it("deletes document", async () => {
      await documentHandle.delete();
      await expect(collection.count()).resolves.toBe(0);
    });
  });
});
