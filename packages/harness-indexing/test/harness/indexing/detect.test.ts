import { describe, expect, test } from "bun:test"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import { hasIndexingPlugin, isIndexingPlugin, normalizePluginName } from "../../../src/detect"

describe("indexing plugin detection", () => {
  test("bundles detect module for browser targets", async () => {
    const dir = await mkdtemp(`${tmpdir()}/harness-indexing-detect-`)
    const result = await Bun.build({
      entrypoints: [fileURLToPath(new URL("../../../src/detect.ts", import.meta.url))],
      minify: true,
      outdir: dir,
      target: "browser",
    })

    expect(result.success).toBe(true)
  })

  test("normalizes supported plugin forms", () => {
    expect(normalizePluginName("harness-indexing")).toBe("harness-indexing")
    expect(normalizePluginName("harness-indexing@1.2.3")).toBe("harness-indexing")
    expect(normalizePluginName("@harness/harness-indexing")).toBe("@harness/harness-indexing")
    expect(normalizePluginName("@harness/harness-indexing@1.2.3")).toBe("@harness/harness-indexing")
    expect(normalizePluginName("../../packages/harness-indexing")).toBe("@harness/harness-indexing")
    expect(normalizePluginName("file:///tmp/.opencode/plugin/harness-indexing.js")).toBe("harness-indexing")
    expect(normalizePluginName("file:///tmp/node_modules/@harness/harness-indexing/index.js")).toBe(
      "@harness/harness-indexing",
    )
    expect(normalizePluginName("file:///tmp/repo/packages/harness-indexing/src/index.ts")).toBe("@harness/harness-indexing")
  })

  test("detects supported indexing plugin specifiers", () => {
    const values = [
      "harness-indexing",
      "harness-indexing@1.2.3",
      "@harness/harness-indexing",
      "@harness/harness-indexing@1.2.3",
      "../../packages/harness-indexing",
      "file:///tmp/.opencode/plugin/harness-indexing.js",
      "file:///tmp/node_modules/@harness/harness-indexing/index.js",
      "file:///tmp/repo/packages/harness-indexing/src/index.ts",
    ]

    for (const value of values) {
      expect(isIndexingPlugin(value)).toBe(true)
    }
  })

  test("ignores unrelated plugin specifiers", () => {
    expect(isIndexingPlugin("@harness/harness-gateway")).toBe(false)
    expect(isIndexingPlugin("file:///tmp/.opencode/plugin/index.js")).toBe(false)
    expect(hasIndexingPlugin(["@harness/harness-gateway", "foo@1.0.0"])).toBe(false)
  })

  test("detects indexing plugin in merged plugin lists", () => {
    expect(
      hasIndexingPlugin(["@harness/harness-gateway", "file:///tmp/node_modules/@harness/harness-indexing/index.js"]),
    ).toBe(true)
  })
})
