import { describe, expect, test } from "bun:test"
import { Client } from "../client"

describe("telemetry client", () => {
  test("is never enabled, even when asked to be", () => {
    Client.init("/tmp")
    Client.setEnabled(true)
    expect(Client.isEnabled()).toBe(false)
  })

  test("accepts events and shuts down without sending anything", async () => {
    Client.capture("anything", { a: 1 })
    Client.alias("a", "b")
    Client.flushInBackground(0)
    await Client.shutdown(10)
    expect(Client.isEnabled()).toBe(false)
  })
})
