export * as Judge from "./judge"

import type { ConfigHarnessV1 } from "@opencode-ai/core/v1/config/harness"

type Check = Extract<ConfigHarnessV1.Step, { kind: "check" }>["checks"][number]
type Rubric = Extract<Check, { type: "rubric" }>

export interface Context {
  /** The change being judged. */
  diff: string
  /** What the change was supposed to do. */
  task?: string
}

/** One judge reply, reduced to the items it scored. */
export interface Parsed {
  scores: Record<string, number>
  reasons: Record<string, string>
}

export interface Collected {
  /** Scores per item id, one entry per run, in the shape Flow.score takes. */
  runs: Record<string, number[]>
  reasons: Record<string, string[]>
}

export function prompt(check: Rubric, ctx: Context): string {
  const items = check.items.map(
    (item) => `- id "${item.id}", ${item.name}: ${item.criterion || "(no criterion given)"}`,
  )
  return [
    "You are reviewing a code change. Score each item from 1 (poor) to 5 (excellent).",
    "A 5 means the criterion is fully met. Judge only what the change shows. Do not reward effort or length.",
    ctx.task ? `\nWhat the change should do:\n${ctx.task}` : "",
    "\nItems:",
    ...items,
    `\nChange:\n${ctx.diff}`,
    '\nReply with JSON only, in this shape: {"scores":[{"id":"<item id>","score":<1-5>,"reason":"<one sentence>"}]}',
  ]
    .filter((line) => line !== "")
    .join("\n")
}

const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

// JSON.parse is the only way to test a candidate; a failure just means "try the next candidate".
function json(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** Local models often wrap JSON in prose or a code fence, so try the likely spans in turn. */
function candidates(reply: string): string[] {
  const fenced = [...reply.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((match) => match[1] ?? "")
  const first = reply.indexOf("{")
  const last = reply.lastIndexOf("}")
  const span = first >= 0 && last > first ? [reply.slice(first, last + 1)] : []
  return [reply.trim(), ...fenced, ...span]
}

const number = (value: unknown): number | undefined => {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value
  return typeof n === "number" && Number.isFinite(n) ? n : undefined
}

export function parse(reply: string, check: Rubric): Parsed {
  const known = new Set(check.items.map((item) => item.id))
  const list = candidates(reply)
    .map(json)
    .map((value) => (object(value) && Array.isArray(value.scores) ? value.scores : undefined))
    .find((value) => value !== undefined)
  const out: Parsed = { scores: {}, reasons: {} }
  for (const entry of list ?? []) {
    if (!object(entry) || typeof entry.id !== "string" || !known.has(entry.id)) continue
    const score = number(entry.score)
    if (score === undefined || entry.id in out.scores) continue
    out.scores[entry.id] = score
    if (typeof entry.reason === "string" && entry.reason !== "") out.reasons[entry.id] = entry.reason
  }
  return out
}

/** Regroups several runs by item so they can go to Flow.score. */
export function collect(runs: readonly Parsed[]): Collected {
  const out: Collected = { runs: {}, reasons: {} }
  for (const run of runs) {
    for (const [id, score] of Object.entries(run.scores)) out.runs[id] = [...(out.runs[id] ?? []), score]
    for (const [id, reason] of Object.entries(run.reasons)) out.reasons[id] = [...(out.reasons[id] ?? []), reason]
  }
  return out
}
