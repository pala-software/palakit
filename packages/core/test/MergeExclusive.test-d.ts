import { MergeExclusive } from "../src/utils";

type Expect<T extends true> = T;
type Not<T extends boolean> = T extends true ? false : true;
type Equal<X, Y> = X extends Y ? (Y extends X ? true : false) : false;

export type TestMergeExclusive = {
  "it handles empty": [
    Expect<Equal<MergeExclusive<[]>, {}>>,
    Expect<Not<Equal<MergeExclusive<[]>, { a: "a" }>>>,
    Expect<Not<Equal<MergeExclusive<[]>, never>>>
  ];
  "it handles singular object": [
    Expect<Equal<MergeExclusive<[{ a: "a" }]>, { a: "a" }>>,
    Expect<Not<Equal<MergeExclusive<[{ a: "a" }]>, { a: "b" }>>>,
    Expect<Not<Equal<MergeExclusive<[{ a: "a" }]>, {}>>>
  ];
  "it handles two objects": [
    Expect<Equal<MergeExclusive<[{ a: "a" }, { b: "b" }]>, { a: "a"; b: "b" }>>,
    Expect<Not<Equal<MergeExclusive<[{ a: "a" }, { b: "b" }]>, { b: "b" }>>>,
    Expect<Not<Equal<MergeExclusive<[{ a: "a" }, { b: "b" }]>, {}>>>
  ];
  "it handles three objects": [
    Expect<
      Equal<
        MergeExclusive<[{ a: "a" }, { b: "b" }, { c: "c" }]>,
        { a: "a"; b: "b"; c: "c" }
      >
    >,
    Expect<
      Not<
        Equal<
          MergeExclusive<[{ a: "a" }, { b: "b" }, { c: "c" }]>,
          { a: "a"; b: "b" }
        >
      >
    >,
    Expect<Not<Equal<MergeExclusive<[{ a: "a" }, { b: "b" }, { c: "c" }]>, {}>>>
  ];
};
