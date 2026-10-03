/**
 * Harness handlers: start, watch, review and stop harness runs.
 * Requests go to the backend through the SDK; the webview polls for state, so there is no event plumbing.
 * No vscode dependency.
 */

import type { HarnessClient } from "@harness/sdk/v2/client"
import type { HarnessWebviewMessage } from "../../../webview-ui/src/types/messages/harness-run"

export interface HarnessContext {
  readonly client: HarnessClient | null
  postMessage(msg: unknown): void
  getWorkspaceDirectory(): string
}

const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : undefined)

/** Reads a webview message as a harness request, or returns undefined when it is something else or malformed. */
export function parseHarnessMessage(raw: unknown): HarnessWebviewMessage | undefined {
  if (typeof raw !== "object" || raw === null || !("type" in raw)) return undefined
  const runID = "runID" in raw ? text(raw.runID) : undefined
  if (raw.type === "harnessList") return { type: "harnessList" }
  if (raw.type === "harnessStart") {
    const task = "task" in raw ? text(raw.task) : undefined
    return task ? { type: "harnessStart", task } : undefined
  }
  if (!runID) return undefined
  if (raw.type === "harnessGet") return { type: "harnessGet", runID }
  if (raw.type === "harnessStop") return { type: "harnessStop", runID }
  if (raw.type === "harnessReview" && "approve" in raw && typeof raw.approve === "boolean") {
    const comment = "comment" in raw ? text(raw.comment) : undefined
    return { type: "harnessReview", runID, approve: raw.approve, ...(comment ? { comment } : {}) }
  }
  return undefined
}

/** SDK errors arrive as the response body, so read `message` from either shape. */
function reason(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === "object" && err !== null && "message" in err && typeof err.message === "string") return err.message
  return String(err)
}

export async function routeHarnessWebviewMessage(ctx: HarnessContext, message: HarnessWebviewMessage): Promise<void> {
  const client = ctx.client
  if (!client) {
    ctx.postMessage({ type: "harnessError", message: "The backend is not connected yet." })
    return
  }
  const directory = ctx.getWorkspaceDirectory()
  const once = { throwOnError: true } as const

  const show = async (runID: string) => {
    const res = await client.harnessRun.get({ runID, directory }, once)
    ctx.postMessage({ type: "harnessRun", run: res.data })
  }

  const handle = async () => {
    if (message.type === "harnessStart") {
      const res = await client.harnessRun.start({ directory, task: message.task }, once)
      ctx.postMessage({ type: "harnessRun", run: res.data })
      return
    }
    if (message.type === "harnessList") {
      const res = await client.harnessRun.list({ directory }, once)
      ctx.postMessage({ type: "harnessRuns", runs: res.data })
      return
    }
    if (message.type === "harnessGet") return show(message.runID)
    if (message.type === "harnessReview") {
      await client.harnessRun.review(
        { runID: message.runID, directory, approve: message.approve, comment: message.comment },
        once,
      )
      return show(message.runID)
    }
    await client.harnessRun.stop({ runID: message.runID, directory }, once)
    return show(message.runID)
  }

  await handle().catch((err: unknown) => {
    console.error("[Harness New] Harness request failed:", err)
    ctx.postMessage({ type: "harnessError", message: reason(err) })
  })
}
