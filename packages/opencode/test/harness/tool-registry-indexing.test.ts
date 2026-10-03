import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Effect, Layer, Schema, Stream } from "effect"
import * as Log from "@opencode-ai/core/util/log"
import { Agent } from "../../src/agent/agent"
import { Bus } from "../../src/bus"
import { HarnessIndexing } from "../../src/harness/indexing"
import { HarnessBootstrap } from "../../src/harness/bootstrap"
import { Wakeup } from "../../src/harness/wakeup"
import { HarnessWatcher } from "../../src/harness/watcher"
import { HarnessSessions } from "../../src/harness-sessions/harness-sessions"
import { HarnessMemory } from "@harness/harness-memory/effect"
import { MemoryService } from "@harness/harness-memory/effect/service"
import { InstanceState } from "../../src/effect/instance-state"
import { HarnessToolRegistry } from "../../src/harness/tool/registry"
import { Provider } from "../../src/provider/provider"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { ModelV2 } from "@opencode-ai/core/model"
import { Session } from "../../src/session/session"
import { SessionSummary } from "../../src/session/summary"
import { ToolRegistry } from "../../src/tool/registry"
import type * as Tool from "../../src/tool/tool"
import { disposeAllInstances, provideTmpdirInstance } from "../fixture/fixture"
import * as CrossSpawnSpawner from "@opencode-ai/core/cross-spawn-spawner"
import { testEffect } from "../lib/effect"

const node = AppNodeBuilder.build(CrossSpawnSpawner.node)
const it = testEffect(Layer.mergeAll(AppNodeBuilder.build(Agent.node), AppNodeBuilder.build(ToolRegistry.node), node))
const ref = {
  providerID: ProviderV2.ID.make("test"),
  modelID: ModelV2.ID.make("test-model"),
}

afterEach(async () => {
  await disposeAllInstances()
})

describe("harness tool registry indexing", () => {
  const logger = Log.create({ service: "harness-tool-registry" })

  it.live("omits semantic_search without waiting for slow indexing startup", () =>
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const avail = spyOn(HarnessIndexing, "available").mockImplementation(() => new Promise<boolean>(() => {}))

          try {
            const registry = yield* ToolRegistry.Service
            const ids = yield* registry.ids()

            expect(ids).not.toContain("semantic_search")
            expect(ids).not.toContain("codesearch")
            expect(ids).toContain("question")
            expect(ids).toContain("read")
            expect(ids).toContain("suggest")
            expect(avail).not.toHaveBeenCalled()
          } finally {
            avail.mockRestore()
          }
        }),
      { git: true },
    ),
  )

  it.live("registers semantic search from config even when readiness throws", () =>
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const err = new Error("ready failed")
          const ready = spyOn(HarnessIndexing, "ready").mockImplementation(() => {
            throw err
          })
          const warn = spyOn(logger, "warn").mockImplementation(() => {})

          try {
            const registry = yield* ToolRegistry.Service
            const ids = yield* registry.ids()

            expect(ids).toContain("semantic_search")
            expect(ids).toContain("question")
            expect(ids).toContain("read")
            expect(ids).toContain("suggest")
            expect(warn).not.toHaveBeenCalled()
          } finally {
            ready.mockRestore()
            warn.mockRestore()
          }
        }),
      { git: true, config: { indexing: { enabled: true } } },
    ),
  )

  it.live("registers semantic search from config even when readiness rejects", () =>
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const err = new Error("ready rejected")
          const ready = spyOn(HarnessIndexing, "ready").mockImplementation(() => Promise.reject(err) as unknown as boolean)
          const warn = spyOn(logger, "warn").mockImplementation(() => {})

          try {
            const registry = yield* ToolRegistry.Service
            const ids = yield* registry.ids()

            expect(ids).toContain("semantic_search")
            expect(ids).toContain("question")
            expect(ids).toContain("read")
            expect(ids).toContain("suggest")
            expect(warn).not.toHaveBeenCalled()
          } finally {
            ready.mockRestore()
            warn.mockRestore()
          }
        }),
      { git: true, config: { indexing: { enabled: true } } },
    ),
  )

  it.live("registers semantic_search when indexing is enabled", () =>
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const ready = spyOn(HarnessIndexing, "ready").mockReturnValue(true)

          try {
            const registry = yield* ToolRegistry.Service
            const ids = yield* registry.ids()

            expect(ids).toContain("semantic_search")
          } finally {
            ready.mockRestore()
          }
        }),
      { git: true, config: { indexing: { enabled: true } } },
    ),
  )

  it.live("omits semantic_search hint from glob and grep descriptions when indexing is not ready", () =>
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const ready = spyOn(HarnessIndexing, "ready").mockReturnValue(false)

          try {
            const agent = yield* Agent.Service
            const build = yield* agent.get("build")
            const registry = yield* ToolRegistry.Service
            const tools = yield* registry.tools({ ...ref, agent: build })
            const glob = tools.find((tool) => tool.id === "glob")?.description ?? ""
            const grep = tools.find((tool) => tool.id === "grep")?.description ?? ""

            expect(glob).not.toContain("semantic_search")
            expect(grep).not.toContain("semantic_search")
          } finally {
            ready.mockRestore()
          }
        }),
      { git: true },
    ),
  )

  it.live("includes semantic_search hint in glob and grep descriptions when indexing is enabled", () =>
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const ready = spyOn(HarnessIndexing, "ready").mockReturnValue(true)

          try {
            const agent = yield* Agent.Service
            const build = yield* agent.get("build")
            const registry = yield* ToolRegistry.Service
            const tools = yield* registry.tools({ ...ref, agent: build })
            const ids = tools.map((tool) => tool.id)
            const glob = tools.find((tool) => tool.id === "glob")?.description ?? ""
            const grep = tools.find((tool) => tool.id === "grep")?.description ?? ""

            expect(ids).toContain("semantic_search")
            expect(glob).toContain("semantic_search")
            expect(grep).toContain("semantic_search")
          } finally {
            ready.mockRestore()
          }
        }),
      { git: true, config: { indexing: { enabled: true } } },
    ),
  )

  for (const client of ["cli", "vscode", "jetbrains"]) {
    it.live(`omits interactive_terminal from ${client} tool definitions`, () =>
      Effect.acquireUseRelease(
        Effect.sync(() => {
          const prev = process.env["HARNESS_CLIENT"]
          process.env["HARNESS_CLIENT"] = client
          return prev
        }),
        () =>
          provideTmpdirInstance(
            () =>
              Effect.gen(function* () {
                const agents = yield* Agent.Service
                const registry = yield* ToolRegistry.Service
                expect(yield* registry.ids()).not.toContain("interactive_terminal")
                for (const name of ["build", "explore"]) {
                  const agent = yield* agents.get(name)
                  const tools = yield* registry.tools({ ...ref, agent })
                  expect(tools.map((tool) => tool.id)).not.toContain("interactive_terminal")
                }
              }),
            {
              git: true,
              config: { permission: { interactive_terminal: "allow" } },
            },
          ),
        (prev) =>
          Effect.sync(() => {
            if (prev === undefined) delete process.env["HARNESS_CLIENT"]
            if (prev !== undefined) process.env["HARNESS_CLIENT"] = prev
          }),
      ),
    )
  }

  test("enables semantic search from indexing configuration before the index is ready", () => {
    expect(
      HarnessToolRegistry.indexing({
        indexing: { enabled: true },
      }),
    ).toBe(true)
    expect(
      HarnessToolRegistry.indexing({
        indexing: { enabled: false },
      }),
    ).toBe(false)
    expect(HarnessToolRegistry.indexing({}, { indexing: { enabled: true } })).toBe(true)
  })

  it.live("omits memory tools when project memory is disabled but keeps harness_local_recall", () =>
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const agent = yield* Agent.Service
          const build = yield* agent.get("build")
          const registry = yield* ToolRegistry.Service
          const tools = yield* registry.tools({ ...ref, agent: build })
          const ids = tools.map((tool) => tool.id)

          expect(ids).not.toContain("harness_memory_recall")
          expect(ids).not.toContain("harness_memory_save")
          // harness_local_recall is a transcript-recall tool gated by `recall: "ask"` in agent
          // permissions; it must NOT be coupled to project-memory enablement.
          expect(ids).toContain("harness_local_recall")
        }),
      { git: true },
    ),
  )

  it.live("memoryToolsEnabled coalesces consecutive probes within the TTL", () =>
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const ctx = yield* InstanceState.context
          const probe = spyOn(HarnessMemory, "toolEnabled")

          try {
            const a = yield* HarnessToolRegistry.memoryToolsEnabled({ ctx })
            const b = yield* HarnessToolRegistry.memoryToolsEnabled({ ctx })
            const c = yield* HarnessToolRegistry.memoryToolsEnabled({ ctx })

            expect([a, b, c]).toEqual([false, false, false])
            // Cache hit: only the first call should reach HarnessMemory.toolEnabled.
            expect(probe).toHaveBeenCalledTimes(1)
          } finally {
            probe.mockRestore()
          }
        }),
      { git: true },
    ),
  )

  it.live("memoryToolsEnabled reflects enable/disable immediately after invalidate", () =>
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const ctx = yield* InstanceState.context
          const root = (yield* Effect.promise(() => HarnessMemory.prepare({ ctx }))).toString()

          const first = yield* HarnessToolRegistry.memoryToolsEnabled({ ctx })
          expect(first).toBe(false)

          yield* Effect.promise(() => HarnessMemory.enable({ ctx }))

          // The bootstrap MemoryEvents subscriber invalidates on mutation; call it directly here.
          HarnessToolRegistry.invalidateMemoryEnabled(root)
          const afterEnable = yield* HarnessToolRegistry.memoryToolsEnabled({ ctx })
          expect(afterEnable).toBe(true)

          yield* Effect.promise(() => HarnessMemory.disable({ ctx }))

          HarnessToolRegistry.invalidateMemoryEnabled(root)
          const afterDisable = yield* HarnessToolRegistry.memoryToolsEnabled({ ctx })
          expect(afterDisable).toBe(false)
        }),
      { git: true },
    ),
  )

  it.live("includes memory tools when project memory is enabled", () =>
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const ctx = yield* InstanceState.context
          yield* Effect.promise(() => HarnessMemory.enable({ ctx }))

          const agent = yield* Agent.Service
          const build = yield* agent.get("build")
          const registry = yield* ToolRegistry.Service
          const tools = yield* registry.tools({ ...ref, agent: build })
          const ids = tools.map((tool) => tool.id)

          expect(ids).toContain("harness_memory_recall")
          expect(ids).toContain("harness_memory_save")
          expect(ids).toContain("harness_local_recall")
        }),
      { git: true },
    ),
  )

  test("conditionally includes Harness registry extras", () => {
    const prev = process.env["HARNESS_CLIENT"]
    const def = (id: string): Tool.Def => ({
      id,
      description: id,
      parameters: Schema.String,
      execute: () => Effect.succeed({ title: id, output: id, metadata: {} }),
    })
    const tools = {
      semantic: def("semantic_search"),
      recall: def("recall"),
      managerModels: def("agent_manager_models"),
      memory: def("harness_memory_recall"),
      save: def("harness_memory_save"),
      manager: def("agent_manager"),
      process: def("background_process"),
      browser: def("browser_open"),
      chart: def("chart"),
      image: def("generate_image"),
      notify: def("notify_user"),
      send: def("send_file"),
      linkPr: def("link_pr"),
      boardRead: def("board_read"),
      boardPost: def("board_post"),
      notebookRead: def("notebook_read"),
      notebookEdit: def("notebook_edit"),
      notebookExecute: def("notebook_execute"),
    }
    const flags = { experimentalSharedAgentBoard: false }

    try {
      process.env["HARNESS_CLIENT"] = "cli"
      expect(HarnessToolRegistry.extra(tools, {}, flags).map((tool) => tool.id)).toEqual([
        "semantic_search",
        "harness_memory_recall",
        "harness_memory_save",
        "recall",
        "background_process",
        "agent_manager_models",
        "notify_user",
        "send_file",
        "link_pr",
      ])
      expect(
        HarnessToolRegistry.extra(tools, { experimental: { image_generation: true } }, flags).map((tool) => tool.id),
      ).toEqual([
        "generate_image",
        "semantic_search",
        "harness_memory_recall",
        "harness_memory_save",
        "recall",
        "background_process",
        "agent_manager_models",
        "notify_user",
        "send_file",
        "link_pr",
      ])

      process.env["HARNESS_CLIENT"] = "vscode"
      expect(HarnessToolRegistry.extra(tools, {}, flags).map((tool) => tool.id)).toEqual([
        "semantic_search",
        "harness_memory_recall",
        "harness_memory_save",
        "recall",
        "chart",
        "background_process",
        "agent_manager_models",
        "agent_manager",
        "browser_open",
        "notify_user",
        "send_file",
      ])
      expect(
        HarnessToolRegistry.extra(
          tools,
          {
            experimental: { native_notebook_tools: true },
          },
          flags,
        ).map((tool) => tool.id),
      ).toEqual([
        "semantic_search",
        "harness_memory_recall",
        "harness_memory_save",
        "recall",
        "chart",
        "background_process",
        "agent_manager_models",
        "agent_manager",
        "browser_open",
        "notebook_read",
        "notebook_edit",
        "notebook_execute",
        "notify_user",
        "send_file",
      ])
      expect(HarnessToolRegistry.extra({ ...tools, semantic: undefined }, {}, flags).map((tool) => tool.id)).toEqual([
        "harness_memory_recall",
        "harness_memory_save",
        "recall",
        "chart",
        "background_process",
        "agent_manager_models",
        "agent_manager",
        "browser_open",
        "notify_user",
        "send_file",
      ])

      process.env["HARNESS_CLIENT"] = "desktop"
      expect(HarnessToolRegistry.extra(tools, {}, flags).map((tool) => tool.id)).toEqual([
        "semantic_search",
        "harness_memory_recall",
        "harness_memory_save",
        "recall",
        "agent_manager_models",
        "notify_user",
        "send_file",
      ])

      process.env["HARNESS_CLIENT"] = "run"
      expect(HarnessToolRegistry.extra(tools, {}, flags).map((tool) => tool.id)).toEqual([
        "semantic_search",
        "harness_memory_recall",
        "harness_memory_save",
        "recall",
        "agent_manager_models",
        "notify_user",
        "send_file",
      ])

      process.env["HARNESS_CLIENT"] = "acp"
      expect(HarnessToolRegistry.extra(tools, {}, flags).map((tool) => tool.id)).toEqual([
        "semantic_search",
        "harness_memory_recall",
        "harness_memory_save",
        "recall",
        "agent_manager_models",
        "notify_user",
        "send_file",
      ])
      for (const client of ["cli", "vscode", "jetbrains", "desktop", "run", "acp"]) {
        process.env["HARNESS_CLIENT"] = client
        for (const enabled of [false, true]) {
          const ids = HarnessToolRegistry.extra(
            tools,
            { shared_agent_board: enabled },
            { experimentalSharedAgentBoard: enabled },
          )
            .map((tool) => tool.id)
            .filter((id) => id.startsWith("board_"))
          expect(ids).toEqual(enabled ? ["board_read", "board_post"] : [])
        }
      }
      const flagged = HarnessToolRegistry.extra(tools, {}, { experimentalSharedAgentBoard: true })
        .map((tool) => tool.id)
        .filter((id) => id.startsWith("board_"))
      expect(flagged).toEqual(["board_read", "board_post"])
    } finally {
      if (prev === undefined) delete process.env["HARNESS_CLIENT"]
      if (prev !== undefined) process.env["HARNESS_CLIENT"] = prev
    }
  })

  test("logs indexing bootstrap failures without blocking session bootstrap", async () => {
    const platform = process.env["HARNESS_PLATFORM"]
    process.env["HARNESS_PLATFORM"] = "cli"
    const logger = Log.create({ service: "harness-bootstrap" })
    const err = new Error("indexing init failed")
    const calls: string[] = []
    const sessions = Layer.succeed(
      HarnessSessions.Service,
      HarnessSessions.Service.of({
        init: () => Effect.sync(() => calls.push("sessions")),
        sendAgentNotification: () => Effect.succeed({ ok: false as const, reason: "not_connected" }),
        reportSessionTitle: () => Effect.succeed({ ok: false as const, reason: "not_connected" }),
      }),
    )
    const bus = Layer.succeed(
      Bus.Service,
      Bus.Service.of({
        publish: () => Effect.void,
        subscribe: () => Effect.succeed(Stream.empty),
        subscribeAll: () => Effect.succeed(Stream.empty),
        subscribeCallback: () => Effect.succeed(() => {}),
        subscribeAllCallback: () => Effect.succeed(() => {}),
      }),
    )
    const memory = Layer.succeed(MemoryService.Service, MemoryService.make())
    const session = Layer.succeed(Session.Service, {} as Session.Interface)
    const summary = Layer.succeed(SessionSummary.Service, {} as SessionSummary.Interface)
    const provider = Layer.succeed(Provider.Service, {} as Provider.Interface)
    const watcher = Layer.succeed(HarnessWatcher.Service, HarnessWatcher.Service.of({ init: () => Effect.void }))
    const wakeup = Layer.succeed(
      Wakeup.Service,
      Wakeup.Service.of({
        schedule: () => Effect.die(new Error("wakeup schedule is not used by this test")),
        list: () => Effect.succeed([]),
        pending: () => Effect.succeed([]),
        scheduled: () => Effect.succeed(new Map()),
        cancel: () => Effect.succeed(undefined),
        cancelSession: () => Effect.succeed(0),
        adopt: () => Effect.void,
        cronCreate: () => Effect.die(new Error("wakeup cronCreate is not used by this test")),
        cronList: () => Effect.succeed([]),
        cronCancel: () => Effect.succeed(undefined),
      }),
    )
    const indexing = spyOn(HarnessIndexing, "init").mockRejectedValue(err)
    const warn = spyOn(logger, "warn").mockImplementation(() => {})

    try {
      await Effect.runPromise(
        HarnessBootstrap.Service.use((svc) => svc.init()).pipe(
          Effect.provide(
            HarnessBootstrap.layer.pipe(
              Layer.provide([sessions, bus, memory, session, summary, provider, watcher, wakeup]),
            ),
          ),
          Effect.scoped,
        ),
      )
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(calls).toEqual(["sessions"])
      expect(indexing).toHaveBeenCalledTimes(1)
      expect(warn).toHaveBeenCalledWith("indexing bootstrap failed", { err })
    } finally {
      if (platform === undefined) delete process.env["HARNESS_PLATFORM"]
      else process.env["HARNESS_PLATFORM"] = platform
      indexing.mockRestore()
      warn.mockRestore()
    }
  })
})
