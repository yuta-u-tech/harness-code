/**
 * Harness Gateway Configuration Constants
 * Centralized configuration for all API endpoints, headers, and settings
 */

/** Environment variable for custom Harness API URL */
export const ENV_HARNESS_API_URL = "HARNESS_API_URL"

/** Default Harness API URL */
export const DEFAULT_HARNESS_API_URL = "https://api.kilo.ai"

/** Base URL for Harness API - can be overridden by HARNESS_API_URL env var */
export const HARNESS_API_BASE = process.env[ENV_HARNESS_API_URL] || DEFAULT_HARNESS_API_URL

/** Environment variable for custom Event Service URL */
export const HARNESS_EVENT_SERVICE_URL_ENV = "EVENT_SERVICE_URL"

/** Default Event Service URL (WebSocket endpoint for harness-chat events) */
export const HARNESS_DEFAULT_EVENT_SERVICE_URL = "wss://events.harnessapps.io"

/** Base URL for Event Service - can be overridden by EVENT_SERVICE_URL env var */
export const HARNESS_EVENT_SERVICE_URL = process.env[HARNESS_EVENT_SERVICE_URL_ENV] || HARNESS_DEFAULT_EVENT_SERVICE_URL

/** Default base URL for OpenRouter-compatible endpoint */
export const HARNESS_OPENROUTER_BASE = `${HARNESS_API_BASE}/api/openrouter`

/** Device auth polling interval in milliseconds */
export const POLL_INTERVAL_MS = 3000

/** Default model for authenticated users */
export const DEFAULT_MODEL = "harness-auto/free"

/** Default model for anonymous/free usage */
export const DEFAULT_FREE_MODEL = "harness-auto/free"

/** Token expiration duration in milliseconds (1 year) */
export const TOKEN_EXPIRATION_MS = 365 * 24 * 60 * 60 * 1000

/** User-Agent header base value for requests */
export const USER_AGENT_BASE = "opencode-harness-provider"

/** Content-Type header value for requests */
export const CONTENT_TYPE = "application/json"

/** Default provider name */
export const DEFAULT_PROVIDER_NAME = "harness"

/** Default API key for anonymous requests */
export const ANONYMOUS_API_KEY = "anonymous"

/** Fetch timeout for model requests in milliseconds (10 seconds) */
export const MODELS_FETCH_TIMEOUT_MS = 10 * 1000

/**
 * Header constants for HarnessCode API requests
 */
export const HEADER_ORGANIZATIONID = "X-HARNESS-ORGANIZATIONID"
export const HEADER_TASKID = "X-HARNESS-TASKID"
export const HEADER_PARENT_TASKID = "X-HARNESS-PARENT-TASKID"
export const HEADER_PROJECTID = "X-HARNESS-PROJECTID"
export const HEADER_TESTER = "X-HARNESS-TESTER"
export const HEADER_EDITORNAME = "X-HARNESS-EDITORNAME"
export const HEADER_MACHINEID = "X-HARNESS-MACHINEID"

/** Default editor name value */
export const DEFAULT_EDITOR_NAME = "Harness CLI"

/** Environment variable name for custom editor name */
export const ENV_EDITOR_NAME = "HARNESS_EDITOR_NAME"

/** Environment variable name for version (set by CLI at startup) */
export const ENV_VERSION = "HARNESS_VERSION"

/** Tester header value for suppressing warnings */
export const TESTER_SUPPRESS_VALUE = "SUPPRESS"

/** Header name for feature tracking */
export const HEADER_FEATURE = "X-HARNESS-FEATURE"

/** Environment variable name for feature override */
export const ENV_FEATURE = "HARNESS_FEATURE"

export const PROMPTS = [
  "codex",
  "gemini",
  "beast",
  "anthropic",
  "trinity",
  "anthropic_without_todo",
  "ling",
  "gpt55",
] as const

export const AI_SDK_PROVIDERS = [
  "anthropic",
  "openai",
  "openai-compatible",
  "openrouter",
] as const
