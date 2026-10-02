import type {
  HarnessCheck,
  HarnessCommandCheck,
  HarnessConfig,
  HarnessRubricCheck,
  HarnessRubricItem,
  HarnessStep,
} from "../../../types/messages"

/** Every edit returns a new HarnessConfig; inputs are never mutated. */

type StepPatch = Partial<
  Omit<Extract<HarnessStep, { kind: "agent" }>, "id" | "kind"> &
    Omit<Extract<HarnessStep, { kind: "check" }>, "id" | "kind"> &
    Omit<Extract<HarnessStep, { kind: "human" }>, "id" | "kind">
>
type CheckPatch = Partial<Omit<HarnessCommandCheck, "id" | "type"> & Omit<HarnessRubricCheck, "id" | "type">>
type ItemPatch = Partial<Omit<HarnessRubricItem, "id">>

export interface HarnessSummary {
  agents: number
  commands: number
  judgeRuns: number
  humans: number
}

/** Values stored in HumanStep.show. Labels come from i18n so the saved config stays language-neutral. */
export const REVIEW_PANELS = ["diff", "scores", "tests", "plan", "subagents"] as const

export const agentKey = (stepId: string) => `harness-${stepId}`

const uniqueId = (prefix: string, taken: readonly string[]) => {
  for (let n = taken.length + 1; ; n++) {
    const id = `${prefix}${n}`
    if (!taken.includes(id)) return id
  }
}

const stepIds = (h: HarnessConfig) => h.steps.map((s) => s.id)

const rubricItems = (): HarnessRubricItem[] => [
  {
    id: "i1",
    name: "可読性",
    weight: 3,
    criterion: "名前から役割が読み取れる。関数が1画面に収まる。ネストが3段以内。",
  },
  {
    id: "i2",
    name: "既存コードとの一貫性",
    weight: 2,
    criterion: "周辺のファイルと同じ命名・エラー処理になっている。",
  },
  { id: "i3", name: "変更範囲", weight: 2, criterion: "計画にない変更が混ざっていない。" },
]

export function defaultHarness(): HarnessConfig {
  return {
    steps: [
      { id: "plan", kind: "agent", name: "計画", agent: agentKey("plan") },
      { id: "impl", kind: "agent", name: "実装", agent: agentKey("impl") },
      {
        id: "verify",
        kind: "check",
        name: "検証",
        failTo: "impl",
        retries: 3,
        checks: [
          { id: "c1", type: "command", name: "型チェック", command: "bun run typecheck", required: true },
          { id: "c2", type: "command", name: "テスト", command: "bun test", required: true },
          {
            id: "c3",
            type: "rubric",
            name: "コード品質の採点",
            model: "",
            runs: 3,
            pass: 3.5,
            required: false,
            items: rubricItems(),
          },
        ],
      },
      {
        id: "human",
        kind: "human",
        name: "あなたの確認",
        failTo: "impl",
        show: ["diff", "scores", "tests"],
        checklist: ["読んで意図が分かるか", "名前の付け方が好みに合うか"],
      },
    ],
  }
}

const lastAgentId = (h: HarnessConfig) => h.steps.findLast((s) => s.kind === "agent")?.id ?? h.steps.at(0)?.id ?? ""

export function addStep(h: HarnessConfig, kind: HarnessStep["kind"]): HarnessConfig {
  const id = uniqueId(kind === "agent" ? "step" : kind, stepIds(h))
  const step: HarnessStep =
    kind === "agent"
      ? { id, kind, name: "新しい工程", agent: agentKey(id) }
      : kind === "check"
        ? {
            id,
            kind,
            name: "検証",
            failTo: lastAgentId(h),
            retries: 3,
            checks: [{ id: "c1", type: "command", name: "テスト", command: "bun test", required: true }],
          }
        : { id, kind, name: "あなたの確認", failTo: lastAgentId(h), show: ["diff"], checklist: [] }
  return { steps: [...h.steps, step] }
}

export function removeStep(h: HarnessConfig, id: string): HarnessConfig {
  const index = h.steps.findIndex((s) => s.id === id)
  if (index < 0) return h
  const fallback = index > 0 ? h.steps.at(index - 1)?.id : undefined
  const steps = h.steps
    .filter((s) => s.id !== id)
    .map((s) => (s.kind !== "agent" && s.failTo === id && fallback ? { ...s, failTo: fallback } : s))
  return { steps }
}

export function moveStep(h: HarnessConfig, id: string, delta: -1 | 1): HarnessConfig {
  const from = h.steps.findIndex((s) => s.id === id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= h.steps.length) return h
  const steps = [...h.steps]
  const moved = steps.at(from)
  const other = steps.at(to)
  if (!moved || !other) return h
  steps[from] = other
  steps[to] = moved
  return { steps }
}

export function updateStep(h: HarnessConfig, id: string, patch: StepPatch): HarnessConfig {
  return { steps: h.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) }
}

const mapChecks = (
  h: HarnessConfig,
  stepId: string,
  fn: (checks: HarnessCheck[]) => HarnessCheck[],
): HarnessConfig => ({
  steps: h.steps.map((s) => (s.id === stepId && s.kind === "check" ? { ...s, checks: fn(s.checks) } : s)),
})

export function addCheck(h: HarnessConfig, stepId: string, type: HarnessCheck["type"], judgeModel = ""): HarnessConfig {
  return mapChecks(h, stepId, (checks) => {
    const id = uniqueId(
      "c",
      checks.map((c) => c.id),
    )
    const added: HarnessCheck =
      type === "command"
        ? { id, type, name: "新しいチェック", command: "bun run lint", required: true }
        : { id, type, name: "新しい採点", model: judgeModel, runs: 3, pass: 3.5, required: false, items: rubricItems() }
    return [...checks, added]
  })
}

export function removeCheck(h: HarnessConfig, stepId: string, checkId: string): HarnessConfig {
  return mapChecks(h, stepId, (checks) => checks.filter((c) => c.id !== checkId))
}

export function updateCheck(h: HarnessConfig, stepId: string, checkId: string, patch: CheckPatch): HarnessConfig {
  return mapChecks(h, stepId, (checks) => checks.map((c) => (c.id === checkId ? { ...c, ...patch } : c)))
}

const mapItems = (
  h: HarnessConfig,
  stepId: string,
  checkId: string,
  fn: (items: HarnessRubricItem[]) => HarnessRubricItem[],
): HarnessConfig =>
  mapChecks(h, stepId, (checks) =>
    checks.map((c) => (c.id === checkId && c.type === "rubric" ? { ...c, items: fn(c.items) } : c)),
  )

export function addRubricItem(h: HarnessConfig, stepId: string, checkId: string): HarnessConfig {
  return mapItems(h, stepId, checkId, (items) => [
    ...items,
    {
      id: uniqueId(
        "i",
        items.map((i) => i.id),
      ),
      name: "新しい観点",
      weight: 2,
      criterion: "",
    },
  ])
}

export function removeRubricItem(h: HarnessConfig, stepId: string, checkId: string, itemId: string): HarnessConfig {
  return mapItems(h, stepId, checkId, (items) => items.filter((i) => i.id !== itemId))
}

export function updateRubricItem(
  h: HarnessConfig,
  stepId: string,
  checkId: string,
  itemId: string,
  patch: ItemPatch,
): HarnessConfig {
  return mapItems(h, stepId, checkId, (items) => items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)))
}

export function summarize(h: HarnessConfig): HarnessSummary {
  const checks = h.steps.flatMap((s) => (s.kind === "check" ? s.checks : []))
  return {
    agents: h.steps.filter((s) => s.kind === "agent").length,
    commands: checks.filter((c) => c.type === "command").length,
    judgeRuns: checks.reduce((n, c) => n + (c.type === "rubric" ? c.runs : 0), 0),
    humans: h.steps.filter((s) => s.kind === "human").length,
  }
}

/** Same rules as ConfigHarnessV1.issues in packages/core. */
export function harnessIssues(h: HarnessConfig): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const step of h.steps) {
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
