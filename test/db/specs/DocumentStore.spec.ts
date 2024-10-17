import { DataType } from "@palakit/db";
import { describeDocumentStore } from "../utils/describeDocumentStore";

describeDocumentStore((getDocumentStore) => {
  it("resolves successfully", () => {
    expect(getDocumentStore()).toEqual({
      connect: expect.any(Function),
      disconnect: expect.any(Function),
      createCollection: expect.any(Function),
    });
  });

  describe("connect", () => {
    afterEach(async () => {
      await getDocumentStore().disconnect();
    });

    it("connects successfully", async () => {
      await expect(getDocumentStore().connect()).resolves.toBeUndefined();
    });
  });

  describe("createCollection", () => {
    it("returns collection", async () => {
      const collection = getDocumentStore()
        .createCollection({
          name: "test",
        })
        .addField({
          name: "string",
          dataType: DataType.STRING,
        })
        .addField({
          name: "integer",
          dataType: DataType.INTEGER,
        });
      expect(collection).toEqual({
        name: "test",
        fields: {
          string: { dataType: DataType.STRING },
          integer: { dataType: DataType.INTEGER },
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
