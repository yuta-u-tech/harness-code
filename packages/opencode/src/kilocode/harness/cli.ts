export * as HarnessCli from "./cli"

import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { buffer } from "node:stream/consumers"
import { Process } from "@/util/process"

export type Kind = "codex" | "claude"

const LIMIT = 30 * 60_000
/** Grace period between SIGTERM and SIGKILL once a run is stopped. */
const GRACE = 2_000
const TAIL = 2_000
/** Tools a Claude step may use when it is allowed to change files. */
const TOOLS = "Bash,Edit,Write,Read,Glob,Grep"

export interface ArgvInput {
  kind: Kind
  cwd: string
  /** false keeps the CLI from changing files. */
  write: boolean
  model?: string
  effort?: string
  /** Where Codex writes its final message. */
  last?: string
}

/** The command line for one non-interactive run. The prompt is not in it; it goes to stdin. */
export function argv(input: ArgvInput): string[] {
  const model = input.model?.trim()
  const effort = input.effort?.trim()
  if (input.kind === "codex") {
    return [
      "codex",
      "exec",
      "-C",
      input.cwd,
      "--skip-git-repo-check",
      "--ephemeral",
      "-s",
      input.write ? "workspace-write" : "read-only",
      ...(model ? ["-m", model] : []),
      ...(effort ? ["-c", `model_reasoning_effort="${effort}"`] : []),
      ...(input.last ? ["-o", input.last] : []),
      "-",
    ]
  }
  return [
    "claude",
    "-p",
    "--no-session-persistence",
    "--permission-mode",
    input.write ? "acceptEdits" : "plan",
    ...(model ? ["--model", model] : []),
    ...(effort ? ["--effort", effort] : []),
    // The tool list is variadic, so it goes last and cannot swallow another flag.
    ...(input.write ? ["--allowedTools", TOOLS] : []),
  ]
}

export interface RunInput extends Omit<ArgvInput, "last"> {
  prompt: string
  abort?: AbortSignal
  /** Milliseconds before the run is stopped. */
  limit?: number
  env?: NodeJS.ProcessEnv
}

/** Why a run was stopped from outside, if it was. */
function stopped(input: RunInput, limit: AbortSignal): string | undefined {
  if (input.abort?.aborted) return `${input.kind} run was aborted`
  if (limit.aborted) return `${input.kind} run timed out after ${input.limit ?? LIMIT}ms`
  return undefined
}

const tail = (text: string) => (text.length <= TAIL ? text : `…${text.slice(-TAIL)}`)

/** Runs the CLI with the prompt on stdin and returns what the agent finally said. Throws when the run fails. */
export async function run(input: RunInput): Promise<{ text: string }> {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "harness-cli-"))
  const last = path.join(scratch, "last-message.txt")
  const limit = AbortSignal.timeout(input.limit ?? LIMIT)
  const signal = input.abort ? AbortSignal.any([input.abort, limit]) : limit
  const cmd = argv({ ...input, last })

  return exec(cmd, input, signal, () => stopped(input, limit))
    .then(async (out) => {
      const written = input.kind === "codex" ? await fs.readFile(last, "utf8").catch(() => "") : ""
      const reason = stopped(input, limit)
      if (reason) throw new Error(reason)
      if (out.code !== 0) {
        const why = tail((out.stderr || out.stdout).trim())
        throw new Error(`${input.kind} exited with code ${out.code}${why ? `: ${why}` : ""}`)
      }
      return { text: (written || out.stdout).trim() }
    })
    .finally(() => fs.rm(scratch, { recursive: true, force: true }))
}

async function exec(cmd: string[], input: RunInput, signal: AbortSignal, reason: () => string | undefined) {
  const child = Process.spawn(cmd, {
    cwd: input.cwd,
    env: input.env,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    abort: signal,
    timeout: GRACE,
  })
  // A CLI that exits before reading its prompt closes the pipe; the exit code reports that failure.
  child.stdin?.on("error", () => undefined)
  child.stdin?.end(input.prompt)
  if (!child.stdout || !child.stderr) throw new Error("process output is not available")

  // A CLI starts children that can keep these pipes open after it is killed; do not wait for them.
  const hangup = () => {
    child.stdout?.destroy()
    child.stderr?.destroy()
  }
  signal.addEventListener("abort", hangup, { once: true })

  const result = await Promise.all([child.exited, buffer(child.stdout), buffer(child.stderr)])
    .catch((err: unknown) => {
      const why = reason()
      if (why) throw new Error(why)
      if (isMissing(err))
        throw new Error(`The ${input.kind} CLI was not found. Install it and sign in, then try again.`)
      throw err
    })
    .finally(() => signal.removeEventListener("abort", hangup))
  return { code: result[0], stdout: result[1].toString(), stderr: result[2].toString() }
}

const isMissing = (err: unknown) => typeof err === "object" && err !== null && "code" in err && err.code === "ENOENT"
