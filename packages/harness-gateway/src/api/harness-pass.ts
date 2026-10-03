import { buildHarnessHeaders } from "../headers.js"
import type { HarnessPassState } from "../types.js"
import { HARNESS_API_BASE } from "./constants.js"

function record(value: unknown) {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : undefined
}

function num(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

// Cloud returns the full subscription record even after cancellation; only
// these statuses represent a pass the user can actually consume.
const live = new Set(["active", "past_due", "trialing"])

export function parseHarnessPassState(value: unknown): HarnessPassState | null {
  const item = Array.isArray(value) ? value[0] : value
  const data = record(record(record(item)?.result)?.data)
  const root = record(data?.json) ?? data ?? record(value)
  const sub = record(root?.subscription)
  if (!sub || (sub.currentPeriodBaseCreditsUsd == null && sub.currentPeriodUsageUsd == null)) return null
  if (typeof sub.status === "string" && !live.has(sub.status)) return null

  const next = sub.nextBillingAt ?? sub.nextRenewalAt
  return {
    currentPeriodBaseCreditsUsd: num(sub.currentPeriodBaseCreditsUsd),
    currentPeriodUsageUsd: num(sub.currentPeriodUsageUsd),
    currentPeriodBonusCreditsUsd: num(sub.currentPeriodBonusCreditsUsd),
    nextBillingAt: typeof next === "string" ? next : null,
  }
}

export async function fetchHarnessPassState(token: string): Promise<HarnessPassState | null> {
  try {
    const params = new URLSearchParams({ batch: "1", input: JSON.stringify({ "0": null }) })
    const response = await fetch(`${HARNESS_API_BASE}/api/trpc/harnessPass.getState?${params}`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...buildHarnessHeaders() },
    })
    if (!response.ok) return null
    return parseHarnessPassState(await response.json())
  } catch {
    return null
  }
}
