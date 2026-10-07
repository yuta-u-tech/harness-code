import type { Provider } from "@opencode-ai/core/models-dev"

export const PROVIDER_ID = "ollama"

const DEFAULT_HOST = "http://127.0.0.1:11434"
const PROBE_TIMEOUT = 1500
const CACHE_MS = 30_000
const DEFAULT_CONTEXT = 32_768

export function host(env: Record<string, string | undefined> = process.env): string {
  const raw = env.OLLAMA_HOST?.trim()
  if (!raw) return DEFAULT_HOST
  const url = /^https?:\/\//.test(raw) ? raw : `http://${raw}`
  return url.replace(/\/+$/, "")
}

/** Names like `qwen3-coder-64k:30b` carry their context window; otherwise assume a modest default. */
export function contextOf(name: string): number {
  const match = /(\d+)k\b/i.exec(name.split(":")[0] ?? "")
  return match ? Number(match[1]) * 1024 : DEFAULT_CONTEXT
}

function model(name: string): Provider["models"][string] {
  return {
    id: name,
    name,
    family: PROVIDER_ID,
    release_date: "",
    attachment: false,
    reasoning: false,
    temperature: true,
    tool_call: true,
    cost: { input: 0, output: 0 },
    limit: { context: contextOf(name), output: 0 },
    modalities: { input: ["text"], output: ["text"] },
  }
}

export function catalog(names: string[], base = host()): Provider {
  return {
    id: PROVIDER_ID,
    name: "Ollama",
    env: [],
    api: `${base}/v1`,
    npm: "@ai-sdk/openai-compatible",
    models: Object.fromEntries(names.map((name) => [name, model(name)])),
  } satisfies Provider
}

const cached = new Map<string, { at: number; names: string[] }>()

/** Installed model names from a running Ollama, or none when it is not reachable. */
export async function installed(base = host()): Promise<string[]> {
  const hit = cached.get(base)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.names
  const names = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(PROBE_TIMEOUT) })
    .then((res) => (res.ok ? res.json() : { models: [] }))
    .then((body: { models?: Array<{ name?: string }> }) =>
      (body.models ?? []).flatMap((item) => (item.name ? [item.name] : [])),
    )
    .catch(() => [] as string[])
  cached.set(base, { at: Date.now(), names })
  return names
}

/** Adds Ollama to the catalog when it is running, so its models appear without any setup. */
export async function overlay(providers: Record<string, Provider>): Promise<Record<string, Provider>> {
  const names = await installed()
  return names.length > 0 ? { ...providers, [PROVIDER_ID]: catalog(names) } : providers
}
