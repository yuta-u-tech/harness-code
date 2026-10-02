export * as HarnessService from "./service"

import { AppRuntime } from "@/effect/app-runtime"
import { Config } from "@/config/config"
import { provide } from "@/kilocode/instance"
import type { SessionID } from "@/session/schema"
import { Storage } from "@/storage/storage"
import { errorMessage } from "@/util/error"
import * as Log from "@opencode-ai/core/util/log"
import { Engine } from "./engine"
import { HarnessRunner } from "./runner"

const log = Log.create({ service: "harness" })

export type Status = "running" | "awaiting_review" | "done" | "failed" | "stopped"

/** What the reviewer is being asked to look at. */
export interface Pending {
  step: string
  name: string
  checklist: string[]
  show: string[]
  notes: string[]
  diff: string
}

export interface State {
  id: string
  directory: string
  task: string
  sessionID: string
  status: Status
  /** The step running now, or the last one that ran. */
  step?: string
  attempt: number
  log: Engine.Entry[]
  notes: string[]
  reason?: string
  pending?: Pending
  startedAt: number
  finishedAt?: number
}

interface Live {
  state: State
  sessionID: SessionID
  abort: AbortController
  answer?: (decision: Engine.Decision) => void
}

/** Runs live only in this process; a restart ends them, but their last state stays readable from storage. */
const live = new Map<string, Live>()

const key = (id: string) => ["harness", id]

function save(state: State) {
  return AppRuntime.runPromise(Storage.Service.use((svc) => svc.write(key(state.id), state))).catch((err: unknown) =>
    log.error("could not save run", { id: state.id, err }),
  )
}

function update(run: Live, patch: Partial<State>) {
  run.state = { ...run.state, ...patch }
  void save(run.state)
}

async function flow(directory: string) {
  const cfg = await provide({ directory, fn: () => AppRuntime.runPromise(Config.Service.use((svc) => svc.get())) })
  if (!cfg.harness || cfg.harness.steps.length === 0) throw new Error("no harness is configured for this project")
  return cfg.harness
}

export async function start(input: { directory: string; task: string }): Promise<State> {
  const steps = await flow(input.directory)
  const abort = new AbortController()
  const holder: { run?: Live } = {}

  const created = await HarnessRunner.create({
    directory: input.directory,
    task: input.task,
    flow: steps,
    abort: abort.signal,
    emit: (event) => {
      const run = holder.run
      if (!run) return
      if (event.type === "started") update(run, { step: event.step, attempt: event.attempt })
      if (event.type === "finished" && event.outcome) {
        const entry = { step: event.step, attempt: event.attempt, outcome: event.outcome, detail: event.detail ?? "" }
        update(run, { log: [...run.state.log, entry] })
      }
    },
    review: ({ step, notes, diff }) =>
      new Promise<Engine.Decision>((resolve) => {
        const run = holder.run
        if (!run) return resolve({ approve: false, comment: "run was not registered" })
        run.answer = resolve
        update(run, {
          status: "awaiting_review",
          pending: { step: step.id, name: step.name, checklist: step.checklist, show: step.show, notes, diff },
        })
      }),
  })

  const run: Live = {
    abort,
    sessionID: created.sessionID,
    state: {
      id: `hr_${crypto.randomUUID().slice(0, 8)}`,
      directory: input.directory,
      task: input.task,
      sessionID: created.sessionID,
      status: "running",
      attempt: 0,
      log: [],
      notes: [],
      startedAt: Date.now(),
    },
  }
  holder.run = run
  live.set(run.state.id, run)
  await save(run.state)

  void Engine.run(steps, created.deps)
    .catch((err: unknown): Engine.Report => ({ status: "failed", reason: errorMessage(err), log: [], notes: [] }))
    .then((report) => {
      run.answer = undefined
      update(run, {
        status: report.status,
        reason: report.reason,
        log: report.log,
        notes: report.notes,
        pending: undefined,
        finishedAt: Date.now(),
      })
    })

  return run.state
}

export async function get(id: string): Promise<State | undefined> {
  const run = live.get(id)
  if (run) return run.state
  const saved = await AppRuntime.runPromise(Storage.Service.use((svc) => svc.read<State>(key(id)))).catch(
    () => undefined,
  )
  if (!saved) return undefined
  // Nothing in this process is driving it, so it was cut off by a restart.
  if (saved.status === "running" || saved.status === "awaiting_review") {
    return { ...saved, status: "stopped", pending: undefined, reason: "interrupted: the backend was restarted" }
  }
  return saved
}

export async function list(directory: string): Promise<State[]> {
  const keys = await AppRuntime.runPromise(Storage.Service.use((svc) => svc.list(["harness"]))).catch(() => [])
  const saved = await Promise.all(keys.map((item) => get(item.at(-1) ?? "")))
  const all = saved.filter((item): item is State => item !== undefined && item.directory === directory)
  return all.sort((a, b) => b.startedAt - a.startedAt)
}

/** Answers a run that is waiting for review. Returns false when nothing is waiting. */
export function review(id: string, decision: Engine.Decision): boolean {
  const run = live.get(id)
  if (!run?.answer) return false
  const answer = run.answer
  run.answer = undefined
  update(run, { status: "running", pending: undefined })
  answer(decision)
  return true
}

export async function stop(id: string): Promise<boolean> {
  const run = live.get(id)
  if (!run || run.state.finishedAt) return false
  run.abort.abort()
  run.answer?.({ approve: false, comment: "stopped" })
  await HarnessRunner.cancel(run.state.directory, run.sessionID).catch(() => undefined)
  return true
}
