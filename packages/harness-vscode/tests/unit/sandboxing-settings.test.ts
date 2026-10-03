import { afterEach, describe, expect, test } from "bun:test"
import { configFeatures } from "../../src/features"

const features = { indexing: false, sandboxControls: false, backgroundSubagents: false }
const platform = Object.getOwnPropertyDescriptor(process, "platform")

function setPlatform(value: string) {
  Object.defineProperty(process, "platform", { value, configurable: true })
}

afterEach(() => {
  if (platform) Object.defineProperty(process, "platform", platform)
})

describe("Sandbox control availability", () => {
  test("shows sandbox controls outside Windows", () => {
    setPlatform("darwin")
    expect(configFeatures().sandboxControls).toBe(true)

    setPlatform("linux")
    expect(configFeatures().sandboxControls).toBe(true)
  })

  test("hides sandbox controls on Windows", () => {
    setPlatform("win32")
    expect(configFeatures().sandboxControls).toBe(false)
  })
})
