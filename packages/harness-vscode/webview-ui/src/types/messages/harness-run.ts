export type HarnessRunStatus = "running" | "awaiting_review" | "done" | "failed" | "stopped"

export interface HarnessLogEntry {
  step: string
  attempt: number
  outcome: "ok" | "failed" | "approved" | "rejected" | "error"
  detail: string
}

/** What the reviewer is being asked to look at. */
export interface HarnessPendingReview {
  step: string
  name: string
  checklist: string[]
  show: string[]
  notes: string[]
  diff: string
}

export interface HarnessRun {
  id: string
  task: string
  sessionID: string
  status: HarnessRunStatus
  /** The step running now, or the last one that ran. */
  step?: string
  attempt: number
  log: HarnessLogEntry[]
  notes: string[]
  reason?: string
  pending?: HarnessPendingReview
  startedAt: number
  finishedAt?: number
}

export type HarnessWebviewMessage =
  | { type: "harnessStart"; task: string }
  | { type: "harnessList" }
  | { type: "harnessGet"; runID: string }
  | { type: "harnessReview"; runID: string; approve: boolean; comment?: string }
  | { type: "harnessStop"; runID: string }

export type HarnessExtensionMessage =
  | { type: "harnessRun"; run: HarnessRun }
  | { type: "harnessRuns"; runs: HarnessRun[] }
  | { type: "harnessError"; message: string }

export type CliKind = "codex" | "claude"

export interface CliStatus {
  installed: boolean
  signedIn: boolean
}

export type CliStatusWebviewMessage = { type: "requestCliStatus" }

export type CliStatusExtensionMessage = { type: "cliStatusLoaded"; status: Record<CliKind, CliStatus> }
