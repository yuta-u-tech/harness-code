export const opaque = [
  { id: "semantic_search", file: "harness/tool/semantic-search.ts" },
  { id: "lsp", file: "tool/lsp.ts" },
] as const

export const host = [
  { id: "notebook_execute", file: "harness/tool/notebook-host.ts" },
  { id: "background_process", file: "harness/tool/background-process.ts" },
] as const
