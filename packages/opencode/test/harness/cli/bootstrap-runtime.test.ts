import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { HarnessCli } from "../../../src/harness/cli/setup"
import { createHelpCommand } from "../../../src/harness/help-command"
import { resetLazyCommandSelection } from "../../../src/harness/cli/lazy-commands"
import yargs from "yargs"

describe("CLI bootstrap runtime selection", () => {
  beforeEach(resetLazyCommandSelection)
  afterEach(resetLazyCommandSelection)

  test("uses the narrow runtime for worker-backed TUI launches", () => {
    expect(HarnessCli.workerTui({ _: [] })).toBe(true)
    expect(HarnessCli.workerTui({ _: ["./project"] })).toBe(true)
  })

  test("keeps full bootstrap for explicit, mini, and worktree commands", () => {
    expect(HarnessCli.workerTui({ _: [], mini: true })).toBe(false)
    expect(HarnessCli.workerTui({ _: [], worktree: "feature" })).toBe(false)
  })

  test("keeps full bootstrap when the eager help command is selected", () => {
    const command = createHelpCommand()
    if (typeof command.builder !== "function") throw new Error("help builder is not a function")
    command.builder(yargs([]))
    expect(HarnessCli.workerTui({ _: [] })).toBe(false)
  })
})
