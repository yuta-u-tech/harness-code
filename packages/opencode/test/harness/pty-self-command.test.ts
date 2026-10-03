import { describe, expect, test } from "bun:test"
import { HarnessPtySelfCommand } from "../../src/harness/pty/self-command"

describe("pty self-command", () => {
  test("does not forward bundled bun entrypoints", () => {
    const proc = {
      argv: ["/tmp/harness", "/$bunfs/root/src/index.js"],
      execArgv: ["--user-agent=harness/test", "--use-system-ca", "--"],
      execPath: "/tmp/harness",
      cwd: "/tmp",
    }

    const cmd = HarnessPtySelfCommand.command(proc)
    expect(cmd).toStrictEqual({ command: "/tmp/harness", args: [] })
    expect(HarnessPtySelfCommand.resolve({ command: "harness", cwd: "/tmp/project" }, cmd)).toStrictEqual({
      command: "/tmp/harness",
      args: [],
      cwd: "/tmp/project",
    })
    expect(
      HarnessPtySelfCommand.command({
        ...proc,
        argv: ["C:/tmp/harness.exe", "B:/~BUN/root/src/index.js"],
      }).args,
    ).toStrictEqual([])
    expect(
      HarnessPtySelfCommand.command({
        ...proc,
        argv: ["C:/tmp/harness.exe", "b:\\~BUN\\root\\src\\index.js"],
      }).args,
    ).toStrictEqual([])
  })

  test("forwards source entrypoints", () => {
    const cmd = HarnessPtySelfCommand.command({
      argv: ["/tmp/bun", "/tmp/harness/src/index.ts"],
      execArgv: ["--conditions=browser", "--cwd", "packages/opencode"],
      execPath: "/tmp/bun",
      cwd: "/tmp/harness",
    })
    expect(cmd).toStrictEqual({
      command: "/tmp/bun",
      args: ["--conditions=browser", "/tmp/harness/src/index.ts"],
      cwd: "/tmp/harness",
    })
    expect(HarnessPtySelfCommand.resolve({ command: "harness", cwd: "/tmp/project" }, cmd)).toStrictEqual({
      command: "/tmp/bun",
      args: ["--conditions=browser", "/tmp/harness/src/index.ts", "/tmp/project"],
      cwd: "/tmp/harness",
    })
  })
})
