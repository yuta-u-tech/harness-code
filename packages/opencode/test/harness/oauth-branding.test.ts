import { describe, expect, test } from "bun:test"
import path from "path"
import { HarnessOauthCallbackPage } from "@opencode-ai/core/harness/oauth/page"

const root = path.join(__dirname, "..", "..")

describe("Harness OAuth branding", () => {
  test("Codex OAuth browser flow uses Harness branding", async () => {
    const src = await Bun.file(path.join(root, "src", "plugin", "openai", "codex.ts")).text()

    expect(src).toContain('originator: "harness"')
    expect(src).toContain('"User-Agent": `harness/${InstallationVersion}`')
    expect(src).toContain("return to Harness")
    expect(src).not.toContain('originator: "opencode"')
    expect(src).not.toContain("return to OpenCode")
  })

  test("core OAuth browser flow uses Harness branding", async () => {
    const src = await Bun.file(path.join(root, "..", "core", "src", "plugin", "provider", "openai.ts")).text()
    const pages = [
      HarnessOauthCallbackPage.success({ provider: "ChatGPT" }),
      HarnessOauthCallbackPage.error("Denied", { provider: "ChatGPT" }),
    ]

    expect(src).toContain('originator: "harness"')
    expect(src).toContain('"User-Agent": `harness/${InstallationVersion}`')
    expect(src).toContain("HarnessOauthCallbackPage")
    expect(src).not.toContain('originator: "opencode"')
    for (const page of pages) {
      expect(page).toContain("· Harness</title>")
      expect(page).toContain('aria-label="Harness Code"')
      expect(page).toContain('viewBox="0 0 100 100"')
      expect(page).not.toContain("OpenCode")
      expect(page).not.toContain('viewBox="0 0 234 42"')
    }
  })

  test("MCP OAuth callback page uses Harness branding", async () => {
    const src = await Bun.file(path.join(root, "src", "mcp", "oauth-callback.ts")).text()

    expect(src).toContain("return to Harness")
    expect(src).not.toContain("return to OpenCode")
  })
})
