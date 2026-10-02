import { describe, expect, test } from "bun:test"
import type { ConfigHarnessV1 } from "@opencode-ai/core/v1/config/harness"
import { Judge } from "../../../src/kilocode/harness/judge"

type Check = Extract<ConfigHarnessV1.Step, { kind: "check" }>["checks"][number]
type Rubric = Extract<Check, { type: "rubric" }>

const rubric: Rubric = {
  id: "r",
  type: "rubric",
  name: "品質",
  model: "ollama/gpt-oss:20b",
  runs: 3,
  pass: 3.5,
  required: false,
  items: [
    { id: "a", name: "可読性", weight: 3, criterion: "名前から役割が読み取れる" },
    { id: "b", name: "一貫性", weight: 1, criterion: "周辺と同じ書き方" },
  ],
}

describe("Judge.prompt", () => {
  const text = Judge.prompt(rubric, { diff: "+const x = 1", task: "add x" })

  test("lists every item with its id and criterion", () => {
    expect(text).toContain("a")
    expect(text).toContain("可読性")
    expect(text).toContain("名前から役割が読み取れる")
    expect(text).toContain("一貫性")
  })

  test("includes the task and the diff being judged", () => {
    expect(text).toContain("add x")
    expect(text).toContain("+const x = 1")
  })

  test("asks for JSON scores from 1 to 5", () => {
    expect(text).toContain("JSON")
    expect(text).toContain("1")
    expect(text).toContain("5")
  })

  test("works without a task", () => {
    expect(Judge.prompt(rubric, { diff: "d" })).toContain("d")
  })
})

describe("Judge.parse", () => {
  test("reads scores and reasons from bare JSON", () => {
    const out = Judge.parse(
      '{"scores":[{"id":"a","score":4,"reason":"clear names"},{"id":"b","score":2,"reason":"differs"}]}',
      rubric,
    )
    expect(out.scores).toEqual({ a: 4, b: 2 })
    expect(out.reasons).toEqual({ a: "clear names", b: "differs" })
  })

  test("finds JSON inside a fenced block surrounded by prose", () => {
    const reply = 'Here is my review.\n```json\n{"scores":[{"id":"a","score":5,"reason":"ok"}]}\n```\nThanks.'
    expect(Judge.parse(reply, rubric).scores).toEqual({ a: 5 })
  })

  test("finds JSON when the model adds text around it without a fence", () => {
    const reply = 'Result: {"scores":[{"id":"b","score":3,"reason":"meh"}]} done'
    expect(Judge.parse(reply, rubric).scores).toEqual({ b: 3 })
  })

  test("accepts numeric strings", () => {
    expect(Judge.parse('{"scores":[{"id":"a","score":"4"}]}', rubric).scores).toEqual({ a: 4 })
  })

  test("ignores unknown ids and non-numeric scores", () => {
    const reply = '{"scores":[{"id":"zzz","score":5},{"id":"a","score":"great"},{"id":"b","score":2}]}'
    expect(Judge.parse(reply, rubric).scores).toEqual({ b: 2 })
  })

  test("returns nothing for text that is not JSON", () => {
    expect(Judge.parse("I think it is fine.", rubric)).toEqual({ scores: {}, reasons: {} })
  })

  test("returns nothing for JSON of the wrong shape", () => {
    expect(Judge.parse('{"result":"good"}', rubric)).toEqual({ scores: {}, reasons: {} })
  })

  test("keeps the first score when an item appears twice", () => {
    const reply = '{"scores":[{"id":"a","score":2},{"id":"a","score":5}]}'
    expect(Judge.parse(reply, rubric).scores).toEqual({ a: 2 })
  })
})

describe("Judge.collect", () => {
  test("gathers one score per run for each item", () => {
    const runs: Judge.Parsed[] = [
      { scores: { a: 4, b: 2 }, reasons: { a: "x" } },
      { scores: { a: 5 }, reasons: {} },
      { scores: { a: 3, b: 3 }, reasons: { b: "y" } },
    ]
    const out = Judge.collect(runs)
    expect(out.runs).toEqual({ a: [4, 5, 3], b: [2, 3] })
    expect(out.reasons).toEqual({ a: ["x"], b: ["y"] })
  })

  test("is empty when there were no runs", () => {
    expect(Judge.collect([])).toEqual({ runs: {}, reasons: {} })
  })
})
