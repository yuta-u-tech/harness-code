import { expect, spyOn, test } from "bun:test"
import { clearInFlightCache } from "../../../src/harness-sessions/inflight-cache"
import { HarnessShutdown } from "../../../src/harness/cli/shutdown"

test("HarnessSessions drains queued ingest before instance disposal", async () => {
  const token = process.env.HARNESS_API_KEY
  const base = process.env.HARNESS_SESSION_INGEST_URL
  const calls: string[] = []
  let body: unknown
  process.env.HARNESS_API_KEY = "shutdown-token"
  process.env.HARNESS_SESSION_INGEST_URL = "https://ingest.test"
  clearInFlightCache("harness-sessions:token")
  clearInFlightCache("harness-sessions:client")
  clearInFlightCache("harness-sessions:token-valid:shutdown-token")
  await HarnessShutdown.run()

  const request = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.endsWith("/api/user")) return new Response("{}", { status: 200 })
        if (url.endsWith("/api/session")) {
          return Response.json({ id: "remote-shutdown", ingestPath: "/api/ingest/shutdown" })
        }
        if (url.endsWith("/api/ingest/shutdown?v=2")) {
          body = init?.body ? JSON.parse(String(init.body)) : undefined
          calls.push("ingest")
          return new Response("{}", { status: 200 })
        }
        throw new Error(`Unexpected request: ${url}`)
      },
      { preconnect: globalThis.fetch.preconnect },
    ),
  )

  try {
    const url = new URL("../../../src/harness-sessions/harness-sessions.ts", import.meta.url)
    url.searchParams.set("test", crypto.randomUUID())
    const { HarnessSessions } = await import(url.href)
    await HarnessSessions.bootstrap("session-shutdown")
    expect(await HarnessSessions._queueIngestForTest("session-shutdown")).toBe(true)

    await HarnessShutdown.run()
    calls.push("dispose")

    expect(calls).toEqual(["ingest", "dispose"])
    expect(body).toEqual({ data: [{ type: "session_status", data: { status: "idle" } }] })
  } finally {
    request.mockRestore()
    if (token === undefined) delete process.env.HARNESS_API_KEY
    else process.env.HARNESS_API_KEY = token
    if (base === undefined) delete process.env.HARNESS_SESSION_INGEST_URL
    else process.env.HARNESS_SESSION_INGEST_URL = base
    clearInFlightCache("harness-sessions:token")
    clearInFlightCache("harness-sessions:client")
    clearInFlightCache("harness-sessions:token-valid:shutdown-token")
    await HarnessShutdown.run()
  }
}, 30_000)
