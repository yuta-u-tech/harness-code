import { expect, test } from "bun:test"
import { cliCommand } from "../../src/cli/cmd/pr"

test("cliCommand uses the current script when argv[1] is a file path", () => {
  const result = cliCommand({
    execPath: "/usr/bin/node",
    argv: ["/usr/bin/node", "/tmp/harness.js", "pr", "1"],
    exists: (file) => file === "/tmp/harness.js",
  })

  expect(result).toEqual(["/usr/bin/node", "/tmp/harness.js"])
})

test("cliCommand falls back to execPath when argv[1] is a subcommand", () => {
  const result = cliCommand({
    execPath: "/usr/local/bin/harness",
    argv: ["/usr/local/bin/harness", "pr", "1"],
    exists: () => false,
  })

  expect(result).toEqual(["/usr/local/bin/harness"])
})

test("cliCommand ignores subcommand token even when it exists on disk", () => {
  const result = cliCommand({
    execPath: "/usr/local/bin/harness",
    argv: ["/usr/local/bin/harness", "pr", "1"],
    exists: (file) => file === "pr",
  })

  expect(result).toEqual(["/usr/local/bin/harness"])
})

test("cliCommand falls back to execPath when argv[1] is missing", () => {
  const result = cliCommand({
    execPath: "/usr/local/bin/harness",
    argv: ["/usr/local/bin/harness"],
    exists: () => false,
  })

  expect(result).toEqual(["/usr/local/bin/harness"])
})

test("cliCommand falls back to execPath for bun virtual script paths", () => {
  const unix = cliCommand({
    execPath: "/tmp/harness",
    argv: ["/tmp/harness", "/$bunfs/root/src/index.js", "pr", "1"],
    exists: () => true,
  })

  const win = cliCommand({
    execPath: "C:/tmp/harness.exe",
    argv: ["C:/tmp/harness.exe", "B:/~BUN/root/src/index.js", "pr", "1"],
    exists: () => true,
  })

  expect(unix).toEqual(["/tmp/harness"])
  expect(win).toEqual(["C:/tmp/harness.exe"])
})
