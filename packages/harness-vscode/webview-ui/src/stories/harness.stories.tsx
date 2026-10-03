/** @jsxImportSource solid-js */
/**
 * Stories for the Harness settings tab.
 */

import { onMount } from "solid-js"
import type { Meta, StoryObj } from "storybook-solidjs-vite"
import { StoryProviders, mockSessionValue } from "./StoryProviders"
import { SessionContext } from "../context/session"
import Settings from "../components/settings/Settings"
import type { Config } from "../types/messages"

const meta: Meta = {
  title: "Settings/Harness",
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj

const SUBAGENTS = [
  { name: "explorer", description: "Read-only codebase search", mode: "subagent" as const, native: false },
  { name: "test-writer", description: "Writes tests from the spec", mode: "subagent" as const, native: false },
]

const CONFIG: Config = {
  agent: {
    "harness-plan": {
      model: "openai/gpt-5.6",
      variant: "high",
      prompt: "コードは書かず、変更の手順を3〜7個で出してください。",
    },
    "harness-impl": { model: "ollama/qwen3-coder-64k:30b" },
  },
}

function Panel(props: { config?: Config }) {
  const session = {
    ...mockSessionValue({ id: "harness-story", status: "idle" }),
    agents: () => SUBAGENTS,
    allAgents: () => SUBAGENTS,
    skills: () => [],
  }
  return (
    <StoryProviders sessionID="harness-story" status="idle" config={props.config ?? CONFIG}>
      <SessionContext.Provider value={session as any}>
        <div style={{ height: "760px", display: "flex", "flex-direction": "column" }}>
          <Settings tab="harness" />
        </div>
      </SessionContext.Provider>
    </StoryProviders>
  )
}

export const DefaultFlow: Story = {
  name: "Harness — default flow",
  render: () => <Panel />,
}

const CLI_CONFIG: Config = {
  ...CONFIG,
  harness: {
    steps: [
      { id: "plan", kind: "agent", name: "計画", agent: "harness-plan", runner: { kind: "claude", effort: "high" } },
      { id: "impl", kind: "agent", name: "実装", agent: "harness-impl", runner: { kind: "codex", model: "gpt-5.6" } },
    ],
  },
}

export const CliRunner: Story = {
  name: "Harness — steps on the Claude Code and Codex CLIs",
  render: () => <Panel config={CLI_CONFIG} />,
}

const REVIEW_RUN = {
  id: "hr_demo",
  task: "add(a, b) を作り、テストを書く",
  sessionID: "ses_demo",
  status: "awaiting_review",
  step: "human",
  attempt: 1,
  log: [
    { step: "plan", attempt: 1, outcome: "ok", detail: "1. add.py を作る\n2. test_add.py を作る" },
    { step: "impl", attempt: 1, outcome: "ok", detail: "add.py と test_add.py を作成しました。" },
    { step: "verify", attempt: 1, outcome: "failed", detail: "unit test: exit code 2\nNo such file: test_add.py" },
    { step: "impl", attempt: 2, outcome: "ok", detail: "test_add.py を追加しました。" },
    { step: "verify", attempt: 2, outcome: "ok", detail: "all checks passed" },
  ],
  notes: ["コード品質: 4.2 of 5 (pass, line 3.5)\n  - 可読性: 5\n  - 変更範囲: 4"],
  pending: {
    step: "human",
    name: "あなたの確認",
    checklist: ["読んで意図が分かるか", "名前の付け方が好みに合うか"],
    show: ["diff", "scores", "tests"],
    notes: ["コード品質: 4.2 of 5 (pass, line 3.5)\n  - 可読性: 5\n  - 変更範囲: 4"],
    diff: "diff --git a/add.py b/add.py\nnew file mode 100644\n--- /dev/null\n+++ b/add.py\n@@ -0,0 +1,2 @@\n+def add(a, b):\n+    return a + b",
  },
  startedAt: 1,
}

function WithRun() {
  onMount(() => {
    window.postMessage({ type: "harnessRun", run: REVIEW_RUN }, "*")
  })
  return <Panel />
}

export const RunWaitingForReview: Story = {
  name: "Harness — run waiting for your review",
  render: () => <WithRun />,
}
