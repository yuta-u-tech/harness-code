import { describe, expect, test } from "bun:test"
import * as vscode from "vscode"
import { HarnessConnectionService } from "./connection-service"
import type { SSEPayload } from "./sdk-sse-adapter"

function state(value: boolean) {
  return {
    get: <T>() => value as T,
    update: async () => undefined,
  }
}

describe("HarnessConnectionService sandbox preference", () => {
  test("uses workspace state instead of extension-global state", () => {
    const service = new HarnessConnectionService({
      workspaceState: state(false),
      globalState: state(true),
    } as any)

    expect(service.sandboxPreference.resolve(true)).toBe(false)
  })
})

describe("HarnessConnectionService visible sessions", () => {
  test("reports a session as visible while any surface displays it", () => {
    const service = new HarnessConnectionService({} as any)

    expect(service.isVisible("ses-1")).toBe(false)

    service.registerVisible("sidebar", ["ses-1"])
    service.registerVisible("agent-manager", ["ses-2"])
    expect(service.isVisible("ses-1")).toBe(true)
    expect(service.isVisible("ses-2")).toBe(true)
    expect(service.isVisible("ses-3")).toBe(false)

    // A hidden panel registers an empty set, which is what makes this usable as
    // the notification suppression check.
    service.registerVisible("sidebar", [])
    expect(service.isVisible("ses-1")).toBe(false)
    expect(service.isVisible("ses-2")).toBe(true)

    service.unregisterVisible("agent-manager")
    expect(service.isVisible("ses-2")).toBe(false)
  })
})

describe("HarnessConnectionService clients", () => {
  test("returns a connected client without a workspace folder", async () => {
    const service = new HarnessConnectionService({} as any)
    const client = {}
    const workspace = vscode.workspace as { workspaceFolders?: readonly vscode.WorkspaceFolder[] }
    const folders = workspace.workspaceFolders

    ;(service as any).client = client
    ;(service as any).state = "connected"
    workspace.workspaceFolders = undefined

    try {
      expect(await service.getClientAsync()).toBe(client)
    } finally {
      workspace.workspaceFolders = folders
    }
  })
})

describe("HarnessConnectionService explicit aborts", () => {
  const close = {
    id: "event-close",
    type: "session.turn.close",
    properties: { sessionID: "session", reason: "interrupted" },
  } as SSEPayload

  function setup() {
    const service = new HarnessConnectionService({} as any)
    const raw: SSEPayload[] = []
    const first: SSEPayload[] = []
    const second: SSEPayload[] = []
    service.onEvent((event) => raw.push(event))
    service.onEventFiltered(
      () => true,
      (event) => first.push(event),
    )
    service.onEventFiltered(
      () => true,
      (event) => second.push(event),
    )
    return { service, raw, first, second }
  }

  test("suppresses a successful explicit abort for filtered subscribers", async () => {
    const state = setup()

    await state.service.runExplicitAbort("session", "/repo", async () => {
      ;(state.service as any).broadcast(close, "/repo")
    })

    expect(state.first).toEqual([])
    expect(state.second).toEqual([])
    expect(state.raw).toEqual([close])
  })

  test("replays a failed explicit abort for filtered subscribers", async () => {
    const state = setup()

    await expect(
      state.service.runExplicitAbort("session", "/repo", async () => {
        ;(state.service as any).broadcast(close, "/repo")
        throw new Error("abort failed")
      }),
    ).rejects.toThrow("abort failed")

    expect(state.first).toEqual([close])
    expect(state.second).toEqual([close])
    expect(state.raw).toEqual([close])
  })
})

describe("HarnessConnectionService drainPendingPrompts", () => {
  test("ignores stale NotFoundError replies while draining permissions", async () => {
    const service = new HarnessConnectionService({} as any)
    const client = {
      project: {
        list: async () => ({ data: [] }),
      },
      permission: {
        list: async () => ({ data: [{ id: "per_test" }] }),
        reply: async () => ({ error: { name: "NotFoundError", data: { message: "missing" } } }),
      },
      question: {
        list: async () => ({ data: [] }),
      },
      suggestion: {
        list: async () => ({ data: [] }),
      },
      network: {
        list: async () => ({ data: [] }),
      },
    }

    ;(service as any).client = client
    ;(service as any).directoryProviders.add(() => ["/tmp/workspace"])

    await expect(service.drainPendingPrompts()).resolves.toBeUndefined()
  })

  test("drains four directories concurrently and suggestions once", async () => {
    const service = new HarnessConnectionService({} as any)
    const dirs = ["/tmp/a", "/tmp/b", "/tmp/c", "/tmp/d", "/tmp/e"]
    const gates = new Map(dirs.map((dir) => [dir, Promise.withResolvers<void>()]))
    const fifth = Promise.withResolvers<void>()
    const calls: string[] = []
    let cleared = 0
    const client = {
      permission: {
        list: async ({ directory }: { directory: string }) => {
          calls.push(`permission:${directory}`)
          if (directory === dirs[4]) fifth.resolve()
          await gates.get(directory)!.promise
          return { data: [] }
        },
      },
      question: {
        list: async ({ directory }: { directory: string }) => {
          calls.push(`question:${directory}`)
          return { data: [] }
        },
      },
      suggestion: {
        list: async ({ directory }: { directory: string }) => {
          calls.push(`suggestion:${directory}`)
          return { data: [] }
        },
      },
      network: {
        list: async ({ directory }: { directory: string }) => {
          calls.push(`network:${directory}`)
          return { data: [] }
        },
      },
    }

    ;(service as any).client = client
    ;(service as any).directoryProviders.add(() => dirs)
    service.onClearPendingPrompts(() => cleared++)

    const pending = service.drainPendingPrompts()
    expect(calls).toEqual(dirs.slice(0, 4).map((dir) => `permission:${dir}`))

    gates.get(dirs[0])!.resolve()
    await fifth.promise
    expect(calls.filter((call) => call.startsWith("permission:"))).toEqual(dirs.map((dir) => `permission:${dir}`))

    for (const gate of gates.values()) gate.resolve()
    await pending

    expect(calls.filter((call) => call.startsWith("suggestion:"))).toEqual([`suggestion:${dirs[0]}`])
    const suggestion = calls.findIndex((call) => call.startsWith("suggestion:"))
    expect(calls.filter((call) => call.startsWith("question:")).every((call) => calls.indexOf(call) < suggestion)).toBe(
      true,
    )
    expect(calls.filter((call) => call.startsWith("network:")).every((call) => calls.indexOf(call) > suggestion)).toBe(
      true,
    )
    expect(cleared).toBe(1)
  })

  test("waits for active drains and skips queued directories after a failure", async () => {
    const service = new HarnessConnectionService({} as any)
    const dirs = ["/tmp/a", "/tmp/b", "/tmp/c", "/tmp/d", "/tmp/e"]
    const release = Promise.withResolvers<void>()
    const calls: string[] = []
    let cleared = 0
    const client = {
      permission: {
        list: async ({ directory }: { directory: string }) => {
          calls.push(directory)
          if (directory === dirs[0]) await release.promise
          if (directory === dirs[1]) return { error: "failed" }
          return { data: [] }
        },
      },
      question: { list: async () => ({ data: [] }) },
      suggestion: { list: async () => ({ data: [] }) },
      network: { list: async () => ({ data: [] }) },
    }

    ;(service as any).client = client
    ;(service as any).directoryProviders.add(() => dirs)
    service.onClearPendingPrompts(() => cleared++)

    const pending = service.drainPendingPrompts()
    expect(calls).toEqual(dirs.slice(0, 4))
    expect(
      await Promise.race([
        pending.then(
          () => "settled",
          () => "settled",
        ),
        Promise.resolve("pending"),
      ]),
    ).toBe("pending")
    expect(calls).not.toContain(dirs[4])

    release.resolve()
    await expect(pending).rejects.toThrow(`Failed to list permissions for ${dirs[1]}`)
    expect(calls).not.toContain(dirs[4])
    expect(cleared).toBe(0)
  })
})

describe("HarnessConnectionService server exit handling", () => {
  test("reports signal name when process is killed by signal", () => {
    const service = new HarnessConnectionService({} as any)
    let stateErr: Error | undefined
    service.onStateChange((state, err) => {
      if (state === "error") stateErr = err
    })
    ;(service as any).handleServerExit(null, "SIGSEGV")
    expect(stateErr?.message).toBe("CLI background process exited with signal SIGSEGV. Retry to reconnect.")
  })

  test("reports exit code when process exits normally with code", () => {
    const service = new HarnessConnectionService({} as any)
    let stateErr: Error | undefined
    service.onStateChange((state, err) => {
      if (state === "error") stateErr = err
    })
    ;(service as any).handleServerExit(1, null)
    expect(stateErr?.message).toBe("CLI background process exited with code 1. Retry to reconnect.")
  })
})
