import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { ConfigV1 } from "@opencode-ai/core/v1/config/config"
import { ConfigHarnessV1 } from "@opencode-ai/core/v1/config/harness"

const decode = Schema.decodeUnknownSync(ConfigV1.Info)

const harness: ConfigHarnessV1.Info = {
  steps: [
    { id: "plan", kind: "agent", name: "計画", agent: "harness-plan", subagents: ["explorer"] },
    { id: "impl", kind: "agent", name: "実装", agent: "harness-impl" },
    {
      id: "verify",
      kind: "check",
      name: "検証",
      failTo: "impl",
      retries: 3,
      checks: [
        { id: "c1", type: "command", name: "型チェック", command: "bun run typecheck", required: true },
        {
          id: "c2",
          type: "rubric",
          name: "コード品質",
          model: "ollama/gpt-oss-64k:20b",
          variant: "medium",
          runs: 3,
          pass: 3.5,
          required: false,
          items: [{ id: "i1", name: "可読性", weight: 3, criterion: "名前から役割が読み取れる" }],
        },
      ],
    },
    { id: "human", kind: "human", name: "あなたの確認", failTo: "impl", show: ["差分"], checklist: ["意図が分かるか"] },
  ],
}

describe("config harness", () => {
  test("keeps a valid harness through the config schema", () => {
    const cfg = decode({ harness })
    expect(cfg.harness?.steps.map((s) => s.kind)).toEqual(["agent", "agent", "check", "human"])
  })

  test("accepts a config without harness", () => {
    expect(decode({}).harness).toBeUndefined()
  })

  test("rejects an unknown step kind", () => {
    expect(() => decode({ harness: { steps: [{ id: "x", kind: "teleport", name: "x" }] } })).toThrow()
  })

  const withRubric = (patch: { weight?: number; pass?: number }) => ({
    steps: harness.steps.map((step) =>
      step.kind !== "check"
        ? step
        : {
            ...step,
            checks: step.checks.map((check) =>
              check.type !== "rubric"
                ? check
                : {
                    ...check,
                    ...(patch.pass === undefined ? {} : { pass: patch.pass }),
                    items: check.items.map((item) => ({ ...item, ...(patch.weight === undefined ? {} : { weight: patch.weight }) })),
                  },
            ),
          },
    ),
  })

  test("rejects a rubric weight outside 1 to 3", () => {
    expect(() => decode({ harness: withRubric({ weight: 9 }) })).toThrow()
  })

  test("rejects a pass line outside 1 to 5", () => {
    expect(() => decode({ harness: withRubric({ pass: 6 }) })).toThrow()
  })
})

describe("ConfigHarnessV1.issues", () => {
  const info = Schema.decodeUnknownSync(ConfigHarnessV1.Info)

  test("returns no issues for a valid harness", () => {
    expect(ConfigHarnessV1.issues(info(harness))).toEqual([])
  })

  test("flags duplicate step ids", () => {
    const dup = info({ steps: [harness.steps[0], harness.steps[0]] })
    expect(ConfigHarnessV1.issues(dup)).toContain("duplicate step id: plan")
  })

  test("flags a failTo that does not point to an earlier step", () => {
    const later = info({ steps: [{ ...harness.steps[3], failTo: "impl" }, harness.steps[1]] })
    expect(ConfigHarnessV1.issues(later)).toContain("step human: failTo impl must be an earlier step")
  })

  test("flags a check step with no checks", () => {
    const empty = info({ steps: [harness.steps[1], { ...harness.steps[2], checks: [] }] })
    expect(ConfigHarnessV1.issues(empty)).toContain("step verify: needs at least one check")
  })
})
