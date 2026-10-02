/** @jsxImportSource solid-js */
/**
 * Stories for the Harness settings tab.
 */

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

function Panel() {
  const session = {
    ...mockSessionValue({ id: "harness-story", status: "idle" }),
    agents: () => SUBAGENTS,
    allAgents: () => SUBAGENTS,
    skills: () => [],
  }
  return (
    <StoryProviders sessionID="harness-story" status="idle" config={CONFIG}>
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
