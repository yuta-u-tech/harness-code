import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { httpClient } from "@opencode-ai/core/effect/app-node-platform"
import { serviceUse } from "@opencode-ai/core/effect/service-use"
import path from "path"
import { pathToFileURL } from "url"
import os from "os"
import { mergeDeep } from "remeda"
import { Global } from "@opencode-ai/core/global"
import fsNode from "fs/promises"
import { Flag } from "@opencode-ai/core/flag/flag"
import { notices } from "@opencode-ai/core/harness/fff"
import { Auth } from "../auth"
import { Env } from "../env"
import { applyEdits, findNodeAtLocation, modify, parseTree } from "jsonc-parser"
import { InstallationLocal, InstallationVersion } from "@opencode-ai/core/installation/version"
import { existsSync } from "fs"
import { GlobalBus } from "@/bus/global"
import { Event } from "../server/event"
import { Account } from "@/account/account"
import { isRecord } from "@/util/record"
import type { ConsoleState } from "@opencode-ai/core/v1/config/console-state"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { InstanceState } from "@/effect/instance-state"
import { Context, Duration, Effect, Fiber, Layer, Option, Schema } from "effect"
import { HttpClient, HttpClientRequest } from "effect/unstable/http"
import { EffectFlock } from "@opencode-ai/core/util/effect-flock"
import { containsPath, type InstanceContext } from "../project/instance-context"
import { ConfigV1 } from "@opencode-ai/core/v1/config/config"
import { RemoteAuthError } from "@opencode-ai/core/v1/config/error"
import { ConfigPermissionV1 } from "@opencode-ai/core/v1/config/permission"
import { ConfigPluginV1 } from "@opencode-ai/core/v1/config/plugin"
import { ConfigAgent } from "./agent"
import { ConfigCommand } from "./command"
import { ConfigManaged } from "./managed"
import { ConfigParse } from "./parse"
import { ConfigPaths } from "./paths"
import { ConfigPlugin } from "./plugin"
import { ConfigVariable } from "./variable"
import { ConfigV2Compat } from "./v2-compat"
import { Npm } from "@opencode-ai/core/npm"
import z from "zod"
import { ZodOverride } from "@opencode-ai/core/effect-zod"
import { HarnessConfig } from "../harness/config/config"
import { Excess } from "../harness/config/excess"
import { sanitizeProjectMcpHeaders } from "../harness/config/mcp-headers"
import { primaryPaths } from "../harness/primary-worktree"
import { Git } from "@/git"
import { HarnessDefaultPlugins } from "@/harness/config/default-plugins"
import { HarnessGlobalConfigStamp } from "@/harness/config/global-stamp"
import { SandboxConfig } from "@/harness/sandbox/config"
import { ExternalMarkdown } from "@/harness/config/external-markdown"
import { ClaudeMigration } from "@/harness/config/claude-migration"
import type { HarnessMarkdown } from "@/harness/config/markdown"
import {
  IndexingConfig as HarnessIndexingConfig,
  IndexingSchema as HarnessIndexingSchema,
} from "@harness/harness-indexing/config"
import { unique } from "remeda"
import { installLocalPluginDependency, needsLocalPluginDependency } from "@/harness/config/plugin-deps"
import { withTransientReadRetry } from "@/util/effect-http-client"
import * as Log from "@opencode-ai/core/util/log"

const log = Log.create({ service: "config" })

// Custom merge function that concatenates array fields instead of replacing them
// Keep remeda's deep conditional merge type out of hot config-loading paths; TS profiling showed it dominates here.
function mergeConfig(target: Info, source: Info): Info {
  return mergeDeep(target, source) as Info
}

function mergeConfigConcatArrays(target: Info, source: Info, trusted = true): Info {
  const merged = trusted ? mergeConfig(target, source) : HarnessConfig.mergeProject(target, source)
  if (target.instructions && source.instructions) {
    merged.instructions = Array.from(new Set([...target.instructions, ...source.instructions]))
  }
  return merged
}

function normalizeLoadedConfig(data: unknown, source: string) {
  if (!isRecord(data)) return data
  const copy = HarnessConfig.retireExperimentalFlags({ ...data }, source)
  const hadLegacy = "theme" in copy || "keybinds" in copy || "tui" in copy
  if (!hadLegacy) return copy
  delete copy.theme
  delete copy.keybinds
  delete copy.tui
  log.warn("tui keys in the main config are deprecated; move them to tui.json", { path: source })
  return copy
}

export const Warning = z.object({
  path: z.string(),
  message: z.string(),
  detail: z.string().optional(),
})
export type Warning = z.infer<typeof Warning>

const { caught: caughtWarning } = HarnessConfig

async function substituteWellKnownRemoteConfig(input: {
  value: unknown
  dir: string
  source: string
  env: Record<string, string>
}) {
  if (!isRecord(input.value) || typeof input.value.url !== "string") return undefined

  const url = await ConfigVariable.substitute({
    text: input.value.url,
    type: "virtual",
    dir: input.dir,
    source: input.source,
    env: input.env,
    trusted: true,
  })
  const headers = isRecord(input.value.headers)
    ? Object.fromEntries(
        await Promise.all(
          Object.entries(input.value.headers)
            .filter((entry): entry is [string, string] => typeof entry[1] === "string")
            .map(async ([key, value]) => [
              key,
              await ConfigVariable.substitute({
                text: value,
                type: "virtual",
                dir: input.dir,
                source: input.source,
                env: input.env,
                trusted: true,
              }),
            ]),
        ),
      )
    : undefined

  return { url, headers }
}

async function resolveLoadedPlugins<T extends { plugin?: ConfigPluginV1.Spec[] }>(config: T, filepath: string) {
  if (!config.plugin) return config
  for (let i = 0; i < config.plugin.length; i++) {
    // Normalize path-like plugin specs while we still know which config file declared them.
    // This prevents `./plugin.ts` from being reinterpreted relative to some later merge location.
    config.plugin[i] = await ConfigPlugin.resolvePluginSpec(config.plugin[i], filepath)
  }
  return config
}

export type Info = ConfigV1.Info & {
  // plugin_origins is derived state, not a persisted config field. It keeps each winning plugin spec together
  // with the file and scope it came from so later runtime code can make location-sensitive decisions.
  plugin_origins?: ConfigPlugin.Origin[]
  instruction_origins?: Record<string, HarnessMarkdown.Source>
  skill_path_origins?: Record<string, HarnessMarkdown.Source>
  // derived provenance for permission patterns: which config scope (global XDG vs local project)
  // last set each permission + pattern. Keyed per pattern (not just per key) because global and
  // project config can contribute different patterns under the same key. Lets the runtime explain
  // why a tool call was auto-approved.
  permission_origins?: Record<string, Record<string, "global" | "local">>
}

export const Info = ConfigV1.Info

type State = {
  config: Info
  directories: string[]
  deps: Fiber.Fiber<void>[]
  warnings: Warning[]
  consoleState: ConsoleState
}

export interface Interface {
  readonly get: () => Effect.Effect<Info>
  readonly getGlobal: () => Effect.Effect<Info>
  readonly getConsoleState: () => Effect.Effect<ConsoleState>
  readonly update: (config: Info) => Effect.Effect<void>
  readonly updateGlobal: (
    config: Info,
    options?: { dispose?: boolean },
  ) => Effect.Effect<{ info: Info; changed: boolean }>
  readonly invalidate: () => Effect.Effect<void>
  readonly directories: () => Effect.Effect<string[]>
  readonly waitForDependencies: () => Effect.Effect<void>
  readonly warnings: () => Effect.Effect<Warning[]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Config") {}

export const use = serviceUse(Service)

function globalConfigFile() {
  const candidates = ["harness.jsonc", "harness.json", "opencode.jsonc", "opencode.json", "config.json"].map((file) =>
    path.join(Global.Path.config, file),
  )
  for (const file of candidates) {
    if (existsSync(file)) return file
  }
  return candidates[0]
}

function patchJsonc(input: string, patch: unknown, path: string[] = []): string {
  if (!isRecord(patch)) {
    // parent does not exist in the document; absent keys are already "unset"
    if (patch === null) {
      const tree = parseTree(input)
      if (!tree || !findNodeAtLocation(tree, path)) return input
    }
    const edits = modify(input, path, patch === null ? undefined : patch, {
      formattingOptions: {
        insertSpaces: true,
        tabSize: 2,
      },
    })
    return applyEdits(input, edits)
  }

  // scalar (e.g. permission.bash is "ask" as a string), jsonc-parser cannot
  // add child keys to it. Detect this case and replace the whole node with
  // the patch object in a single modify() call instead of recursing.
  // For permission keys, promote the scalar to { "*": scalarValue } so the
  // wildcard default is preserved. For other keys, replace directly.
  if (path.length > 0) {
    const tree = parseTree(input)
    const node = tree && findNodeAtLocation(tree, path)
    if (node && node.type !== "object") {
      const isPermissionKey = path[0] === "permission" && path.length === 2
      const replacement = isPermissionKey ? { "*": node.value, ...patch } : patch
      const edits = modify(input, path, replacement, {
        formattingOptions: { insertSpaces: true, tabSize: 2 },
      })
      return applyEdits(input, edits)
    }
  }

  return Object.entries(patch).reduce((result, [key, value]) => patchJsonc(result, value, [...path, key]), input)
}

function writable(info: Info) {
  const {
    plugin_origins: _plugin_origins,
    instruction_origins: _instruction_origins,
    skill_path_origins: _skill_path_origins,
    permission_origins: _permission_origins,
    ...next
  } = info
  return next
}

function writableGlobal(info: Info) {
  const next = writable(info)
  // When a user changes config from a value back to default in the Desktop app, we don't want to leave a blank `"shell": "",` key
  if ("shell" in next && next.shell === "") return { ...next, shell: undefined }
  return next
}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const authSvc = yield* Auth.Service
    const accountSvc = yield* Account.Service
    const env = yield* Env.Service
    const npmSvc = yield* Npm.Service
    const http = yield* HttpClient.HttpClient
    const git = yield* Git.Service
    const flock = yield* EffectFlock.Service

    const readConfigFile = (filepath: string) => fs.readFileStringSafe(filepath).pipe(Effect.orDie)

    const decodeConfig = Effect.fnUntraced(function* (input: unknown, source: string) {
      const result = ConfigV2Compat.lower(normalizeLoadedConfig(input, source), source)
      yield* Effect.forEach(result.diagnostics, (diagnostic) =>
        Effect.logWarning("configuration compatibility diagnostic", {
          source,
          path: diagnostic.path,
          kind: diagnostic.kind,
          action: diagnostic.message,
        }),
      )
      return ConfigParse.schema(ConfigV1.Info, result.value, source)
    })

    const fetchRemoteJson = Effect.fnUntraced(function* <S extends Schema.Top>(
      url: string,
      headers: Record<string, string> | undefined,
      schema: S,
      loginOrigin: string,
    ) {
      const response = yield* HttpClient.filterStatusOk(withTransientReadRetry(http))
        .execute(
          HttpClientRequest.get(url).pipe(HttpClientRequest.acceptJson, HttpClientRequest.setHeaders(headers ?? {})),
        )
        .pipe(
          Effect.catch((error) => Effect.die(new Error(`failed to fetch remote config from ${url}: ${String(error)}`))),
        )
      const body = yield* response.text.pipe(
        Effect.catch((error) => Effect.die(new Error(`failed to read remote config from ${url}: ${String(error)}`))),
      )
      // An auth proxy can answer with an HTML login page at HTTP 200 (passes filterStatusOk); treat it as a re-auth error, not a decode failure.
      const contentType = (response.headers["content-type"] ?? "").toLowerCase()
      if (contentType.includes("html") || /^\s*<!doctype|^\s*<html/i.test(body)) {
        return yield* Effect.die(new RemoteAuthError({ url: loginOrigin, remote: url }))
      }
      return yield* Schema.decodeEffect(Schema.fromJsonString(schema))(body).pipe(
        Effect.catch((error) => Effect.die(new Error(`failed to decode remote config from ${url}: ${String(error)}`))),
      )
    })

    const loadConfig = Effect.fnUntraced(function* (
      text: string,
      options: { path: string; original?: string } | { dir: string; source: string },
      env?: Record<string, string>,
      trusted?: boolean,
      fileScope?: ConfigVariable.FileScope,
      configWarnings?: Warning[],
    ) {
      const source = "path" in options ? options.path : options.source
      const expanded = yield* Effect.promise(() =>
        ConfigVariable.substitute(
          "path" in options
            ? { text, type: "path", path: options.path, env, trusted, fileScope }
            : { text, type: "virtual", ...options, env, trusted, fileScope },
        ),
      )
      const parsed = ConfigParse.jsonc(expanded, source)
      const normalized = normalizeLoadedConfig(parsed, source)
      if (configWarnings) {
        // Warn for keys the V1 decoder drops and the V2 lowering does not consume. Probe the lowering
        // with only that key so the answer does not depend on the rest of the document, and treat a key
        // as consumed when the lowering adds a legacy counterpart for it.
        const consumed = (key: string, value: unknown) => {
          const lowered = ConfigV2Compat.lower({ [key]: value }, source).value
          return isRecord(lowered) && Object.keys(lowered).some((candidate) => candidate !== key)
        }
        const record = normalized as Record<string, unknown>
        const keys = Excess.keys(ConfigV1.Info, normalized).filter((key) => !consumed(key, record[key]))
        if (keys.length) {
          const detail = Excess.issue(keys)
          configWarnings.push({
            path: source,
            message: `Configuration is invalid at ${source}: ${detail}`,
            detail,
          })
        }
      }
      const data = yield* decodeConfig(normalized, source)
      if (!("path" in options)) return data

      yield* Effect.promise(() => resolveLoadedPlugins(data, options.path))
      return data
    })

    const loadFile = Effect.fnUntraced(function* (
      filepath: string,
      env?: Record<string, string>,
      trusted?: boolean,
      fileScope?: ConfigVariable.FileScope,
      configWarnings?: Warning[],
    ) {
      yield* Effect.logInfo("loading", { path: filepath })
      const text = yield* readConfigFile(filepath)
      if (!text) return {} as Info
      const sanitized =
        trusted === false ? sanitizeProjectMcpHeaders(ConfigParse.jsonc(text, filepath), filepath) : undefined
      const content = sanitized ? (JSON.stringify(sanitized.config) ?? text) : text
      if (sanitized && configWarnings) configWarnings.push(...sanitized.warnings)
      const data = yield* loadConfig(
        content,
        { path: filepath, original: text },
        trusted === false ? undefined : env,
        trusted,
        fileScope,
        configWarnings,
      )
      return data
    })

    let globalStamp = ""

    const loadGlobal = Effect.fnUntraced(function* (
      env?: Record<string, string>,
      configWarnings?: Warning[],
    ) {
      yield* Effect.promise(() => HarnessConfig.migrateBashPermission())
      if (Flag.HARNESS_EXPERIMENTAL_CLAUDE_MIGRATION && !ClaudeMigration.unsupportedContext()) {
        yield* flock
          .withLock(
            Effect.promise(() => ClaudeMigration.run({ enabled: true })),
            `config:global:${path.resolve(Global.Path.config)}`,
          )
          .pipe(
            Effect.catchCause((cause) =>
              Effect.logWarning("Claude Code configuration migration failed", { error: String(cause) }).pipe(
                Effect.as(undefined),
              ),
            ),
          )
      }
      globalStamp = yield* HarnessGlobalConfigStamp.read(fs, Global.Path.config)
      let result: Info = {}
      result = mergeConfig(
        result,
        yield* loadFile(path.join(Global.Path.config, "config.json"), env, true, undefined, configWarnings),
      )
      result = mergeConfig(
        result,
        yield* loadFile(path.join(Global.Path.config, "harness.json"), env, true, undefined, configWarnings),
      )
      result = mergeConfig(
        result,
        yield* loadFile(path.join(Global.Path.config, "harness.jsonc"), env, true, undefined, configWarnings),
      )
      result = mergeConfig(
        result,
        yield* loadFile(path.join(Global.Path.config, "opencode.json"), env, true, undefined, configWarnings),
      )
      result = mergeConfig(
        result,
        yield* loadFile(path.join(Global.Path.config, "opencode.jsonc"), env, true, undefined, configWarnings),
      )

      const legacy = path.join(Global.Path.config, "config")
      if (existsSync(legacy)) {
        yield* Effect.promise(() =>
          import(pathToFileURL(legacy).href, { with: { type: "toml" } })
            .then(async (mod) => {
              const { provider, model, ...rest } = mod.default
              if (provider && model) result.model = `${provider}/${model}`
              result = mergeConfig(result, rest)
              await fsNode.writeFile(path.join(Global.Path.config, "config.json"), JSON.stringify(result, null, 2))
              await fsNode.unlink(legacy)
            })
            .catch(() => {}),
        )
      }

      globalStamp = yield* HarnessGlobalConfigStamp.read(fs, Global.Path.config)
      return result
    })

    const loadGlobalState = Effect.fnUntraced(function* (env?: Record<string, string>) {
      const warnings: Warning[] = []
      const config = yield* loadGlobal(env, warnings)
      return { config, warnings }
    })

    const [cachedGlobal, invalidateGlobal] = yield* Effect.cachedInvalidateWithTTL(
      loadGlobalState().pipe(
        Effect.tapError((error) =>
          Effect.logError("failed to load global config, using defaults", { error: String(error) }),
        ),
        Effect.orElseSucceed(() => ({ config: {} as Info, warnings: [] as Warning[] })),
      ),
      Duration.infinity,
    )

    const refreshGlobal = Effect.fnUntraced(function* () {
      const stamp = yield* HarnessGlobalConfigStamp.read(fs, Global.Path.config)
      if (!globalStamp || stamp === globalStamp) return false
      // Keep globalStamp tied to config that loadGlobal completed. Advancing it
      // before invalidation reloads can hide a stale cached value from the next check.
      yield* invalidateGlobal
      return true
    })

    const getGlobalState = Effect.fnUntraced(function* () {
      yield* refreshGlobal()
      return yield* cachedGlobal
    })

    const getGlobal = Effect.fn("Config.getGlobal")(function* () {
      return (yield* getGlobalState()).config
    })

    const ensureGitignore = Effect.fn("Config.ensureGitignore")(function* (dir: string) {
      yield* fs.ensureDir(dir).pipe(Effect.catchTag("PlatformError", () => Effect.void))
      const gitignore = path.join(dir, ".gitignore")
      const hasIgnore = yield* fs.existsSafe(gitignore)
      if (!hasIgnore) {
        yield* fs
          .writeFileString(
            gitignore,
            [
              "node_modules",
              "package.json",
              "package-lock.json",
              "pnpm-lock.yaml",
              "bun.lock",
              "yarn.lock",
              ".gitignore",
              "agent-manager.json",
            ].join("\n"),
          )
          .pipe(Effect.catchTag("PlatformError", () => Effect.void))
      }
    })

    const loadInstanceState = Effect.fn("Config.loadInstanceState")(
      function* (ctx: InstanceContext) {
        const warnings: Warning[] = notices(ctx.directory)
        // Untrusted project config may only read files inside this root (worktree, or directory for non-git projects).
        const projectRoot = ctx.worktree === "/" ? ctx.directory : ctx.worktree
        const auth = yield* authSvc.all().pipe(Effect.orDie)

        let result: Info = {}
        const legacy = yield* Effect.promise(() =>
          HarnessConfig.loadLegacyConfigs({
            projectDir: ctx.directory,
            merge: mergeConfigConcatArrays,
          }),
        )
        result = mergeConfigConcatArrays(result, legacy.config)
        // Legacy rules are discovered from fixed global/project directories, so their paths safely identify the
        // source boundary even though the migrator returns them as one merged instruction list.
        result.instruction_origins = Object.fromEntries(
          (legacy.config.instructions ?? []).map((item) => {
            const trusted = !containsPath(item, ctx)
            return [item, { trusted, source: item, root: trusted ? undefined : projectRoot }]
          }),
        )
        warnings.push(...legacy.warnings)

        let configuredAgents = { ...(result.agent ?? {}) }

        const authEnv: Record<string, string> = {}
        const consoleManagedProviders = new Set<string>()
        let activeOrgName: string | undefined

        const pluginScopeForSource = Effect.fnUntraced(function* (source: string) {
          if (source.startsWith("http://") || source.startsWith("https://")) return "global"
          if (source === "HARNESS_CONFIG_CONTENT") return "local"
          if (containsPath(source, ctx)) return "local"
          return "global"
        })

        const mergePluginOrigins = Effect.fnUntraced(function* (
          source: string,
          // mergePluginOrigins receives raw Specs from one config source, before provenance for this merge step
          // is attached.
          list: ConfigPluginV1.Spec[] | undefined,
          // Scope can be inferred from the source path, but some callers already know whether the config should
          // behave as global or local and can pass that explicitly.
          kind?: ConfigPlugin.Scope,
        ) {
          if (!list?.length) return
          const hit = kind ?? (yield* pluginScopeForSource(source))
          // Merge newly seen plugin origins with previously collected ones, then dedupe by plugin identity while
          // keeping the winning source/scope metadata for downstream installs, writes, and diagnostics.
          const plugins = ConfigPlugin.deduplicatePluginOrigins([
            ...(result.plugin_origins ?? []),
            ...list.map((spec) => ({ spec, source, scope: hit })),
          ])
          result.plugin = plugins.map((item) => item.spec)
          result.plugin_origins = plugins
        })

        const origins = (
          prev: Record<string, HarnessMarkdown.Source> | undefined,
          values: readonly string[],
          trusted: boolean,
          source: string,
        ) => {
          const result = { ...prev }
          for (const value of values) {
            if (result[value]?.trusted) continue
            result[value] = { trusted, source, root: trusted ? undefined : projectRoot }
          }
          return result
        }

        const merge = Effect.fnUntraced(function* (
          source: string,
          next: Info,
          kind?: ConfigPlugin.Scope,
          sourceTrusted?: boolean,
        ) {
          const scope = kind ?? (yield* pluginScopeForSource(source))
          const trusted = sourceTrusted ?? scope === "global"
          const scoped = HarnessConfig.scopeIndexing(SandboxConfig.scope(next, scope), scope)
          result = mergeConfigConcatArrays(result, scoped, trusted)
          if (scoped.agent) configuredAgents = mergeDeep(configuredAgents, scoped.agent)
          if (next.instructions?.length) {
            result.instruction_origins = origins(result.instruction_origins, next.instructions, trusted, source)
          }
          if (next.skills?.paths?.length) {
            result.skill_path_origins = origins(result.skill_path_origins, next.skills.paths, trusted, source)
          }
          // record which scope last set each permission + pattern. A scalar value (e.g. bash: "allow")
          // maps to pattern "*"; an object records each of its patterns. Global and project config can
          // contribute different patterns under one key, so track per pattern; later merges win.
          if (scoped.permission && typeof scoped.permission === "object") {
            const map = { ...result.permission_origins }
            for (const [key, value] of Object.entries(scoped.permission)) {
              if (value === null) continue
              const patterns = typeof value === "string" ? { "*": value } : value
              const inner = { ...map[key] }
              for (const [pattern, action] of Object.entries(patterns)) {
                if (action === null) continue
                inner[pattern] = scope
              }
              map[key] = inner
            }
            result.permission_origins = map
          }
          return yield* mergePluginOrigins(source, scoped.plugin, scope)
        })

        for (const [key, value] of Object.entries(auth)) {
          if (value.type === "wellknown") {
            const url = key.replace(/\/+$/, "")
            authEnv[value.key] = value.token
            const wellknownURL = `${url}/.well-known/opencode`
            const source = wellknownURL
            yield* Effect.gen(function* () {
              yield* Effect.logDebug("fetching remote config", { url: wellknownURL })
              const wellknown = yield* fetchRemoteJson(wellknownURL, undefined, ConfigV1.WellKnown, url)
              const remote = yield* Effect.promise(() =>
                substituteWellKnownRemoteConfig({
                  value: wellknown.remote_config,
                  dir: url,
                  source: wellknownURL,
                  env: authEnv,
                }),
              )
              const fetchedConfig = remote
                ? yield* Effect.gen(function* () {
                    yield* Effect.logDebug("fetching remote config", { url: remote.url })
                    const data = yield* fetchRemoteJson(remote.url, remote.headers, Schema.Json, url)
                    if (isRecord(data) && isRecord(data.config)) return data.config
                    if (isRecord(data)) return data
                    return yield* Effect.die(
                      new Error(`failed to decode remote config from ${remote.url}: expected object`),
                    )
                  })
                : {}
              const remoteConfig = mergeConfig(isRecord(wellknown.config) ? wellknown.config : {}, fetchedConfig)
              const next = yield* loadConfig(
                JSON.stringify(remoteConfig),
                {
                  dir: path.dirname(source),
                  source,
                },
                authEnv,
                true,
                undefined,
                warnings,
              )
              yield* merge(source, next, "global")
              yield* Effect.logDebug("loaded remote config from well-known", { url })
            }).pipe(
              Effect.catch((err: unknown) => {
                caughtWarning(warnings, source, err)
                return Effect.logWarning("skipped remote config due to error", { url, err })
              }),
              Effect.catchDefect((err: unknown) => {
                caughtWarning(warnings, source, err)
                return Effect.logWarning("skipped remote config due to error", { url, err })
              }),
            )
          }
        }

        const global = yield* (
          Object.keys(authEnv).length
            ? loadGlobal(authEnv, warnings)
            : Effect.gen(function* () {
                const state = yield* getGlobalState()
                warnings.push(...state.warnings)
                return state.config
              })
        ).pipe(
          Effect.catchDefect((err: unknown) => {
            caughtWarning(warnings, "global config", err)
            return Effect.succeed({} as Info)
          }),
        )

        yield* merge(Global.Path.config, global, "global")

        if (Flag.HARNESS_CONFIG) {
          yield* merge(
            Flag.HARNESS_CONFIG,
            yield* loadFile(Flag.HARNESS_CONFIG, authEnv, true, undefined, warnings).pipe(
              Effect.catchDefect((err: unknown) => {
                caughtWarning(warnings, Flag.HARNESS_CONFIG!, err)
                return Effect.succeed({} as Info)
              }),
            ),
            undefined,
            true,
          )
          yield* Effect.logDebug("loaded custom config", { path: Flag.HARNESS_CONFIG })
        }

        if (!Flag.HARNESS_DISABLE_PROJECT_CONFIG) {
          for (const name of ["harness", "opencode"] as const) {
            for (const file of yield* ConfigPaths.files(name, ctx.directory, ctx.worktree).pipe(Effect.orDie)) {
              yield* merge(
                file,
                yield* loadFile(file, authEnv, false, { root: projectRoot, source: file }, warnings).pipe(
                  Effect.catchDefect((err: unknown) => {
                    caughtWarning(warnings, file, err)
                    return Effect.succeed({} as Info)
                  }),
                ),
                "local",
              )
            }
          }
        }

        result.agent = result.agent || {}
        result.mode = result.mode || {}
        result.plugin = result.plugin || []

        const directories = yield* ConfigPaths.directories(ctx.directory, ctx.worktree)
        const primary = Flag.HARNESS_DISABLE_PROJECT_CONFIG
          ? []
          : yield* primaryPaths(ctx.directory, ctx.worktree, [".harness"])
        // Load primary fallbacks before active-worktree config, then track them as local.
        directories.splice(1, 0, ...primary)
        const primarySet = new Set(primary)

        if (Flag.HARNESS_CONFIG_DIR) {
          yield* Effect.logDebug("loading config from HARNESS_CONFIG_DIR", { path: Flag.HARNESS_CONFIG_DIR })
        }

        const deps: Fiber.Fiber<void>[] = []

        for (const dir of unique(directories)) {
          const plugins: ConfigPluginV1.Spec[] = []
          const scope = primarySet.has(dir) ? "local" : undefined
          const dirScope = scope ?? (yield* pluginScopeForSource(dir))
          const dirTrusted = dir === Flag.HARNESS_CONFIG_DIR || dirScope === "global"
          const dirFileScope = dirTrusted ? undefined : { root: projectRoot, source: dir }
          const dirSourceScope = dirTrusted
            ? undefined
            : { root: primarySet.has(dir) ? path.dirname(dir) : projectRoot, source: dir }
          if (HarnessConfig.isConfigDir(dir, Flag.HARNESS_CONFIG_DIR)) {
            for (const file of HarnessConfig.ALL_CONFIG_FILES) {
              const source = path.join(dir, file)
              yield* Effect.logDebug(`loading config from ${source}`)
              const fileScope = dirTrusted ? undefined : { root: projectRoot, source }
              const next = yield* loadFile(source, authEnv, dirTrusted, fileScope, warnings).pipe(
                Effect.catchDefect((err: unknown) => {
                  caughtWarning(warnings, source, err)
                  return Effect.succeed({} as Info)
                }),
              )
              plugins.push(...(next.plugin ?? []))
              yield* merge(source, next, dirScope, dirTrusted)
              result.agent ??= {}
              result.mode ??= {}
              result.plugin ??= []
            }
          }

          yield* ensureGitignore(dir).pipe(Effect.orDie)

          const sourceScopes = (names: readonly string[]) => [
            ...(dirSourceScope ? [dirSourceScope] : []),
            ...ExternalMarkdown.scopes({
              dir,
              names,
              permission: result.permission,
              origins: result.permission_origins,
            }),
          ]
          result.command = mergeDeep(
            result.command ?? {},
            yield* Effect.promise(() =>
              ConfigCommand.load(dir, warnings, dirTrusted, dirFileScope, sourceScopes(["command", "commands"])),
            ),
          )
          result.agent = HarnessConfig.mergeAgentMarkdown(
            result.agent ?? {},
            yield* Effect.promise(() =>
              ConfigAgent.load(dir, warnings, dirTrusted, dirFileScope, sourceScopes(["agent", "agents"])),
            ),
            configuredAgents,
          )
          result.agent = HarnessConfig.mergeAgentMarkdown(
            result.agent ?? {},
            yield* Effect.promise(() => ConfigAgent.loadMode(dir, warnings, dirTrusted, dirFileScope, dirSourceScope)),
            configuredAgents,
          )
          // returns normalized Specs and we only need to attach origin metadata here.
          const list = yield* Effect.promise(() => ConfigPlugin.load(dir))
          plugins.push(...list)
          yield* mergePluginOrigins(dir, list, dirScope)

          if (needsLocalPluginDependency(plugins)) {
            deps.push(yield* installLocalPluginDependency(npmSvc, dir, InstallationVersion, InstallationLocal))
          }
        }

        if (process.env.HARNESS_CONFIG_CONTENT) {
          const source = "HARNESS_CONFIG_CONTENT"
          yield* merge(
            source,
            yield* loadConfig(
              process.env.HARNESS_CONFIG_CONTENT,
              {
                dir: ctx.directory,
                source,
              },
              undefined,
              true,
              undefined,
              warnings,
            ).pipe(
              Effect.tap(() => Effect.logDebug("loaded custom config from HARNESS_CONFIG_CONTENT")),
              Effect.catchDefect((err: unknown) => {
                caughtWarning(warnings, source, err)
                return Effect.succeed({} as Info)
              }),
            ),
            "local",
            true,
          )
        }

        const activeAccount = Option.getOrUndefined(
          yield* accountSvc.active().pipe(Effect.catch(() => Effect.succeed(Option.none()))),
        )
        if (activeAccount?.active_org_id) {
          const accountID = activeAccount.id
          const orgID = activeAccount.active_org_id
          const url = activeAccount.url
          yield* Effect.gen(function* () {
            const [configOpt, tokenOpt] = yield* Effect.all(
              [accountSvc.config(accountID, orgID), accountSvc.token(accountID)],
              { concurrency: 2 },
            )
            if (Option.isSome(tokenOpt)) {
              process.env["HARNESS_CONSOLE_TOKEN"] = tokenOpt.value
              yield* env.set("HARNESS_CONSOLE_TOKEN", tokenOpt.value)
            }

            if (Option.isSome(configOpt)) {
              const source = `${url}/api/config`
              const next = yield* loadConfig(
                JSON.stringify(configOpt.value),
                {
                  dir: path.dirname(source),
                  source,
                },
                undefined,
                true,
                undefined,
                warnings,
              )
              for (const providerID of Object.keys(next.provider ?? {})) {
                consoleManagedProviders.add(providerID)
              }
              yield* merge(source, next, "global")
            }
          }).pipe(
            Effect.withSpan("Config.loadActiveOrgConfig"),
            Effect.catch((err) =>
              Effect.logDebug("failed to fetch remote account config", {
                error: err instanceof Error ? err.message : String(err),
              }),
            ),
          )
        }

        const managedDir = ConfigManaged.managedConfigDir()
        if (existsSync(managedDir)) {
          for (const file of HarnessConfig.ALL_CONFIG_FILES) {
            const source = path.join(managedDir, file)
            yield* merge(source, yield* loadFile(source, undefined, true, undefined, warnings), "global")
          }
        }

        // macOS managed preferences (.mobileconfig deployed via MDM) override everything
        const managed = yield* Effect.promise(() => ConfigManaged.readManagedPreferences())
        if (managed) {
          yield* merge(
            managed.source,
            yield* loadConfig(
              managed.text,
              {
                dir: path.dirname(managed.source),
                source: managed.source,
              },
              undefined,
              true,
              undefined,
              warnings,
            ),
            "global",
          )
        }

        for (const [name, mode] of Object.entries(result.mode ?? {})) {
          result.agent = mergeDeep(result.agent ?? {}, {
            [name]: {
              ...mode,
              mode: "primary" as const,
            },
          })
        }

        if (Flag.HARNESS_PERMISSION) {
          try {
            result.permission = mergeDeep(result.permission ?? {}, JSON.parse(Flag.HARNESS_PERMISSION))
          } catch (err) {
            yield* Effect.logWarning("HARNESS_PERMISSION contains invalid JSON, skipping", { err })
          }
        }

        if (result.tools) {
          const perms: Record<string, ConfigPermissionV1.Action> = {}
          for (const [tool, enabled] of Object.entries(result.tools)) {
            const action: ConfigPermissionV1.Action = enabled ? "allow" : "deny"
            if (tool === "write" || tool === "edit" || tool === "patch") {
              perms.edit = action
              continue
            }
            perms[tool] = action
          }
          result.permission = mergeDeep(perms, result.permission ?? {})
        }

        if (!result.username) {
          try {
            result.username = os.userInfo().username || "user"
          } catch (err) {
            yield* Effect.logWarning("failed to read system username, using fallback", { err })
            result.username = "user"
          }
        }

        if (result.autoshare === true && !result.share) {
          result.share = "auto"
        }

        if (Flag.HARNESS_DISABLE_AUTOCOMPACT) {
          result.compaction = { ...result.compaction, auto: false }
        }
        if (Flag.HARNESS_DISABLE_PRUNE) {
          result.compaction = { ...result.compaction, prune: false }
        }
        HarnessDefaultPlugins.apply(result, { disabled: Flag.HARNESS_DISABLE_DEFAULT_PLUGINS, log })

        return {
          config: result,
          directories,
          deps,
          warnings,
          consoleState: {
            consoleManagedProviders: Array.from(consoleManagedProviders),
            activeOrgName,
            switchableOrgCount: 0,
          },
        }
      },
      Effect.provideService(FSUtil.Service, fs),
    )

    const state = yield* InstanceState.make<State>(
      Effect.fn("Config.state")(function* (ctx) {
        return yield* loadInstanceState(ctx).pipe(Effect.provideService(Git.Service, git), Effect.orDie)
      }),
    )

    const get = Effect.fn("Config.get")(function* () {
      if (yield* refreshGlobal()) {
        yield* InstanceState.invalidate(state).pipe(Effect.catchCause(() => Effect.void))
      }
      return yield* InstanceState.use(state, (s) => s.config)
    })

    const directories = Effect.fn("Config.directories")(function* () {
      return yield* InstanceState.use(state, (s) => s.directories)
    })

    const getConsoleState = Effect.fn("Config.getConsoleState")(function* () {
      return yield* InstanceState.use(state, (s) => s.consoleState)
    })

    const waitForDependencies = Effect.fn("Config.waitForDependencies")(function* () {
      yield* InstanceState.useEffect(state, (s) =>
        Effect.forEach(s.deps, Fiber.join, { concurrency: "unbounded" }).pipe(Effect.asVoid),
      )
    })

    const update = Effect.fn("Config.update")(function* (config: Info) {
      // Harness's updateProjectConfig already reads the raw file (read: readConfigFile)
      // and patches JSONC in place, so upstream's raw-text merge fix is covered.
      const ctx = yield* InstanceState.context
      yield* HarnessConfig.updateProjectConfig({
        fs,
        directory: ctx.directory,
        worktree: ctx.worktree,
        config,
        read: readConfigFile,
        parse: (input, file) =>
          ConfigParse.schema(
            ConfigV1.Info,
            ConfigV2Compat.lower(normalizeLoadedConfig(ConfigParse.jsonc(input, file), file), file).value,
            file,
          ),
        patch: (input, patch) => patchJsonc(input, patch),
        writable,
      })
      yield* InstanceState.invalidate(state)
      yield* Effect.sync(() =>
        GlobalBus.emit("event", {
          directory: ctx.directory,
          payload: {
            type: Event.ConfigUpdated.type,
            properties: { sandbox: Object.hasOwn(config, "sandbox") },
          },
        }),
      )
    })

    const warnings = Effect.fn("Config.warnings")(function* () {
      return yield* InstanceState.use(state, (s) => s.warnings)
    })

    const invalidate = Effect.fn("Config.invalidate")(function* () {
      yield* invalidateGlobal
      yield* InstanceState.invalidate(state).pipe(Effect.catchCause(() => Effect.void))
    })

    const updateGlobal = Effect.fn("Config.updateGlobal")(function* (config: Info, options?: { dispose?: boolean }) {
      const dispose = options?.dispose ?? true
      const file = globalConfigFile()
      const result = yield* flock
        .withLock(
          Effect.gen(function* () {
            const before = (yield* readConfigFile(file)) ?? "{}"
            const patch = writableGlobal(config)
            // Reads merge every global config file, so delete sentinels must be
            // removed from all of them, not just the primary write target.
            const propagated = yield* HarnessConfig.propagateUnset({
              fs,
              files: HarnessConfig.GLOBAL_CONFIG_FILES.map((name) => path.join(Global.Path.config, name)),
              exclude: file,
              patch,
            })

            if (!file.endsWith(".jsonc")) {
              // Lower V2 native settings while keeping Harness read-merge-write behavior.
              const existing = normalizeLoadedConfig(ConfigParse.jsonc(before, file), file)
              const merged = HarnessConfig.preserve(existing, patch, file)
              const next = yield* decodeConfig(merged, file)
              const serialized = JSON.stringify(merged, null, 2)
              const changed = serialized !== before || propagated
              if (serialized !== before) yield* fs.writeFileString(file, serialized).pipe(Effect.orDie)
              return { next, changed }
            }

            const updated = patchJsonc(before, patch)
            const next = yield* decodeConfig(ConfigParse.jsonc(updated, file), file) // Lower V2 native settings for the returned info.
            const changed = updated !== before || propagated
            if (updated !== before) yield* fs.writeFileString(file, updated).pipe(Effect.orDie)
            return { next, changed }
          }),
          `config:global:${path.resolve(Global.Path.config)}`,
        )
        .pipe(Effect.orDie)
      const next = result.next
      const changed = result.changed
      const sandboxChanged = changed && Object.hasOwn(config, "sandbox")

      if (!dispose) {
        yield* invalidateGlobal
        yield* InstanceState.invalidate(state).pipe(Effect.catchCause(() => Effect.void))
        yield* Effect.sync(() =>
          GlobalBus.emit("event", {
            directory: "global",
            payload: {
              type: Event.ConfigUpdated.type,
              properties: { sandbox: sandboxChanged },
            },
          }),
        ).pipe(Effect.catchCause(() => Effect.void))
        return { info: next, changed }
      }

      if (changed) yield* invalidate()
      if (changed) {
        yield* InstanceState.invalidate(state).pipe(Effect.catchCause(() => Effect.void))
        yield* Effect.sync(() =>
          GlobalBus.emit("event", {
            directory: "global",
            payload: {
              type: Event.ConfigUpdated.type,
              properties: { sandbox: sandboxChanged },
            },
          }),
        ).pipe(Effect.catchCause(() => Effect.void))
      }
      return { info: next, changed }
    })

    return Service.of({
      get,
      getGlobal,
      getConsoleState,
      update,
      updateGlobal,
      invalidate,
      directories,
      waitForDependencies,
      warnings,
    })
  }),
)

export const node = LayerNode.make({
  service: Service,
  layer: layer,
  deps: [FSUtil.node, Auth.node, Account.node, Env.node, Npm.node, httpClient, Git.node, EffectFlock.node],
})

export * as Config from "./config"
