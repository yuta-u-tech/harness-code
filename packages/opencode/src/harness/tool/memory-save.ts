import { Effect } from "effect"
import { Instance } from "@/harness/instance"
import * as Tool from "@/tool/tool"
import { ConfigProtection } from "@/harness/permission/config-paths"
import { MemoryService } from "@harness/harness-memory/effect/service"
import { MemoryTool } from "@harness/harness-memory/tool"

export const MemorySaveTool = Tool.define(
  "harness_memory_save",
  Effect.gen(function* () {
    const memory = yield* MemoryService.Service
    return {
      description: MemoryTool.SaveDescription,
      parameters: MemoryTool.SaveParameters,
      execute: (params: MemoryTool.SaveParams, ctx: Tool.Context) =>
        MemoryTool.save({
          memory,
          params,
          sessionID: ctx.sessionID,
          ctx: { directory: Instance.directory, worktree: Instance.worktree },
          ask: (req) =>
            ctx.ask({
              ...req,
              metadata: { [ConfigProtection.DISABLE_ALWAYS_KEY]: true, ...req.metadata },
            }),
        }).pipe(Effect.catchIf(MemoryTool.failure, (err) => Effect.succeed(MemoryTool.error("save", err)))),
    }
  }),
)
