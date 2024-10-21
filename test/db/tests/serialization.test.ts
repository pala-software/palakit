import { describeDocumentStore } from "../utils/describeDocumentStore";
import { z } from "zod";

describeDocumentStore((getDocumentStore) => {
  beforeEach(async () => {
    await getDocumentStore().connect();
  });

  afterEach(async () => {
    await getDocumentStore().disconnect();
  });

  describe("serializing number as string", () => {
    it("does not allow you normally to input number in string field (create)", async () => {
      const collection = await getDocumentStore()
        .createCollection({ name: "test" })
        .addField({
          name: "number",
          dataType: "string",
          schema: z.number().optional(),
        })
        .sync();
      await expect(collection.create({ number: 111 })).rejects.toThrow();
    });

    it("does not allow you normally to input number in string field (update)", async () => {
      const collection = await getDocumentStore()
        .createCollection({ name: "test" })
        .addField({
          name: "number",
          dataType: "string",
          schema: z.number().optional(),
        })
        .sync();
      const document = await collection.create({});
      await expect(document.update({ number: 111 })).rejects.toThrow();
    });

    it("allows you to serialize number to string field (create)", async () => {
      const collection = await getDocumentStore()
        .createCollection({ name: "test" })
        .addField({
          name: "number",
          dataType: "string",
          schema: z.number().optional(),
          serialize: String,
          deserialize: Number,
        })
        .sync();
      const document = await collection.create({ number: 111 });
      await expect(document.get()).resolves.toEqual({
        id: expect.any(String),
        number: 111,
      });
    });

    it("allows you to serialize number to string field (update)", async () => {
      const collection = await getDocumentStore()
        .createCollection({ name: "test" })
        .addField({
          name: "number",
          dataType: "string",
          schema: z.number().optional(),
          serialize: String,
          deserialize: Number,
        })
        .sync();
      const document = await collection.create({});
      await document.update({ number: 111 });
      await expect(document.get()).resolves.toEqual({
        id: expect.any(String),
        number: 111,
      });
    });
  });
});
