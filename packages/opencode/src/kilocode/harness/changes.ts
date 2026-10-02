export * as HarnessChanges from "./changes"

import { Process } from "@/util/process"

/** Repository state when a run began, so later changes can be told apart from earlier ones. */
export interface Baseline {
  /** A commit holding the working tree at the start. Undefined when the repository has no commits. */
  ref?: string
  /** Untracked files that were already there. */
  early: string[]
}

export interface Limits {
  /** Characters kept from the diff of one new file. */
  file?: number
  /** New files listed at most. */
  files?: number
}

const FILE = 40_000
const FILES = 100
const IDENTITY = {
  GIT_AUTHOR_NAME: "harness",
  GIT_AUTHOR_EMAIL: "harness@localhost",
  GIT_COMMITTER_NAME: "harness",
  GIT_COMMITTER_EMAIL: "harness@localhost",
}

const git = (cwd: string, args: string[]) => Process.run(["git", ...args], { cwd, nothrow: true, env: IDENTITY })

async function untracked(cwd: string): Promise<string[]> {
  const out = await git(cwd, ["ls-files", "--others", "--exclude-standard", "-z"])
  return out.code === 0 ? out.stdout.toString().split("\0").filter(Boolean) : []
}

/** Notes where the working tree stands. It changes nothing in the repository's index or files. */
export async function begin(cwd: string): Promise<Baseline | undefined> {
  const inside = await git(cwd, ["rev-parse", "--is-inside-work-tree"])
  if (inside.code !== 0) return undefined
  const stash = (await git(cwd, ["stash", "create"])).stdout.toString().trim()
  const head = await git(cwd, ["rev-parse", "--verify", "HEAD"])
  const ref = stash || (head.code === 0 ? head.stdout.toString().trim() : undefined)
  return { ref, early: await untracked(cwd) }
}

const clip = (text: string, size: number) => (text.length <= size ? text : `${text.slice(0, size)}\n… truncated`)

/** What changed since `begin`: edits to tracked files, then each new file with its content. */
export async function since(cwd: string, base: Baseline | undefined, limits: Limits = {}): Promise<string> {
  if (!base) return ""
  const tracked = base.ref ? (await git(cwd, ["diff", "--no-color", base.ref])).stdout.toString() : ""
  const fresh = (await untracked(cwd)).filter((file) => !base.early.includes(file)).slice(0, limits.files ?? FILES)
  const added = await Promise.all(
    fresh.map(async (file) => {
      const out = await git(cwd, ["diff", "--no-color", "--no-index", "--", "/dev/null", file])
      return { file, text: out.stdout.toString() }
    }),
  )
  // A binary file has no text to read, so name it at the end instead of printing it among the code.
  const binary = added.filter((item) => item.text.includes("Binary files"))
  const text = added
    .filter((item) => !item.text.includes("Binary files"))
    .map((item) => clip(item.text, limits.file ?? FILE))
  const names =
    binary.length > 0 ? [`Also changed, with no text diff: ${binary.map((item) => item.file).join(", ")}`] : []
  return [tracked, ...text, ...names].filter((part) => part.trim() !== "").join("\n")
}
