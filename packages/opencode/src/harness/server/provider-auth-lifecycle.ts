import { InstanceStore } from "@/project/instance-store"
import { Effect } from "effect"

export const disposeAllInstancesAfterProviderAuthCallback = Effect.fn(
  "HarnessServer.disposeAllInstancesAfterProviderAuthCallback",
)(function* () {
  const store = yield* InstanceStore.Service
  yield* store.disposeAll()
})

export const invalidateAfterProviderAuthChange = Effect.fn("HarnessServer.invalidateAfterProviderAuthChange")(function* (
  _providerID: string,
) {
  yield* disposeAllInstancesAfterProviderAuthCallback()
})
