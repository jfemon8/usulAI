import { build } from "esbuild";

await build({
  entryPoints: ["widget-src/loader.ts"],
  bundle: true,
  minify: true,
  format: "iife",
  outfile: "public/widget.js",
  target: "es2018",
});

console.log("widget.js built -> public/widget.js");
