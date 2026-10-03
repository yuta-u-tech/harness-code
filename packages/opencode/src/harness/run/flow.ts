export * as Flow from "./flow"

import type { ConfigHarnessV1 } from "@opencode-ai/core/v1/config/harness"

type Info = ConfigHarnessV1.Info
type Step = ConfigHarnessV1.Step
type Check = Extract<Step, { kind: "check" }>["checks"][number]
type Rubric = Extract<Check, { type: "rubric" }>

export interface Run {
  status: "running" | "done" | "failed"
  /** Index of the step that runs next, or that just ran when the flow has ended. */
  position: number
  /** How many times each check step has sent the flow back. */
  attempts: Readonly<Record<string, number>>
  /** Failure text handed to the step the flow went back to. Cleared when the flow moves forward. */
  carry: string | undefined
  reason?: string
}

export interface CheckResult {
  id: string
  passed: boolean
  detail: string
}

export interface Failure {
  check: string
  detail: string
}

export interface GateResult {
  blocked: boolean
  failures: Failure[]
  advisory: Failure[]
}

export interface Scored {
  total: number
  passed: boolean
  items: { id: string; name: string; score: number }[]
}

export function median(list: readonly number[]): number {
  if (list.length === 0) return 0
  const sorted = [...list].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted.at(mid) ?? 0
  return ((sorted.at(mid - 1) ?? 0) + (sorted.at(mid) ?? 0)) / 2
}

const clamp = (n: number) => Math.min(5, Math.max(1, n))

/** Median of the runs per item, then a weighted average. A skipped item counts as the lowest mark. */
export function score(check: Rubric, runs: Readonly<Record<string, readonly number[]>>): Scored {
  const items = check.items.map((item) => {
    const got = runs[item.id] ?? []
    return { id: item.id, name: item.name, score: got.length === 0 ? 1 : median(got.map(clamp)) }
  })
  const weight = check.items.reduce((sum, item) => sum + item.weight, 0)
  const sum = check.items.reduce((acc, item, idx) => acc + item.weight * (items.at(idx)?.score ?? 1), 0)
  const total = weight === 0 ? 0 : sum / weight
  return { total, passed: weight > 0 && total >= check.pass, items }
}

/** A required failure blocks the step. Advisory failures are reported and passed on. */
export function gate(checks: readonly Check[], results: readonly CheckResult[]): GateResult {
  const failures: Failure[] = []
  const advisory: Failure[] = []
  for (const check of checks) {
    const result = results.find((item) => item.id === check.id)
    if (result?.passed) continue
    const entry = { check: check.name, detail: result?.detail ?? "no result" }
    if (check.required) failures.push(entry)
    if (!check.required) advisory.push(entry)
  }
  return { blocked: failures.length > 0, failures, advisory }
}

export function start(_info: Info): Run {
  return { status: "running", position: 0, attempts: {}, carry: undefined }
}

/** The current step passed. */
export function next(info: Info, run: Run): Run {
  const position = run.position + 1
  if (position >= info.steps.length) return { ...run, status: "done", carry: undefined }
  return { ...run, position, carry: undefined }
}

const fail = (run: Run, reason: string): Run => ({ ...run, status: "failed", reason })

/** The current gate (check or human step) rejected the work: return to its failTo step. */
export function back(info: Info, run: Run, failure: string): Run {
  const step = info.steps.at(run.position)
  if (!step || step.kind === "agent") return fail(run, "only a check or human step can send the flow back")
  const target = info.steps.findIndex((item) => item.id === step.failTo)
  if (target < 0) return fail(run, `failTo ${step.failTo} was not found`)
  if (target >= run.position) return fail(run, `failTo ${step.failTo} must be an earlier step`)
  // The reviewer decides when to stop, so only check steps are capped.
  if (step.kind === "human") return { ...run, status: "running", position: target, carry: failure }
  const used = run.attempts[step.id] ?? 0
  if (used >= step.retries) return fail(run, `${step.name} failed after ${used} retries`)
  return {
    ...run,
    status: "running",
    position: target,
    attempts: { ...run.attempts, [step.id]: used + 1 },
    carry: failure,
  }
}

/** Text for the step that has to fix the failures. */
export function brief(failures: readonly Failure[]): string {
  return [
    "The previous attempt failed these checks:",
    ...failures.map((item) => `- ${item.check}: ${item.detail}`),
  ].join("\n")
}
