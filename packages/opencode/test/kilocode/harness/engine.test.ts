import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { ConfigHarnessV1 } from "@opencode-ai/core/v1/config/harness"
import { Engine } from "../../../src/kilocode/harness/engine"

const dir = () => fs.mkdtemp(path.join(os.tmpdir(), "harness-engine-"))

const base = (verify: ConfigHarnessV1.Step): ConfigHarnessV1.Info => ({
  steps: [
    { id: "plan", kind: "agent", name: "計画", agent: "harness-plan" },
    { id: "impl", kind: "agent", name: "実装", agent: "harness-impl" },
    verify,
    { id: "human", kind: "human", name: "確認", failTo: "impl", show: ["diff"], checklist: ["読みやすいか"] },
  ],
})

const verifying = (checks: Extract<ConfigHarnessV1.Step, { kind: "check" }>["checks"], retries = 2) =>
  base({ id: "verify", kind: "check", name: "検証", failTo: "impl", retries, checks })

const command = (cmd: string, required = true, id = "c1") => ({
  id,
  type: "command" as const,
  name: id,
  command: cmd,
  required,
})

const rubric = (over: Partial<{ runs: number; pass: number; required: boolean }> = {}) => ({
  id: "r1",
  type: "rubric" as const,
  name: "品質",
  model: "ollama/gpt-oss:20b",
  runs: 3,
  pass: 3.5,
  required: false,
  items: [{ id: "a", name: "可読性", weight: 1, criterion: "" }],
  ...over,
})

interface Calls {
  agent: { step: string; carry?: string }[]
  judge: number
  review: { notes: string[] }[]
}

/** Only the model-backed pieces are replaced; the loop, command runner, scoring and gating are real. */
const setup = async (opts: {
  judge?: number[]
  decisions?: { approve: boolean; comment?: string }[]
  failAgent?: string
}) => {
  const cwd = await dir()
  const calls: Calls = { agent: [], judge: 0, review: [] }
  const decisions = [...(opts.decisions ?? [{ approve: true }])]
  const deps: Engine.Deps = {
    cwd,
    task: "add a feature",
    agent: async (input) => {
      calls.agent.push({ step: input.step.id, carry: input.carry })
      if (input.step.id === opts.failAgent) throw new Error("model unavailable")
      return `${input.step.id} done`
    },
    judge: async (check) => {
      const score = opts.judge?.at(calls.judge) ?? 5
      calls.judge += 1
      return { scores: Object.fromEntries(check.items.map((item) => [item.id, score])), reasons: {} }
    },
    diff: async () => "+const x = 1",
    review: async (input) => {
      calls.review.push({ notes: input.notes })
      return decisions.shift() ?? { approve: true }
    },
    emit: () => {},
  }
  return { cwd, calls, deps }
}

describe("Engine.run", () => {
  test("runs every step in order and finishes when the reviewer approves", async () => {
    const { deps, calls } = await setup({})
    const report = await Engine.run(verifying([command("true")]), deps)
    expect(report.status).toBe("done")
    expect(calls.agent.map((a) => a.step)).toEqual(["plan", "impl"])
    expect(report.log.map((l) => l.step)).toEqual(["plan", "impl", "verify", "human"])
  })

  test("sends a failing required check back with its output, then passes on the retry", async () => {
    const { deps, calls, cwd } = await setup({})
    const flag = path.join(cwd, "flag")
    const flaky = command(`test -f ${flag} || { touch ${flag}; echo broken-build; exit 1; }`)
    const report = await Engine.run(verifying([flaky]), deps)
    expect(report.status).toBe("done")
    expect(calls.agent.map((a) => a.step)).toEqual(["plan", "impl", "impl"])
    expect(calls.agent.at(0)?.carry).toBeUndefined()
    expect(calls.agent.at(2)?.carry).toContain("broken-build")
  })

  test("fails once the retries are used up", async () => {
    const { deps, calls } = await setup({})
    const report = await Engine.run(verifying([command("exit 1")], 1), deps)
    expect(report.status).toBe("failed")
    expect(report.reason).toContain("retries")
    expect(calls.agent.filter((a) => a.step === "impl")).toHaveLength(2)
    expect(calls.review).toHaveLength(0)
  })

  test("scores a rubric from several judge runs and keeps going when advisory", async () => {
    const { deps, calls } = await setup({ judge: [1, 1, 1] })
    const report = await Engine.run(verifying([rubric({ runs: 3, pass: 4 })]), deps)
    expect(calls.judge).toBe(3)
    expect(report.status).toBe("done")
    expect(calls.review.at(0)?.notes.join("\n")).toContain("品質")
  })

  test("blocks on a required rubric below the pass line", async () => {
    const { deps } = await setup({ judge: [2, 2, 2, 2, 2, 2] })
    const report = await Engine.run(verifying([rubric({ required: true, pass: 4 })], 1), deps)
    expect(report.status).toBe("failed")
  })

  test("passes a required rubric at or above the pass line", async () => {
    const { deps } = await setup({ judge: [4, 4, 4] })
    const report = await Engine.run(verifying([rubric({ required: true, pass: 4 })]), deps)
    expect(report.status).toBe("done")
  })

  test("sends the flow back with the reviewer's comment when rejected, then finishes on approval", async () => {
    const { deps, calls } = await setup({ decisions: [{ approve: false, comment: "rename x" }, { approve: true }] })
    const report = await Engine.run(verifying([command("true")]), deps)
    expect(report.status).toBe("done")
    expect(calls.agent.map((a) => a.step)).toEqual(["plan", "impl", "impl"])
    expect(calls.agent.at(2)?.carry).toContain("rename x")
    expect(calls.review).toHaveLength(2)
  })

  test("fails with the error when a step throws instead of crashing", async () => {
    const { deps } = await setup({ failAgent: "impl" })
    const report = await Engine.run(verifying([command("true")]), deps)
    expect(report.status).toBe("failed")
    expect(report.reason).toContain("model unavailable")
  })

  test("stops between steps when aborted", async () => {
    const { deps } = await setup({})
    const ctl = new AbortController()
    const seen: string[] = []
    const report = await Engine.run(verifying([command("true")]), {
      ...deps,
      agent: async (input) => {
        seen.push(input.step.id)
        ctl.abort()
        return "ok"
      },
      abort: ctl.signal,
    })
    expect(report.status).toBe("stopped")
    expect(seen).toEqual(["plan"])
  })

  test("emits a start and a finish for each step", async () => {
    const { deps } = await setup({})
    const events: string[] = []
    await Engine.run(verifying([command("true")]), { ...deps, emit: (e) => events.push(`${e.type}:${e.step}`) })
    expect(events).toEqual([
      "started:plan",
      "finished:plan",
      "started:impl",
      "finished:impl",
      "started:verify",
      "finished:verify",
      "started:human",
      "finished:human",
    ])
  })

  test("refuses a flow that has validation problems", async () => {
    const { deps } = await setup({})
    const report = await Engine.run({ steps: [] }, deps)
    expect(report.status).toBe("failed")
    expect(report.reason).toContain("no steps")
  })
})
