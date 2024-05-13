export type DeepPartial<T> = T extends Record<string, unknown>
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export type MergeTwoInclusive<
  T1 extends Record<string, unknown>,
  T2 extends Record<string, unknown>
> = {
  [K in keyof T1 | keyof T2]: K extends keyof T1
    ? K extends keyof T2
      ? T1[K] extends (...args: any[]) => any
        ? T1[K] | T2[K]
        : T1[K] extends Record<string, unknown>
        ? T2[K] extends (...args: any[]) => any
          ? T1[K] | T2[K]
          : T2[K] extends Record<string, unknown>
          ? MergeTwoInclusive<T1[K], T2[K]>
          : T1[K] | T2[K]
        : T1[K] | T2[K]
      : T1[K]
    : K extends keyof T2
    ? T2[K]
    : never;
};

export type MergeTwoExclusive<
  T1 extends Record<string, unknown>,
  T2 extends Record<string, unknown>
> = {
  [K in keyof T1 | keyof T2]: K extends keyof T1
    ? K extends keyof T2
      ? T1[K] extends (...args: any[]) => any
        ? T2[K]
        : T1[K] extends Record<string, unknown>
        ? T2[K] extends (...args: any[]) => any
          ? T2[K]
          : T2[K] extends Record<string, unknown>
          ? MergeTwoExclusive<T1[K], T2[K]>
          : T2[K]
        : T2[K]
      : T1[K]
    : K extends keyof T2
    ? T2[K]
    : never;
};

export type MergeInclusive<T extends Record<string, unknown>[]> = T extends [
  infer T1 extends Record<string, unknown>,
  infer T2 extends Record<string, unknown>,
  ...infer T3 extends Record<string, unknown>[] | []
]
  ? MergeInclusive<[MergeTwoInclusive<T1, T2>, ...T3]>
  : T extends [infer T1 extends Record<string, unknown>]
  ? T1
  : {};

export type MergeExclusive<T extends Record<string, unknown>[]> = T extends [
  infer T1 extends Record<string, unknown>,
  infer T2 extends Record<string, unknown>,
  ...infer T3 extends Record<string, unknown>[] | []
]
  ? MergeExclusive<[MergeTwoExclusive<T1, T2>, ...T3]>
  : T extends [infer T1 extends Record<string, unknown>]
  ? T1
  : {};
