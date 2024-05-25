import { MergeTwoInclusive } from "../src/utils";

type Expect<T extends true> = T;
type Not<T extends boolean> = T extends true ? false : true;
type Equal<X, Y> = X extends Y ? (Y extends X ? true : false) : false;

export type TestMergeTwoInclusive = {
  "it does merge empty objects": [
    Expect<Equal<MergeTwoInclusive<{}, {}>, {}>>,
    Expect<Not<Equal<MergeTwoInclusive<{}, {}>, { a: "a" }>>>
  ];
  "it does merge objects with non-overlapping properties": [
    Expect<
      Equal<MergeTwoInclusive<{ a: "a" }, { b: "b" }>, { a: "a"; b: "b" }>
    >,
    Expect<
      Not<
        Equal<
          MergeTwoInclusive<{ a: "a" }, { b: "b" }>,
          { a: "a"; b: "b"; c: "c" }
        >
      >
    >
  ];
  "it does merge objects with overlapping string": [
    Expect<Equal<MergeTwoInclusive<{ a: "a" }, { a: "b" }>, { a: "a" | "b" }>>,
    Expect<Not<Equal<MergeTwoInclusive<{ a: "a" }, { a: "b" }>, { a: "b" }>>>
  ];
  "it does merge objects with overlapping function": [
    Expect<
      Equal<
        MergeTwoInclusive<{ a: () => "a" }, { a: () => "b" }>,
        { a: (() => "a") | (() => "b") }
      >
    >,
    Expect<
      Not<
        Equal<
          MergeTwoInclusive<{ a: () => "a" }, { a: () => "b" }>,
          { a: () => "b" }
        >
      >
    >
  ];
  "it does merge objects with overlapping array": [
    Expect<
      Equal<MergeTwoInclusive<{ a: ["a"] }, { a: ["b"] }>, { a: ["a"] | ["b"] }>
    >,
    Expect<
      Not<Equal<MergeTwoInclusive<{ a: ["a"] }, { a: ["b"] }>, { a: ["b"] }>>
    >
  ];
  "it does merge objects with overlapping object": [
    Expect<
      Equal<
        MergeTwoInclusive<{ a: { a: "a" } }, { a: { b: "b" } }>,
        { a: { a: "a"; b: "b" } }
      >
    >,
    Expect<
      Not<
        Equal<
          MergeTwoInclusive<{ a: { a: "a" } }, { a: { b: "b" } }>,
          { a: { b: "b" } }
        >
      >
    >
  ];
  "it does merge objects with overlapping deep nested string": [
    Expect<
      Equal<
        MergeTwoInclusive<
          { a: { b: { c: { d: "d" } } } },
          { a: { b: { c: { e: "e" } } } }
        >,
        { a: { b: { c: { d: "d"; e: "e" } } } }
      >
    >,
    Expect<
      Not<
        Equal<
          MergeTwoInclusive<
            { a: { b: { c: { d: "d" } } } },
            { a: { b: { c: { e: "e" } } } }
          >,
          { a: { b: { c: { e: "e" } } } }
        >
      >
    >
  ];
};
