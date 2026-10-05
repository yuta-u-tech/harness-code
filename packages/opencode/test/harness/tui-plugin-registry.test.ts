import { expect, test } from "bun:test"
import { internalTuiPlugins } from "@/plugin/tui/internal"

const harness = [
  "internal:home-onboarding",
  "internal:harness-attention",
  "internal:harness-home-footer",
  "internal:harness-permissions",
  "internal:harness-sidebar-memory",
  "internal:harness-memory-palette",
  "internal:harness-sidebar-background-processes",
  "internal:harness-sidebar-indexing",
  "internal:harness-sidebar-pr",
  "internal:harness-sidebar-usage",
  "internal:sandbox",
  "internal:remote",
  "internal:reload",
]

test("internal TUI registry preserves every Harness plugin before upstream builtins", () => {
  const ids = internalTuiPlugins({ experimentalEventSystem: false, experimentalSessionSwitcher: false }).map(
    (plugin) => plugin.id,
  )

  expect(ids.slice(0, harness.length)).toEqual(harness)
  expect(new Set(ids).size).toBe(ids.length)
  expect(ids).toContain("internal:sidebar-context")
  expect(ids).toContain("diff-viewer")
})

test("experimental Harness TUI plugins remain wired", () => {
  const ids = internalTuiPlugins({ experimentalEventSystem: true, experimentalSessionSwitcher: true }).map(
    (plugin) => plugin.id,
  )

  expect(ids).toContain("internal:session-v2-debug")
  expect(ids).toContain("internal:session-switcher")
})
