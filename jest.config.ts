import { createJsWithTsEsmPreset, JestConfigWithTsJest } from "ts-jest";

export default {
  roots: ["<rootDir>/test"],
  ...createJsWithTsEsmPreset(),
} satisfies JestConfigWithTsJest;
