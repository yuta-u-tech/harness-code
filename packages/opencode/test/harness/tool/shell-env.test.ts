import { expect } from "bun:test"
import { Effect, Layer } from "effect"
import type * as Scope from "effect/Scope"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Agent } from "@/agent/agent"
import { Config } from "@/config/config"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { Plugin } from "@/plugin"
import { MessageID, SessionID } from "@/session/schema"
import { ShellTool } from "@/tool/shell"
import { Truncate } from "@/tool/truncate"
import type { Tool } from "@/tool/tool"
import { InstanceStore } from "@/project/instance-store"
import { provideInstance, testInstanceStoreLayer, tmpdirScoped } from "../../fixture/fixture"
import { testEffect } from "../../lib/effect"

const layer = Layer.mergeAll(
  AppNodeBuilder.build(CrossSpawnSpawner.node),
  AppNodeBuilder.build(FSUtil.node),
  AppNodeBuilder.build(Plugin.node),
  AppNodeBuilder.build(Truncate.node),
  AppNodeBuilder.build(Config.node),
  AppNodeBuilder.build(Agent.node),
  AppNodeBuilder.build(RuntimeFlags.node),
  testInstanceStoreLayer,
)
const it = testEffect(layer)
type Services =
  | (typeof layer extends Layer.Layer<infer ROut, infer _E, infer _RIn> ? ROut : never)
  | InstanceStore.Service
  | Scope.Scope

const ctx = {
  sessionID: SessionID.make("ses_shell_env"),
  messageID: MessageID.make("msg_shell_env"),
  callID: "",
  agent: "code",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => Effect.void,
  ask: () => Effect.void,
}

const run = Effect.fn("ShellEnvTest.run")(function* (args: Tool.InferParameters<typeof ShellTool>) {
  const info = yield* ShellTool
  const tool = yield* info.init()
  return yield* tool.execute(args, ctx)
})

it.effect("does not expose backend credentials or config to model shell commands", () =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const values = {
        password: process.env.HARNESS_SERVER_PASSWORD,
        username: process.env.HARNESS_SERVER_USERNAME,
        config: process.env.HARNESS_CONFIG,
        content: process.env.HARNESS_CONFIG_CONTENT,
        directory: process.env.HARNESS_CONFIG_DIR,
        broker: process.env.HARNESS_BROWSER_BROKER_URL,
        token: process.env.HARNESS_BROWSER_BROKER_TOKEN,
      }
      process.env.HARNESS_SERVER_PASSWORD = "secret"
      process.env.HARNESS_SERVER_USERNAME = "harness"
      process.env.HARNESS_CONFIG = "/secret/config.json"
      process.env.HARNESS_CONFIG_CONTENT = '{"provider":{"apiKey":"secret"}}'
      process.env.HARNESS_CONFIG_DIR = "/secret/config"
      process.env.HARNESS_BROWSER_BROKER_URL = "http://127.0.0.1:4321"
      process.env.HARNESS_BROWSER_BROKER_TOKEN = "browser-secret"
      return values
    }),
    () =>
      tmpdirScoped().pipe(
        Effect.flatMap((tmp) =>
          provideInstance(tmp)(
            run({
              command:
                process.platform === "win32"
                  ? "if ($env:HARNESS_SERVER_PASSWORD -or $env:HARNESS_SERVER_USERNAME -or $env:HARNESS_CONFIG -or $env:HARNESS_CONFIG_CONTENT -or $env:HARNESS_CONFIG_DIR -or $env:HARNESS_BROWSER_BROKER_URL -or $env:HARNESS_BROWSER_BROKER_TOKEN) { 'set' } else { 'unset' }"
                  : 'test -z "$HARNESS_SERVER_PASSWORD" && test -z "$HARNESS_SERVER_USERNAME" && test -z "$HARNESS_CONFIG" && test -z "$HARNESS_CONFIG_CONTENT" && test -z "$HARNESS_CONFIG_DIR" && test -z "$HARNESS_BROWSER_BROKER_URL" && test -z "$HARNESS_BROWSER_BROKER_TOKEN" && printf unset',
              description: "Check backend credential isolation",
            }),
          ),
        ),
        Effect.map((result) => expect(result.output.trim()).toBe("unset")),
      ) as Effect.Effect<void, never, Services>,
    (values) =>
      Effect.sync(() => {
        if (values.password === undefined) delete process.env.HARNESS_SERVER_PASSWORD
        else process.env.HARNESS_SERVER_PASSWORD = values.password
        if (values.username === undefined) delete process.env.HARNESS_SERVER_USERNAME
        else process.env.HARNESS_SERVER_USERNAME = values.username
        if (values.config === undefined) delete process.env.HARNESS_CONFIG
        else process.env.HARNESS_CONFIG = values.config
        if (values.content === undefined) delete process.env.HARNESS_CONFIG_CONTENT
        else process.env.HARNESS_CONFIG_CONTENT = values.content
        if (values.directory === undefined) delete process.env.HARNESS_CONFIG_DIR
        else process.env.HARNESS_CONFIG_DIR = values.directory
        if (values.broker === undefined) delete process.env.HARNESS_BROWSER_BROKER_URL
        else process.env.HARNESS_BROWSER_BROKER_URL = values.broker
        if (values.token === undefined) delete process.env.HARNESS_BROWSER_BROKER_TOKEN
        else process.env.HARNESS_BROWSER_BROKER_TOKEN = values.token
      }),
  ),
)
