export * as Engine from "./engine"

import { ConfigHarnessV1 } from "@opencode-ai/core/v1/config/harness"
import { errorMessage } from "@/util/error"
import { HarnessCommand } from "./command"
import { Flow } from "./flow"
import { Judge } from "./judge"

type Info = ConfigHarnessV1.Info
type Step = ConfigHarnessV1.Step
type AgentStep = Extract<Step, { kind: "agent" }>
type CheckStep = Extract<Step, { kind: "check" }>
type HumanStep = Extract<Step, { kind: "human" }>
type Rubric = Extract<CheckStep["checks"][number], { type: "rubric" }>

export interface Decision {
  approve: boolean
  comment?: string
}

/**
 * The pieces that need a model, a session or a person. Everything else
 * (stepping, retries, command checks, scoring, gating) lives in the engine.
 */
export interface Deps {
  cwd: string
  task: string
  abort?: AbortSignal
  /** Runs an agent step and returns what it said. `carry` is the failure the flow went back with. */
  agent: (input: { step: AgentStep; carry?: string; task: string }) => Promise<string>
  /** One judge run over the change. */
  judge: (check: Rubric, ctx: Judge.Context) => Promise<Judge.Parsed>
  /** The change made so far, as text. */
  diff: () => Promise<string>
  /** Waits for the person to approve or reject. */
  review: (input: { step: HumanStep; notes: string[]; diff: string }) => Promise<Decision>
  emit: (event: Event) => void
}

export type Outcome = "ok" | "failed" | "approved" | "rejected" | "error"

export interface Event {
  type: "started" | "finished"
  step: string
  attempt: number
  outcome?: Outcome
  detail?: string
}

export interface Entry {
  step: string
  attempt: number
  outcome: Outcome
  detail: string
}

export interface Report {
  status: "done" | "failed" | "stopped"
  reason?: string
  log: Entry[]
  /** Scores and advisory findings gathered along the way, for the reviewer. */
  notes: string[]
}

interface Result {
  outcome: Outcome
  detail: string
  notes: string[]
  /** What the step the flow returns to should hear about. */
  failure?: string
}

/** Longest detail kept in the log; the full text still goes to events. */
const DETAIL = 8_000

function summary(check: Rubric, scored: Flow.Scored, reasons: Judge.Collected["reasons"]): string {
  const lines = scored.items.map((item) => {
    const why = reasons[item.id]?.at(0)
    return `  - ${item.name}: ${item.score}${why ? ` (${why})` : ""}`
  })
  const verdict = scored.passed ? "pass" : "below the pass line"
  return [`${check.name}: ${scored.total.toFixed(1)} of 5 (${verdict}, line ${check.pass})`, ...lines].join("\n")
}

async function rubric(deps: Deps, check: Rubric, diff: string) {
  const ctx = { diff, task: deps.task }
  const runs: Judge.Parsed[] = []
  for (const _ of Array.from({ length: check.runs })) {
    if (deps.abort?.aborted) break
    runs.push(await deps.judge(check, ctx).catch(() => ({ scores: {}, reasons: {} })))
  }
  const got = Judge.collect(runs)
  if (Object.keys(got.runs).length === 0) {
    return { passed: false, detail: `${check.name}: the judge returned no scores`, note: `${check.name}: no scores` }
  }
  const scored = Flow.score(check, got.runs)
  const text = summary(check, scored, got.reasons)
  return { passed: scored.passed, detail: text, note: text }
}

async function verify(deps: Deps, step: CheckStep): Promise<Result> {
  const diff = step.checks.some((check) => check.type === "rubric") ? await deps.diff() : ""
  const results: Flow.CheckResult[] = []
  const notes: string[] = []
  for (const check of step.checks) {
    if (check.type === "command") {
      const out = await HarnessCommand.run({ command: check.command, cwd: deps.cwd, abort: deps.abort })
      results.push({ id: check.id, passed: out.passed, detail: out.detail })
      if (!out.passed && !check.required) notes.push(`${check.name}: ${out.detail}`)
      continue
    }
    const out = await rubric(deps, check, diff)
    results.push({ id: check.id, passed: out.passed, detail: out.detail })
    notes.push(out.note)
  }
  const gated = Flow.gate(step.checks, results)
  if (!gated.blocked) return { outcome: "ok", detail: notes.join("\n") || "all checks passed", notes }
  const failure = Flow.brief(gated.failures)
  return { outcome: "failed", detail: failure, notes, failure }
}

async function exec(deps: Deps, step: Step, carry: string | undefined, notes: string[]): Promise<Result> {
  if (step.kind === "agent") {
    const text = await deps.agent({ step, carry, task: deps.task })
    return { outcome: "ok", detail: text, notes: [] }
  }
  if (step.kind === "check") return verify(deps, step)
  const decision = await deps.review({ step, notes, diff: await deps.diff() })
  if (decision.approve) return { outcome: "approved", detail: decision.comment ?? "", notes: [] }
  const comment = decision.comment?.trim() || "(no comment)"
  return { outcome: "rejected", detail: comment, notes: [], failure: `The reviewer rejected the change: ${comment}` }
}

interface Ctx {
  info: Info
  deps: Deps
}

async function loop(ctx: Ctx, run: Flow.Run, log: Entry[], notes: string[]): Promise<Report> {
  if (run.status === "done") return { status: "done", log, notes }
  if (run.status === "failed") return { status: "failed", reason: run.reason, log, notes }
  if (ctx.deps.abort?.aborted) return { status: "stopped", log, notes }

  const step = ctx.info.steps.at(run.position)
  if (!step) return { status: "failed", reason: "the flow ran past its last step", log, notes }

  const attempt = log.filter((entry) => entry.step === step.id).length + 1
  ctx.deps.emit({ type: "started", step: step.id, attempt })
  const result = await exec(ctx.deps, step, run.carry, notes).catch(
    (err: unknown): Result => ({ outcome: "error", detail: errorMessage(err), notes: [] }),
  )
  const entry: Entry = { step: step.id, attempt, outcome: result.outcome, detail: result.detail.slice(0, DETAIL) }
  ctx.deps.emit({ type: "finished", step: step.id, attempt, outcome: result.outcome, detail: result.detail })

  const all = [...log, entry]
  const seen = [...notes, ...result.notes]
  if (result.outcome === "error") {
    return loop(ctx, { ...run, status: "failed", reason: `${step.name}: ${result.detail}` }, all, seen)
  }
  if (result.failure === undefined) return loop(ctx, Flow.next(ctx.info, run), all, seen)
  return loop(ctx, Flow.back(ctx.info, run, result.failure), all, seen)
}

export async function run(info: Info, deps: Deps): Promise<Report> {
  const problems = info.steps.length === 0 ? ["the flow has no steps"] : ConfigHarnessV1.issues(info)
  if (problems.length > 0) return { status: "failed", reason: problems.join("; "), log: [], notes: [] }
  return loop({ info, deps }, Flow.start(info), [], [])
}
