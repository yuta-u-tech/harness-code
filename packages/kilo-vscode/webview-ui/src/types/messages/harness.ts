/** Mirrors packages/core/src/v1/config/harness.ts. */

export interface HarnessCommandCheck {
  id: string
  type: "command"
  name: string
  command: string
  required: boolean
}

export interface HarnessRubricItem {
  id: string
  name: string
  weight: number
  criterion: string
}

export interface HarnessRubricCheck {
  id: string
  type: "rubric"
  name: string
  model: string
  variant?: string | null
  runs: number
  pass: number
  required: boolean
  items: HarnessRubricItem[]
}

export type HarnessCheck = HarnessCommandCheck | HarnessRubricCheck

export interface HarnessAgentStep {
  id: string
  kind: "agent"
  name: string
  agent: string
  subagents?: string[]
}

export interface HarnessCheckStep {
  id: string
  kind: "check"
  name: string
  failTo: string
  retries: number
  checks: HarnessCheck[]
}

export interface HarnessHumanStep {
  id: string
  kind: "human"
  name: string
  failTo: string
  show: string[]
  checklist: string[]
}

export type HarnessStep = HarnessAgentStep | HarnessCheckStep | HarnessHumanStep

export interface HarnessConfig {
  steps: HarnessStep[]
}
