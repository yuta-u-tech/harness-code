import { createHarness, HARNESS_OPENROUTER_BASE } from "@harness/harness-gateway"
import { Effect } from "effect"
import { ProviderV2 } from "../../provider"
import { define } from "../internal"

const id = ProviderV2.ID.harness

export const HarnessPlugin = define({
  id: "harness",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.catalog.transform(
      Effect.fn(function* (evt) {
        for (const item of evt.provider.list()) {
          if (item.provider.id !== id) continue
          evt.provider.update(item.provider.id, (provider) => {
            const options = provider.request.body
            const token = options.harnessToken ?? options.apiKey ?? process.env.HARNESS_API_KEY
            const org = process.env.HARNESS_ORG_ID ?? options.harnessOrganizationId

            provider.api = {
              type: "aisdk",
              package: "@harness/harness-gateway",
              url: HARNESS_OPENROUTER_BASE,
            }
            provider.request.headers["HTTP-Referer"] = "https://kilo.ai/"
            provider.request.headers["X-Title"] = "Harness Code"
            options.apiKey = token ?? "anonymous"
            options.harnessToken = options.apiKey
            if (org) options.harnessOrganizationId = org
          })
        }
      }),
    )
    yield* ctx.aisdk.sdk(
      Effect.fn(function* (evt) {
        if (evt.model.providerID !== id) return
        evt.sdk = createHarness(evt.options)
      }),
    )
  }),
})
