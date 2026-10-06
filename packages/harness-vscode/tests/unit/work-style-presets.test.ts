import { describe, expect, it } from "bun:test"
import { getDisplayPreset } from "../../src/shared/work-style-presets"

describe("getDisplayPreset", () => {
  it("shows details for the step by step preset", () => {
    const preset = getDisplayPreset("human-in-the-loop")
    expect(preset.config.terminal_command_display).toBe("expanded")
    expect(preset.settings.showAutoApprovalReason).toBe(true)
  })

  it("collapses details for the autonomous preset", () => {
    const preset = getDisplayPreset("autonomous")
    expect(preset.config.reasoning_display).toBe("preview")
    expect(preset.config.code_edit_display).toBe("collapsed")
    expect(preset.settings.showAutoApprovalReason).toBe(false)
  })
})
