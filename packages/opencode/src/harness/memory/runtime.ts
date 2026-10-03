import { Global } from "@opencode-ai/core/global"
import * as Log from "@opencode-ai/core/util/log"
import { MemoryInstance } from "@harness/harness-memory/effect/instance"
import { MemoryLog } from "@harness/harness-memory/effect/log"
import { MemoryPaths } from "@harness/harness-memory/effect/paths"
import { bind } from "@/harness/instance"
import { MemoryEvents } from "./events"

const log = Log.create({ service: "memory" })

let installed = false

/** Wire the package's injectable seams to opencode at process startup: the instance-context binder
 * (so async package calls survive the host ALS), the diagnostic logger, host paths (resolved from
 * Global), and the Bus-backed event sink. Idempotent. */
export function installMemoryRuntime() {
  if (installed) return
  installed = true
  MemoryPaths.configure(() => ({ data: Global.Path.data }))
  MemoryInstance.setBinder((fn) => bind(fn))
  MemoryLog.setWarn((message, meta) => log.warn(message, meta))
  MemoryEvents.install()
}
