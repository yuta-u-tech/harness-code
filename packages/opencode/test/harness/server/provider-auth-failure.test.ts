import { describe, expect } from "bun:test"
import { NodeHttpServer } from "@effect/platform-node"
import { ModelsDev } from "@opencode-ai/core/models-dev"
import { Effect, Layer } from "effect"
import { HttpClient, HttpRouter } from "effect/unstable/http"
import { HttpApi, HttpApiBuilder } from "effect/unstable/httpapi"
import { Auth } from "../../../src/auth"
import { HarnessViewers } from "../../../src/harness/presence/service"
import { InstanceStore } from "../../../src/project/instance-store"
import { Session } from "../../../src/session/session"
import { ModelCache } from "../../../src/provider/model-cache"
import { Provider } from "../../../src/provider/provider"
import { ProviderAuth } from "../../../src/provider/auth"
import { ConfigApi } from "../../../src/server/routes/instance/httpapi/groups/config"
import { ProviderApi } from "../../../src/server/routes/instance/httpapi/groups/provider"
import { configHandlers } from "../../../src/server/routes/instance/httpapi/handlers/config"
import { providerHandlers } from "../../../src/server/routes/instance/httpapi/handlers/provider"
import { Authorization } from "../../../src/server/routes/instance/httpapi/middleware/authorization"
import { InstanceContextMiddleware } from "../../../src/server/routes/instance/httpapi/middleware/instance-context"
import {
  WorkspaceRouteContext,
  WorkspaceRoutingMiddleware,
} from "../../../src/server/routes/instance/httpapi/middleware/workspace-routing"
import { schemaErrorLayer } from "../../../src/server/routes/instance/httpapi/middleware/schema-error"
import { TestConfig } from "../../fixture/config"
import { testEffect } from "../../lib/effect"

function catalog(id: string, models: string[]): ModelsDev.Provider {
  return {
    id,
    name: id,
    env: [],
    models: Object.fromEntries(
      models.map((id) => [
        id,
        {
          id,
          name: id,
          release_date: "2026-01-01",
          attachment: false,
          reasoning: false,
          temperature: true,
          tool_call: true,
          limit: { context: 32000, output: 4096 },
        },
      ]),
    ),
  }
}

const catalogs = { external: catalog("external", ["model"]), harness: catalog("harness", ["public/leak"]) }
const providers = {
  external: Provider.fromModelsDevProvider(catalogs.external),
  harness: Provider.fromModelsDevProvider(
    catalog("harness", ["connected/training", "connected/z-local", "connected/a-remote"]),
  ),
}
providers.harness.models["connected/training"].mayTrainOnYourPrompts = true
const state = {
  failure: false,
  connected: true,
  disabled: false,
  excluded: false,
  initial: false,
  empty: false,
  failed: [] as string[],
  requests: [] as string[],
  reads: 0,
}
const layer = HttpRouter.serve(
  HttpApiBuilder.layer(HttpApi.make("opencode-instance").addHttpApi(ProviderApi).addHttpApi(ConfigApi)).pipe(
    Layer.provide([providerHandlers, configHandlers]),
    Layer.provide(schemaErrorLayer),
    Layer.provide([
      TestConfig.layer({
        get: () =>
          Effect.succeed({
            enabled_providers: state.excluded ? ["external"] : ["external", "harness"],
            disabled_providers: state.disabled ? ["harness"] : [],
            hide_prompt_training_models: true,
          }),
      }),
      Layer.mock(Provider.Service)({
        list: () =>
          state.initial
            ? Effect.die(new Auth.AuthError({ message: "Cannot initialize providers" }))
            : Effect.succeed(
                state.connected && !state.disabled && !state.excluded
                  ? { ...providers, harness: { ...providers.harness, models: state.empty ? {} : providers.harness.models } }
                  : { external: providers.external },
              ),
      }),
      Layer.mock(ProviderAuth.Service)({}),
      Layer.mock(ModelCache.Service)({ failedProviders: () => Effect.succeed(state.failed) }),
      Layer.mock(Auth.Service)({
        get: () =>
          Effect.suspend(() => {
            state.reads++
            return state.failure
              ? Effect.fail(new Auth.AuthError({ message: "Cannot read credentials" }))
              : Effect.succeed(undefined)
          }),
      }),
      Layer.succeed(
        Authorization,
        Authorization.of((effect) => effect),
      ),
      Layer.succeed(
        InstanceContextMiddleware,
        InstanceContextMiddleware.of((effect) => effect),
      ),
      Layer.succeed(
        WorkspaceRoutingMiddleware,
        WorkspaceRoutingMiddleware.of((effect) =>
          effect.pipe(
            Effect.provideService(WorkspaceRouteContext, WorkspaceRouteContext.of({ directory: process.cwd() })),
          ),
        ),
      ),
    ]),
  ),
  { disableListenLog: true, disableLogger: true },
).pipe(
  Layer.provide([
    Layer.mock(ModelsDev.Service)({ get: () => Effect.succeed(catalogs) }),
    Layer.mock(InstanceStore.Service)({}),
    Layer.mock(Session.Service)({}),
    Layer.mock(HarnessViewers.Service)({}),
  ]),
  Layer.provideMerge(NodeHttpServer.layerTest),
)
const it = testEffect(layer)

function configure(failure: boolean, connected: boolean) {
  return Effect.acquireRelease(
    Effect.sync(() => {
      const previous = {
        state: { ...state },
        env: { HARNESS_ORG_ID: process.env.HARNESS_ORG_ID, HARNESS_API_KEY: process.env.HARNESS_API_KEY },
        fetch: globalThis.fetch,
      }
      Object.assign(state, { failure, connected, requests: [], reads: 0 })
      delete process.env.HARNESS_ORG_ID
      delete process.env.HARNESS_API_KEY
      globalThis.fetch = Object.assign(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url)
          if (url.pathname.endsWith("/defaults")) {
            state.requests.push(url.pathname)
            return Response.json({ defaultModel: "connected/a-remote", defaultFreeModel: "connected/a-remote" })
          }
          return previous.fetch(input, init)
        },
        { preconnect: previous.fetch.preconnect },
      )
      return previous
    }),
    (previous) =>
      Effect.sync(() => {
        Object.assign(state, previous.state)
        globalThis.fetch = previous.fetch
        for (const [key, value] of Object.entries(previous.env)) {
          if (value === undefined) delete process.env[key]
          else process.env[key] = value
        }
      }),
  )
}

function request(path: string) {
  return Effect.gen(function* () {
    const response = yield* HttpClient.get(path)
    expect(response.status).toBe(200)
    return yield* response.json
  })
}

function record(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input)
}

function result(input: unknown, key: "all" | "providers") {
  if (!record(input) || !Array.isArray(input[key])) throw new Error("Expected provider catalog")
  return input[key].map((provider: unknown) => {
    if (!record(provider) || typeof provider.id !== "string" || !record(provider.models)) {
      throw new Error("Expected provider models")
    }
    return { id: provider.id, models: Object.keys(provider.models) }
  })
}

const external = { id: "external", models: ["model"] }
const harness = { id: "harness", models: ["connected/z-local", "connected/a-remote"] }

describe("provider catalog authentication failures", () => {
  for (const connected of [false, true]) {
    it.live(`retains only safe catalogs when Harness auth fails (connected: ${connected})`, () =>
      Effect.gen(function* () {
        yield* configure(true, connected)
        state.failed = ["existing"]
        const all = yield* request("/provider")
        const config = yield* request("/config/providers")
        expect(result(all, "all")).toEqual(connected ? [external, harness] : [external])
        expect(result(config, "providers")).toEqual(connected ? [external, harness] : [external])
        const defaults = { external: "model", ...(connected ? { harness: "connected/z-local" } : {}) }
        expect(all).toMatchObject({
          default: defaults,
          connected: connected ? ["external", "harness"] : ["external"],
          failed: ["existing", "harness"],
        })
        expect(config).toMatchObject({ default: defaults })
        expect(JSON.stringify([all, config])).not.toContain("public/leak")
        expect(state.requests).toEqual([])

        state.failure = false
        const recovered = yield* request("/provider")
        const configured = yield* request("/config/providers")
        expect(result(recovered, "all")).toEqual([external, connected ? harness : { id: "harness", models: ["public/leak"] }])
        expect(result(configured, "providers")).toEqual(connected ? [external, harness] : [external])
        expect(recovered).toMatchObject({
          default: { external: "model", harness: connected ? "connected/a-remote" : "public/leak" },
          connected: connected ? ["external", "harness"] : ["external"],
          failed: ["existing"],
        })
        expect(configured).toMatchObject({
          default: { external: "model", ...(connected ? { harness: "connected/a-remote" } : {}) },
        })
        expect(state.requests).toHaveLength(connected ? 2 : 0)
      }),
    )

    it.live(`distinguishes anonymous auth success from failure (connected: ${connected})`, () =>
      Effect.gen(function* () {
        yield* configure(false, connected)
        const all = yield* request("/provider")
        const config = yield* request("/config/providers")
        expect(result(all, "all")).toEqual([external, connected ? harness : { id: "harness", models: ["public/leak"] }])
        expect(result(config, "providers")).toEqual(connected ? [external, harness] : [external])
        expect(all).toMatchObject({
          default: { external: "model", harness: connected ? "connected/a-remote" : "public/leak" },
          connected: connected ? ["external", "harness"] : ["external"],
          failed: [],
        })
        expect(config).toMatchObject({
          default: { external: "model", ...(connected ? { harness: "connected/a-remote" } : {}) },
        })
        expect(state.requests).toHaveLength(connected ? 2 : 0)
      }),
    )
  }

  it.live("does not duplicate an existing Harness failure", () =>
    Effect.gen(function* () {
      yield* configure(true, true)
      state.failed = ["harness", "existing"]
      expect(yield* request("/provider")).toMatchObject({ failed: ["harness", "existing"] })
      expect(state.failed).toEqual(["harness", "existing"])
      expect(state.requests).toEqual([])
    }),
  )

  for (const restriction of ["disabled", "excluded"] as const) {
    it.live(`does not flag ${restriction} Harness when auth fails`, () =>
      Effect.gen(function* () {
        yield* configure(true, false)
        state[restriction] = true
        state.failed = ["existing"]
        const all = yield* request("/provider")
        const config = yield* request("/config/providers")
        expect(result(all, "all")).toEqual([external])
        expect(result(config, "providers")).toEqual([external])
        expect(all).toMatchObject({ default: { external: "model" }, connected: ["external"], failed: ["existing"] })
        expect(config).toMatchObject({ default: { external: "model" } })
        expect(state.requests).toEqual([])
      }),
    )
  }

  it.live("keeps empty connected catalogs without an unsafe fallback", () =>
    Effect.gen(function* () {
      yield* configure(true, true)
      state.empty = true
      const all = yield* request("/provider")
      const config = yield* request("/config/providers")
      expect(result(all, "all")).toEqual([external, { id: "harness", models: [] }])
      expect(result(config, "providers")).toEqual([external, { id: "harness", models: [] }])
      expect(all).toMatchObject({ default: { external: "model" }, connected: ["external", "harness"], failed: ["harness"] })
      expect(config).toMatchObject({ default: { external: "model" } })
      expect(JSON.stringify([all, config])).not.toContain("public/leak")
      expect(state.requests).toEqual([])
    }),
  )

  it.live("does not hide initial provider initialization failure with the public snapshot", () =>
    Effect.gen(function* () {
      yield* configure(true, true)
      state.initial = true
      for (const path of ["/provider", "/config/providers"]) {
        const response = yield* HttpClient.get(path)
        expect(response.status).toBe(500)
        expect(yield* response.text).not.toContain("public/leak")
      }
      expect(state.reads).toBe(0)
      expect(state.requests).toEqual([])
    }),
  )
})
