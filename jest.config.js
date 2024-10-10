import { createJsWithTsEsmPreset } from "ts-jest";

/** @type {import("ts-jest").JestConfigWithTsJest} */
export default {
  ...createJsWithTsEsmPreset(),
  transform: {
    "^.+.tsx?$": ["ts-jest", {}],
  },
};
