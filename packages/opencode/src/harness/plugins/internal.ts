import type { BuiltinTuiPlugin } from "@opencode-ai/tui/builtins"
import HomeOnboarding from "@/harness/plugins/home-onboarding"
import Attention from "@/harness/plugins/attention"
import HomeFooter from "@/harness/plugins/home-footer"
import Permissions from "@/harness/plugins/permissions"
import MemoryStatus from "@/harness/plugins/memory-status"
import MemoryPalette from "@/harness/plugins/memory-palette"
import SidebarProcesses from "@/harness/plugins/sidebar-background-processes"
import SidebarIndexing from "@/harness/plugins/sidebar-indexing"
import SidebarPr from "@/harness/plugins/sidebar-pr"
import SidebarUsage from "@/harness/plugins/sidebar-usage"
import Sandbox from "@/harness/plugins/sandbox"
import Reload from "@/harness/plugins/reload"
import SessionSwitcher from "@/harness/plugins/session-switcher"
import SessionV2Debug from "@/harness/plugins/session-v2-debug"
import type { RuntimeFlags } from "@/effect/runtime-flags"

const plugins = [
  HomeOnboarding,
  Attention,
  HomeFooter,
  Permissions,
  MemoryStatus,
  MemoryPalette,
  SidebarProcesses,
  SidebarIndexing,
  SidebarPr,
  SidebarUsage,
  Sandbox,
  Reload,
] satisfies BuiltinTuiPlugin[]

export function withHarnessTuiPlugins(
  builtins: BuiltinTuiPlugin[],
  flags: Pick<RuntimeFlags.Info, "experimentalEventSystem" | "experimentalSessionSwitcher">,
) {
  return [
    ...plugins,
    ...(flags.experimentalEventSystem ? [SessionV2Debug] : []),
    ...(flags.experimentalSessionSwitcher ? [SessionSwitcher] : []),
    ...builtins,
  ]
}
