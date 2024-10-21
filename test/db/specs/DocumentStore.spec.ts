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
          dataType: "string",
        })
        .addField({
          name: "integer",
          dataType: "integer",
        });
      expect(collection).toEqual({
        name: "test",
        fields: {
          string: { dataType: "string" },
          integer: { dataType: "integer" },
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
