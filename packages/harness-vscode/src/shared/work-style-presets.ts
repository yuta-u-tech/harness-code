export type WorkStyle = "human-in-the-loop" | "autonomous"

/** Display settings behind the `@preset` actions. */
export function getDisplayPreset(style: WorkStyle) {
  const human = style === "human-in-the-loop"
  return {
    config: {
      reasoning_display: human ? "expanded" : "preview",
      terminal_command_display: human ? "expanded" : "collapsed",
      code_edit_display: human ? "expanded" : "collapsed",
      mcp_tool_display: "collapsed",
    },
    settings: { showAutoApprovalReason: human },
  } as const
}
