import { createContext, createSignal, onCleanup, useContext, type Accessor, type ParentComponent } from "solid-js"
import {
  EMPTY_HARNESS_EMBEDDING_MODEL_CATALOG,
  type HarnessEmbeddingModelCatalog,
} from "@harness/harness-indexing/embedding-models"
import { useVSCode } from "./vscode"
import type { ExtensionMessage } from "../types/messages"

type HarnessEmbeddingModelsContextValue = {
  catalog: Accessor<HarnessEmbeddingModelCatalog>
}

export const HarnessEmbeddingModelsContext = createContext<HarnessEmbeddingModelsContextValue>()

export const HarnessEmbeddingModelsProvider: ParentComponent = (props) => {
  const vscode = useVSCode()
  const [catalog, setCatalog] = createSignal<HarnessEmbeddingModelCatalog>(EMPTY_HARNESS_EMBEDDING_MODEL_CATALOG)

  const unsubscribe = vscode.onMessage((message: ExtensionMessage) => {
    if (message.type !== "harnessEmbeddingModelsLoaded") return
    setCatalog(message.catalog)
  })

  vscode.postMessage({ type: "requestHarnessEmbeddingModels" })

  onCleanup(unsubscribe)

  return <HarnessEmbeddingModelsContext.Provider value={{ catalog }}>{props.children}</HarnessEmbeddingModelsContext.Provider>
}
