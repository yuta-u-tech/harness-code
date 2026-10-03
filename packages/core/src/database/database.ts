export * as Database from "./database"

import { EffectDrizzleSqlite } from "@opencode-ai/effect-drizzle-sqlite"
import { layer as sqliteLayer } from "#sqlite"
import { Context, Effect, Layer } from "effect"
import { Global } from "../global"
import { Flag } from "../flag/flag"
import { isAbsolute, join } from "path"
import { existsSync } from "fs"
import { DbPreflight } from "../harness/db-preflight"
import { ensure as compat } from "../harness/database-compat"
import { DatabaseMigration } from "./migration"
import { InstallationChannel } from "../installation/version"
import { makeGlobalNode } from "../effect/app-node"

const makeDatabase = EffectDrizzleSqlite.makeWithDefaults()
type DatabaseShape = Effect.Success<typeof makeDatabase>

export interface Interface {
  db: DatabaseShape
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/storage/Database") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const db = yield* makeDatabase

    yield* db.run("PRAGMA busy_timeout = 5000")
    yield* db.run("PRAGMA journal_mode = WAL")
    yield* db.run("PRAGMA synchronous = NORMAL")
    yield* db.run("PRAGMA cache_size = -64000")
    yield* db.run("PRAGMA foreign_keys = ON")
    yield* db.run("PRAGMA wal_checkpoint(PASSIVE)")
    yield* DatabaseMigration.apply(db)
    yield* compat(db)

    return { db }
  }).pipe(Effect.orDie),
)

export function layerFromPath(filename: string) {
  DbPreflight.assertWritable(filename)
  return layer.pipe(Layer.provide(sqliteLayer({ filename, disableWAL: true })))
}

export function path() {
  if (Flag.HARNESS_DB) {
    if (Flag.HARNESS_DB === ":memory:" || isAbsolute(Flag.HARNESS_DB)) return Flag.HARNESS_DB
    return join(Global.Path.data, Flag.HARNESS_DB)
  }
  if (
    ["latest", "beta", "prod"].includes(InstallationChannel) ||
    process.env.HARNESS_DISABLE_CHANNEL_DB === "1" ||
    process.env.HARNESS_DISABLE_CHANNEL_DB === "true"
  )
    return join(Global.Path.data, "harness.db")
  const safe = InstallationChannel.replace(/[^a-zA-Z0-9._-]/g, "-")
  const next = join(Global.Path.data, `harness-${safe}.db`)
  const prev = join(Global.Path.data, `opencode-${safe}.db`)
  if (!existsSync(next) && existsSync(prev)) return prev
  return next
}

export const node = makeGlobalNode({
  service: Service,
  layer: Layer.unwrap(Effect.sync(() => layerFromPath(path()))),
  deps: [],
})
