import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { $ } from "bun"
import { Effect } from "effect"
import fs from "node:fs/promises"
import path from "node:path"
import { CodeIndexManager } from "@harness/harness-indexing/engine"
import { normalizeIndexingStatus } from "@harness/harness-indexing/status"
import type { Config } from "../../src/config/config"
import { GlobalBus } from "../../src/bus/global"
import { WorkspaceV2 } from "@opencode-ai/core/workspace"
import { Global } from "@opencode-ai/core/global"
import { message } from "@opencode-ai/core/harness/fff"
import { WorkspaceContext } from "../../src/control-plane/workspace-context"
import { HarnessIndexing, IndexingModelError } from "../../src/harness/indexing"
import { indexingWarningKey } from "../../src/harness/indexing-warning"
import { IndexingWorker } from "../../src/harness/indexing-worker-client"
import { provideTestInstance, withTestInstance } from "../fixture/fixture"
import { Server } from "../../src/server/server"
import * as Log from "@opencode-ai/core/util/log"
import { disposeAllInstances, tmpdir } from "../fixture/fixture"

Log.init({ print: false })

const fetch = global.fetch

const cfg: Partial<Config.Info> = {
  plugin: ["@harness/harness-indexing"],
  indexing: {
    enabled: true,
    provider: "ollama",
    vectorStore: "qdrant",
    ollama: {
      baseUrl: "http://127.0.0.1:1",
    },
  },
}

const unset: Partial<Config.Info> = {
  plugin: ["@harness/harness-indexing"],
  indexing: {
    provider: "ollama",
    vectorStore: "qdrant",
    ollama: {
      baseUrl: "http://127.0.0.1:1",
    },
  },
}
const inactive: Partial<Config.Info> = {
  plugin: ["@harness/harness-indexing"],
  indexing: {
    enabled: false,
    provider: "ollama",
    vectorStore: "qdrant",
  },
}
const implicitOpenAi: Partial<Config.Info> = {
  plugin: ["@harness/harness-indexing"],
  indexing: {
    enabled: true,
    vectorStore: "qdrant",
    openai: {
      apiKey: "openai-token",
    },
  },
}
const configDir = process.env["HARNESS_CONFIG_DIR"]
const disabled = process.env["HARNESS_DISABLE_CODEBASE_INDEXING"]
const platform = process.env["HARNESS_PLATFORM"]
const error = new Error("test indexing initialization failed")

function inline(directory: string, root: string, hooks: IndexingWorker.Hooks): IndexingWorker.Driver {
  const manager = new CodeIndexManager(directory, root)
  const progress = manager.onProgressUpdate.on(() => hooks.status(normalizeIndexingStatus(manager)))
  const telemetry = manager.onTelemetry.on(hooks.telemetry)

  return {
    async init(input) {
      await manager.initialize(input)
      return normalizeIndexingStatus(manager)
    },
    search: (query, directoryPrefix) => manager.searchIndex(query, directoryPrefix),
    async dispose() {
      progress.dispose()
      telemetry.dispose()
      await manager.dispose()
    },
  }
}

async function wait(read: () => Promise<HarnessIndexing.Status>, state: HarnessIndexing.Status["state"]) {
  for (const _ of Array.from({ length: 100 })) {
    const status = await read()
    if (status.state === state) return status
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`indexing did not reach ${state}`)
}

async function called(init: ReturnType<typeof spyOn<CodeIndexManager, "initialize">>) {
  for (const _ of Array.from({ length: 100 })) {
    if (init.mock.calls.length > 0) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error("indexing initialization did not start")
}

beforeEach(() => {
  process.env["HARNESS_PLATFORM"] = "cli"
  IndexingWorker.override(inline)
})

afterEach(async () => {
  IndexingWorker.override()
  if (configDir === undefined) delete process.env["HARNESS_CONFIG_DIR"]
  else process.env["HARNESS_CONFIG_DIR"] = configDir
  if (disabled === undefined) delete process.env["HARNESS_DISABLE_CODEBASE_INDEXING"]
  else process.env["HARNESS_DISABLE_CODEBASE_INDEXING"] = disabled
  if (platform === undefined) delete process.env["HARNESS_PLATFORM"]
  else process.env["HARNESS_PLATFORM"] = platform
  global.fetch = fetch
  await disposeAllInstances()
})

describe("indexing startup degradation", () => {
  test("keeps server routes alive when indexing initialization fails", async () => {
    const init = spyOn(CodeIndexManager.prototype, "initialize").mockRejectedValue(error)

    await using tmp = await tmpdir({ git: true, config: cfg })
    process.env["HARNESS_CONFIG_DIR"] = tmp.path

    try {
      const app = Server.Default().app

      const config = await app.request("/config", {
        headers: {
          "x-harness-directory": tmp.path,
        },
      })
      expect(config.status).toBe(200)

      const body = await wait(async () => {
        const status = await app.request("/indexing/status", {
          headers: {
            "x-harness-directory": tmp.path,
          },
        })
        expect(status.status).toBe(200)
        return status.json()
      }, "Error")

      expect(body).toMatchObject({
        state: "Error",
      })
      expect(body.message).toContain("Failed to initialize: test indexing initialization failed")
    } finally {
      init.mockRestore()
    }
  })

  test("retains and deduplicates indexing warnings for TUI replay", async () => {
    const warning = {
      code: "qdrant.version-incompatible" as const,
      message:
        "Client version 1.17.0 is incompatible with server version 1.14.1. Set checkCompatibility=false to skip version check.",
    }
    const events: (typeof warning)[] = []
    const workspaces: (string | undefined)[] = []
    let emit: IndexingWorker.Hooks["warning"] | undefined

    IndexingWorker.override((_directory, _root, hooks) => {
      emit = hooks.warning
      return {
        async init() {
          hooks.log({ level: "warn", message: warning.message })
          hooks.warning(warning)
          hooks.warning(warning)
          return {
            state: "Standby",
            message: "Indexing paused.",
            processedFiles: 0,
            totalFiles: 0,
            percent: 0,
          }
        },
        async search() {
          return []
        },
        async dispose() {},
      }
    })

    await using tmp = await tmpdir({ git: true, config: cfg })
    process.env["HARNESS_CONFIG_DIR"] = tmp.path
    const on = (data: {
      directory?: string
      workspace?: string
      payload?: { type?: string; properties?: typeof warning }
    }) => {
      if (data.directory !== tmp.path) return
      if (data.payload?.type !== HarnessIndexing.Warning.type) return
      if (data.payload.properties) events.push(data.payload.properties)
      workspaces.push(data.workspace)
    }
    GlobalBus.on("event", on)

    try {
      const workspace = WorkspaceV2.ID.make("wrk_indexing_warning")
      await WorkspaceContext.provide({
        workspaceID: workspace,
        fn: () =>
          withTestInstance({
            directory: tmp.path,
            fn: () => HarnessIndexing.current(),
          }),
      })
      const app = Server.Default().app

      const list = await (async () => {
        for (const _ of Array.from({ length: 100 })) {
          const response = await app.request("/indexing/warnings", {
            headers: {
              "x-harness-directory": tmp.path,
            },
          })
          expect(response.status).toBe(200)
          const body = (await response.json()) as (typeof warning)[]
          if (body.length > 0) return body
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
        throw new Error("indexing warning was not retained")
      })()
      for (const _ of Array.from({ length: 100 })) {
        if (events.length > 0 && events.length === workspaces.length) break
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      expect(list).toEqual([warning])
      expect(events.length).toBeGreaterThan(0)
      expect(events.every((item) => indexingWarningKey(item) === indexingWarningKey(warning))).toBe(true)
      expect(workspaces.every((item) => item === undefined || item === workspace)).toBe(true)

      const offset = events.length
      const second = WorkspaceV2.ID.make("wrk_indexing_warning_second")
      await WorkspaceContext.provide({
        workspaceID: second,
        fn: () =>
          withTestInstance({
            directory: tmp.path,
            fn: () => HarnessIndexing.warnings(),
          }),
      })
      const next = { ...warning, message: `${warning.message} Again.` }
      emit?.(next)
      for (const _ of Array.from({ length: 100 })) {
        if (workspaces.slice(offset).includes(workspace) && workspaces.slice(offset).includes(second)) break
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      const scoped = workspaces.slice(offset)
      expect(events.slice(offset).every((item) => indexingWarningKey(item) === indexingWarningKey(next))).toBe(true)
      expect(scoped.includes(workspace)).toBe(true)
      expect(scoped.includes(second)).toBe(true)
      expect(scoped.every((item) => item === undefined || item === workspace || item === second)).toBe(true)
    } finally {
      GlobalBus.off("event", on)
    }
  })

  test("coalesces burst indexing progress publications", async () => {
    const complete: HarnessIndexing.Status = {
      state: "Complete",
      message: "Index up-to-date.",
      processedFiles: 50,
      totalFiles: 50,
      percent: 100,
    }
    IndexingWorker.override((_directory, _root, hooks) => ({
      async init() {
        for (const processedFiles of Array.from({ length: 50 }, (_, index) => index + 1)) {
          hooks.status({
            state: "In Progress",
            message: `Indexed ${processedFiles} / 50 files.`,
            processedFiles,
            totalFiles: 50,
            percent: processedFiles * 2,
          })
        }
        return complete
      },
      async search() {
        return []
      },
      async dispose() {},
    }))

    await using tmp = await tmpdir({ git: true, config: cfg })
    process.env["HARNESS_CONFIG_DIR"] = tmp.path
    const events: HarnessIndexing.Status[] = []
    const on = (data: {
      directory?: string
      payload?: { type?: string; properties?: { status?: HarnessIndexing.Status } }
    }) => {
      if (data.directory !== tmp.path) return
      if (data.payload?.type !== HarnessIndexing.Event.type) return
      if (data.payload.properties?.status) events.push(data.payload.properties.status)
    }
    GlobalBus.on("event", on)

    try {
      await withTestInstance({
        directory: tmp.path,
        fn: async () => expect(await wait(() => HarnessIndexing.current(), "Complete")).toEqual(complete),
      })
      await new Promise((resolve) => setTimeout(resolve, 150))

      const progress = events.filter((status) => status.state === "In Progress")
      expect(progress.length).toBeLessThanOrEqual(2)
      expect(progress.filter((status) => status.processedFiles > 0)).toHaveLength(1)
      expect(events.filter((status) => status.state === "Complete")).toEqual([complete])
    } finally {
      GlobalBus.off("event", on)
    }
  })

  test("reports routes as in progress while initialization is in flight", async () => {
    await using tmp = await tmpdir({ git: true, config: cfg })
    process.env["HARNESS_CONFIG_DIR"] = tmp.path
    const gate = Promise.withResolvers<{ requiresRestart: boolean }>()
    const init = spyOn(CodeIndexManager.prototype, "initialize").mockImplementation(() => gate.promise)

    try {
      const app = Server.Default().app

      const config = await app.request("/config", {
        headers: {
          "x-harness-directory": tmp.path,
        },
      })
      expect(config.status).toBe(200)

      const status = await app.request("/indexing/consent", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-harness-directory": tmp.path,
        },
        body: JSON.stringify({ enabled: true }),
      })
      expect(status.status).toBe(200)
      await called(init)

      const body = await status.json()
      expect(body).toMatchObject({
        state: "In Progress",
        message: "Indexing is initializing.",
      })
    } finally {
      gate.resolve({ requiresRestart: false })
      init.mockRestore()
    }
  })

  test("does not publish initialized status after in-flight startup is disposed", async () => {
    await using tmp = await tmpdir({ git: true, config: cfg })
    process.env["HARNESS_CONFIG_DIR"] = tmp.path
    const gate = Promise.withResolvers<{ requiresRestart: boolean }>()
    const init = spyOn(CodeIndexManager.prototype, "initialize").mockImplementation(() => gate.promise)
    const events: HarnessIndexing.Status[] = []
    const on = (data: {
      directory?: string
      payload?: { type?: string; properties?: { status?: HarnessIndexing.Status } }
    }) => {
      if (data.directory !== tmp.path) return
      if (data.payload?.type !== HarnessIndexing.Event.type) return
      if (data.payload.properties?.status) events.push(data.payload.properties.status)
    }
    GlobalBus.on("event", on)

    try {
      await provideTestInstance({
        directory: tmp.path,
        init: Effect.promise(() => HarnessIndexing.init()),
        fn: async () => {
          await called(init)
          expect((await HarnessIndexing.current()).state).toBe("In Progress")
        },
      })

      await disposeAllInstances()
      gate.resolve({ requiresRestart: false })
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(events.some((status) => status.state === "Complete" || status.state === "Standby")).toBe(false)
    } finally {
      GlobalBus.off("event", on)
      gate.resolve({ requiresRestart: false })
      init.mockRestore()
    }
  })

  test("keeps degraded indexing queryable but releases its failed engine", async () => {
    const init = spyOn(CodeIndexManager.prototype, "initialize").mockRejectedValue(error)
    const dispose = spyOn(CodeIndexManager.prototype, "dispose")

    await using tmp = await tmpdir({ git: true, config: cfg })
    process.env["HARNESS_CONFIG_DIR"] = tmp.path

    try {
      await provideTestInstance({
        directory: tmp.path,
        init: Effect.promise(() => HarnessIndexing.init()),
        fn: async () => {
          const status = await wait(() => HarnessIndexing.current(), "Error")

          expect(status.state).toBe("Error")
          expect(status.message).toContain("Failed to initialize: test indexing initialization failed")
          expect(await HarnessIndexing.available()).toBe(false)
          expect(HarnessIndexing.ready()).toBe(false)
          expect(await HarnessIndexing.search("boot failure")).toEqual([])
          expect(dispose).toHaveBeenCalledTimes(1)
        },
      })
    } finally {
      dispose.mockRestore()
      init.mockRestore()
    }
  })

  test("reports not ready while initialization is in flight", async () => {
    await using tmp = await tmpdir({ git: true, config: cfg })
    process.env["HARNESS_CONFIG_DIR"] = tmp.path
    const gate = Promise.withResolvers<{ requiresRestart: boolean }>()
    const init = spyOn(CodeIndexManager.prototype, "initialize").mockImplementation(() => gate.promise)

    try {
      await provideTestInstance({
        directory: tmp.path,
        init: Effect.promise(() => HarnessIndexing.init()),
        fn: async () => {
          await called(init)

          expect(init).toHaveBeenCalled()
          expect(HarnessIndexing.ready()).toBe(false)
          expect(await HarnessIndexing.available()).toBe(false)
          const search = HarnessIndexing.search("boot failure")
          const pending = await Promise.race([search.then(() => false), Promise.resolve(true)])
          expect(pending).toBe(true)
          gate.resolve({ requiresRestart: false })
          expect(await search).toEqual([])
        },
      })
    } finally {
      gate.resolve({ requiresRestart: false })
      init.mockRestore()
    }
  })

  test("stays disabled when indexing enablement is unset", async () => {
    await using tmp = await tmpdir({ git: true, config: unset })
    process.env["HARNESS_CONFIG_DIR"] = tmp.path
    const init = spyOn(CodeIndexManager.prototype, "initialize")

    await provideTestInstance({
      directory: tmp.path,
      fn: async () => {
        const status = await wait(() => HarnessIndexing.current(), "Disabled")

        expect(status).toMatchObject({
          state: "Disabled",
          message: "Indexing disabled.",
        })
        expect(await HarnessIndexing.available()).toBe(false)
        expect(HarnessIndexing.ready()).toBe(false)
        expect(await HarnessIndexing.search("disabled")).toEqual([])
        expect(init).not.toHaveBeenCalled()
      },
    })
  })

  test("warns for home/root workspaces and aliases without allocating an indexing worker", async () => {
    const created: string[] = []
    IndexingWorker.override((directory) => {
      created.push(directory)
      throw new Error("unsafe workspaces must not allocate an indexing worker")
    })

    await using tmp = await tmpdir()
    const app = Server.Default().app
    for (const target of [path.parse(process.cwd()).root, Global.Path.home]) {
      const link = path.join(tmp.path, target === Global.Path.home ? "home" : "root")
      await fs.symlink(target, link, process.platform === "win32" ? "junction" : "dir")
      for (const directory of [target, link]) {
        await provideTestInstance({
          directory,
          fn: async () => {
            expect(await HarnessIndexing.current()).toMatchObject({ state: "Disabled", message })
            expect(await HarnessIndexing.available()).toBe(false)
            expect(HarnessIndexing.ready()).toBe(false)
            expect(await HarnessIndexing.search("filesystem root")).toEqual([])
            const warnings = await app.request("/config/warnings", { headers: { "x-harness-directory": directory } })
            expect(warnings.status).toBe(200)
            expect(await warnings.json()).toContainEqual(expect.objectContaining({ message }))
            expect(created).toEqual([])
          },
        })
      }
    }
    const warnings = await app.request("/config/warnings", { headers: { "x-harness-directory": tmp.path } })
    expect(warnings.status).toBe(200)
    expect(await warnings.json()).not.toContainEqual(expect.objectContaining({ message }))
  })

  test.each([false, true])("handles removed directories with no-workspace flag %s", async (disabled) => {
    await using tmp = await tmpdir({ config: cfg })
    process.env["HARNESS_CONFIG_DIR"] = tmp.path
    delete process.env["HARNESS_DISABLE_CODEBASE_INDEXING"]
    if (disabled) process.env["HARNESS_DISABLE_CODEBASE_INDEXING"] = "vscode-no-workspace"
    const directory = path.join(tmp.path, "project")
    await fs.mkdir(directory)
    const created: string[] = []
    IndexingWorker.override((directory) => {
      created.push(directory)
      throw new Error("removed workspaces must not start an indexing worker")
    })

    await provideTestInstance({
      directory,
      fn: async () => {
        await fs.rmdir(directory)
        await HarnessIndexing.init()
        const status = await HarnessIndexing.current()
        expect(await HarnessIndexing.available()).toBe(false)
        expect(HarnessIndexing.ready()).toBe(false)
        expect(await HarnessIndexing.search("removed workspace")).toEqual([])
        expect(created).toEqual([])
        if (disabled) {
          expect(status).toMatchObject({
            state: "Disabled",
            message: "Codebase indexing is disabled because no workspace folder is open in VS Code.",
          })
          return
        }
        expect(status.state).toBe("Error")
        expect(status.message).toContain("Failed to initialize:")
        expect(status.message).toContain("ENOENT")
      },
    })
  })

  test("does not allocate an engine when indexing configuration is disabled", async () => {
    const created: string[] = []
    IndexingWorker.override((directory, root, hooks) => {
      created.push(directory)
      return inline(directory, root, hooks)
    })

    await using tmp = await tmpdir({ git: true, config: inactive })
    process.env["HARNESS_CONFIG_DIR"] = tmp.path

    await provideTestInstance({
      directory: tmp.path,
      fn: async () => {
        const status = await wait(() => HarnessIndexing.current(), "Disabled")

        expect(status).toMatchObject({
          state: "Disabled",
          message: "Indexing disabled.",
        })
        expect(await HarnessIndexing.available()).toBe(false)
        expect(HarnessIndexing.ready()).toBe(false)
        expect(await HarnessIndexing.search("disabled")).toEqual([])
        expect(created).toEqual([])
      },
    })
  })

  test("requires explicit VS Code consent even when repository config enables indexing", async () => {
    const created: string[] = []
    IndexingWorker.override((directory) => {
      created.push(directory)
      return inline(directory, "/index", {
        status() {},
        telemetry() {},
        warning() {},
        log() {},
        failure() {},
      })
    })

    await using tmp = await tmpdir({ git: true, config: cfg })
    process.env["HARNESS_CONFIG_DIR"] = tmp.path
    process.env["HARNESS_PLATFORM"] = "vscode"

    try {
      await provideTestInstance({
        directory: tmp.path,
        init: Effect.promise(() => HarnessIndexing.setConsent(false)),
        fn: async () => {
          const status = await HarnessIndexing.current()
          expect(status.state).toBe("Disabled")
          expect(status.message).toContain("enable it for this project")
          expect(created).toEqual([])
        },
      })
    } finally {
      process.env["HARNESS_PLATFORM"] = "cli"
    }
  })

  test("shares consent across linked worktrees and revokes every project worker", async () => {
    const created: string[] = []
    const disposed: string[] = []
    IndexingWorker.override((directory) => {
      created.push(directory)
      return {
        async init() {
          return {
            state: "Standby",
            message: "Indexing paused.",
            processedFiles: 0,
            totalFiles: 0,
            percent: 0,
          }
        },
        async search() {
          return []
        },
        async dispose() {
          disposed.push(directory)
        },
      }
    })

    await using tmp = await tmpdir({ git: true, config: cfg })
    const worktree = path.join(path.dirname(tmp.path), `indexing-worktree-${Date.now()}`)
    await $`git worktree add --quiet -b indexing-consent-${Date.now()} ${worktree} HEAD`.cwd(tmp.path)
    process.env["HARNESS_CONFIG_DIR"] = tmp.path
    process.env["HARNESS_PLATFORM"] = "vscode"

    try {
      await withTestInstance({
        directory: tmp.path,
        fn: async () => {
          await HarnessIndexing.setConsent(true)
          await wait(() => HarnessIndexing.current(), "Standby")
        },
      })
      await withTestInstance({
        directory: worktree,
        fn: async () => expect((await wait(() => HarnessIndexing.current(), "Standby")).state).toBe("Standby"),
      })
      expect(new Set(created)).toEqual(new Set([tmp.path, worktree]))

      await withTestInstance({
        directory: tmp.path,
        fn: () => HarnessIndexing.setConsent(false),
      })

      expect(new Set(disposed)).toEqual(new Set([tmp.path, worktree]))
      await withTestInstance({
        directory: worktree,
        fn: async () => expect((await HarnessIndexing.current()).state).toBe("Disabled"),
      })
    } finally {
      process.env["HARNESS_PLATFORM"] = "cli"
      await $`git worktree remove --force ${worktree}`.cwd(tmp.path).quiet()
    }
  }, 15_000)

  test("stays disabled when VS Code starts without a workspace folder", async () => {
    await using tmp = await tmpdir({ git: true, config: cfg })
    process.env["HARNESS_CONFIG_DIR"] = tmp.path
    process.env["HARNESS_DISABLE_CODEBASE_INDEXING"] = "vscode-no-workspace"
    const init = spyOn(CodeIndexManager.prototype, "initialize")

    try {
      await provideTestInstance({
        directory: tmp.path,
        init: Effect.promise(() => HarnessIndexing.init()),
        fn: async () => {
          const status = await HarnessIndexing.current()

          expect(status).toMatchObject({
            state: "Disabled",
            message: "Codebase indexing is disabled because no workspace folder is open in VS Code.",
          })
          expect(await HarnessIndexing.available()).toBe(false)
          expect(HarnessIndexing.ready()).toBe(false)
          expect(await HarnessIndexing.search("no workspace")).toEqual([])
          expect(init).not.toHaveBeenCalled()
        },
      })
    } finally {
      init.mockRestore()
    }
  })
})
