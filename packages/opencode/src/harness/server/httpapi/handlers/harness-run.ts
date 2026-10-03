import { Effect } from "effect"
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi"
import { Instance } from "@/harness/instance"
import { HarnessService } from "@/harness/run/service"
import { InstanceHttpApi } from "@/server/routes/instance/httpapi/api"
import { errorMessage } from "@/util/error"
import { HarnessStartError, type ReviewPayload, type StartPayload } from "../groups/harness-run"

export const harnessRunHandlers = HttpApiBuilder.group(InstanceHttpApi, "harnessRun", (handlers) =>
  Effect.gen(function* () {
    const start = Effect.fn("HarnessRunHttpApi.start")(function* (ctx: { payload: typeof StartPayload.Type }) {
      const directory = Instance.directory
      return yield* Effect.tryPromise({
        try: () => HarnessService.start({ directory, task: ctx.payload.task }),
        catch: (err) => new HarnessStartError({ message: errorMessage(err) }),
      })
    })

    const list = Effect.fn("HarnessRunHttpApi.list")(function* () {
      const directory = Instance.directory
      return yield* Effect.promise(() => HarnessService.list(directory))
    })

    const get = Effect.fn("HarnessRunHttpApi.get")(function* (ctx: { params: { runID: string } }) {
      const run = yield* Effect.promise(() => HarnessService.get(ctx.params.runID))
      if (!run) return yield* new HttpApiError.NotFound({})
      return run
    })

    const review = Effect.fn("HarnessRunHttpApi.review")(function* (ctx: {
      params: { runID: string }
      payload: typeof ReviewPayload.Type
    }) {
      const ok = HarnessService.review(ctx.params.runID, ctx.payload)
      if (!ok) return yield* new HttpApiError.NotFound({})
      return true
    })

    const stop = Effect.fn("HarnessRunHttpApi.stop")(function* (ctx: { params: { runID: string } }) {
      const ok = yield* Effect.promise(() => HarnessService.stop(ctx.params.runID))
      if (!ok) return yield* new HttpApiError.NotFound({})
      return true
    })

    return handlers
      .handle("start", start)
      .handle("list", list)
      .handle("get", get)
      .handle("review", review)
      .handle("stop", stop)
  }),
)
