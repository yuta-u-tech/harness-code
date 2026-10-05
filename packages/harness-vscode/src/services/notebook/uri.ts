import * as vscode from "vscode"

interface NotebookResolution {
  notebook: vscode.NotebookDocument
  version: number
}

const resolutions = new WeakMap<vscode.Uri, NotebookResolution>()

function resolveNotebook(uri: vscode.Uri): vscode.NotebookDocument | undefined {
  const id = uri.toString()
  const cached = resolutions.get(uri)
  if (
    cached &&
    cached.notebook.version === cached.version &&
    vscode.workspace.notebookDocuments.includes(cached.notebook)
  ) {
    return cached.notebook
  }

  resolutions.delete(uri)
  for (const notebook of vscode.workspace.notebookDocuments) {
    if (!notebook.getCells().some((cell) => cell.document.uri.toString() === id)) continue
    resolutions.set(uri, { notebook, version: notebook.version })
    return notebook
  }
}

/** The notebook file behind a cell document URI; plain file URIs map to themselves. */
export function notebookUri(uri: vscode.Uri): vscode.Uri | undefined {
  if (uri.scheme === "file") return uri
  if (uri.scheme !== "vscode-notebook-cell") return
  return resolveNotebook(uri)?.uri
}
