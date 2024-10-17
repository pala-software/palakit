import { describeDocumentStore } from "../utils/describeDocumentStore";
import { Collection, DataType } from "@palakit/db";

describeDocumentStore((getDocumentStore) => {
  describe("Collection", () => {
    let collection: Collection<{ number?: { dataType: DataType.INTEGER } }>;
    beforeEach(async () => {
      await getDocumentStore().connect();
      collection = getDocumentStore().createCollection({
        name: "test",
      });
    });

    afterEach(async () => {
      await getDocumentStore().disconnect();
    });

    describe("addField", () => {
      it("returns the collection", () => {
        expect(
          collection.addField({ name: "number", dataType: DataType.INTEGER }),
        ).toBe(collection);
      });

      it("adds the field", () => {
        expect(collection.fields).toEqual({});
        collection.addField({ name: "number", dataType: DataType.INTEGER });
        expect(collection.fields).toEqual({
          number: { dataType: DataType.INTEGER },
        });
      });

      it("succeeds after sync", async () => {
        await collection.sync();
        expect(
          collection.addField({ name: "number", dataType: DataType.INTEGER }),
        ).toBe(collection);
        await collection.sync();
      });
    });

    describe("removeField", () => {
      beforeEach(() => {
        collection.addField({ name: "number", dataType: DataType.INTEGER });
      });

      it("returns the collection", () => {
        expect(collection.removeField("number")).toBe(collection);
      });

      it("removes the field", () => {
        expect(collection.fields).toEqual({
          number: { dataType: DataType.INTEGER },
        });
        collection.removeField("number");
        expect(collection.fields).toEqual({});
      });

      it("succeeds after sync", async () => {
        await collection.sync();
        expect(collection.removeField("number")).toBe(collection);
        await collection.sync();
      });
    });

    describe("sync", () => {
      it("succeeds no fields", async () => {
        await expect(collection.sync()).resolves.toBe(collection);
      });
    });

    describe("create", () => {
      beforeEach(async () => {
        await collection.sync();
      });

      it("returns DocumentHandle", async () => {
        await expect(collection.create({})).resolves.toEqual({
          get: expect.any(Function),
          update: expect.any(Function),
          delete: expect.any(Function),
        });
      });
    });

    describe("find", () => {
      beforeEach(async () => {
        await collection.sync();
        await collection.create({});
      });

      it("returns array of DocumentHandle", async () => {
        await expect(collection.find()).resolves.toEqual(
          expect.arrayContaining([
            {
              get: expect.any(Function),
              update: expect.any(Function),
              delete: expect.any(Function),
            },
          ]),
        );
      });
    });

    describe("count", () => {
      beforeEach(async () => {
        await collection.sync();
        await collection.create({});
      });

      it("returns count", async () => {
        await expect(collection.count()).resolves.toBe(1);
      });
    });
  });
});
