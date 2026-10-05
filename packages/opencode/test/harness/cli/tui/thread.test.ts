import { afterEach, describe, expect, mock, spyOn, test } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "node:url"
import { spawn, type Exit } from "@opencode-ai/core/pty/driver"
import { sanitizedProcessEnv } from "@opencode-ai/core/util/opencode-process"
import { tmpdir } from "../../../fixture/fixture"
import {
  resolveThreadDirectory,
} from "../../../../src/cli/cmd/tui"
import { preload, validate } from "../../../../src/harness/cli/cmd/tui"
import { HarnessTuiThreadDaemon } from "../../../../src/harness/cli/cmd/tui/thread"
import { DaemonClient } from "../../../../src/harness/daemon/client"

afterEach(() => {
  mock.restore()
})

describe("harness tui thread", () => {
  test("starts fresh sessions without requesting session validation", async () => {
    await expect(validate({ url: "http://127.0.0.1:0" })).resolves.toBeUndefined()
  })

  test("still rejects invalid IDs when resuming a session", async () => {
    await expect(validate({ url: "http://127.0.0.1:0", sessionID: "invalid" })).rejects.toThrow("Invalid session ID")
  })

  test("skips preload resolver invocation in compiled mode", () => {
    let calls = 0

    expect(
      preload(true, () => {
        calls++
        return "/resolved/preload"
      }),
    ).toEqual([])
    expect(calls).toBe(0)
  })

  test("resolves the preload once in source mode", () => {
    let calls = 0
    const path = "/resolved/preload"

    expect(
      preload(false, () => {
        calls++
        return path
      }),
    ).toEqual([path])
    expect(calls).toBe(1)
  })

  test(
    "starts the TUI from a directory without OpenTUI dependencies",
    async () => {
      await using root = await tmpdir()
      const state = { text: "", exit: undefined as Exit | undefined }
      const ready = Promise.withResolvers<void>()
      const stopped = Promise.withResolvers<void>()
      const proc = spawn(
        process.execPath,
        [
          "--conditions=browser",
          `--preload=${fileURLToPath(import.meta.resolve("@opentui/solid/preload"))}`,
          path.resolve(import.meta.dir, "../../../../src/index.ts"),
        ],
        {
          name: "xterm-256color",
          cols: 120,
          rows: 40,
          cwd: root.path,
          env: sanitizedProcessEnv({
            HOME: root.path,
            XDG_CONFIG_HOME: path.join(root.path, ".config"),
            XDG_DATA_HOME: path.join(root.path, ".local/share"),
            XDG_STATE_HOME: path.join(root.path, ".local/state"),
            XDG_CACHE_HOME: path.join(root.path, ".cache"),
            HARNESS_TEST_HOME: root.path,
            HARNESS_CONFIG_CONTENT: "{}",
            HARNESS_AUTH_CONTENT: "{}",
            HARNESS_DISABLE_PROJECT_CONFIG: "1",
            HARNESS_DISABLE_AUTOUPDATE: "1",
            HARNESS_DISABLE_MODELS_FETCH: "1",
            HARNESS_DISABLE_TERMINAL_TITLE: "0",
            HARNESS_DEV_CWD: "",
            HARNESS_PURE: "1",
            HARNESS_NO_DAEMON: "1",
            TERM: "xterm-256color",
          }),
        },
      )
      const data = proc.onData((chunk) => {
        state.text = (state.text + chunk).slice(-20_000)
        if (state.text.includes("TUI worker error")) {
          ready.reject(new Error(`TUI worker failed during startup:\n${state.text}`))
          return
        }
        // The title is emitted only after the worker-backed TUI reaches its rendered app.
        if (state.text.includes("Harness CLI")) ready.resolve()
      })
      const exit = proc.onExit((event) => {
        state.exit = event
        stopped.resolve()
        ready.reject(
          new Error(
            `TUI exited before rendering (code ${event.exitCode}, signal ${event.signal ?? "none"}):\n${state.text}`,
          ),
        )
      })
      const timer = setTimeout(() => {
        ready.reject(new Error(`Timed out waiting for the TUI to render:\n${state.text}`))
      }, 30_000)

      try {
        await ready.promise
        expect(state.text).toContain("Harness CLI")
      } finally {
        clearTimeout(timer)
        data.dispose()
        if (!state.exit) proc.kill()
        await stopped.promise
        exit.dispose()
      }
    },
    45_000,
  )

  test("ignores stale PWD after cwd is changed by a process wrapper", async () => {
    await using root = await tmpdir()
    const pkg = path.join(root.path, "packages", "opencode")
    await fs.mkdir(pkg, { recursive: true })

    expect(resolveThreadDirectory(".", root.path, pkg)).toBe(pkg)
  })

  test("uses harness-dev caller directory when running through package cwd", async () => {
    await using root = await tmpdir()
    const pkg = path.join(root.path, "packages", "opencode")
    await fs.mkdir(pkg, { recursive: true })

    const prev = process.env.HARNESS_DEV_CWD
    process.env.HARNESS_DEV_CWD = root.path
    try {
      expect(resolveThreadDirectory(".", root.path, pkg)).toBe(root.path)
      expect(resolveThreadDirectory(undefined, root.path, pkg)).toBe(root.path)
    } finally {
      if (prev === undefined) delete process.env.HARNESS_DEV_CWD
      else process.env.HARNESS_DEV_CWD = prev
    }
  })

})
