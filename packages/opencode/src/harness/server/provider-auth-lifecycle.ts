import { InstanceStore } from "@/project/instance-store"
import { ModelCache } from "@/provider/model-cache"
import { HarnessViewers } from "@/harness/presence/service"
import { Effect } from "effect"

export const disposeAllInstancesAfterProviderAuthCallback = Effect.fn(
  "HarnessServer.disposeAllInstancesAfterProviderAuthCallback",
)(function* () {
  const store = yield* InstanceStore.Service
  yield* store.disposeAll()
})

export const invalidatePresence = Effect.fn("HarnessServer.invalidatePresence")(function* () {
  const viewers = yield* HarnessViewers.Service
  yield* viewers.invalidateAuth()
})

export const invalidateAfterProviderAuthChange = Effect.fn("HarnessServer.invalidateAfterProviderAuthChange")(function* (
  providerID: string,
) {
  const cache = yield* ModelCache.Service
  yield* cache.clear(providerID)
  yield* disposeAllInstancesAfterProviderAuthCallback()
})
