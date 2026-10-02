import { describe, expect, test } from "bun:test"
import type { ConfigHarnessV1 } from "@opencode-ai/core/v1/config/harness"
import { Flow } from "../../../src/kilocode/harness/flow"

type Rubric = Extract<ConfigHarnessV1.Info["steps"][number], { kind: "check" }>["checks"][number] & { type: "rubric" }

const rubric = (over: Partial<Rubric> = {}): Rubric => ({
  id: "r",
  type: "rubric",
  name: "品質",
  model: "ollama/gpt-oss:20b",
  runs: 3,
  pass: 3.5,
  required: false,
  items: [
    { id: "a", name: "可読性", weight: 3, criterion: "" },
    { id: "b", name: "一貫性", weight: 1, criterion: "" },
  ],
  ...over,
})

const flow: ConfigHarnessV1.Info = {
  steps: [
    { id: "plan", kind: "agent", name: "計画", agent: "harness-plan" },
    { id: "impl", kind: "agent", name: "実装", agent: "harness-impl" },
    {
      id: "verify",
      kind: "check",
      name: "検証",
      failTo: "impl",
      retries: 2,
      checks: [{ id: "c1", type: "command", name: "テスト", command: "bun test", required: true }],
    },
    { id: "human", kind: "human", name: "確認", failTo: "impl", show: ["diff"], checklist: [] },
  ],
}

describe("Flow.median", () => {
  test("picks the middle of an odd list regardless of order", () => {
    expect(Flow.median([5, 1, 3])).toBe(3)
  })

  test("averages the two middle values of an even list", () => {
    expect(Flow.median([1, 2, 4, 5])).toBe(3)
  })

  test("returns the only value", () => {
    expect(Flow.median([4])).toBe(4)
  })

  test("returns 0 for an empty list", () => {
    expect(Flow.median([])).toBe(0)
  })
})

describe("Flow.score", () => {
  test("uses the median of the runs for each item, then weights them", () => {
    const result = Flow.score(rubric(), { a: [5, 1, 4], b: [2, 2, 2] })
    // a: median 4 (weight 3), b: 2 (weight 1) -> (12 + 2) / 4
    expect(result.total).toBe(3.5)
    expect(result.items).toEqual([
      { id: "a", name: "可読性", score: 4 },
      { id: "b", name: "一貫性", score: 2 },
    ])
  })

  test("passes when the total equals the pass line", () => {
    expect(Flow.score(rubric({ pass: 3.5 }), { a: [4], b: [2] }).passed).toBe(true)
  })

  test("fails below the pass line", () => {
    expect(Flow.score(rubric({ pass: 4 }), { a: [4], b: [2] }).passed).toBe(false)
  })

  test("clamps judge scores into 1 to 5", () => {
    const result = Flow.score(rubric(), { a: [9], b: [-3] })
    expect(result.items.map((i) => i.score)).toEqual([5, 1])
  })

  test("scores an item the judge skipped as the lowest mark", () => {
    const result = Flow.score(rubric(), { a: [5] })
    expect(result.items.find((i) => i.id === "b")?.score).toBe(1)
  })

  test("never passes a rubric that has no items", () => {
    const result = Flow.score(rubric({ items: [] }), {})
    expect(result.total).toBe(0)
    expect(result.passed).toBe(false)
  })
})

describe("Flow.gate", () => {
  const cmd = { id: "c1", type: "command" as const, name: "テスト", command: "bun test", required: true }

  test("passes when every required check passes", () => {
    const result = Flow.gate([cmd], [{ id: "c1", passed: true, detail: "ok" }])
    expect(result).toEqual({ blocked: false, failures: [], advisory: [] })
  })

  test("blocks on a failing required check and keeps its output", () => {
    const result = Flow.gate([cmd], [{ id: "c1", passed: false, detail: "2 tests failed" }])
    expect(result.blocked).toBe(true)
    expect(result.failures).toEqual([{ check: "テスト", detail: "2 tests failed" }])
  })

  test("reports a failing advisory check without blocking", () => {
    const advisory = { ...cmd, id: "c2", name: "lint", required: false }
    const result = Flow.gate(
      [cmd, advisory],
      [
        { id: "c1", passed: true, detail: "" },
        { id: "c2", passed: false, detail: "3 warnings" },
      ],
    )
    expect(result.blocked).toBe(false)
    expect(result.advisory).toEqual([{ check: "lint", detail: "3 warnings" }])
  })

  test("treats a check with no result as failed", () => {
    const result = Flow.gate([cmd], [])
    expect(result.blocked).toBe(true)
    expect(result.failures[0]?.check).toBe("テスト")
  })
})

describe("Flow progression", () => {
  test("starts at the first step", () => {
    const run = Flow.start(flow)
    expect(run).toMatchObject({ status: "running", position: 0, carry: undefined })
  })

  test("moves to the next step when the current one passes", () => {
    expect(Flow.next(flow, Flow.start(flow)).position).toBe(1)
  })

  test("is done after the last step passes", () => {
    const last = { ...Flow.start(flow), position: 3 }
    expect(Flow.next(flow, last).status).toBe("done")
  })

  test("goes back to failTo with the failure as context and counts the attempt", () => {
    const at = { ...Flow.start(flow), position: 2 }
    const run = Flow.back(flow, at, "2 tests failed")
    expect(run).toMatchObject({ status: "running", position: 1, carry: "2 tests failed" })
    expect(run.attempts).toEqual({ verify: 1 })
  })

  test("clears the carried context once the flow moves forward again", () => {
    const at = { ...Flow.start(flow), position: 2 }
    const back = Flow.back(flow, at, "boom")
    expect(Flow.next(flow, back).carry).toBeUndefined()
  })

  test("fails once a check step has used all its retries", () => {
    const at = { ...Flow.start(flow), position: 2, attempts: { verify: 2 } }
    expect(Flow.back(flow, at, "still failing").status).toBe("failed")
  })

  test("lets the reviewer send the flow back without a retry limit", () => {
    const at = { ...Flow.start(flow), position: 3, attempts: { human: 9 } }
    const run = Flow.back(flow, at, "rename things")
    expect(run).toMatchObject({ status: "running", position: 1, carry: "rename things" })
  })

  test("fails when failTo points at a step that does not exist", () => {
    const broken = {
      steps: flow.steps.map((s) => (s.id === "verify" && s.kind === "check" ? { ...s, failTo: "gone" } : s)),
    }
    const at = { ...Flow.start(broken), position: 2 }
    expect(Flow.back(broken, at, "x").status).toBe("failed")
  })

  test("does not mutate the previous run", () => {
    const at = { ...Flow.start(flow), position: 2 }
    const before = JSON.stringify(at)
    Flow.back(flow, at, "x")
    expect(JSON.stringify(at)).toBe(before)
  })
})

describe("Flow.brief", () => {
  test("turns failures into text for the step that has to fix them", () => {
    const text = Flow.brief([
      { check: "テスト", detail: "2 failed" },
      { check: "型", detail: "1 error" },
    ])
    expect(text).toContain("テスト")
    expect(text).toContain("2 failed")
    expect(text).toContain("型")
    expect(text).toContain("1 error")
  })
})
