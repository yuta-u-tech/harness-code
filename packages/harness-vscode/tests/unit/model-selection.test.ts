import { describe, expect, it } from "bun:test"
import { resolveModelSelection } from "../../webview-ui/src/context/model-selection"
import { HARNESS_AUTO, parseModelString } from "../../src/shared/provider-model"
import type { ModelSelection, Provider } from "../../webview-ui/src/types/messages"

function makeProvider(id: string, name: string, modelIds: string[]): Provider {
  const models: Provider["models"] = {}
  for (const modelID of modelIds) {
    models[modelID] = { id: modelID, name: modelID }
  }
  return { id, name, models }
}

const providers = {
  harness: makeProvider("harness", "Harness Gateway", ["harness-auto/free"]),
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

  it("keeps slashes inside harness model ids", () => {
    expect(parseModelString("harness/harness-auto/free")).toEqual({
      providerID: "harness",
      modelID: "harness-auto/free",
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
      fallback: HARNESS_AUTO,
    })
    expect(result).toEqual({ providerID: "openai", modelID: "gpt-4.1" })
  })

  it("falls back from an invalid override to the mode model", () => {
    const result = resolveModelSelection({
      providers,
      connected: ["anthropic"],
      override: { providerID: "openai", modelID: "gpt-4.1" },
      mode: { providerID: "anthropic", modelID: "claude-sonnet-4" },
      fallback: HARNESS_AUTO,
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
      fallback: HARNESS_AUTO,
    })
    expect(result).toEqual({ providerID: "openai", modelID: "gpt-4.1" })
  })

  it("uses harness auto as the explicit final fallback", () => {
    const result = resolveModelSelection({
      providers,
      connected: [],
      fallback: HARNESS_AUTO,
    })
    expect(result).toEqual(HARNESS_AUTO)
  })

  it("rejects a fallback missing from the loaded catalog", () => {
    const result = resolveModelSelection({
      providers: { openai: providers.openai },
      connected: [],
      fallback: HARNESS_AUTO,
    })
    expect(result).toBeNull()
  })

  it("does not treat an empty catalog as unvalidated preferences", () => {
    const result = resolveModelSelection({
      providers: {},
      connected: [],
      override: { providerID: "openai", modelID: "gpt-4.1" },
      mode: { providerID: "anthropic", modelID: "claude-sonnet-4" },
      fallback: HARNESS_AUTO,
    })
    expect(result).toBeNull()
  })
})

describe("organization model selection", () => {
  const first = { providerID: "harness", modelID: "z-first" }
  const recommendation = { providerID: "harness", modelID: "a-default" }
  const recent = { providerID: "harness", modelID: "older-recent" }
  const external = { providerID: "openai", modelID: "gpt-4.1" }
  const input = {
    providers: {
      ...providers,
      harness: makeProvider("harness", "Harness Gateway", [
        first.modelID,
        recommendation.modelID,
        recent.modelID,
        "harness-auto/free",
      ]),
    },
    connected: ["openai"],
    ready: true,
    organizationId: "org-a",
    defaults: { harness: recommendation.modelID },
    recent: [{ providerID: "harness", modelID: "missing-recent" }, recent, external],
    fallback: HARNESS_AUTO,
  }

  it("uses the recommendation for fresh Org login instead of recents or the generic fallback", () => {
    expect(resolveModelSelection(input)).toEqual(recommendation)
  })

  it.each([undefined, "", "unavailable"])("uses catalog order for an absent or invalid default %s", (model) => {
    expect(resolveModelSelection({ ...input, defaults: model === undefined ? {} : { harness: model } })).toEqual(first)
  })

  it.each(["session", "override", "mode", "global"] as const)(
    "preserves a valid %s before the recommendation",
    (key) => {
      expect(resolveModelSelection({ ...input, [key]: HARNESS_AUTO })).toEqual(HARNESS_AUTO)
    },
  )

  it("validates session, manual, mode, and global preferences in order", () => {
    const missing = { providerID: "harness", modelID: "missing" }
    const choices = { session: HARNESS_AUTO, override: recent, mode: first, global: external }
    expect(resolveModelSelection({ ...input, ...choices })).toEqual(HARNESS_AUTO)
    expect(resolveModelSelection({ ...input, ...choices, session: missing })).toEqual(recent)
    expect(resolveModelSelection({ ...input, ...choices, session: missing, override: missing })).toEqual(first)
    expect(resolveModelSelection({ ...input, ...choices, session: missing, override: missing, mode: missing })).toEqual(
      external,
    )
    expect(
      resolveModelSelection({ ...input, session: missing, override: missing, mode: missing, global: missing }),
    ).toEqual(recommendation)
  })

  it("preserves explicitly configured external providers only while connected", () => {
    expect(resolveModelSelection({ ...input, override: external })).toEqual(external)
    expect(resolveModelSelection({ ...input, connected: [], override: external })).toEqual(recommendation)
  })

  it.each([{}, { harness: makeProvider("harness", "Harness Gateway", []) }, { openai: providers.openai }])(
    "does not fall back to free models or external recents for an empty Org catalog",
    (catalog) => {
      expect(resolveModelSelection({ ...input, providers: catalog, override: HARNESS_AUTO })).toBeNull()
    },
  )

  it("keeps explicit external models available with an empty Org catalog", () => {
    expect(resolveModelSelection({ ...input, providers: { openai: providers.openai }, override: external })).toEqual(
      external,
    )
  })

  it("does not trust a retained Harness catalog while refresh or auth context is pending", () => {
    for (const pending of [{ ready: false }, { organizationId: undefined }]) {
      expect(resolveModelSelection({ ...input, ...pending, override: HARNESS_AUTO })).toBeNull()
      expect(resolveModelSelection({ ...input, ...pending, override: external })).toEqual(external)
    }
  })

  it("keeps Personal recents ahead of defaults and validates its final fallback", () => {
    expect(resolveModelSelection({ ...input, organizationId: null })).toEqual(recent)
    expect(resolveModelSelection({ ...input, organizationId: null, recent: [] })).toEqual(HARNESS_AUTO)
    expect(
      resolveModelSelection({ ...input, organizationId: null, recent: [], fallback: external, connected: [] }),
    ).toBeNull()
  })

  it("restores the same explicit choice through Personal, Org A, Org B, and Personal", () => {
    const override: ModelSelection = { providerID: "harness", modelID: "personal" }
    const personal = {
      ...input,
      organizationId: null,
      providers: { harness: makeProvider("harness", "Harness", [override.modelID]) },
    }
    expect(resolveModelSelection({ ...personal, override })).toEqual(override)
    expect(resolveModelSelection({ ...input, override })).toEqual(recommendation)
    expect(
      resolveModelSelection({ ...input, organizationId: "org-b", defaults: { harness: first.modelID }, override }),
    ).toEqual(first)
    expect(resolveModelSelection({ ...personal, override })).toEqual(override)
    expect(override).toEqual({ providerID: "harness", modelID: "personal" })
  })
})
