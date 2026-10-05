import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiError, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "@/server/routes/instance/httpapi/middleware/authorization"
import { InstanceContextMiddleware } from "@/server/routes/instance/httpapi/middleware/instance-context"
import {
  WorkspaceRoutingMiddleware,
  WorkspaceRoutingQuery,
  WorkspaceRoutingQueryFields,
} from "@/server/routes/instance/httpapi/middleware/workspace-routing"
import { described } from "@/server/routes/instance/httpapi/groups/metadata"
import { AnacondaDesktopApi } from "./anaconda-desktop"
import {
  Failure as AgentManagerFailure,
  Request as AgentManagerRequest,
  RequestID as AgentManagerRequestID,
  Result as AgentManagerResult,
} from "@/harness/agent-manager/protocol"
import {
  Failure as NotebookFailure,
  Request as NotebookRequest,
  RequestID as NotebookRequestID,
  Result as NotebookResult,
} from "@/harness/notebook/protocol"
import { ModelUsage } from "@/harness/session/model-usage"
import { MessageID, SessionID } from "@/session/schema"
import {
  ApiNotFoundError,
  ConflictError,
  InvalidRequestError,
  UnknownError,
} from "@/server/routes/instance/httpapi/errors"
import { BoardStore } from "@/harness/board/store"
import {
  MarketplaceRemovePayload,
  MarketplaceRemoveResult,
} from "@/harness/marketplace/schema"
import { CommandFiles } from "@/harness/command-files"
import { Token } from "@opencode-ai/schema/harness/session-drain"
import { PendingInfo as WakeupPending } from "@opencode-ai/schema/harness/wakeup-event"

const root = "/harness"
const Scope = Schema.Literals(["global", "project"])

export const BackgroundJobInfo = Schema.Struct({
  id: Schema.String,
  type: Schema.String,
  title: Schema.optional(Schema.String),
  status: Schema.Literals(["running", "completed", "error", "cancelled"]),
  started_at: Schema.Number,
  completed_at: Schema.optional(Schema.Number),
  error: Schema.optional(Schema.String),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
})

export const BackgroundJobsQuery = Schema.Struct({
  ...WorkspaceRoutingQueryFields,
  sessionID: SessionID,
})

export const RemoveSkillPayload = Schema.Struct({
  location: Schema.String,
})

export const RemoveCommandPayload = Schema.Struct({
  location: Schema.String,
})

export const RemoveAgentPayload = Schema.Struct({
  name: Schema.String,
  scope: Schema.optional(Scope),
})

export const RemoveSnapshotPayload = Schema.Struct({
  worktree: Schema.String,
})

export const TeardownWorktreePayload = Schema.Struct({
  worktree: Schema.String,
})

export const TeardownWorktreeResult = Schema.Struct({
  /** True when a loaded backend instance for the worktree was disposed. */
  disposed: Schema.Boolean,
})

export const ResumeSessionPayload = Schema.Struct({
  messageID: MessageID,
  snapshotInitialization: Schema.optional(Schema.Literal("wait")),
})

export const DrainSessionPayload = Schema.Struct({ token: Token })

export const SessionBoard = BoardStore.SessionBoard
export const SessionBoardQuery = Schema.Struct({
  ...WorkspaceRoutingQueryFields,
  before: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.NumberFromString.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 50 }))),
})
export const ResetSessionBoardPayload = Schema.Struct({
  revision: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
})

export const NotebookReplyPayload = Schema.Struct({ result: NotebookResult })
export const NotebookRejectPayload = Schema.Struct({ error: NotebookFailure })
export const AgentManagerReplyPayload = Schema.Struct({ result: AgentManagerResult })
export const AgentManagerRejectPayload = Schema.Struct({ error: AgentManagerFailure })

export const RetentionRunPayload = Schema.Struct({
  force: Schema.optional(Schema.Boolean),
})

export const RetentionState = Schema.Struct({
  at: Schema.Number,
  scanned: Schema.Number,
  deleted: Schema.Number,
  skippedActive: Schema.Number,
  failed: Schema.Number,
  durationMs: Schema.Number,
  cancelled: Schema.optional(Schema.Boolean),
  reclaimedBytes: Schema.optional(Schema.Number),
})

export const RetentionStatus = Schema.Struct({
  policy: Schema.Struct({
    enabled: Schema.Boolean,
    maxAgeDays: Schema.Number,
  }),
  last: Schema.optional(RetentionState),
  progress: Schema.optional(
    Schema.Struct({
      phase: Schema.Literals(["scanning", "deleting", "cancelling"]),
      total: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
      processed: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
      deleted: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
      failed: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
      skippedActive: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    }),
  ),
})

export const HarnessPaths = {
  heapSnapshot: `${root}/heap/snapshot`,
  commandFiles: `${root}/command/files`,
  removeCommand: `${root}/command/remove`,
  removeSkill: `${root}/skill/remove`,
  removeAgent: `${root}/agent/remove`,
  marketplaceRemove: `${root}/marketplace/remove`,
  removeSnapshot: `${root}/snapshot/remove`,
  teardownWorktree: `${root}/worktree/teardown`,
  prepareSnapshot: `${root}/snapshot/prepare`,
  notebookList: `${root}/notebook`,
  notebookReply: `${root}/notebook/:requestID/reply`,
  notebookReject: `${root}/notebook/:requestID/reject`,
  agentManagerList: `${root}/agent-manager`,
  agentManagerReply: `${root}/agent-manager/:requestID/reply`,
  agentManagerReject: `${root}/agent-manager/:requestID/reject`,
  sessionModelUsage: `/session/:sessionID/model-usage`,
  resumeSession: `${root}/session/:sessionID/resume`,
  drainSession: `${root}/session/:sessionID/drain`,
  sessionBoard: `${root}/session/:sessionID/board`,
  resetSessionBoard: `${root}/session/:sessionID/board/reset`,
  backgroundJobs: `${root}/background-jobs`,
  backgroundJobCancel: `${root}/background-jobs/:jobID/cancel`,
  backgroundJobPromote: `${root}/background-jobs/:jobID/promote`,
  retentionStatus: `${root}/retention`,
  retentionRun: `${root}/retention/run`,
  retentionCancel: `${root}/retention/cancel`,
  wakeups: `${root}/wakeups`,
} as const

export const HarnessApi = HttpApi.make("harness")
  .add(
    HttpApiGroup.make("harness")
      .add(
        HttpApiEndpoint.post("resumeSession", HarnessPaths.resumeSession, {
          params: { sessionID: SessionID },
          query: WorkspaceRoutingQuery,
          payload: ResumeSessionPayload,
          success: described(Schema.Boolean, "Session continuation accepted"),
          error: [ApiNotFoundError, InvalidRequestError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.resumeSession",
            summary: "Resume an interrupted session",
            description:
              "Resume the specified unfinished assistant turn without adding a user message. Active, completed, reverted, and blocked sessions cannot be resumed.",
          }),
        ),
        HttpApiEndpoint.post("drainSession", HarnessPaths.drainSession, {
          params: { sessionID: SessionID },
          query: WorkspaceRoutingQuery,
          payload: DrainSessionPayload,
          success: described(Schema.Boolean, "Session work drained"),
          error: ApiNotFoundError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.drainSession",
            summary: "Wait for session completion",
            description:
              "Wait for active session work and background result delivery, then publish the matching drain acknowledgment.",
          }),
        ),
        HttpApiEndpoint.get("sessionBoard", HarnessPaths.sessionBoard, {
          params: { sessionID: SessionID },
          query: SessionBoardQuery,
          success: described(SessionBoard, "Shared board snapshot"),
          error: [ApiNotFoundError, InvalidRequestError, ConflictError, UnknownError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.sessionBoard",
            summary: "Observe a session's shared board",
            description: "Read stored board messages without changing the board.",
          }),
        ),
        HttpApiEndpoint.post("resetSessionBoard", HarnessPaths.resetSessionBoard, {
          params: { sessionID: SessionID },
          query: WorkspaceRoutingQuery,
          payload: ResetSessionBoardPayload,
          success: described(SessionBoard, "Shared board after reset"),
          error: [ApiNotFoundError, InvalidRequestError, ConflictError, UnknownError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.resetSessionBoard",
            summary: "Clear a session's shared board",
            description: "Clear visible messages without changing conversations or running tasks.",
          }),
        ),
        HttpApiEndpoint.post("heapSnapshot", HarnessPaths.heapSnapshot, {
          query: WorkspaceRoutingQuery,
          success: described(Schema.String, "Heap snapshot file path"),
          error: HttpApiError.BadRequest,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.heap.snapshot",
            summary: "Write heap snapshot",
            description: "Write a heap snapshot for the CLI process to the log directory.",
          }),
        ),
        HttpApiEndpoint.get("commandFiles", HarnessPaths.commandFiles, {
          query: WorkspaceRoutingQuery,
          success: described(Schema.Array(CommandFiles.Info), "Command files"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.commandFiles",
            summary: "List command files",
            description: "List commands with editable file locations for settings clients.",
          }),
        ),
        HttpApiEndpoint.post("removeCommand", HarnessPaths.removeCommand, {
          query: WorkspaceRoutingQuery,
          payload: RemoveCommandPayload,
          success: described(Schema.Boolean, "Command removed"),
          error: HttpApiError.BadRequest,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.removeCommand",
            summary: "Remove a command",
            description: "Remove a command by deleting its markdown file from disk and clearing it from cache.",
          }),
        ),
        HttpApiEndpoint.post("removeSkill", HarnessPaths.removeSkill, {
          query: WorkspaceRoutingQuery,
          payload: RemoveSkillPayload,
          success: described(Schema.Boolean, "Skill removed"),
          error: HttpApiError.BadRequest,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.removeSkill",
            summary: "Remove a skill",
            description: "Remove a skill by deleting its manifest from disk and clearing it from cache.",
          }),
        ),
        HttpApiEndpoint.post("removeAgent", HarnessPaths.removeAgent, {
          query: WorkspaceRoutingQuery,
          payload: RemoveAgentPayload,
          success: described(Schema.Boolean, "Agent removed"),
          error: HttpApiError.BadRequest,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.removeAgent",
            summary: "Remove a custom agent",
            description:
              "Remove a custom (non-native) agent from one writable configuration scope, or every writable scope when omitted, and dispose cached instance state.",
          }),
        ),
        HttpApiEndpoint.post("marketplaceRemove", HarnessPaths.marketplaceRemove, {
          query: WorkspaceRoutingQuery,
          payload: MarketplaceRemovePayload,
          success: described(MarketplaceRemoveResult, "Marketplace removal result"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.marketplace.remove",
            summary: "Remove a marketplace item",
            description: "Remove a marketplace MCP server, agent, skill, or plugin from project or global Harness config.",
          }),
        ),
        HttpApiEndpoint.post("removeSnapshot", HarnessPaths.removeSnapshot, {
          query: WorkspaceRoutingQuery,
          payload: RemoveSnapshotPayload,
          success: described(Schema.Boolean, "Snapshot repository removed"),
          error: HttpApiError.BadRequest,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.removeSnapshot",
            summary: "Remove a snapshot repository",
            description: "Remove the snapshot repository for an already deleted Agent Manager worktree.",
          }),
        ),
        HttpApiEndpoint.post("teardownWorktree", HarnessPaths.teardownWorktree, {
          query: WorkspaceRoutingQuery,
          payload: TeardownWorktreePayload,
          success: described(TeardownWorktreeResult, "Worktree backend teardown result"),
          error: HttpApiError.BadRequest,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.teardownWorktree",
            summary: "Tear down backend state for a managed worktree",
            description:
              "Kill the PTYs rooted in an Agent Manager worktree and dispose its backend instance when one is loaded, without booting an instance for the directory.",
          }),
        ),
        HttpApiEndpoint.post("prepareSnapshot", HarnessPaths.prepareSnapshot, {
          query: WorkspaceRoutingQuery,
          success: described(
            Schema.Struct({ prepared: Schema.Boolean, durationMs: Schema.Number }),
            "Snapshot repository preparation result",
          ),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.snapshot.prepare",
            summary: "Prepare a snapshot repository",
            description:
              "Initialize and seed snapshots for the routed directory without creating a session or tracking ref.",
          }),
        ),
        HttpApiEndpoint.get("notebookList", HarnessPaths.notebookList, {
          query: WorkspaceRoutingQuery,
          success: described(Schema.Array(NotebookRequest), "Pending notebook host requests"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.notebook.list",
            summary: "List pending notebook requests",
            description: "List pending native notebook requests for the routed workspace.",
          }),
        ),
        HttpApiEndpoint.post("notebookReply", HarnessPaths.notebookReply, {
          params: { requestID: NotebookRequestID },
          query: WorkspaceRoutingQuery,
          payload: NotebookReplyPayload,
          success: described(Schema.Boolean, "Notebook reply accepted"),
          error: [HttpApiError.BadRequest, HttpApiError.NotFound],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.notebook.reply",
            summary: "Reply to a notebook request",
            description: "Complete a pending native notebook request with a structured result.",
          }),
        ),
        HttpApiEndpoint.post("notebookReject", HarnessPaths.notebookReject, {
          params: { requestID: NotebookRequestID },
          query: WorkspaceRoutingQuery,
          payload: NotebookRejectPayload,
          success: described(Schema.Boolean, "Notebook rejection accepted"),
          error: HttpApiError.NotFound,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.notebook.reject",
            summary: "Reject a notebook request",
            description: "Complete a pending native notebook request with a structured host error.",
          }),
        ),
        HttpApiEndpoint.get("agentManagerList", HarnessPaths.agentManagerList, {
          query: WorkspaceRoutingQuery,
          success: described(Schema.Array(AgentManagerRequest), "Pending Agent Manager host requests"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.agentManager.list",
            summary: "List pending Agent Manager requests",
            description: "List pending native Agent Manager orchestration requests for the routed workspace.",
          }),
        ),
        HttpApiEndpoint.post("agentManagerReply", HarnessPaths.agentManagerReply, {
          params: { requestID: AgentManagerRequestID },
          query: WorkspaceRoutingQuery,
          payload: AgentManagerReplyPayload,
          success: described(Schema.Boolean, "Agent Manager reply accepted"),
          error: [HttpApiError.BadRequest, HttpApiError.NotFound],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.agentManager.reply",
            summary: "Reply to an Agent Manager request",
            description: "Complete a pending Agent Manager orchestration request with a structured result.",
          }),
        ),
        HttpApiEndpoint.post("agentManagerReject", HarnessPaths.agentManagerReject, {
          params: { requestID: AgentManagerRequestID },
          query: WorkspaceRoutingQuery,
          payload: AgentManagerRejectPayload,
          success: described(Schema.Boolean, "Agent Manager rejection accepted"),
          error: HttpApiError.NotFound,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.agentManager.reject",
            summary: "Reject an Agent Manager request",
            description: "Complete a pending Agent Manager orchestration request with a structured host error.",
          }),
        ),
        HttpApiEndpoint.get("sessionModelUsage", HarnessPaths.sessionModelUsage, {
          params: { sessionID: SessionID },
          query: WorkspaceRoutingQuery,
          success: described(ModelUsage.Info, "Model usage for a session tree"),
          error: HttpApiError.NotFound,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.sessionModelUsage",
            summary: "Get session model usage",
            description: "Get token usage and direct cost by model for the complete top-level session tree.",
          }),
        ),
        HttpApiEndpoint.get("backgroundJobs", HarnessPaths.backgroundJobs, {
          query: BackgroundJobsQuery,
          success: described(Schema.Array(BackgroundJobInfo), "Background jobs"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.backgroundJobs",
            summary: "List background jobs",
            description: "List background subagent jobs owned by one parent session.",
          }),
        ),
        HttpApiEndpoint.post("backgroundJobCancel", HarnessPaths.backgroundJobCancel, {
          params: { jobID: Schema.String },
          query: WorkspaceRoutingQuery,
          success: described(Schema.Boolean, "Background job cancelled"),
          error: HttpApiError.NotFound,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.backgroundJob.cancel",
            summary: "Cancel background job",
            description: "Cancel one background subagent job and its session tree.",
          }),
        ),
        HttpApiEndpoint.post("backgroundJobPromote", HarnessPaths.backgroundJobPromote, {
          params: { jobID: Schema.String },
          query: WorkspaceRoutingQuery,
          success: described(Schema.Boolean, "Background job promoted"),
          error: HttpApiError.NotFound,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.backgroundJob.promote",
            summary: "Promote background job",
            description: "Continue one foreground subagent in the background.",
          }),
        ),
        HttpApiEndpoint.get("wakeups", HarnessPaths.wakeups, {
          query: WorkspaceRoutingQuery,
          success: described(Schema.Array(WakeupPending), "Pending wakeups for the routed directory"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.wakeups",
            summary: "List pending wakeups",
            description:
              "List the sessions that hold scheduled wakeups in the routed directory, with each session's pending count.",
          }),
        ),
        HttpApiEndpoint.get("retentionStatus", HarnessPaths.retentionStatus, {
          query: WorkspaceRoutingQuery,
          success: described(RetentionStatus, "Session retention policy and last run"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.retention.status",
            summary: "Get session retention status",
            description:
              "Read the machine-wide session retention policy and the state of the most recent cleanup pass.",
          }),
        ),
        HttpApiEndpoint.post("retentionRun", HarnessPaths.retentionRun, {
          query: WorkspaceRoutingQuery,
          payload: RetentionRunPayload,
          success: described(RetentionStatus, "Retention pass outcome"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.retention.run",
            summary: "Run session retention",
            description:
              "Run one machine-wide session retention pass. Does nothing unless the retention policy is enabled in harness.json; `force` bypasses the minimum spacing between scheduled passes, never the enable check.",
          }),
        ),
        HttpApiEndpoint.post("retentionCancel", HarnessPaths.retentionCancel, {
          query: WorkspaceRoutingQuery,
          success: described(
            Schema.Struct({ requested: Schema.Boolean }),
            "Retention cancel request outcome; false when no pass was running",
          ),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harness.retention.cancel",
            summary: "Stop the active session retention pass",
            description:
              "Ask the machine-wide retention pass to stop before deleting more sessions. Already-deleted sessions stay deleted; the interrupted pass still records its partial result and honors the spacing window.",
          }),
        ),
      )
      .annotateMerge(
        OpenApi.annotations({
          title: "harness",
          description: "Harness-specific routes.",
        }),
      )
      .middleware(InstanceContextMiddleware)
      .middleware(WorkspaceRoutingMiddleware)
      .middleware(Authorization),
  )
  .addHttpApi(AnacondaDesktopApi)
  .annotateMerge(
    OpenApi.annotations({
      title: "harness HttpApi",
      version: "0.0.1",
      description: "Harness HttpApi surface.",
    }),
  )
