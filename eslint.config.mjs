import js from "@eslint/js";
import ts from "typescript-eslint";
import prettierRecommended from "eslint-plugin-prettier/recommended";

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  prettierRecommended,
  { ignores: ["examples/*/generated"] },
);
