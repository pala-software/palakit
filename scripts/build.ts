import { readdir, readFile, rm, writeFile } from "fs/promises";
import { build } from "tsup";

const srcDir = "./packages";
const outDir = "./dist";

await rm(outDir, { recursive: true, force: true });
for (const name of await readdir(srcDir)) {
  const packageJsonBuffer = await readFile(`${srcDir}/${name}/package.json`);
  const packageJson = JSON.parse(packageJsonBuffer.toString());
  const entryPoint = packageJson.main;
  if (!entryPoint) {
    throw new Error("No main field in package.json");
  }

  await build({
    entry: { index: `${srcDir}/${name}/${entryPoint}` },
    outDir: `${outDir}/${name}`,
    format: ["esm"],
    dts: true,
    splitting: false,
    clean: false,
    minify: true,
    skipNodeModulesBundle: true,
  });

  const modifiedPackageJson = {
    ...packageJson,
    main: "./index.js",
    types: "./index.d.ts",
  };
  const modifiedPackageJsonBuffer = Buffer.from(
    JSON.stringify(modifiedPackageJson, undefined, "  "),
  );
  await writeFile(`${outDir}/${name}/package.json`, modifiedPackageJsonBuffer);
}
