export * as HarnessRunner from "./runner"

import { Config } from "@/config/config"
import { AppRuntime } from "@/effect/app-runtime"
import { provide } from "@/harness/instance"
import { Session } from "@/session/session"
import { SessionSummary } from "@/session/summary"
import { SessionPrompt } from "@/session/prompt"
import type { SessionID } from "@/session/schema"
import type { ConfigHarnessV1 } from "@opencode-ai/core/v1/config/harness"
import { HarnessChanges } from "./changes"
import { HarnessCli } from "./cli"
import type { Engine } from "./engine"
import { HarnessModel } from "./model"
import { Judge } from "./judge"

type Info = ConfigHarnessV1.Info
type Step = Extract<Info["steps"][number], { kind: "agent" }>

export interface Input {
  directory: string
  task: string
  flow: Info
  abort?: AbortSignal
  review: Engine.Deps["review"]
  emit: Engine.Deps["emit"]
}

/** Longest earlier reply handed on to a step that cannot share the session. */
const CONTEXT = 6_000

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

/**
 * Steps on the model catalog share one session, so a step that is sent back still sees the earlier work.
 * A step on a CLI has no session, so it is given what the earlier steps said instead.
 */
export async function create(input: Input): Promise<{ sessionID: SessionID; deps: Engine.Deps }> {
  const inDir = async <T>(fn: () => Promise<T>): Promise<T> => await provide({ directory: input.directory, fn })

  const title = `Harness: ${input.task.slice(0, 60)}`
  const session = await inDir(() => AppRuntime.runPromise(Session.Service.use((svc) => svc.create({ title }))))
  const sessionID = session.id
  const cfg = await inDir(() => AppRuntime.runPromise(Config.Service.use((svc) => svc.get())))
  const base = await HarnessChanges.begin(input.directory)
  const history: { name: string; text: string }[] = []

  const earlier = () =>
    history.length === 0
      ? ""
      : `What the earlier steps said:\n${history.map((item) => `## ${item.name}\n${item.text.slice(-CONTEXT)}`).join("\n\n")}`

  const sessionStep = (step: Step, text: string) =>
    inDir(async () => {
      const result = await AppRuntime.runPromise(
        SessionPrompt.Service.use((svc) =>
          svc.prompt({ sessionID, agent: step.agent, parts: [{ type: "text", text }] }),
        ),
      )
      return said(result.parts)
    })

  const cli = async (step: Step, runner: NonNullable<Step["runner"]>, text: string) => {
    const agent = cfg.agent?.[step.agent]
    const out = await HarnessCli.run({
      kind: runner.kind,
      model: runner.model,
      effort: runner.effort,
      prompt: [agent?.prompt, text, earlier()].filter(Boolean).join("\n\n"),
      cwd: input.directory,
      // A step whose agent may not edit gets a read-only sandbox.
      write: agent?.permission?.edit !== "deny",
      abort: input.abort,
    })
    return out.text
  }

  const deps: Engine.Deps = {
    cwd: input.directory,
    task: input.task,
    abort: input.abort,
    emit: input.emit,
    review: input.review,
    agent: async ({ step, carry, task }) => {
      const text = carry ?? `Task:\n${task}\n\nDo the "${step.name}" step.`
      const reply = (step.runner ? await cli(step, step.runner, text) : await sessionStep(step, text)) || "(no reply)"
      history.push({ name: step.name, text: reply })
      return reply
    },
    // Compare the working tree with where the run began, so edits made by a CLI show up too.
    diff: () =>
      base
        ? HarnessChanges.since(input.directory, base)
        : inDir(async () =>
            patches(await AppRuntime.runPromise(SessionSummary.Service.use((svc) => svc.diff({ sessionID })))),
          ),
    judge: async (check, ctx) => {
      const user = Judge.prompt(check, ctx)
      const reply = check.runner
        ? (
            await HarnessCli.run({
              kind: check.runner.kind,
              model: check.runner.model,
              effort: check.runner.effort,
              prompt: `${JUDGE}\n\n${user}`,
              cwd: input.directory,
              write: false,
              abort: input.abort,
            })
          ).text
        : await HarnessModel.text({
            model: check.model,
            variant: check.variant,
            system: JUDGE,
            user,
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
