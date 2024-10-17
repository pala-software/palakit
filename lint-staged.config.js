export default {
  "*": () => "pnpm run check:lint",
  "*.{js,ts}": () => "pnpm run check:types",
};
