import { Effect } from "effect"
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi"
import { Instance } from "@/kilocode/instance"
import { HarnessService } from "@/kilocode/harness/service"
import { InstanceHttpApi } from "@/server/routes/instance/httpapi/api"
import { errorMessage } from "@/util/error"
import { HarnessStartError, type ReviewPayload, type StartPayload } from "../groups/harness"

export const harnessHandlers = HttpApiBuilder.group(InstanceHttpApi, "harness", (handlers) =>
  Effect.gen(function* () {
    const start = Effect.fn("HarnessHttpApi.start")(function* (ctx: { payload: typeof StartPayload.Type }) {
      const directory = Instance.directory
      return yield* Effect.tryPromise({
        try: () => HarnessService.start({ directory, task: ctx.payload.task }),
        catch: (err) => new HarnessStartError({ message: errorMessage(err) }),
      })
    })

    const list = Effect.fn("HarnessHttpApi.list")(function* () {
      const directory = Instance.directory
      return yield* Effect.promise(() => HarnessService.list(directory))
    })

    const get = Effect.fn("HarnessHttpApi.get")(function* (ctx: { params: { runID: string } }) {
      const run = yield* Effect.promise(() => HarnessService.get(ctx.params.runID))
      if (!run) return yield* new HttpApiError.NotFound({})
      return run
    })

    const review = Effect.fn("HarnessHttpApi.review")(function* (ctx: {
      params: { runID: string }
      payload: typeof ReviewPayload.Type
    }) {
      const ok = HarnessService.review(ctx.params.runID, ctx.payload)
      if (!ok) return yield* new HttpApiError.NotFound({})
      return true
    })

    const stop = Effect.fn("HarnessHttpApi.stop")(function* (ctx: { params: { runID: string } }) {
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
