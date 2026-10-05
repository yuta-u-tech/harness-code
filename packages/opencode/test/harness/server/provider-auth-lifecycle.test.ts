import { expect } from "bun:test"
import { Effect, Layer, Ref } from "effect"
import { invalidateAfterProviderAuthChange } from "../../../src/harness/server/provider-auth-lifecycle"
import { InstanceStore } from "../../../src/project/instance-store"
import { testEffect } from "../../lib/effect"

const it = testEffect(Layer.empty)

function layer(events: Ref.Ref<string[]>) {
  return Layer.mergeAll(
    Layer.mock(InstanceStore.Service)({
      disposeAll: () => Ref.update(events, (items) => [...items, "dispose"]),
    }),
  )
}

it.effect("disposes instances after auth changes", () =>
  Effect.gen(function* () {
    const events = yield* Ref.make<string[]>([])

    yield* invalidateAfterProviderAuthChange("harness").pipe(Effect.provide(layer(events)))

    expect(yield* Ref.get(events)).toEqual(["dispose"])
  }),
)
