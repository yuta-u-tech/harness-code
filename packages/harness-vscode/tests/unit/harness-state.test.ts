import { describe, expect, it } from "bun:test"

import {
  addCheck,
  addRubricItem,
  addStep,
  agentKey,
  defaultHarness,
  harnessIssues,
  moveStep,
  removeCheck,
  removeRubricItem,
  removeStep,
  summarize,
  updateCheck,
  updateRubricItem,
  updateStep,
} from "../../webview-ui/src/components/settings/harness/harness-state"

describe("defaultHarness", () => {
  it("is a runnable plan, implement, verify, review flow", () => {
    const h = defaultHarness()
    expect(h.steps.map((s) => s.id)).toEqual(["plan", "impl", "verify", "human"])
    expect(harnessIssues(h)).toEqual([])
  })

  it("returns a fresh object each call", () => {
    const a = defaultHarness()
    const b = defaultHarness()
    expect(a).not.toBe(b)
    expect(a.steps).not.toBe(b.steps)
  })
})

describe("agentKey", () => {
  it("prefixes the step id so harness agents never collide with user agents", () => {
    expect(agentKey("impl")).toBe("harness-impl")
  })
})

describe("addStep", () => {
  it("appends an agent step bound to its own agent key", () => {
    const next = addStep(defaultHarness(), "agent")
    const added = next.steps.at(-1)
    expect(added?.kind).toBe("agent")
    expect(added?.kind === "agent" && added.agent).toBe(agentKey(added!.id))
  })

  it("generates unique ids", () => {
    const once = addStep(defaultHarness(), "agent")
    const twice = addStep(once, "agent")
    expect(new Set(twice.steps.map((s) => s.id)).size).toBe(twice.steps.length)
  })

  it("points a new check step back at the last agent step", () => {
    const next = addStep(defaultHarness(), "check")
    const added = next.steps.at(-1)
    expect(added?.kind === "check" && added.failTo).toBe("impl")
  })

  it("does not mutate the input", () => {
    const h = defaultHarness()
    const before = JSON.stringify(h)
    addStep(h, "human")
    expect(JSON.stringify(h)).toBe(before)
  })
})

describe("removeStep", () => {
  it("repoints failTo to the nearest earlier step when its target is removed", () => {
    const next = removeStep(defaultHarness(), "impl")
    const verify = next.steps.find((s) => s.id === "verify")
    expect(verify?.kind === "check" && verify.failTo).toBe("plan")
    expect(harnessIssues(next)).toEqual([])
  })

  it("ignores an unknown id", () => {
    const h = defaultHarness()
    expect(removeStep(h, "nope").steps).toHaveLength(h.steps.length)
  })
})

describe("moveStep", () => {
  it("swaps a step with its neighbour", () => {
    const next = moveStep(defaultHarness(), "impl", -1)
    expect(next.steps.map((s) => s.id).slice(0, 2)).toEqual(["impl", "plan"])
  })

  it("stays put at the edges", () => {
    const h = defaultHarness()
    expect(moveStep(h, "plan", -1).steps.map((s) => s.id)).toEqual(h.steps.map((s) => s.id))
    expect(moveStep(h, "human", 1).steps.map((s) => s.id)).toEqual(h.steps.map((s) => s.id))
  })
})

describe("updateStep", () => {
  it("patches only the matching step", () => {
    const next = updateStep(defaultHarness(), "plan", { name: "設計" })
    expect(next.steps[0]?.name).toBe("設計")
    expect(next.steps[1]?.name).toBe(defaultHarness().steps[1]?.name)
  })
})

describe("checks", () => {
  const verifyChecks = (h: ReturnType<typeof defaultHarness>) => {
    const step = h.steps.find((s) => s.id === "verify")
    return step?.kind === "check" ? step.checks : []
  }

  it("adds a command check that blocks by default", () => {
    const next = addCheck(defaultHarness(), "verify", "command")
    const added = verifyChecks(next).at(-1)
    expect(added).toMatchObject({ type: "command", required: true })
  })

  it("adds a rubric check that is advisory by default, with the given judge model", () => {
    const next = addCheck(defaultHarness(), "verify", "rubric", "ollama/gpt-oss-64k:20b")
    const added = verifyChecks(next).at(-1)
    expect(added).toMatchObject({ type: "rubric", required: false, model: "ollama/gpt-oss-64k:20b", runs: 3 })
    expect(added?.type === "rubric" && added.items.length).toBeGreaterThan(0)
  })

  it("updates and removes a check", () => {
    const h = addCheck(defaultHarness(), "verify", "command")
    const id = verifyChecks(h).at(-1)!.id
    const renamed = updateCheck(h, "verify", id, { name: "lint" })
    expect(verifyChecks(renamed).find((c) => c.id === id)?.name).toBe("lint")
    expect(verifyChecks(removeCheck(renamed, "verify", id)).some((c) => c.id === id)).toBe(false)
  })

  it("edits rubric items", () => {
    const base = defaultHarness()
    const rubric = verifyChecks(base).find((c) => c.type === "rubric")!
    const added = addRubricItem(base, "verify", rubric.id)
    const items = (h: typeof base) => {
      const c = verifyChecks(h).find((x) => x.id === rubric.id)
      return c?.type === "rubric" ? c.items : []
    }
    expect(items(added).length).toBe(items(base).length + 1)

    const itemId = items(added).at(-1)!.id
    const edited = updateRubricItem(added, "verify", rubric.id, itemId, { weight: 3 })
    expect(items(edited).find((i) => i.id === itemId)?.weight).toBe(3)
    expect(items(removeRubricItem(edited, "verify", rubric.id, itemId)).some((i) => i.id === itemId)).toBe(false)
  })
})

describe("runners", () => {
  it("puts an agent step on a CLI and takes it off again", () => {
    const on = updateStep(defaultHarness(), "plan", { runner: { kind: "codex", model: "gpt-5", effort: "high" } })
    expect(on.steps[0]).toMatchObject({ runner: { kind: "codex", model: "gpt-5", effort: "high" } })
    const off = updateStep(on, "plan", { runner: undefined })
    expect(off.steps[0]?.kind === "agent" && off.steps[0].runner).toBeUndefined()
  })

  it("puts a rubric check on a CLI", () => {
    const next = updateCheck(defaultHarness(), "verify", "c3", { runner: { kind: "claude", effort: "low" } })
    const verify = next.steps.find((s) => s.id === "verify")
    const rubric = verify?.kind === "check" ? verify.checks.find((c) => c.id === "c3") : undefined
    expect(rubric).toMatchObject({ runner: { kind: "claude", effort: "low" } })
  })

  it("does not count a CLI step as a model call in the summary", () => {
    const next = updateStep(defaultHarness(), "plan", { runner: { kind: "claude" } })
    expect(summarize(next).agents).toBe(summarize(defaultHarness()).agents)
  })
})

describe("summarize", () => {
  it("counts agent calls, judge runs, commands and human gates", () => {
    expect(summarize(defaultHarness())).toEqual({ agents: 2, commands: 2, judgeRuns: 3, humans: 1 })
  })
})

describe("harnessIssues", () => {
  it("flags duplicate ids, forward failTo and empty check steps", () => {
    const h = defaultHarness()
    const dup = { steps: [h.steps[0], h.steps[0]] }
    expect(harnessIssues(dup)).toContain("duplicate step id: plan")

    const forward = updateStep(h, "verify", { failTo: "human" })
    expect(harnessIssues(forward)).toContain("step verify: failTo human must be an earlier step")

    const verify = h.steps.find((s) => s.id === "verify")
    const empty = updateStep(h, "verify", { checks: [] })
    expect(verify?.kind).toBe("check")
    expect(harnessIssues(empty)).toContain("step verify: needs at least one check")
  })
})
