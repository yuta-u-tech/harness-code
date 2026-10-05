export const Npm = {
  name: "@harness/cli",
  path: "@harness%2fcli",
}

export const Brew = {
  name: "harness",
  tap: "yuta-u-tech/tap",
  formula: "yuta-u-tech/tap/harness",
  api: "https://formulae.brew.sh/api/formula/harness.json",
}

export const Choco = {
  name: "harness",
  api: "https://community.chocolatey.org/api/v2/Packages?$filter=Id%20eq%20%27harness%27%20and%20IsLatestVersion&$select=Version",
}

export const Scoop = {
  name: "harness",
  manifest: "https://raw.githubusercontent.com/ScoopInstaller/Main/master/bucket/harness.json",
}

export const Release = {
  install: "https://github.com/yuta-u-tech/harness-code/releases/latest",
}
