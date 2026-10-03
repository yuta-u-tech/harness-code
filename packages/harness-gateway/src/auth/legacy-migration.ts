/**
 * Legacy Harness CLI migration module
 *
 * Migrates authentication from the legacy Harness Code VS Code extension CLI
 * config path (~/.harness/cli/config.json) to the new auth.json format.
 */
import fs from "fs/promises"
import os from "os"
import path from "path"

export const LEGACY_CONFIG_PATH = path.join(os.homedir(), ".harness", "cli", "config.json")

interface LegacyProvider {
  id: string
  provider: string
  harnessToken?: string
  harnessModel?: string
  harnessOrganizationId?: string
}

interface LegacyConfig {
  providers?: LegacyProvider[]
}

interface LegacyHarnessAuth {
  token: string
  organizationId?: string
}

// Auth info types matching opencode's Auth module
type ApiAuth = { type: "api"; key: string }
type OAuthAuth = { type: "oauth"; access: string; refresh: string; expires: number; accountId?: string }
type AuthInfo = ApiAuth | OAuthAuth

/**
 * Extract harness auth from legacy config
 */
function extractHarnessAuth(config: LegacyConfig): LegacyHarnessAuth | undefined {
  if (!config.providers) return undefined

  const provider = config.providers.find((p) => p.provider === "harness")
  if (!provider?.harnessToken) return undefined

  return {
    token: provider.harnessToken,
    organizationId: provider.harnessOrganizationId,
  }
}

/**
 * Migrate Harness authentication from legacy CLI config path.
 *
 * Checks ~/.harness/cli/config.json for existing harness credentials
 * and migrates them to the new auth.json format.
 *
 * @param hasHarnessAuth - Callback to check if harness auth already exists
 * @param saveHarnessAuth - Callback to save the migrated auth
 * @returns true if migration was performed, false otherwise
 */
export async function migrateLegacyHarnessAuth(
  hasHarnessAuth: () => Promise<boolean>,
  saveHarnessAuth: (auth: AuthInfo) => Promise<void>,
): Promise<boolean> {
  // Skip if harness auth already configured
  if (await hasHarnessAuth()) return false

  // Check if legacy config exists and parse it
  const content = await fs.readFile(LEGACY_CONFIG_PATH, "utf-8").catch(() => null)
  if (!content) return false

  let config: LegacyConfig | null = null
  try {
    config = JSON.parse(content) as LegacyConfig
  } catch {
    return false
  }

  // Extract harness auth from legacy config
  const legacy = extractHarnessAuth(config)
  if (!legacy) return false

  // Migrate to new format
  // Use OAuth format if organization ID present, otherwise API format
  if (legacy.organizationId) {
    await saveHarnessAuth({
      type: "oauth",
      access: legacy.token,
      refresh: "",
      expires: 0,
      accountId: legacy.organizationId,
    })
  } else {
    await saveHarnessAuth({
      type: "api",
      key: legacy.token,
    })
  }

  return true
}
