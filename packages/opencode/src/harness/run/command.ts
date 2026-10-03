export * as HarnessCommand from "./command"

import { errorMessage } from "@/util/error"
import { Process } from "@/util/process"

const LIMIT = 10 * 60_000
const TAIL = 4_000
/** Grace period between SIGTERM and SIGKILL once a command is stopped. */
const GRACE = 1_000

export interface Input {
  command: string
  cwd: string
  /** Milliseconds before the command is stopped. */
  limit?: number
  /** How many characters of output to keep, counted from the end. */
  tail?: number
  abort?: AbortSignal
}

export interface Output {
  passed: boolean
  code: number
  detail: string
}

const cut = (text: string, size: number) => (text.length <= size ? text : `…${text.slice(-size)}`)

/** Runs a shell command. Exit code 0 passes; everything else fails with the end of its output as the detail. */
export async function run(input: Input): Promise<Output> {
  const limit = AbortSignal.timeout(input.limit ?? LIMIT)
  const signal = input.abort ? AbortSignal.any([input.abort, limit]) : limit
  const out = await Process.run([input.command], {
    cwd: input.cwd,
    shell: true,
    nothrow: true,
    abort: signal,
    timeout: GRACE,
  }).catch((err: unknown) => ({ code: 1, stdout: Buffer.alloc(0), stderr: Buffer.from(errorMessage(err)) }))

  const text = cut(`${out.stdout.toString()}${out.stderr.toString()}`.trim(), input.tail ?? TAIL)
  const stopped = input.abort?.aborted
    ? "aborted"
    : limit.aborted
      ? `timed out after ${input.limit ?? LIMIT}ms`
      : undefined
  if (stopped) return { passed: false, code: out.code, detail: `${stopped}\n${text}`.trim() }
  if (out.code === 0) return { passed: true, code: 0, detail: text || "exit code 0" }
  return { passed: false, code: out.code, detail: `exit code ${out.code}\n${text}`.trim() }
}
