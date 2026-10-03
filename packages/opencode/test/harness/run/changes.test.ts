import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Process } from "../../../src/util/process"
import { HarnessChanges } from "../../../src/harness/run/changes"

const git = (cwd: string, ...args: string[]) =>
  Process.run(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd })

async function repo(files: Record<string, string> = { "a.txt": "one\n" }) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "harness-changes-"))
  await git(cwd, "init", "-q")
  for (const [name, text] of Object.entries(files)) await fs.writeFile(path.join(cwd, name), text)
  await git(cwd, "add", ".")
  await git(cwd, "commit", "-qm", "init")
  return cwd
}

describe("HarnessChanges", () => {
  test("shows an edit to a tracked file made after begin", async () => {
    const cwd = await repo()
    const base = await HarnessChanges.begin(cwd)
    await fs.writeFile(path.join(cwd, "a.txt"), "one\ntwo\n")
    const text = await HarnessChanges.since(cwd, base)
    expect(text).toContain("a.txt")
    expect(text).toContain("+two")
  })

  test("shows a new file with its content", async () => {
    const cwd = await repo()
    const base = await HarnessChanges.begin(cwd)
    await fs.writeFile(path.join(cwd, "new.py"), "print('hi')\n")
    const text = await HarnessChanges.since(cwd, base)
    expect(text).toContain("new.py")
    expect(text).toContain("+print('hi')")
  })

  test("leaves out changes that were already there when the run began", async () => {
    const cwd = await repo({ "a.txt": "one\n", "b.txt": "x\n" })
    await fs.writeFile(path.join(cwd, "b.txt"), "x\nbefore the run\n")
    await fs.writeFile(path.join(cwd, "early.txt"), "already here\n")
    const base = await HarnessChanges.begin(cwd)
    await fs.writeFile(path.join(cwd, "a.txt"), "one\nduring the run\n")
    const text = await HarnessChanges.since(cwd, base)
    expect(text).toContain("during the run")
    expect(text).not.toContain("before the run")
    expect(text).not.toContain("early.txt")
  })

  test("is empty when nothing changed", async () => {
    const cwd = await repo()
    const base = await HarnessChanges.begin(cwd)
    expect(await HarnessChanges.since(cwd, base)).toBe("")
  })

  test("does not touch the user's index or working tree", async () => {
    const cwd = await repo()
    await fs.writeFile(path.join(cwd, "a.txt"), "one\nstaged\n")
    await git(cwd, "add", "a.txt")
    const before = (await git(cwd, "status", "--porcelain")).stdout.toString()
    const base = await HarnessChanges.begin(cwd)
    await HarnessChanges.since(cwd, base)
    expect((await git(cwd, "status", "--porcelain")).stdout.toString()).toBe(before)
  })

  test("returns nothing outside a git repository", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "harness-nogit-"))
    const base = await HarnessChanges.begin(cwd)
    expect(base).toBeUndefined()
    expect(await HarnessChanges.since(cwd, base)).toBe("")
  })

  test("works in a repository that has no commits yet", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "harness-empty-"))
    await git(cwd, "init", "-q")
    const base = await HarnessChanges.begin(cwd)
    await fs.writeFile(path.join(cwd, "first.txt"), "hello\n")
    const text = await HarnessChanges.since(cwd, base)
    expect(text).toContain("first.txt")
    expect(text).toContain("+hello")
  })

  test("lists binary files after the text diffs instead of printing them first", async () => {
    const cwd = await repo()
    const base = await HarnessChanges.begin(cwd)
    await fs.mkdir(path.join(cwd, "cache"))
    await fs.writeFile(path.join(cwd, "cache", "a.bin"), Buffer.from([0, 1, 2, 0, 255, 0]))
    await fs.writeFile(path.join(cwd, "code.py"), "x = 1\n")
    const text = await HarnessChanges.since(cwd, base)
    expect(text.indexOf("+x = 1")).toBeGreaterThan(-1)
    expect(text).not.toContain("Binary files")
    expect(text).toContain("no text diff")
    expect(text.indexOf("cache/a.bin")).toBeGreaterThan(text.indexOf("+x = 1"))
  })

  test("caps the size of one new file's diff", async () => {
    const cwd = await repo()
    const base = await HarnessChanges.begin(cwd)
    await fs.writeFile(path.join(cwd, "big.txt"), "x".repeat(500_000))
    const text = await HarnessChanges.since(cwd, base, { file: 1_000 })
    expect(text).toContain("big.txt")
    expect(text.length).toBeLessThan(3_000)
    expect(text).toContain("truncated")
  })
})
