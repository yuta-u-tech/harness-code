export * as HarnessModel from "./model"

import { Agent } from "@/agent/agent"
import { AppRuntime } from "@/effect/app-runtime"
import { Provider } from "@/provider/provider"
import { LLM } from "@/session/llm"
import { HarnessLLM } from "@/harness/session/llm"
import { MessageID, SessionID } from "@/session/schema"
import { Effect } from "effect"

export interface Input {
  /** provider/model. Empty means the configured default model. */
  model: string
  /** Reasoning level from the model's variants. */
  variant?: string | null
  system: string
  user: string
  abort?: AbortSignal
}

const resolve = (id: string) =>
  Provider.Service.use((svc) =>
    Effect.gen(function* () {
      const ref = id === "" ? yield* svc.defaultModel() : Provider.parseModel(id)
      return yield* svc.getModel(ref.providerID, ref.modelID)
    }),
  )

/** One text answer from a model, with no tools and no session. */
export async function text(input: Input): Promise<string> {
  const model = await AppRuntime.runPromise(resolve(input.model))
  const variant = input.variant && model.variants?.[input.variant] ? input.variant : undefined
  const agent: Agent.Info = {
    name: "harness-judge",
    mode: "primary",
    hidden: true,
    options: {},
    permission: [],
    prompt: input.system,
    temperature: 0,
  }
  const session = SessionID.make("harness-judge")
  const request: LLM.StreamInput = {
    agent,
    user: {
      id: MessageID.ascending(),
      sessionID: session,
      role: "user",
      agent: agent.name,
      model: { providerID: model.providerID, modelID: model.id, ...(variant ? { variant } : {}) },
      time: { created: Date.now() },
    },
    tools: {},
    model,
    messages: [{ role: "user", content: input.user }],
    sessionID: session,
    system: [],
    retries: 2,
  }
  return AppRuntime.runPromise(
    LLM.Service.use((svc) => HarnessLLM.text(svc.stream(request)).pipe(Effect.orDie)),
    { signal: input.abort },
  )
}
