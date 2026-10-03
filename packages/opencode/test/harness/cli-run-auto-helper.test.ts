import { describe, expect, test } from "bun:test"
import { HarnessRunAuto } from "../../src/harness/cli/run-auto"

describe("HarnessRunAuto", () => {
  test("tracks task child sessions without allowing unrelated sessions", () => {
    const state = HarnessRunAuto.create("ses_root")

    expect(HarnessRunAuto.allowed(state, "ses_root")).toBe(true)
    expect(HarnessRunAuto.allowed(state, "ses_child")).toBe(false)

    HarnessRunAuto.track(state, {
      type: "tool",
      tool: "task",
      sessionID: "ses_root",
      state: {
        metadata: {
          sessionId: "ses_child",
        },
      },
    })

    expect(HarnessRunAuto.allowed(state, "ses_child")).toBe(true)
    HarnessRunAuto.track(state, {
      type: "tool",
      tool: "task",
      sessionID: "ses_child",
      state: { metadata: { sessionId: "ses_grandchild" } },
    })
    expect(HarnessRunAuto.allowed(state, "ses_grandchild")).toBe(true)
    expect(HarnessRunAuto.allowed(state, "ses_other")).toBe(false)
  })

  test("ignores malformed or untrusted task metadata", () => {
    const state = HarnessRunAuto.create("ses_root")

    HarnessRunAuto.track(state, {
      type: "tool",
      tool: "task",
      sessionID: "ses_root",
      state: {
        metadata: {
          sessionId: "",
        },
      },
    })
    HarnessRunAuto.track(state, {
      type: "tool",
      tool: "task",
      sessionID: "ses_other",
      state: {
        metadata: {
          sessionId: "ses_wrong",
        },
      },
    })
    HarnessRunAuto.track(state, {
      type: "text",
      sessionID: "ses_root",
      state: {},
    })

    expect(HarnessRunAuto.allowed(state, "ses_wrong")).toBe(false)
    expect(HarnessRunAuto.allowed(state, "")).toBe(false)
  })
})
