/**
 * Reports whether the Codex and Claude Code CLIs are installed and signed in, for the Connections tab.
 * Sign-in is read from each CLI's own status command; no credentials are read or stored here.
 * No vscode dependency.
 */

import { exec } from "../../util/process"
import type { CliKind, CliStatus } from "../../../webview-ui/src/types/messages/harness-run"

const TIMEOUT = 8_000

type Run = (cmd: string, args: string[]) => Promise<{ stdout: string; stderr: string }>

const run: Run = (cmd, args) => exec(cmd, args, { timeout: TIMEOUT })

const missing = (err: unknown) => typeof err === "object" && err !== null && "code" in err && err.code === "ENOENT"

/** Codex prints "Logged in using ..." when signed in and exits non-zero otherwise. */
export function codexSignedIn(output: string): boolean {
  return /logged in/i.test(output) && !/not logged in/i.test(output)
}

/** `claude auth status` prints JSON with a `loggedIn` flag. */
export function claudeSignedIn(output: string): boolean {
  const body: unknown = (() => {
    try {
      return JSON.parse(output)
    } catch {
      return undefined
    }
  })()
  return typeof body === "object" && body !== null && "loggedIn" in body && body.loggedIn === true
}

const COMMANDS: Record<CliKind, { cmd: string; args: string[]; signedIn: (output: string) => boolean }> = {
  codex: { cmd: "codex", args: ["login", "status"], signedIn: codexSignedIn },
  claude: { cmd: "claude", args: ["auth", "status"], signedIn: claudeSignedIn },
}

export async function cliStatus(kind: CliKind, runner: Run = run): Promise<CliStatus> {
  const spec = COMMANDS[kind]
  return runner(spec.cmd, spec.args)
    .then((out) => ({ installed: true, signedIn: spec.signedIn(`${out.stdout}\n${out.stderr}`) }))
    .catch((err: unknown) => {
      if (missing(err)) return { installed: false, signedIn: false }
      // A non-zero exit from the status command means the CLI is there but not signed in.
      return { installed: true, signedIn: false }
    })
}

export async function allCliStatus(runner: Run = run): Promise<Record<CliKind, CliStatus>> {
  const [codex, claude] = await Promise.all([cliStatus("codex", runner), cliStatus("claude", runner)])
  return { codex, claude }
}
