import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { HarnessCommand } from "../../../src/harness/run/command"

const dir = () => fs.mkdtemp(path.join(os.tmpdir(), "harness-command-"))

describe("HarnessCommand.run", () => {
  test("passes on exit code 0", async () => {
    const result = await HarnessCommand.run({ command: "echo hello", cwd: await dir() })
    expect(result.passed).toBe(true)
    expect(result.code).toBe(0)
    expect(result.detail).toContain("hello")
  })

  test("fails on a non-zero exit code and reports it", async () => {
    const result = await HarnessCommand.run({ command: "echo oops; exit 3", cwd: await dir() })
    expect(result.passed).toBe(false)
    expect(result.code).toBe(3)
    expect(result.detail).toContain("exit code 3")
    expect(result.detail).toContain("oops")
  })

  test("includes stderr", async () => {
    const result = await HarnessCommand.run({ command: "echo bad 1>&2; exit 1", cwd: await dir() })
    expect(result.detail).toContain("bad")
  })

  test("runs in the given directory", async () => {
    const cwd = await dir()
    const result = await HarnessCommand.run({ command: "pwd", cwd })
    expect(result.detail).toContain(path.basename(cwd))
  })

  test("supports shell operators", async () => {
    const result = await HarnessCommand.run({ command: "true && echo chained", cwd: await dir() })
    expect(result.passed).toBe(true)
    expect(result.detail).toContain("chained")
  })

  test("keeps only the end of very long output", async () => {
    const result = await HarnessCommand.run({
      command: "i=0; while [ $i -lt 2000 ]; do echo line-$i; i=$((i+1)); done; exit 1",
      cwd: await dir(),
      tail: 200,
    })
    expect(result.detail).toContain("line-1999")
    expect(result.detail).not.toContain("line-5\n")
    expect(result.detail.length).toBeLessThan(600)
  })

  test("stops a command that runs past its limit and says so", async () => {
    const started = Date.now()
    const result = await HarnessCommand.run({ command: "sleep 5", cwd: await dir(), limit: 200 })
    expect(result.passed).toBe(false)
    expect(result.detail).toContain("timed out")
    expect(Date.now() - started).toBeLessThan(4000)
  })

  test("fails cleanly when the directory does not exist", async () => {
    const result = await HarnessCommand.run({ command: "echo hi", cwd: "/definitely/not/here" })
    expect(result.passed).toBe(false)
    expect(result.detail.length).toBeGreaterThan(0)
  })

  test("stops when the caller aborts", async () => {
    const ctl = new AbortController()
    setTimeout(() => ctl.abort(), 100)
    const result = await HarnessCommand.run({ command: "sleep 5", cwd: await dir(), abort: ctl.signal })
    expect(result.passed).toBe(false)
    expect(result.detail).toContain("aborted")
  })
})
