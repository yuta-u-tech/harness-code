import type { Auth } from "@/auth"
import { fetchDefaultModel, getHarnessUrlFromToken, HARNESS_API_BASE } from "@harness/harness-gateway"

type Options = { harnessOrganizationId?: string; baseURL?: string; apiKey?: string; harnessToken?: string }

export function token(options: Options | undefined, info: Auth.Info | undefined) {
  if (process.env.HARNESS_API_KEY) return process.env.HARNESS_API_KEY
  if (info?.type === "oauth") return info.access
  if (info?.type === "api") return info.key
  if (options?.harnessToken != null) return options.harnessToken
  return options?.apiKey || undefined
}

function scoped(url: string) {
  return URL.parse(url)
    ?.pathname.match(/\/api\/organizations\/([^/]+)/)
    ?.at(1)
}

export function organization(options: Options | undefined, info: Auth.Info | undefined) {
  return (
    process.env.HARNESS_ORG_ID ||
    (info?.type === "oauth" ? info.accountId : undefined) ||
    options?.harnessOrganizationId ||
    scoped(getHarnessUrlFromToken(options?.baseURL ?? "", token(options, info) ?? ""))
  )
}

export function compatible(options: { baseURL?: string; harnessToken?: string; harnessOrganizationId?: string }) {
  const org = scoped(getHarnessUrlFromToken(options.baseURL ?? "", options.harnessToken ?? ""))
  return !org || !options.harnessOrganizationId || org === options.harnessOrganizationId
}

export async function recommend(
  models: Readonly<Record<string, unknown>>,
  options: Options | undefined,
  info: Auth.Info | undefined,
  known = true,
) {
  const first = Object.keys(models).at(0)
  if (!first || !known) return first
  const org = organization(options, info)
  const key = token(options, info)
  if (!compatible({ baseURL: options?.baseURL, harnessToken: key, harnessOrganizationId: org })) return undefined
  const fallback = org ? first : undefined
  const endpoint = getHarnessUrlFromToken(options?.baseURL || HARNESS_API_BASE, key ?? "")
  if (URL.parse(endpoint)?.origin !== URL.parse(HARNESS_API_BASE)?.origin) return fallback
  const model = await fetchDefaultModel(key, org, fallback)
  return Object.hasOwn(models, model) ? model : fallback
}
