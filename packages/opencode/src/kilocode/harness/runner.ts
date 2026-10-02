export * as HarnessRunner from "./runner"

import { AppRuntime } from "@/effect/app-runtime"
import { provide } from "@/kilocode/instance"
import { Session } from "@/session/session"
import { SessionSummary } from "@/session/summary"
import { SessionPrompt } from "@/session/prompt"
import type { SessionID } from "@/session/schema"
import type { ConfigHarnessV1 } from "@opencode-ai/core/v1/config/harness"
import type { Engine } from "./engine"
import { HarnessModel } from "./model"
import { Judge } from "./judge"

type Info = ConfigHarnessV1.Info

export interface Input {
  directory: string
  task: string
  flow: Info
  abort?: AbortSignal
  review: Engine.Deps["review"]
  emit: Engine.Deps["emit"]
}

const JUDGE = "You are a strict, fair code reviewer. Judge only the change you are shown."

/** What the agent said, from its text parts. */
const said = (parts: readonly { type: string; text?: string }[]) =>
  parts
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("\n")

/** Text diffs first, then the files that have no text diff (binary or empty), so noise stays at the bottom. */
const patches = (diffs: readonly { file?: string; patch?: string }[]) => {
  const text = diffs.filter((item) => item.patch)
  const rest = diffs.filter((item) => !item.patch).map((item) => item.file ?? "unknown file")
  const tail = rest.length > 0 ? [`Also changed, with no text diff: ${rest.join(", ")}`] : []
  return [...text.map((item) => item.patch), ...tail].join("\n")
}

/** Every agent step shares one session, so a step that is sent back still sees the earlier work. */
export async function create(input: Input): Promise<{ sessionID: SessionID; deps: Engine.Deps }> {
  const inDir = async <T>(fn: () => Promise<T>): Promise<T> => await provide({ directory: input.directory, fn })

  const title = `Harness: ${input.task.slice(0, 60)}`
  const session = await inDir(() => AppRuntime.runPromise(Session.Service.use((svc) => svc.create({ title }))))
  const sessionID = session.id

  const deps: Engine.Deps = {
    cwd: input.directory,
    task: input.task,
    abort: input.abort,
    emit: input.emit,
    review: input.review,
    agent: ({ step, carry, task }) =>
      inDir(async () => {
        const first = !carry
        const text = carry ?? `Task:\n${task}\n\nDo the "${step.name}" step.`
        const result = await AppRuntime.runPromise(
          SessionPrompt.Service.use((svc) =>
            svc.prompt({ sessionID, agent: step.agent, parts: [{ type: "text", text }] }),
          ),
        )
        return said(result.parts) || (first ? "(no reply)" : "(no reply to the fix request)")
      }),
    diff: () =>
      inDir(async () =>
        patches(await AppRuntime.runPromise(SessionSummary.Service.use((svc) => svc.diff({ sessionID })))),
      ),
    judge: async (check, ctx) => {
      const reply = await HarnessModel.text({
        model: check.model,
        variant: check.variant,
        system: JUDGE,
        user: Judge.prompt(check, ctx),
        abort: input.abort,
      })
      return Judge.parse(reply, check)
    },
  }
  return { sessionID, deps }
}

/** Stops whatever the session is doing right now. */
export function cancel(directory: string, sessionID: SessionID) {
  return provide({
    directory,
    fn: () => AppRuntime.runPromise(SessionPrompt.Service.use((svc) => svc.cancel(sessionID))),
  })
}
