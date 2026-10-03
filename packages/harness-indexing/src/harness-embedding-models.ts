export type HarnessEmbeddingModel = {
  id: string
  name: string
  dimension: number
  scoreThreshold: number
  note?: string
}

export type HarnessEmbeddingModelCatalog = {
  defaultModel: string
  models: HarnessEmbeddingModel[]
  aliases: Record<string, string>
}

export const EMPTY_HARNESS_EMBEDDING_MODEL_CATALOG: HarnessEmbeddingModelCatalog = {
  defaultModel: "",
  models: [],
  aliases: {},
}

export function normalizeHarnessEmbeddingModelId(model: string | undefined, catalog = EMPTY_HARNESS_EMBEDDING_MODEL_CATALOG) {
  if (!model) return undefined
  return catalog.aliases[model] ?? model
}

export function getHarnessEmbeddingModel(model: string | undefined, catalog = EMPTY_HARNESS_EMBEDDING_MODEL_CATALOG) {
  const id = normalizeHarnessEmbeddingModelId(model, catalog)
  return catalog.models.find((item) => item.id === id)
}

export function formatHarnessEmbeddingModelLabel(model: HarnessEmbeddingModel): string {
  const note = model.note ? `${model.note}, ` : ""
  return `${model.name} (${note}${model.dimension}d)`
}
