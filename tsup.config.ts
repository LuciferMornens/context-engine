import { defineConfig } from "tsup";

export default defineConfig([
  // CLI entry — with shebang
  {
    entry: { "cli/index": "src/cli/index.ts" },
    format: ["esm"],
    target: "node20",
    outDir: "dist",
    clean: true,
    splitting: false,
    sourcemap: true,
    dts: false,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  // Library entry — no shebang, with types
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    target: "node20",
    outDir: "dist",
    clean: false,
    splitting: false,
    sourcemap: true,
    dts: true,
  },
]);
