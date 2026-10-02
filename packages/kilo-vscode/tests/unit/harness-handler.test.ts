import { describe, expect, it } from "bun:test"

import {
  parseHarnessMessage,
  routeHarnessWebviewMessage,
  type HarnessContext,
} from "../../src/kilo-provider/handlers/harness"

const run = { id: "hr_1", status: "running", task: "t", log: [], notes: [], attempt: 0, startedAt: 1, sessionID: "s" }

/** The backend client is the only thing replaced; the handler's routing and messages are real. */
function setup(overrides: Record<string, unknown> = {}) {
  const posted: unknown[] = []
  const calls: { name: string; args: Record<string, unknown> }[] = []
  const record = (name: string, data: unknown) => async (args: Record<string, unknown>) => {
    calls.push({ name, args })
    return { data }
  }
  const client = {
    harness: {
      start: record("start", run),
      list: record("list", [run]),
      get: record("get", run),
      review: record("review", true),
      stop: record("stop", true),
      ...overrides,
    },
  }
  const ctx: HarnessContext = {
    client: client as never,
    postMessage: (msg) => posted.push(msg),
    getWorkspaceDirectory: () => "/project",
  }
  return { ctx, posted, calls }
}

describe("parseHarnessMessage", () => {
  it("reads each of the five requests", () => {
    expect(parseHarnessMessage({ type: "harnessList" })).toEqual({ type: "harnessList" })
    expect(parseHarnessMessage({ type: "harnessStart", task: "t" })).toEqual({ type: "harnessStart", task: "t" })
    expect(parseHarnessMessage({ type: "harnessGet", runID: "r" })).toEqual({ type: "harnessGet", runID: "r" })
    expect(parseHarnessMessage({ type: "harnessStop", runID: "r" })).toEqual({ type: "harnessStop", runID: "r" })
    expect(parseHarnessMessage({ type: "harnessReview", runID: "r", approve: true })).toEqual({
      type: "harnessReview",
      runID: "r",
      approve: true,
    })
  })

  it("keeps a review comment and drops an empty one", () => {
    const base = { type: "harnessReview", runID: "r", approve: false }
    expect(parseHarnessMessage({ ...base, comment: "fix it" })).toMatchObject({ comment: "fix it" })
    expect(parseHarnessMessage({ ...base, comment: "" })).not.toHaveProperty("comment")
  })

  it("ignores other messages", () => {
    expect(parseHarnessMessage({ type: "requestProviders" })).toBeUndefined()
    expect(parseHarnessMessage(null)).toBeUndefined()
    expect(parseHarnessMessage("harnessList")).toBeUndefined()
  })

  it("rejects a request that is missing what it needs", () => {
    expect(parseHarnessMessage({ type: "harnessStart" })).toBeUndefined()
    expect(parseHarnessMessage({ type: "harnessStart", task: "" })).toBeUndefined()
    expect(parseHarnessMessage({ type: "harnessGet" })).toBeUndefined()
    expect(parseHarnessMessage({ type: "harnessReview", runID: "r" })).toBeUndefined()
    expect(parseHarnessMessage({ type: "harnessReview", runID: "r", approve: "yes" })).toBeUndefined()
  })
})

describe("routeHarnessWebviewMessage", () => {
  it("starts a run for the project directory and posts it back", async () => {
    const { ctx, posted, calls } = setup()
    await routeHarnessWebviewMessage(ctx, { type: "harnessStart", task: "add a feature" })
    expect(calls[0]).toEqual({ name: "start", args: { directory: "/project", task: "add a feature" } })
    expect(posted).toEqual([{ type: "harnessRun", run }])
  })

  it("lists runs", async () => {
    const { ctx, posted } = setup()
    await routeHarnessWebviewMessage(ctx, { type: "harnessList" })
    expect(posted).toEqual([{ type: "harnessRuns", runs: [run] }])
  })

  it("gets one run", async () => {
    const { ctx, posted, calls } = setup()
    await routeHarnessWebviewMessage(ctx, { type: "harnessGet", runID: "hr_1" })
    expect(calls[0]?.args).toEqual({ runID: "hr_1", directory: "/project" })
    expect(posted).toEqual([{ type: "harnessRun", run }])
  })

  it("sends the review, then posts the run's new state", async () => {
    const { ctx, posted, calls } = setup()
    await routeHarnessWebviewMessage(ctx, { type: "harnessReview", runID: "hr_1", approve: false, comment: "rename x" })
    expect(calls.map((c) => c.name)).toEqual(["review", "get"])
    expect(calls[0]?.args).toEqual({ runID: "hr_1", directory: "/project", approve: false, comment: "rename x" })
    expect(posted).toEqual([{ type: "harnessRun", run }])
  })

  it("stops a run, then posts its new state", async () => {
    const { ctx, posted, calls } = setup()
    await routeHarnessWebviewMessage(ctx, { type: "harnessStop", runID: "hr_1" })
    expect(calls.map((c) => c.name)).toEqual(["stop", "get"])
    expect(posted).toEqual([{ type: "harnessRun", run }])
  })

  it("tells the webview when the backend is not connected", async () => {
    const { posted } = setup()
    await routeHarnessWebviewMessage(
      { client: null, postMessage: (m) => posted.push(m), getWorkspaceDirectory: () => "/p" },
      { type: "harnessList" },
    )
    expect(posted).toHaveLength(1)
    expect(posted[0]).toMatchObject({ type: "harnessError" })
  })

  it("reports the message from a failed start", async () => {
    const { ctx, posted } = setup({
      start: async () => {
        throw { message: "no harness is configured for this project" }
      },
    })
    await routeHarnessWebviewMessage(ctx, { type: "harnessStart", task: "x" })
    expect(posted).toEqual([{ type: "harnessError", message: "no harness is configured for this project" }])
  })

  it("reports a plain Error too", async () => {
    const { ctx, posted } = setup({
      list: async () => {
        throw new Error("connection lost")
      },
    })
    await routeHarnessWebviewMessage(ctx, { type: "harnessList" })
    expect(posted).toEqual([{ type: "harnessError", message: "connection lost" }])
  })
})
