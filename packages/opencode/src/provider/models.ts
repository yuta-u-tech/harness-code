import * as Core from "@opencode-ai/core/models-dev"
import { Context, Effect, Layer } from "effect"
import { AI_SDK_PROVIDERS, PROMPTS } from "@opencode-ai/core/v1/config/provider"
import { overlay } from "@/harness/anaconda-desktop/provider"
import { overlay as ollama } from "@/harness/ollama/provider"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"

export const Model = Core.Model
export type Model = Core.Model
export const Provider = Core.Provider
export type Provider = Core.Provider
export const CatalogModelStatus = Core.CatalogModelStatus
export type CatalogModelStatus = Core.CatalogModelStatus

export interface Interface extends Core.Interface {}

export class Service extends Context.Service<Service, Interface>()("@opencode/ModelsDev") {}

export const layer: Layer.Layer<Service, never, Core.Service> = Layer.effect(
  Service,
  Effect.gen(function* () {
    const core = yield* Core.Service

    const get = Effect.fn("ModelsDev.get")(function* () {
      const catalog = overlay(yield* core.get())
      const providers = yield* Effect.promise(() => ollama(catalog))
      // Hosted gateway catalogs are not offered, so nothing here is fetched from them.
      delete providers.harness
      delete providers.apertis
      return providers
    })

    return Service.of({ get, refresh: core.refresh })
  }),
)

export const defaultLayer: Layer.Layer<Service> = Layer.suspend(() => AppNodeBuilder.build(node))

export const node = LayerNode.make({
  service: Service,
  layer,
  deps: [Core.node],
})

export { AI_SDK_PROVIDERS, PROMPTS }
export * as ModelsDev from "./models"
