// kilocode_change - new file
import * as Core from "@opencode-ai/core/models-dev"
import { Context, Effect, Layer } from "effect"
import { AI_SDK_PROVIDERS, PROMPTS } from "@kilocode/kilo-gateway"
import { overlay } from "@/kilocode/anaconda-desktop/provider"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder" // kilocode_change

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
      const providers = overlay(yield* core.get())
      // Hosted gateway catalogs are not offered, so nothing here is fetched from them.
      delete providers.kilo
      delete providers.apertis
      return providers
    })

    return Service.of({ get, refresh: core.refresh })
  }),
)

export const defaultLayer: Layer.Layer<Service> = Layer.suspend(() => AppNodeBuilder.build(node)) // kilocode_change - build from the LayerNode graph

export const node = LayerNode.make({
  service: Service,
  layer,
  deps: [Core.node],
})

export { AI_SDK_PROVIDERS, PROMPTS }
export * as ModelsDev from "./models"
