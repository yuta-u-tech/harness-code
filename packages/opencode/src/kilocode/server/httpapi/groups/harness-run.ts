import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiError, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "@/server/routes/instance/httpapi/middleware/authorization"
import { InstanceContextMiddleware } from "@/server/routes/instance/httpapi/middleware/instance-context"
import {
  WorkspaceRoutingMiddleware,
  WorkspaceRoutingQuery,
} from "@/server/routes/instance/httpapi/middleware/workspace-routing"
import { described } from "@/server/routes/instance/httpapi/groups/metadata"

const root = "/harness/run"

const Entry = Schema.Struct({
  step: Schema.String,
  attempt: Schema.Number,
  outcome: Schema.Literals(["ok", "failed", "approved", "rejected", "error"]),
  detail: Schema.String,
}).annotate({ identifier: "HarnessLogEntry" })

const Pending = Schema.Struct({
  step: Schema.String,
  name: Schema.String,
  checklist: Schema.Array(Schema.String),
  show: Schema.Array(Schema.String),
  notes: Schema.Array(Schema.String),
  diff: Schema.String,
}).annotate({ identifier: "HarnessPendingReview" })

export const RunState = Schema.Struct({
  id: Schema.String,
  directory: Schema.String,
  task: Schema.String,
  sessionID: Schema.String,
  status: Schema.Literals(["running", "awaiting_review", "done", "failed", "stopped"]),
  step: Schema.optional(Schema.String),
  attempt: Schema.Number,
  log: Schema.Array(Entry),
  notes: Schema.Array(Schema.String),
  reason: Schema.optional(Schema.String),
  pending: Schema.optional(Pending),
  startedAt: Schema.Number,
  finishedAt: Schema.optional(Schema.Number),
}).annotate({ identifier: "HarnessRun" })

export const StartPayload = Schema.Struct({
  task: Schema.String.check(Schema.isMinLength(1)).annotate({ description: "What the flow should get done" }),
})

export const ReviewPayload = Schema.Struct({
  approve: Schema.Boolean,
  comment: Schema.optional(Schema.String).annotate({ description: "Handed to the step the flow returns to" }),
})

export class HarnessStartError extends Schema.ErrorClass<HarnessStartError>("HarnessStartError")(
  { message: Schema.String },
  { httpApiStatus: 422 },
) {}

const params = { runID: Schema.String }

export const HarnessRunApi = HttpApi.make("harnessRun")
  .add(
    HttpApiGroup.make("harnessRun")
      .add(
        HttpApiEndpoint.post("start", root, {
          query: WorkspaceRoutingQuery,
          payload: StartPayload,
          success: described(RunState, "The run that was started"),
          error: [HttpApiError.BadRequest, HarnessStartError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harnessRun.start",
            summary: "Start a harness run",
            description: "Run the project's harness flow for a task. The run continues in the background.",
          }),
        ),
        HttpApiEndpoint.get("list", root, {
          query: WorkspaceRoutingQuery,
          success: described(Schema.Array(RunState), "Runs for this project, newest first"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harnessRun.list",
            summary: "List harness runs",
            description: "Get the harness runs of this project.",
          }),
        ),
        HttpApiEndpoint.get("get", `${root}/:runID`, {
          params,
          query: WorkspaceRoutingQuery,
          success: described(RunState, "The run"),
          error: [HttpApiError.NotFound],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harnessRun.get",
            summary: "Get a harness run",
            description: "Get the current state of a harness run.",
          }),
        ),
        HttpApiEndpoint.post("review", `${root}/:runID/review`, {
          params,
          query: WorkspaceRoutingQuery,
          payload: ReviewPayload,
          success: described(Schema.Boolean, "The review was recorded"),
          error: [HttpApiError.BadRequest, HttpApiError.NotFound],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harnessRun.review",
            summary: "Approve or reject a run",
            description: "Answer a run that is waiting for your review.",
          }),
        ),
        HttpApiEndpoint.post("stop", `${root}/:runID/stop`, {
          params,
          query: WorkspaceRoutingQuery,
          success: described(Schema.Boolean, "The run was stopped"),
          error: [HttpApiError.NotFound],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "harnessRun.stop",
            summary: "Stop a harness run",
            description: "Stop a run that is still going.",
          }),
        ),
      )
      .annotateMerge(
        OpenApi.annotations({
          title: "harnessRun",
          description: "Harness run routes.",
        }),
      )
      .middleware(InstanceContextMiddleware)
      .middleware(WorkspaceRoutingMiddleware)
      .middleware(Authorization),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "Kilo HttpApi",
      version: "0.0.1",
      description: "Effect HttpApi surface for instance routes.",
    }),
  )
