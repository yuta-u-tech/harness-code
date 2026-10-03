import { Cause, Context, Effect, Layer } from "effect"
import { EffectBridge } from "@/effect/bridge"
import { HarnessSessions } from "@/harness-sessions/harness-sessions"
import * as Log from "@opencode-ai/core/util/log"
import { Global } from "@opencode-ai/core/global"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import path from "node:path"
import { Bus } from "@/bus"
import { Provider } from "@/provider/provider"
import { Session } from "@/session/session"
import { SessionSummary } from "@/session/summary"
import { SessionExport } from "@/harness/session-export"
import { createWorkspaceProvider } from "@/harness/session-export/workspace-provider"
import { Instance } from "@/harness/instance"
import { InstanceRef } from "@/effect/instance-ref"
import { Identity } from "@harness/harness-telemetry"
import { MemoryLifecycle } from "@/harness/memory/turn"
import { MemoryService } from "@harness/harness-memory/effect/service"
import { MemoryEvents } from "@/harness/memory/events"
import { installMemoryRuntime } from "@/harness/memory/runtime"
import { HarnessToolRegistry } from "@/harness/tool/registry"
import { Wakeup } from "@/harness/wakeup"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { HarnessWatcher } from "@/harness/watcher"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"

const log = Log.create({ service: "harness-bootstrap" })

export namespace HarnessBootstrap {
  export interface Interface {
    readonly init: () => Effect.Effect<void, unknown>
  }

  export class Service extends Context.Service<Service, Interface>()("@harness/Bootstrap") {}

  export const layer = Layer.effect(
    Service,
    Effect.gen(function* () {
      // Bind the package memory effect layer to opencode (paths, instance binder, logger, event sink).
      installMemoryRuntime()
      const harness = yield* HarnessSessions.Service
      const bus = yield* Bus.Service
      const sessions = yield* Session.Service
      const summary = yield* SessionSummary.Service
      const provider = yield* Provider.Service
      const memory = yield* MemoryService.Service
      const watcher = yield* HarnessWatcher.Service
      const wake = yield* Wakeup.Service

      const init = Effect.fn("HarnessBootstrap.init")(function* () {
        yield* watcher.init()
        yield* harness.init()
        yield* MemoryLifecycle.subscribe({ bus, sessions, summary, provider, memory })
        // Invalidate enabled cache on every memory state mutation (properties.directory holds the memory root).
        yield* bus.subscribeCallback(MemoryEvents.Status, (evt) =>
          HarnessToolRegistry.invalidateMemoryEnabled(evt.properties.directory),
        )
        yield* bus.subscribeCallback(MemoryEvents.Updated, (evt) =>
          HarnessToolRegistry.invalidateMemoryEnabled(evt.properties.directory),
        )
        // Re-arm this directory's persisted wakeups on every instance start: overdue ones
        // fire immediately, the rest get their timers. A failure must not block bootstrap.
        const inst = yield* InstanceRef
        if (inst) {
          yield* wake.adopt(inst.directory).pipe(
            Effect.catchCause((cause) =>
              Effect.sync(() => log.warn("wakeup adopt failed", { err: Cause.squash(cause) })),
            ),
          )
        }
        // Session export bootstrap.
        yield* Effect.gen(function* () {
          if (!SessionExport.enabled) return
          const anon = yield* EffectBridge.fromPromise(() =>
            Identity.getMachineId().catch((err) => {
              log.warn("session export identity failed", { err })
              return undefined
            }),
          )
          SessionExport.init({
            agentVersion: InstallationVersion,
            anonId: anon,
            dbPath: path.join(Global.Path.data, "session-export.db"),
            workspaceKey: Instance.directory,
            subscribeAll: (cb) => Bus.subscribeAll(cb),
            snapshotProvider: createWorkspaceProvider({
              root: Instance.directory,
              statePath: path.join(Global.Path.data, "session-export-workspace.json"),
            }),
          })
        }).pipe(
          Effect.catchCause((cause) =>
            Effect.sync(() => log.warn("session export bootstrap failed", { err: Cause.squash(cause) })),
          ),
        )
        if (process.env["HARNESS_PLATFORM"] !== "vscode") {
          yield* EffectBridge.fromPromise(() =>
            import("@/harness/indexing").then((mod) => mod.HarnessIndexing.init()),
          ).pipe(
            Effect.catchCause((cause) =>
              Effect.sync(() => log.warn("indexing bootstrap failed", { err: Cause.squash(cause) })),
            ),
            Effect.forkDetach,
          )
        }
      })

      return Service.of({ init })
    }),
  )

  export const defaultLayer = layer.pipe(
    Layer.provide([
      HarnessSessions.defaultLayer,
      Session.defaultLayer,
      AppNodeBuilder.build(SessionSummary.node),
      AppNodeBuilder.build(Provider.node),
      MemoryService.layer,
      Bus.defaultLayer,
      HarnessWatcher.defaultLayer,
      AppNodeBuilder.build(Wakeup.node),
    ]),
  )

  const memory = LayerNode.make({ service: MemoryService.Service, layer: MemoryService.layer, deps: [] })
  const watcher = LayerNode.make({ service: HarnessWatcher.Service, layer: HarnessWatcher.defaultLayer, deps: [] })
  export const node = LayerNode.suspend(() =>
    LayerNode.make({
      service: Service,
      layer,
      deps: [
        HarnessSessions.node,
        Session.node,
        SessionSummary.node,
        Provider.node,
        memory,
        Bus.node,
        watcher,
        Wakeup.node,
      ],
    }),
  )
}
