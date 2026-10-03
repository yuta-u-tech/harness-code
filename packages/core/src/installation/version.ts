declare global {
  const HARNESS_VERSION: string
  const HARNESS_CHANNEL: string
  const HARNESS_BUILD_KIND: string
}

export const InstallationVersion = typeof HARNESS_VERSION === "string" ? HARNESS_VERSION : "local"
export const InstallationChannel = typeof HARNESS_CHANNEL === "string" ? HARNESS_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
export const InstallationBuildKind: "source" | "release" =
  typeof HARNESS_BUILD_KIND === "string" && HARNESS_BUILD_KIND === "release" ? "release" : "source"
