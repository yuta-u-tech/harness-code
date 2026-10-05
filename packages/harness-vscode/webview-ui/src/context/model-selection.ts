import type { ModelSelection, Provider } from "../types/messages"
import { isModelValid } from "./provider-utils"

export function resolveModelSelection(input: {
  providers: Record<string, Provider>
  connected: string[]
  session?: ModelSelection | null
  preferred?: ModelSelection | null
  override?: ModelSelection | null
  mode?: ModelSelection | null
  global?: ModelSelection | null
  recent?: ModelSelection[]
  fallback?: ModelSelection | null
}): ModelSelection | null {
  const validate = (selection: ModelSelection | null | undefined) => {
    if (!selection) return null
    return isModelValid(input.providers, input.connected, selection) ? selection : null
  }
  const preference =
    validate(input.session) ??
    validate(input.preferred) ??
    validate(input.override) ??
    validate(input.mode) ??
    validate(input.global)
  if (preference) return preference
  for (const selection of input.recent ?? []) {
    const model = validate(selection)
    if (model) return model
  }
  return validate(input.fallback)
}
