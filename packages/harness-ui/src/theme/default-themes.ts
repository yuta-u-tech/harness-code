import type { DesktopTheme } from "@opencode-ai/ui/theme/types"
import { DEFAULT_THEMES as UPSTREAM_THEMES } from "@opencode-ai/ui/theme/default-themes"
import harnessJson from "./themes/harness.json"
import harnessVscodeJson from "./themes/harness-vscode.json"

// Re-export all upstream theme constants
export {
  oc2Theme,
  tokyonightTheme,
  draculaTheme,
  monokaiTheme,
  solarizedTheme,
  nordTheme,
  catppuccinTheme,
  ayuTheme,
  oneDarkProTheme,
  shadesOfPurpleTheme,
  nightowlTheme,
  vesperTheme,
  carbonfoxTheme,
  gruvboxTheme,
  auraTheme,
} from "@opencode-ai/ui/theme/default-themes"

export const harnessTheme = harnessJson as DesktopTheme
export const harnessVscodeTheme = harnessVscodeJson as DesktopTheme

export const HARNESS_THEMES: Record<string, DesktopTheme> = {
  harness: harnessTheme,
  "harness-vscode": harnessVscodeTheme,
}

// Override DEFAULT_THEMES: Harness themes first, then upstream
export const DEFAULT_THEMES: Record<string, DesktopTheme> = {
  ...HARNESS_THEMES,
  ...UPSTREAM_THEMES,
}
