import { Collection } from "@palakit/db";
import { describeDocumentStore } from "../utils/describeDocumentStore";

describeDocumentStore((getDocumentStore) => {
  beforeEach(async () => {
    await getDocumentStore().connect();
  });

  afterEach(async () => {
    await getDocumentStore().disconnect();
  });

  describe("JsonField", () => {
    let collection: Collection<{ json: { dataType: "json" } }>;
    beforeEach(async () => {
      collection = await getDocumentStore()
        .createCollection({ name: "test" })
        .addField({ name: "json", dataType: "json" })
        .sync();
    });

    describe.each([
      { name: "null", factory: () => null },
      { name: "boolean", factory: () => true },
      { name: "number", factory: () => 2 },
      { name: "string", factory: () => "h" },
      { name: "array", factory: () => ["a", "b", "c"] },
      { name: "object", factory: () => ({ a: 0, b: 1, c: 2 }) },
      {
        name: "complex object",
        factory: () => ({
          a: null,
          b: false,
          c: 0,
          d: "",
          e: [null, true, 1, "a", { a: null, b: true, c: 2, d: "b" }],
          f: {
            a: null,
            b: true,
            c: 3,
            d: "c",
            e: [null, true, 4, "d", { a: null, b: true, c: 5, d: "g" }],
          },
        }),
      },
    ] satisfies { name: string; factory: () => unknown }[])(
      "$name",
      ({ factory }) => {
        it("is saved on creation", async () => {
          const document = await collection.create({
            json: factory(),
          });
          const values = await document.get();
          expect(values).toEqual({
            id: expect.any(String),
            json: factory(),
          });
        });

        it("is saved on update", async () => {
          const document = await collection.create({});
          await document.update({ json: factory() });
          const values = await document.get();
          expect(values).toEqual({
            id: expect.any(String),
            json: factory(),
          });
        });
      },
    );
  });
});
