export function model(extra?: NodeJS.ProcessEnv | null): Record<string, string> {
  const env = Object.fromEntries(
    Object.entries({ ...process.env, ...(extra ?? {}) }).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  )
  delete env.HARNESS_SERVER_PASSWORD
  delete env.HARNESS_SERVER_USERNAME
  delete env.HARNESS_BROWSER_BROKER_URL
  delete env.HARNESS_BROWSER_BROKER_TOKEN
  delete env.HARNESS_CONFIG
  delete env.HARNESS_CONFIG_CONTENT
  delete env.HARNESS_CONFIG_DIR
  return env
}
