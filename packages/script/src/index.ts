import { $ } from "bun"
import semver from "semver"
import path from "path"

const rootPkgPath = path.resolve(import.meta.dir, "../../../package.json")
const rootPkg = await Bun.file(rootPkgPath).json()
const expectedBunVersion = rootPkg.packageManager?.split("@")[1]

if (!expectedBunVersion) {
  throw new Error("packageManager field not found in root package.json")
}

// relax version requirement
const expectedBunVersionRange = `^${expectedBunVersion}`

if (!semver.satisfies(process.versions.bun, expectedBunVersionRange)) {
  throw new Error(`This script requires bun@${expectedBunVersionRange}, but you are using bun@${process.versions.bun}`)
}
const env = {
  HARNESS_CHANNEL: process.env["HARNESS_CHANNEL"],
  HARNESS_BUMP: process.env["HARNESS_BUMP"],
  HARNESS_VERSION: process.env["HARNESS_VERSION"],
  HARNESS_RELEASE: process.env["HARNESS_RELEASE"],
  HARNESS_PRE_RELEASE: process.env["HARNESS_PRE_RELEASE"],
}
const CHANNEL = await (async () => {
  if (env.HARNESS_CHANNEL) return env.HARNESS_CHANNEL
  if (env.HARNESS_PRE_RELEASE === "true") return "rc"
  if (env.HARNESS_BUMP) return "latest"
  if (env.HARNESS_VERSION && !env.HARNESS_VERSION.startsWith("0.0.0-")) return "latest"
  return await $`git branch --show-current`.text().then((x) => x.trim().replace(/[^0-9A-Za-z-]/g, "-"))
})()
const IS_PREVIEW = CHANNEL !== "latest"

function parseVersion(input: string) {
  const match = input.trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/)
  if (!match) return
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    value: `${match[1]}.${match[2]}.${match[3]}`,
  }
}

function compareVersion(
  a: NonNullable<ReturnType<typeof parseVersion>>,
  b: NonNullable<ReturnType<typeof parseVersion>>,
) {
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  return a.patch - b.patch
}

async function fetchLatest() {
  const data: any = await fetch("https://registry.npmjs.org/@harness/cli/latest").then((res) => {
    if (!res.ok) throw new Error(res.statusText)
    return res.json()
  })
  return data.version as string
}

async function fetchHighest() {
  if (!process.env.GH_REPO) return fetchLatest()
  const data: { tagName: string }[] = await $`gh release list --json tagName --limit 100 --repo ${process.env.GH_REPO}`
    .json()
    .catch(() => [])
  const versions = data.flatMap((item) => {
    const version = parseVersion(item.tagName)
    if (!version) return []
    return [version]
  })
  const highest = versions.sort(compareVersion).at(-1)
  if (highest) return highest.value
  return fetchLatest()
}

function bumpVersion(current: string, type: string) {
  const version = parseVersion(current)
  if (!version) throw new Error(`Invalid version: ${current}`)
  if (type === "major") return `${version.major + 1}.0.0`
  if (type === "minor") return `${version.major}.${version.minor + 1}.0`
  return `${version.major}.${version.minor}.${version.patch + 1}`
}

const VERSION = await (async () => {
  if (env.HARNESS_VERSION) return env.HARNESS_VERSION
  if (IS_PREVIEW) {
    if (env.HARNESS_BUMP && env.HARNESS_PRE_RELEASE === "true") {
      const current = await fetchHighest()
      return bumpVersion(current, env.HARNESS_BUMP.toLowerCase())
    }
    return `0.0.0-${CHANNEL}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`
  }
  const version = await fetchHighest()
  return bumpVersion(version, env.HARNESS_BUMP?.toLowerCase() ?? "patch")
})()

const team = [
  "actions-user",
  "alexkgold",
  "arimesser",
  "arkadiykondrashov",
  "bturcotte520",
  "chrarnoldus",
  "codingelves",
  "dependabot[bot]",
  "dosire",
  "Drixled",
  "DScdng",
  "emilieschario",
  "eshurakov",
  "evanjacobson",
  "Helix-Harness",
  "iscekic",
  "jeanduplessis",
  "jobrietbergen",
  "johnnyeric",
  "jrf0110",
  "harness-code-bot",
  "harness-code-bot[bot]",
  "harness-maintainer[bot]",
  "harness-bot",
  "harnessconnect-lite[bot]",
  "harnessconnect[bot]",
  "kirillk",
  "lambertjosh",
  "olearycrew",
  "pandemicsyn",
  "pedroheyerdahl",
  "RSO",
  "sbreitenother",
  "St0rmz1",
  "suhailkc2025",
]

export const Script = {
  get channel() {
    return CHANNEL
  },
  get version() {
    return VERSION
  },
  get preview() {
    return IS_PREVIEW
  },
  get release(): boolean {
    return !!env.HARNESS_RELEASE
  },
  get team() {
    return team
  },
}
console.log(`harness script`, JSON.stringify(Script, null, 2))
