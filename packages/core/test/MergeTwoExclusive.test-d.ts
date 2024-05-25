import { MergeTwoExclusive } from "../src/utils";

type Expect<T extends true> = T;
type Not<T extends boolean> = T extends true ? false : true;
type Equal<X, Y> = X extends Y ? (Y extends X ? true : false) : false;

export type TestMergeTwoExclusive = {
  "it does merge empty objects": [
    Expect<Equal<MergeTwoExclusive<{}, {}>, {}>>,
    Expect<Not<Equal<MergeTwoExclusive<{}, {}>, { a: "a" }>>>
  ];
  "it does merge objects with non-overlapping properties": [
    Expect<
      Equal<MergeTwoExclusive<{ a: "a" }, { b: "b" }>, { a: "a"; b: "b" }>
    >,
    Expect<
      Not<
        Equal<
          MergeTwoExclusive<{ a: "a" }, { b: "b" }>,
          { a: "a"; b: "b"; c: "c" }
        >
      >
    >
  ];
  "it does merge objects with overlapping string": [
    Expect<Equal<MergeTwoExclusive<{ a: "a" }, { a: "b" }>, { a: "b" }>>,
    Expect<Not<Equal<MergeTwoExclusive<{ a: "a" }, { a: "b" }>, { a: "a" }>>>
  ];
  "it does merge objects with overlapping function": [
    Expect<
      Equal<
        MergeTwoExclusive<{ a: () => "a" }, { a: () => "b" }>,
        { a: () => "b" }
      >
    >,
    Expect<
      Not<
        Equal<
          MergeTwoExclusive<{ a: () => "a" }, { a: () => "b" }>,
          { a: () => "a" }
        >
      >
    >
  ];
  "it does merge objects with overlapping array": [
    Expect<Equal<MergeTwoExclusive<{ a: ["a"] }, { a: ["b"] }>, { a: ["b"] }>>,
    Expect<
      Not<Equal<MergeTwoExclusive<{ a: ["a"] }, { a: ["b"] }>, { a: ["a"] }>>
    >
  ];
  "it does merge objects with overlapping object": [
    Expect<
      Equal<
        MergeTwoExclusive<{ a: { a: "a" } }, { a: { b: "b" } }>,
        { a: { a: "a"; b: "b" } }
      >
    >,
    Expect<
      Not<
        Equal<
          MergeTwoExclusive<{ a: { a: "a" } }, { a: { b: "b" } }>,
          { a: { b: "b" } }
        >
      >
    >
  ];
  "it does merge objects with overlapping deep nested string": [
    Expect<
      Equal<
        MergeTwoExclusive<
          { a: { b: { c: { d: "d" } } } },
          { a: { b: { c: { e: "e" } } } }
        >,
        { a: { b: { c: { d: "d"; e: "e" } } } }
      >
    >,
    Expect<
      Not<
        Equal<
          MergeTwoExclusive<
            { a: { b: { c: { d: "d" } } } },
            { a: { b: { c: { e: "e" } } } }
          >,
          { a: { b: { c: { e: "e" } } } }
        >
      >
    >
  ];
};
