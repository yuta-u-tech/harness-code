import { describe, expect, it } from "bun:test"
import { resolveModelSelection } from "../../webview-ui/src/context/model-selection"
import { parseModelString } from "../../src/shared/provider-model"
import type { ModelSelection, Provider } from "../../webview-ui/src/types/messages"

function makeProvider(id: string, name: string, modelIds: string[]): Provider {
  const models: Provider["models"] = {}
  for (const modelID of modelIds) {
    models[modelID] = { id: modelID, name: modelID }
  }
  return { id, name, models }
}

const FALLBACK: ModelSelection = { providerID: "anthropic", modelID: "claude-sonnet-4" }

const providers = {
  anthropic: makeProvider("anthropic", "Anthropic", ["claude-sonnet-4"]),
  openai: makeProvider("openai", "OpenAI", ["gpt-4.1"]),
}

describe("parseModelString", () => {
  it("parses provider/model pairs", () => {
    expect(parseModelString("anthropic/claude-sonnet-4")).toEqual({
      providerID: "anthropic",
      modelID: "claude-sonnet-4",
    })
  })

  it("keeps slashes inside model ids", () => {
    expect(parseModelString("openrouter/anthropic/claude-sonnet-4")).toEqual({
      providerID: "openrouter",
      modelID: "anthropic/claude-sonnet-4",
    })
  })

  it("returns null for invalid values", () => {
    expect(parseModelString(undefined)).toBeNull()
    expect(parseModelString("claude-sonnet-4")).toBeNull()
  })
})

describe("resolveModelSelection", () => {
  it("prefers a valid override", () => {
    const result = resolveModelSelection({
      providers,
      connected: ["anthropic", "openai"],
      override: { providerID: "openai", modelID: "gpt-4.1" },
      mode: { providerID: "anthropic", modelID: "claude-sonnet-4" },
      fallback: FALLBACK,
    })
    expect(result).toEqual({ providerID: "openai", modelID: "gpt-4.1" })
  })

  it("falls back from an invalid override to the mode model", () => {
    const result = resolveModelSelection({
      providers,
      connected: ["anthropic"],
      override: { providerID: "openai", modelID: "gpt-4.1" },
      mode: { providerID: "anthropic", modelID: "claude-sonnet-4" },
      fallback: FALLBACK,
    })
    expect(result).toEqual({ providerID: "anthropic", modelID: "claude-sonnet-4" })
  })

  it("falls back from invalid config to the first valid recent model", () => {
    const result = resolveModelSelection({
      providers,
      connected: ["openai"],
      mode: { providerID: "anthropic", modelID: "claude-sonnet-4" },
      recent: [
        { providerID: "anthropic", modelID: "claude-sonnet-4" },
        { providerID: "openai", modelID: "gpt-4.1" },
      ],
      fallback: FALLBACK,
    })
    expect(result).toEqual({ providerID: "openai", modelID: "gpt-4.1" })
  })

  it("uses the configured default as the explicit final fallback", () => {
    const result = resolveModelSelection({
      providers,
      connected: ["anthropic"],
      fallback: FALLBACK,
    })
    expect(result).toEqual(FALLBACK)
  })

  it("rejects a fallback missing from the loaded catalog", () => {
    const result = resolveModelSelection({
      providers: { openai: providers.openai },
      connected: [],
      fallback: FALLBACK,
    })
    expect(result).toBeNull()
  })

  it("does not treat an empty catalog as unvalidated preferences", () => {
    const result = resolveModelSelection({
      providers: {},
      connected: [],
      override: { providerID: "openai", modelID: "gpt-4.1" },
      mode: { providerID: "anthropic", modelID: "claude-sonnet-4" },
      fallback: FALLBACK,
    })
    expect(result).toBeNull()
  })
})
