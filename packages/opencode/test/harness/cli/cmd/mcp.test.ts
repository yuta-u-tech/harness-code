import { describe, expect, test } from "bun:test"
import { HarnessMcpConfig } from "@/harness/cli/cmd/mcp"

const added = `{
  "permission": {
    "bash": "allow"
  },
  "mcp": {
    "linear": {
      "type": "remote",
      "url": "https://mcp.linear.app/mcp",
      "oauth": {}
    }
  },
}`

describe("HarnessMcpConfig.format", () => {
  test("writes strict JSON for harness.json", () => {
    const output = HarnessMcpConfig.format("/tmp/harness.json", added)

    expect(JSON.parse(output)).toEqual({
      permission: { bash: "allow" },
      mcp: {
        linear: {
          type: "remote",
          url: "https://mcp.linear.app/mcp",
          oauth: {},
        },
      },
    })
    expect(output).not.toEndWith(",\n}")
  })

  test("preserves JSONC formatting for harness.jsonc", () => {
    expect(HarnessMcpConfig.format("/tmp/harness.jsonc", added)).toBe(added)
  })
})
