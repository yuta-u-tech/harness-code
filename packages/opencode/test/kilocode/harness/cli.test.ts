import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { HarnessCli } from "../../../src/kilocode/harness/cli"

const dir = () => fs.mkdtemp(path.join(os.tmpdir(), "harness-cli-"))

describe("HarnessCli.argv", () => {
  test("builds a Codex command that reads the prompt from stdin", () => {
    const out = HarnessCli.argv({ kind: "codex", cwd: "/work", write: true, last: "/tmp/last.txt" })
    expect(out.slice(0, 2)).toEqual(["codex", "exec"])
    expect(out).toContain("-C")
    expect(out[out.indexOf("-C") + 1]).toBe("/work")
    expect(out[out.indexOf("-s") + 1]).toBe("workspace-write")
    expect(out[out.indexOf("-o") + 1]).toBe("/tmp/last.txt")
    expect(out.at(-1)).toBe("-")
  })

  test("uses a read-only sandbox when the step must not edit", () => {
    const out = HarnessCli.argv({ kind: "codex", cwd: "/work", write: false, last: "/tmp/l" })
    expect(out[out.indexOf("-s") + 1]).toBe("read-only")
  })

  test("passes the Codex model and reasoning effort", () => {
    const out = HarnessCli.argv({ kind: "codex", cwd: "/w", write: false, model: "gpt-5", effort: "high", last: "/l" })
    expect(out[out.indexOf("-m") + 1]).toBe("gpt-5")
    expect(out).toContain('model_reasoning_effort="high"')
  })

  test("leaves model and effort out when they are not set", () => {
    const out = HarnessCli.argv({ kind: "codex", cwd: "/w", write: false, model: "", effort: "", last: "/l" })
    expect(out).not.toContain("-m")
    expect(out.join(" ")).not.toContain("model_reasoning_effort")
  })

  test("builds a Claude Code command in print mode", () => {
    const out = HarnessCli.argv({ kind: "claude", cwd: "/work", write: true })
    expect(out.slice(0, 2)).toEqual(["claude", "-p"])
    expect(out).toContain("--no-session-persistence")
    expect(out[out.indexOf("--permission-mode") + 1]).toBe("acceptEdits")
  })

  test("uses plan mode for a Claude step that must not edit", () => {
    const out = HarnessCli.argv({ kind: "claude", cwd: "/work", write: false })
    expect(out[out.indexOf("--permission-mode") + 1]).toBe("plan")
    expect(out).not.toContain("--allowedTools")
  })

  test("lets a writing Claude step run commands and edit files", () => {
    const out = HarnessCli.argv({ kind: "claude", cwd: "/work", write: true })
    const tools = out[out.indexOf("--allowedTools") + 1] ?? ""
    expect(tools).toContain("Bash")
    expect(tools).toContain("Edit")
  })

  test("passes the Claude model and effort", () => {
    const out = HarnessCli.argv({ kind: "claude", cwd: "/w", write: false, model: "opus", effort: "max" })
    expect(out[out.indexOf("--model") + 1]).toBe("opus")
    expect(out[out.indexOf("--effort") + 1]).toBe("max")
  })

  test("puts the variadic tool list last so it cannot swallow other flags", () => {
    const out = HarnessCli.argv({ kind: "claude", cwd: "/w", write: true, model: "opus", effort: "low" })
    expect(out.indexOf("--allowedTools")).toBeGreaterThan(out.indexOf("--effort"))
    expect(out.indexOf("--allowedTools")).toBeGreaterThan(out.indexOf("--model"))
  })
})

/** Puts a script named like the CLI first on PATH, so the real spawning, stdin and output handling run. */
async function fake(name: string, body: string) {
  const bin = await dir()
  const file = path.join(bin, name)
  await fs.writeFile(file, `#!/bin/sh\n${body}\n`, { mode: 0o755 })
  return { PATH: `${bin}:${process.env.PATH ?? ""}` }
}

describe("HarnessCli.run", () => {
  test("sends the prompt on stdin and returns Codex's last message from the output file", async () => {
    const work = await dir()
    const env = await fake(
      "codex",
      `last=""; while [ $# -gt 0 ]; do [ "$1" = "-o" ] && last="$2"; shift; done
cat > "${work}/stdin.txt"
echo "progress noise"
printf 'final answer' > "$last"`,
    )
    const out = await HarnessCli.run({ kind: "codex", prompt: "do the thing", cwd: work, write: true, env })
    expect(out.text).toBe("final answer")
    expect(await fs.readFile(path.join(work, "stdin.txt"), "utf8")).toBe("do the thing")
  })

  test("returns Claude's stdout", async () => {
    const work = await dir()
    const env = await fake("claude", `cat > "${work}/stdin.txt"; printf 'claude says hi'`)
    const out = await HarnessCli.run({ kind: "claude", prompt: "hello", cwd: work, write: false, env })
    expect(out.text).toBe("claude says hi")
    expect(await fs.readFile(path.join(work, "stdin.txt"), "utf8")).toBe("hello")
  })

  test("runs in the given directory", async () => {
    const work = await dir()
    const env = await fake("claude", "pwd")
    const out = await HarnessCli.run({ kind: "claude", prompt: "x", cwd: work, write: false, env })
    expect(out.text).toContain(path.basename(work))
  })

  test("throws with the CLI's error output on a non-zero exit", async () => {
    const work = await dir()
    const env = await fake("claude", "echo 'not logged in' 1>&2; exit 2")
    const err = await HarnessCli.run({ kind: "claude", prompt: "x", cwd: work, write: false, env }).catch(
      (e: unknown) => e,
    )
    expect(String(err)).toContain("not logged in")
  })

  test("explains how to fix a CLI that is not installed", async () => {
    const work = await dir()
    const env = { PATH: "/usr/bin:/bin" }
    const err = await HarnessCli.run({ kind: "codex", prompt: "x", cwd: work, write: false, env }).catch(
      (e: unknown) => e,
    )
    expect(String(err)).toMatch(/codex.*(not found|install)/i)
  })

  test("stops when aborted", async () => {
    const work = await dir()
    const env = await fake("claude", "sleep 5")
    const ctl = new AbortController()
    setTimeout(() => ctl.abort(), 150)
    const started = Date.now()
    const err = await HarnessCli.run({
      kind: "claude",
      prompt: "x",
      cwd: work,
      write: false,
      env,
      abort: ctl.signal,
    }).catch((e: unknown) => e)
    expect(String(err)).toContain("aborted")
    expect(Date.now() - started).toBeLessThan(4000)
  })
})
