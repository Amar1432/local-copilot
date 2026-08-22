import * as esbuild from "esbuild";
import { cpSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: [resolve(__dirname, "src/extension.ts")],
  bundle: true,
  outfile: resolve(__dirname, "dist/extension.js"),
  external: ["vscode", "@local-copilot/core", "@local-copilot/shared"],
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: !production,
  minify: production,
  treeShaking: true,
  logLevel: "info",
};

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await esbuild.build(buildOptions);

  // Copy static assets if they exist
  const staticDir = resolve(__dirname, "static");
  if (existsSync(staticDir)) {
    cpSync(staticDir, resolve(__dirname, "dist"), { recursive: true });
    console.log("Copied static assets to dist/");
  }

  console.log("Build complete!");
}
