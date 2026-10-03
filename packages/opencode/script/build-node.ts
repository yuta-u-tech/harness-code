#!/usr/bin/env bun

import { Script } from "@opencode-ai/script"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

process.chdir(dir)

const generated = await import("./generate.ts")

await Bun.build({
  target: "node",
  entrypoints: [
    "./src/node.ts",
    "../harness-sandbox/src/harness-sandbox-mutation-worker.ts",
    "../harness-sandbox/src/harness-sandbox-network-relay.ts",
  ],
  outdir: "./dist/node",
  format: "esm",
  sourcemap: "linked",
  external: ["jsonc-parser", "@lydell/node-pty"],
  define: {
    HARNESS_MODELS_DEV: generated.modelsData,
    HARNESS_VERSION: `'${Script.version}'`,
    HARNESS_SANDBOX_MUTATION_WORKER_PATH: `'./harness-sandbox-mutation-worker.js'`,
    HARNESS_SANDBOX_NETWORK_RELAY_PATH: `'./harness-sandbox-network-relay.js'`,
    HARNESS_SANDBOX_SECCOMP_PATH: "undefined",
    HARNESS_CHANNEL: `'${Script.channel}'`,
  },
  files: {
    "opencode-web-ui.gen.ts": "",
  },
})

console.log("Build complete")
