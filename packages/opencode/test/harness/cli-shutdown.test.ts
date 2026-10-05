import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { HarnessShutdown } from "../../src/harness/cli/shutdown"

const calls: string[] = []
const timeouts: Array<number | undefined> = []
let err: unknown
let drainCalls = 0
let exit: string | number | null | undefined

mock.module("@opencode-ai/core/global", () => ({
  Global: { Path: { data: "/tmp/harness-test" } },
}))

mock.module("@opencode-ai/core/installation/version", () => ({
  InstallationBuildKind: "release",
  InstallationVersion: "test",
}))

mock.module("@harness/harness-telemetry", () => ({
  Telemetry: {
    async init() {
      calls.push("telemetry:init")
    },
    async updateIdentity() {},
    trackCliStart() {},
    trackCliExit(code?: number) {
      calls.push(`track:${code ?? "undefined"}`)
    },
    async shutdown(timeout?: number) {
      calls.push("telemetry")
      timeouts.push(timeout)
      if (err) throw err
    },
  },
}))

mock.module("@harness/harness-gateway", () => ({
  ENV_FEATURE: "HARNESS_FEATURE",
  ENV_VERSION: "HARNESS_VERSION",
  async migrateLegacyHarnessAuth() {
    calls.push("auth:migrate")
  },
}))

mock.module("@/effect/app-runtime", () => ({
  AppRuntime: {
    async runPromise() {
      calls.push("runtime")
    },
    async dispose() {},
  },
}))

mock.module("@/harness/log", () => ({
  HarnessLog: {
    async init() {
      calls.push("log")
    },
  },
}))

mock.module("@/harness/storage/json-migration", () => ({
  JsonMigration: {
    async bootstrap() {
      calls.push("migration")
    },
  },
}))

mock.module("@/config/config", () => ({
  Config: { Service: { use: () => ({ experimental: {} }) } },
}))

mock.module("@/auth", () => ({
  Auth: { Service: { use: () => undefined } },
}))

mock.module("@/project/instance-runtime", () => ({
  InstanceRuntime: {
    async disposeAllInstances() {
      calls.push("dispose")
    },
  },
}))

mock.module("@/harness/help-command", () => ({
  createHelpCommand: () => ({ command: "help", handler() {} }),
}))

for (const path of [
  "@/harness/cli/cmd/console",
  "@/harness/cli/cmd/cloud",
  "@/harness/cli/cmd/roll-call",
  "@/harness/cli/cmd/profile",
  "@/harness/cli/cmd/daemon",
  "@/harness/cli/dev-setup",
  "@/cli/cmd/remote",
  "@/cli/cmd/config",
]) {
  mock.module(path, () => ({
    HarnessConsoleCommand: { command: "console", handler() {} },
    CloudCommand: { command: "cloud", handler() {} },
    RollCallCommand: { command: "roll-call", handler() {} },
    ProfileCommand: { command: "profile", handler() {} },
    DaemonCommand: { command: "daemon", handler() {} },
    DevSetupCommand: { command: "dev-setup", handler() {} },
    DevAliasCommand: { command: "dev-alias", handler() {} },
    RemoteCommand: { command: "remote", handler() {} },
    ConfigCommand: { command: "config", handler() {} },
  }))
}

/** Same mock body as the harness-sessions module mock used by setup.ts's drain task. */
function registerDrain() {
  HarnessShutdown.register(async () => {
    drainCalls += 1
    calls.push("drain")
  })
}

/**
 * Install a drain task for this test only. Clears any leftover registry entries first
 * (setup.ts's one-time module-scope registration, or a prior test) so assertions do not
 * depend on declaration order or on whether an earlier test already ran HarnessShutdown.run().
 */
async function installDrain() {
  await HarnessShutdown.run()
  calls.length = 0
  drainCalls = 0
  registerDrain()
}

describe("HarnessCli.shutdown", () => {
  beforeEach(() => {
    calls.length = 0
    timeouts.length = 0
    err = undefined
    drainCalls = 0
    exit = process.exitCode
    process.exitCode = undefined
  })

  afterEach(() => {
    process.exitCode = exit
  })

  test("does not load unused ingest shutdown work", async () => {
    process.exitCode = 0
    const { HarnessCli } = await import("../../src/harness/cli/setup")

    await expect(HarnessCli.shutdown()).resolves.toBeUndefined()

    expect(drainCalls).toBe(0)
    expect(timeouts).toEqual([2000])
    expect(calls).toEqual(["track:0", "telemetry", "dispose"])
    expect(process.exitCode).toBe(0)
  })

  test("keeps telemetry shutdown timeout best-effort and still disposes instances", async () => {
    err = "Timeout while shutting down PostHog. Some events may not have been sent."
    process.exitCode = 0
    const { HarnessCli } = await import("../../src/harness/cli/setup")
    await installDrain()

    await expect(HarnessCli.shutdown()).resolves.toBeUndefined()

    expect(timeouts).toEqual([2000])
    expect(calls).toEqual(["track:0", "telemetry", "drain", "dispose"])
    expect(process.exitCode).toBe(0)
  })

  test("preserves failing command exit status", async () => {
    process.exitCode = 1
    const { HarnessCli } = await import("../../src/harness/cli/setup")
    await installDrain()

    await HarnessCli.shutdown()

    expect(timeouts).toEqual([2000])
    expect(calls).toEqual(["track:1", "telemetry", "drain", "dispose"])
    expect(process.exitCode).toBe(1)
  })

  test("skips lifecycle work for parsed informational flags", async () => {
    const { HarnessCli } = await import("../../src/harness/cli/setup")
    await installDrain()

    for (const flag of ["help", "version"] as const) {
      await HarnessCli.bootstrap({ [flag]: true })
      await HarnessCli.shutdown()
    }

    expect(calls).toEqual([])
    expect(timeouts).toEqual([])
  })
})
