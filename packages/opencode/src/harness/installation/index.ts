export const Npm = {
  name: "@harness/cli",
  path: "@harness%2fcli",
}

export const Brew = {
  name: "harness",
  tap: "Kilo-Org/tap",
  formula: "Kilo-Org/tap/harness",
  api: "https://formulae.brew.sh/api/formula/kilo.json",
}

export const Choco = {
  name: "harness",
  api: "https://community.chocolatey.org/api/v2/Packages?$filter=Id%20eq%20%27kilo%27%20and%20IsLatestVersion&$select=Version",
}

export const Scoop = {
  name: "harness",
  manifest: "https://raw.githubusercontent.com/ScoopInstaller/Main/master/bucket/kilo.json",
}

export const Release = {
  install: "https://kilo.ai/cli/install",
}
