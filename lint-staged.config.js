export default {
  "*": () => "pnpm run lint",
  "*.{js,ts}": () => "pnpm run check-types",
};
