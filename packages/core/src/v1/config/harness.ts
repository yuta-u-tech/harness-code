// kilocode_change - new file
export * as ConfigHarnessV1 from "./harness"

import { Schema } from "effect"
import { PositiveInt } from "../../schema"

const Id = Schema.String.check(Schema.isMinLength(1))
const Name = Schema.String.check(Schema.isMinLength(1))

/** Runs a step through an official CLI that is already signed in, instead of through the model catalog. */
export const Runner = Schema.Struct({
  kind: Schema.Literals(["codex", "claude"]),
  model: Schema.optional(Schema.String).annotate({
    description: "Model name passed to the CLI. Empty uses its default.",
  }),
  effort: Schema.optional(Schema.String).annotate({ description: "Reasoning effort passed to the CLI." }),
}).annotate({ identifier: "HarnessRunner" })
export type Runner = Schema.Schema.Type<typeof Runner>

export const CommandCheck = Schema.Struct({
  id: Id,
  type: Schema.Literal("command"),
  name: Name,
  command: Schema.String.check(Schema.isMinLength(1)).annotate({ description: "Shell command. Exit code 0 passes." }),
  required: Schema.Boolean.annotate({ description: "A failing required check sends the flow back to failTo." }),
})

export const RubricItem = Schema.Struct({
  id: Id,
  name: Name,
  weight: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 3 })),
  criterion: Schema.String.annotate({ description: "What earns the top score for this item." }),
})

export const RubricCheck = Schema.Struct({
  id: Id,
  type: Schema.Literal("rubric"),
  name: Name,
  model: Schema.String.annotate({ description: "Judge model as provider/model." }),
  variant: Schema.optional(Schema.NullOr(Schema.String)).annotate({ description: "Judge reasoning variant." }),
  runner: Schema.optional(Runner).annotate({ description: "Judge through a CLI instead of the model above." }),
  runs: PositiveInt.annotate({ description: "How many times to score. The median is used." }),
  pass: Schema.Finite.check(Schema.isBetween({ minimum: 1, maximum: 5 })),
  required: Schema.Boolean,
  items: Schema.mutable(Schema.Array(RubricItem)),
})

export const Check = Schema.Union([CommandCheck, RubricCheck])

export const AgentStep = Schema.Struct({
  id: Id,
  kind: Schema.Literal("agent"),
  name: Name,
  agent: Schema.String.annotate({ description: "Key of an entry in the top-level agent config." }),
  subagents: Schema.optional(Schema.mutable(Schema.Array(Schema.String))).annotate({
    description: "Subagent keys this step may call.",
  }),
  runner: Schema.optional(Runner).annotate({
    description: "Run this step through a CLI instead of the model catalog.",
  }),
})

export const CheckStep = Schema.Struct({
  id: Id,
  kind: Schema.Literal("check"),
  name: Name,
  failTo: Id.annotate({ description: "Earlier step id to return to when a required check fails." }),
  retries: PositiveInt,
  checks: Schema.mutable(Schema.Array(Check)),
})

export const HumanStep = Schema.Struct({
  id: Id,
  kind: Schema.Literal("human"),
  name: Name,
  failTo: Id.annotate({ description: "Earlier step id to return to when the reviewer rejects." }),
  show: Schema.mutable(Schema.Array(Schema.String)),
  checklist: Schema.mutable(Schema.Array(Schema.String)),
})

export const Step = Schema.Union([AgentStep, CheckStep, HumanStep])

export const Info = Schema.Struct({
  steps: Schema.mutable(Schema.Array(Step)),
}).annotate({ description: "Ordered flow of agent, check and human steps" })
export type Info = Schema.Schema.Type<typeof Info>
export type Step = Schema.Schema.Type<typeof Step>

/** Cross-field problems the schema cannot express. Empty means the flow is runnable. */
export function issues(info: Info): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const step of info.steps) {
    if (seen.has(step.id)) {
      out.push(`duplicate step id: ${step.id}`)
      continue
    }
    if (step.kind !== "agent" && !seen.has(step.failTo)) {
      out.push(`step ${step.id}: failTo ${step.failTo} must be an earlier step`)
    }
    if (step.kind === "check" && step.checks.length === 0) {
      out.push(`step ${step.id}: needs at least one check`)
    }
    seen.add(step.id)
  }
  return out
}
