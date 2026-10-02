import { describe, expect, it } from "bun:test"

import { splitLines, toggled } from "../../webview-ui/src/components/settings/harness/harness-lists"

describe("toggled", () => {
  it("adds a missing value", () => {
    expect(toggled(["a"], "b", true)).toEqual(["a", "b"])
  })

  it("does not duplicate a value that is already present", () => {
    expect(toggled(["a", "b"], "b", true)).toEqual(["a", "b"])
  })

  it("removes a value", () => {
    expect(toggled(["a", "b"], "a", false)).toEqual(["b"])
  })

  it("leaves the input untouched", () => {
    const list = ["a"]
    toggled(list, "b", true)
    expect(list).toEqual(["a"])
  })
})

describe("splitLines", () => {
  it("returns one trimmed entry per non-empty line", () => {
    expect(splitLines("  one \n\n two\n   \nthree")).toEqual(["one", "two", "three"])
  })

  it("returns an empty list for blank text", () => {
    expect(splitLines("  \n ")).toEqual([])
  })
})
