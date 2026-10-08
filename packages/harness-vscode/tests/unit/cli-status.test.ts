import { describe, expect, it } from "bun:test"
import { allCliStatus, claudeSignedIn, cliStatus, codexSignedIn } from "../../src/harness-provider/handlers/cli-status"

const ok = (stdout: string) => () => Promise.resolve({ stdout, stderr: "" })
const fail = (code: string | number) => () => Promise.reject(Object.assign(new Error("x"), { code }))

describe("cli status", () => {
  it("reads sign-in from each CLI's own output", () => {
    expect(codexSignedIn("Logged in using ChatGPT")).toBe(true)
    expect(codexSignedIn("Not logged in")).toBe(false)
    expect(claudeSignedIn('{"loggedIn": true, "authMethod": "claude.ai"}')).toBe(true)
    expect(claudeSignedIn('{"loggedIn": false}')).toBe(false)
    expect(claudeSignedIn("not json")).toBe(false)
  })

  it("reports a missing CLI as not installed", async () => {
    expect(await cliStatus("codex", fail("ENOENT"))).toEqual({ installed: false, signedIn: false })
  })

  it("treats a failing status command as installed but signed out", async () => {
    expect(await cliStatus("claude", fail(1))).toEqual({ installed: true, signedIn: false })
  })

  it("checks both CLIs", async () => {
    const run = (cmd: string) => (cmd === "codex" ? ok("Logged in using ChatGPT")() : ok('{"loggedIn": false}')())
    expect(await allCliStatus(run)).toEqual({
      codex: { installed: true, signedIn: true },
      claude: { installed: true, signedIn: false },
    })
  })
})
