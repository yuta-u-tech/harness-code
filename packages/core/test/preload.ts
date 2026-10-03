import path from "path"

process.env.HARNESS_DB = ":memory:"
process.env.HARNESS_MODELS_PATH = path.join(import.meta.dir, "plugin", "fixtures", "models-dev.json")
process.env.HARNESS_DISABLE_MODELS_FETCH = "true"

// is the only thing keeping them off the real ~/.local/share/harness database. Verify the
// resolved path (env is read at flag import time, so this must stay after the env writes).
const { Database } = await import("../src/database/database")
const resolved = Database.path()
if (resolved !== ":memory:") {
  throw new Error(`unit test preload: database path must resolve to ":memory:", got "${resolved}"`)
}
