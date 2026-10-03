// ============================================================================
// Plugin
// ============================================================================
export { HarnessAuthPlugin, default } from "./plugin.js"

// ============================================================================
// Provider
// ============================================================================
export { createHarness } from "./provider.js"
export { createHarnessDebug } from "./provider-debug.js"
export { harnessCustomLoader } from "./loader.js"
export { buildHarnessHeaders, getEditorNameHeader, getFeatureHeader, getDefaultHeaders, getUserAgent } from "./headers.js"

// ============================================================================
// Auth
// ============================================================================
export { authenticateWithDeviceAuth } from "./auth/device-auth.js"
export { authenticateWithDeviceAuthTUI } from "./auth/device-auth-tui.js"
export { getHarnessUrlFromToken, isValidHarnessToken, getApiKey } from "./auth/token.js"
export { poll, formatTimeRemaining } from "./auth/polling.js"
export { migrateLegacyHarnessAuth, LEGACY_CONFIG_PATH } from "./auth/legacy-migration.js"

// ============================================================================
// API
// ============================================================================
export {
  fetchProfile,
  fetchBalance,
  fetchProfileWithBalance,
  fetchDefaultModel,
  getHarnessProfile,
  defaultOrganizationId,
  getHarnessBalance,
  getHarnessDefaultModel,
  promptOrganizationSelection,
} from "./api/profile.js"
export { fetchHarnessPassState } from "./api/harness-pass.js"
export {
  fetchHarnessModels,
  type HarnessModelsResult,
  fetchHarnessImageModels,
  type HarnessImageModel,
  type HarnessImageModelsResult,
  fetchHarnessTranscriptionModels,
  type HarnessTranscriptionModel,
  type HarnessTranscriptionModelsResult,
  supportsTools,
} from "./api/models.js"
export {
  EMPTY_HARNESS_EMBEDDING_MODEL_CATALOG,
  fetchHarnessEmbeddingModelCatalog,
  type HarnessEmbeddingModel,
  type HarnessEmbeddingModelCatalog,
  type HarnessEmbeddingModelCatalogIssue,
} from "./api/embedding-models.js"
export { resolveHarnessGatewayBaseUrl, resolveHarnessOpenRouterBaseUrl } from "./api/url.js"
export {
  AUTOCOMPLETE_MODELS,
  DEFAULT_AUTOCOMPLETE_MODEL,
  getAutocompleteModel,
  getAutocompleteModelById,
  validAutocompleteModel,
  validAutocompleteProvider,
  type AutocompleteModelDef,
  type AutocompleteProviderID,
} from "./autocomplete.js"
export {
  fetchOrganizationModes,
  clearModesCache,
  type OrganizationMode,
  type OrganizationModeConfig,
} from "./api/modes.js"
export { fetchHarnessNotifications, type HarnessNotification } from "./api/notifications.js"
export {
  fetchByokEntries,
  fetchCodingPlanSubscriptions,
  fetchCodingPlanUsage,
  type ByokEntry,
  type CodingPlanSubscription,
  type CodingPlanQuotaWindow,
} from "./api/trpc.js"
export {
  fetchCloudSession,
  fetchCloudSessionForImport,
  SessionImportValidationError,
  prepareSessionImport,
  importSessionToDb,
} from "./cloud-sessions.js"

// ============================================================================
// Server Routes (optional - requires hono and OpenCode dependencies)
// ============================================================================
export { createHarnessRoutes } from "./server/routes.js"
export {
  GatewayError,
  UnauthorizedError,
  getOrganizationId,
  getCloudSessions,
  getNotifications,
  getProfile,
  getToken,
  setOrganization,
} from "./server/handlers.js"

// ============================================================================
// Note: TUI exports moved to separate entry point
// ============================================================================
// For TUI components and commands, import from "@harness/harness-gateway/tui"
// This avoids circular dependencies with opencode TUI infrastructure

// ============================================================================
// Types
// ============================================================================
export type {
  // Auth types
  DeviceAuthInitiateResponse,
  DeviceAuthPollResponse,
  Organization,
  HarnessProfile,
  HarnessBalance,
  HarnessPassState,
  PollOptions,
  PollResult,
  // Provider types
  HarnessProvider,
  HarnessProviderOptions,
  HarnessMetadata,
  CustomLoaderResult,
  ProviderInfo,
  LanguageModelV3,
} from "./types.js"

// ============================================================================
// Constants
// ============================================================================
export {
  ENV_HARNESS_API_URL,
  DEFAULT_HARNESS_API_URL,
  HARNESS_API_BASE,
  HARNESS_EVENT_SERVICE_URL,
  HARNESS_OPENROUTER_BASE,
  POLL_INTERVAL_MS,
  DEFAULT_MODEL,
  DEFAULT_FREE_MODEL,
  TOKEN_EXPIRATION_MS,
  USER_AGENT_BASE,
  CONTENT_TYPE,
  DEFAULT_PROVIDER_NAME,
  ANONYMOUS_API_KEY,
  MODELS_FETCH_TIMEOUT_MS,
  HEADER_ORGANIZATIONID,
  HEADER_TASKID,
  HEADER_PARENT_TASKID,
  HEADER_PROJECTID,
  HEADER_TESTER,
  HEADER_EDITORNAME,
  HEADER_MACHINEID,
  HEADER_FEATURE,
  DEFAULT_EDITOR_NAME,
  ENV_EDITOR_NAME,
  ENV_VERSION,
  TESTER_SUPPRESS_VALUE,
  ENV_FEATURE,
  PROMPTS,
  AI_SDK_PROVIDERS,
} from "./api/constants.js"
