import { describe, expect, test } from "bun:test"
import { createWorkerShutdown } from "../../../src/cli/tui/worker-shutdown"

describe("createWorkerShutdown", () => {
  test("disposes instances before stopping the server", async () => {
    const order: string[] = []
    const run = createWorkerShutdown({
      dispose: async () => {
        order.push("dispose")
      },
      stopServer: async () => {
        order.push("stopServer")
      },
    })

    await run()
    expect(order).toEqual(["dispose", "stopServer"])
  })
})
