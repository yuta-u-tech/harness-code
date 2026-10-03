import { describe, expect, test } from "bun:test"
import {
  hasHarnessIndexingAuth,
  resolveHarnessIndexingAuth,
  shouldDefaultIndexingToHarness,
} from "../../src/harness/indexing-auth"

describe("Harness indexing auth resolution", () => {
  test("detects auth from explicit indexing Harness config", () => {
    const auth = resolveHarnessIndexingAuth({
      config: { indexing: { harness: { apiKey: "idx-token", baseUrl: "https://idx.test", organizationId: "org_idx" } } },
    })

    expect(auth).toEqual({ apiKey: "idx-token", baseUrl: "https://idx.test", organizationId: "org_idx" })
    expect(hasHarnessIndexingAuth({ config: { indexing: { harness: { apiKey: "idx-token" } } } })).toBe(true)
  })

  test("detects auth from provider config, provider state, auth storage, and env", () => {
    expect(
      resolveHarnessIndexingAuth({ config: { provider: { harness: { options: { apiKey: "cfg-token" } } } } }).apiKey,
    ).toBe("cfg-token")
    expect(resolveHarnessIndexingAuth({ provider: { options: { harnessToken: "provider-token" } } }).apiKey).toBe(
      "provider-token",
    )
    expect(resolveHarnessIndexingAuth({ auth: { type: "oauth", access: "oauth-token", accountId: "org_oauth" } })).toEqual(
      {
        apiKey: "oauth-token",
        organizationId: "org_oauth",
      },
    )
    expect(resolveHarnessIndexingAuth({ env: { HARNESS_API_KEY: "env-token", HARNESS_ORG_ID: "org_env" } })).toEqual({
      apiKey: "env-token",
      organizationId: "org_env",
    })
  })

  test("defaults to Harness only when no provider or other embedder config is present", () => {
    const auth = { apiKey: "harness-token" }

    expect(shouldDefaultIndexingToHarness({}, auth)).toBe(true)
    expect(shouldDefaultIndexingToHarness({ provider: "openai" }, auth)).toBe(false)
    expect(shouldDefaultIndexingToHarness({ openai: { apiKey: "openai-key" } }, auth)).toBe(false)
    expect(shouldDefaultIndexingToHarness({ ollama: { baseUrl: "http://localhost:11434" } }, auth)).toBe(false)
  })
})
