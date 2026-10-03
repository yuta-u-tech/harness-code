import { Config, ConfigProvider, Context, Effect, Layer, Option } from "effect"
import { ConfigService } from "@/effect/config-service"

const bool = (name: string) => Config.boolean(name).pipe(Config.withDefault(false))
const positiveInteger = (name: string) =>
  Config.number(name).pipe(
    Config.map((value) => (Number.isInteger(value) && value > 0 ? value : undefined)),
    Config.orElse(() => Config.succeed(undefined)),
  )
const experimental = bool("HARNESS_EXPERIMENTAL")
const enabledByExperimental = (name: string) =>
  Config.all({ experimental, enabled: Config.boolean(name).pipe(Config.option) }).pipe(
    Config.map((flags) => Option.getOrElse(flags.enabled, () => flags.experimental)),
  )

export class Service extends ConfigService.Service<Service>()("@opencode/RuntimeFlags", {
  autoShare: bool("HARNESS_AUTO_SHARE"),
  pure: bool("HARNESS_PURE"),
  disableDefaultPlugins: bool("HARNESS_DISABLE_DEFAULT_PLUGINS"),
  disableChannelDb: bool("HARNESS_DISABLE_CHANNEL_DB"),
  disableEmbeddedWebUi: bool("HARNESS_DISABLE_EMBEDDED_WEB_UI"),
  disableExternalSkills: bool("HARNESS_DISABLE_EXTERNAL_SKILLS"),
  disableSkillShell: bool("HARNESS_DISABLE_SKILL_SHELL"),
  disableLspDownload: bool("HARNESS_DISABLE_LSP_DOWNLOAD"),
  skipMigrations: bool("HARNESS_SKIP_MIGRATIONS"),
  disableClaudeCodePrompt: Config.all({
    broad: bool("HARNESS_DISABLE_CLAUDE_CODE"),
    direct: bool("HARNESS_DISABLE_CLAUDE_CODE_PROMPT"),
  }).pipe(Config.map((flags) => flags.broad || flags.direct)),
  disableClaudeCodeSkills: Config.all({
    broad: bool("HARNESS_DISABLE_CLAUDE_CODE"),
    direct: bool("HARNESS_DISABLE_CLAUDE_CODE_SKILLS"),
  }).pipe(Config.map((flags) => flags.broad || flags.direct)),
  enableExa: Config.all({
    experimental,
    enabled: bool("HARNESS_ENABLE_EXA"),
    legacy: bool("HARNESS_EXPERIMENTAL_EXA"),
  }).pipe(Config.map((flags) => flags.experimental || flags.enabled || flags.legacy)),
  enableParallel: Config.all({
    enabled: bool("HARNESS_ENABLE_PARALLEL"),
    legacy: bool("HARNESS_EXPERIMENTAL_PARALLEL"),
  }).pipe(Config.map((flags) => flags.enabled || flags.legacy)),
  enableExperimentalModels: bool("HARNESS_ENABLE_EXPERIMENTAL_MODELS"),
  enableQuestionTool: bool("HARNESS_ENABLE_QUESTION_TOOL"),
  experimentalScout: enabledByExperimental("HARNESS_EXPERIMENTAL_SCOUT"),
  experimentalReferences: enabledByExperimental("HARNESS_EXPERIMENTAL_REFERENCES"),
  experimentalBackgroundSubagents: Config.boolean("HARNESS_EXPERIMENTAL_BACKGROUND_SUBAGENTS").pipe(
    Config.withDefault(true),
  ),
  experimentalLspTy: bool("HARNESS_EXPERIMENTAL_LSP_TY"),
  experimentalLspTool: enabledByExperimental("HARNESS_EXPERIMENTAL_LSP_TOOL"),
  experimentalContextTools: enabledByExperimental("HARNESS_EXPERIMENTAL_CONTEXT_TOOLS"),
  experimentalOxfmt: enabledByExperimental("HARNESS_EXPERIMENTAL_OXFMT"),
  experimentalCodeMode: enabledByExperimental("HARNESS_EXPERIMENTAL_CODE_MODE"),
  experimentalEventSystem: enabledByExperimental("HARNESS_EXPERIMENTAL_EVENT_SYSTEM"),
  experimentalSessionSwitcher: enabledByExperimental("HARNESS_EXPERIMENTAL_SESSION_SWITCHER"),
  experimentalSharedAgentBoard: Config.boolean("HARNESS_EXPERIMENTAL_SHARED_AGENT_BOARD").pipe(Config.withDefault(true)),
  experimentalWorkspaces: enabledByExperimental("HARNESS_EXPERIMENTAL_WORKSPACES"),
  experimentalIconDiscovery: enabledByExperimental("HARNESS_EXPERIMENTAL_ICON_DISCOVERY"),
  experimentalMcpApps: enabledByExperimental("HARNESS_EXPERIMENTAL_MCP_APPS"),
  outputTokenMax: positiveInteger("HARNESS_EXPERIMENTAL_OUTPUT_TOKEN_MAX"),
  bashDefaultTimeoutMs: positiveInteger("HARNESS_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS"),
  experimentalNativeLlm: bool("HARNESS_EXPERIMENTAL_NATIVE_LLM"),
  experimentalWebSockets: bool("HARNESS_EXPERIMENTAL_WEBSOCKETS"),
  client: Config.string("HARNESS_CLIENT").pipe(Config.withDefault("cli")),
}) {}

export type Info = Context.Service.Shape<typeof Service>

const emptyConfigLayer = Service.layer.pipe(
  Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))),
  Layer.orDie,
)

export const layer = (overrides: Partial<Info> = {}) =>
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const flags = yield* Service
      return Service.of({ ...flags, ...overrides })
    }),
  ).pipe(Layer.provide(emptyConfigLayer))

export const node = LayerNode.make({ service: Service, layer: Service.layer.pipe(Layer.orDie), deps: [] })

export * as RuntimeFlags from "./runtime-flags"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
