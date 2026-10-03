import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { AISDK } from "@opencode-ai/core/aisdk"
import { Catalog } from "@opencode-ai/core/catalog"
import { ModelV2 } from "@opencode-ai/core/model"
import { PluginV2 } from "@opencode-ai/core/plugin"
import { PluginHost } from "@opencode-ai/core/plugin/host"
import { ProviderPlugins } from "@opencode-ai/core/plugin/provider"
import { HarnessPlugin } from "@opencode-ai/core/plugin/provider/harness"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { testEffect } from "../lib/effect"
import { PluginTestLayer } from "./fixture"

const it = testEffect(PluginTestLayer)

const addPlugin = Effect.fn(function* () {
  const plugin = yield* PluginV2.Service
  const host = yield* PluginHost.make(plugin)
  yield* HarnessPlugin.effect(host)
})

function withEnv<A, E, R>(vars: Record<string, string | undefined>, effect: () => Effect.Effect<A, E, R>) {
  return Effect.acquireUseRelease(
    Effect.sync(() => {
      const previous = Object.fromEntries(Object.keys(vars).map((key) => [key, process.env[key]]))
      for (const [key, value] of Object.entries(vars)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
      return previous
    }),
    effect,
    (previous) =>
      Effect.sync(() => {
        for (const [key, value] of Object.entries(previous)) {
          if (value === undefined) delete process.env[key]
          else process.env[key] = value
        }
      }),
  )
}

describe("HarnessPlugin", () => {
  it.effect("is registered so legacy referer headers can be applied", () =>
    Effect.sync(() => expect(ProviderPlugins.map((item) => item.id)).toContain(PluginV2.ID.make("harness"))),
  )

  it.effect("applies legacy referer headers only to harness", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      yield* catalog.transform((catalog) => {
        catalog.provider.update(ProviderV2.ID.make("harness"), (provider) => {
          provider.api = {
            type: "aisdk",
            package: "@ai-sdk/openai-compatible",
            url: "https://api.kilo.ai/api/gateway",
          }
          provider.request = { headers: { Existing: "value" }, body: {} }
        })
        catalog.provider.update(ProviderV2.ID.openrouter, () => {})
      })
      yield* addPlugin()
      expect((yield* catalog.provider.get(ProviderV2.ID.make("harness")))?.request.headers).toEqual({
        Existing: "value",
        "HTTP-Referer": "https://kilo.ai/",
        "X-Title": "Harness Code",
      })
      expect((yield* catalog.provider.get(ProviderV2.ID.openrouter))?.request.headers).toEqual({})
    }),
  )

  it.effect("uses the exact legacy Harness header casing and set", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      yield* catalog.transform((catalog) => {
        catalog.provider.update(ProviderV2.ID.make("harness"), (provider) => {
          provider.api = {
            type: "aisdk",
            package: "@ai-sdk/openai-compatible",
            url: "https://api.kilo.ai/api/gateway",
          }
        })
      })
      yield* addPlugin()

      expect((yield* catalog.provider.get(ProviderV2.ID.harness))?.request.headers).toEqual({
        "HTTP-Referer": "https://kilo.ai/",
        "X-Title": "Harness Code",
      })
      expect((yield* catalog.provider.get(ProviderV2.ID.make("harness")))?.request.headers).not.toHaveProperty(
        "http-referer",
      )
      expect((yield* catalog.provider.get(ProviderV2.ID.make("harness")))?.request.headers).not.toHaveProperty("x-title")
      expect((yield* catalog.provider.get(ProviderV2.ID.make("harness")))?.request.headers).not.toHaveProperty("X-Source")
    }),
  )

  it.effect("uses the legacy provider-id guard instead of endpoint package matching", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      yield* catalog.transform((catalog) => {
        catalog.provider.update(ProviderV2.ID.make("harness"), (provider) => {
          provider.api = {
            type: "aisdk",
            package: "@ai-sdk/openai-compatible",
            url: "https://api.kilo.ai/api/gateway",
          }
        })
        catalog.provider.update(ProviderV2.ID.make("custom-harness"), (provider) => {
          provider.api = { type: "aisdk", package: "harness" }
        })
      })
      yield* addPlugin()

      expect((yield* catalog.provider.get(ProviderV2.ID.harness))?.request.headers).toEqual({
        "HTTP-Referer": "https://kilo.ai/",
        "X-Title": "Harness Code",
      })
      expect((yield* catalog.provider.get(ProviderV2.ID.make("custom-harness")))?.request.headers).toEqual({})
    }),
  )

  it.effect("routes the Harness catalog through the Harness Gateway SDK", () =>
    withEnv({ HARNESS_API_KEY: undefined, HARNESS_ORG_ID: undefined }, () =>
      Effect.gen(function* () {
        const aisdk = yield* AISDK.Service
        const catalog = yield* Catalog.Service
        yield* catalog.transform((catalog) => {
          catalog.provider.update(ProviderV2.ID.harness, (provider) => {
            provider.api = {
              type: "aisdk",
              package: "@ai-sdk/openai-compatible",
              url: "https://api.kilo.ai/api/gateway",
            }
            provider.request = { headers: {}, body: { apiKey: "stored-token" } }
          })
        })
        yield* addPlugin()
        const updated = yield* catalog.provider.get(ProviderV2.ID.harness)

        expect(updated?.api).toEqual({
          type: "aisdk",
          package: "@harness/harness-gateway",
          url: "https://api.kilo.ai/api/openrouter",
        })
        expect(updated?.request.body.harnessToken).toBe("stored-token")

        const result = yield* aisdk.runSDK({
          model: ModelV2.Info.make({
            ...ModelV2.Info.empty(ProviderV2.ID.harness, ModelV2.ID.make("harness-auto/free")),
            api: {
              id: ModelV2.ID.make("harness-auto/free"),
              type: "aisdk",
              package: "@harness/harness-gateway",
            },
          }),
          package: "@harness/harness-gateway",
          options: updated?.request.body ?? {},
        })
        expect(result.sdk).toBeDefined()
        expect(typeof result.sdk.languageModel).toBe("function")
        expect(typeof result.sdk.anthropic).toBe("function")
      }),
    ),
  )

  it.effect("keeps authenticated credentials ahead of inherited environment keys", () =>
    withEnv({ HARNESS_API_KEY: "environment-token", HARNESS_ORG_ID: "environment-org" }, () =>
      Effect.gen(function* () {
        const catalog = yield* Catalog.Service
        yield* catalog.transform((catalog) => {
          catalog.provider.update(ProviderV2.ID.harness, (provider) => {
            provider.request = {
              headers: {},
              body: { apiKey: "authenticated-token", harnessOrganizationId: "authenticated-org" },
            }
          })
        })
        yield* addPlugin()
        const result = yield* catalog.provider.get(ProviderV2.ID.harness)

        expect(result?.request.body.apiKey).toBe("authenticated-token")
        expect(result?.request.body.harnessToken).toBe("authenticated-token")
        expect(result?.request.body.harnessOrganizationId).toBe("environment-org")
      }),
    ),
  )

  it.effect("keeps anonymous Harness models available without credentials", () =>
    withEnv({ HARNESS_API_KEY: undefined, HARNESS_ORG_ID: undefined }, () =>
      Effect.gen(function* () {
        const catalog = yield* Catalog.Service
        yield* catalog.transform((catalog) => catalog.provider.update(ProviderV2.ID.harness, () => {}))
        yield* addPlugin()
        const result = yield* catalog.provider.get(ProviderV2.ID.harness)

        expect((yield* catalog.provider.available()).map((provider) => provider.id)).toContain(ProviderV2.ID.harness)
        expect(result?.request.body.apiKey).toBe("anonymous")
        expect(result?.request.body.harnessToken).toBe("anonymous")
      }),
    ),
  )
})
