import { MergeInclusive } from "../src/utils";

type Expect<T extends true> = T;
type Not<T extends boolean> = T extends true ? false : true;
type Equal<X, Y> = X extends Y ? (Y extends X ? true : false) : false;

export type TestMergeInclusive = {
  "it handles empty": [
    Expect<Equal<MergeInclusive<[]>, {}>>,
    Expect<Not<Equal<MergeInclusive<[]>, { a: "a" }>>>,
    Expect<Not<Equal<MergeInclusive<[]>, never>>>
  ];
  "it handles singular object": [
    Expect<Equal<MergeInclusive<[{ a: "a" }]>, { a: "a" }>>,
    Expect<Not<Equal<MergeInclusive<[{ a: "a" }]>, { a: "b" }>>>,
    Expect<Not<Equal<MergeInclusive<[{ a: "a" }]>, {}>>>
  ];
  "it handles two objects": [
    Expect<Equal<MergeInclusive<[{ a: "a" }, { b: "b" }]>, { a: "a"; b: "b" }>>,
    Expect<Not<Equal<MergeInclusive<[{ a: "a" }, { b: "b" }]>, { b: "b" }>>>,
    Expect<Not<Equal<MergeInclusive<[{ a: "a" }, { b: "b" }]>, {}>>>
  ];
  "it handles three objects": [
    Expect<
      Equal<
        MergeInclusive<[{ a: "a" }, { b: "b" }, { c: "c" }]>,
        { a: "a"; b: "b"; c: "c" }
      >
    >,
    Expect<
      Not<
        Equal<
          MergeInclusive<[{ a: "a" }, { b: "b" }, { c: "c" }]>,
          { a: "a"; b: "b" }
        >
      >
    >,
    Expect<Not<Equal<MergeInclusive<[{ a: "a" }, { b: "b" }, { c: "c" }]>, {}>>>
  ];
};
