import type { WorkspaceV2 } from "@opencode-ai/core/workspace"
import { dispose } from "@/harness/effect/instance-registry"

const disposers = new Set<(directory: string, workspaceID?: WorkspaceV2.ID) => Promise<void>>()

export function registerDisposer(
  disposer: (directory: string, workspaceID?: WorkspaceV2.ID) => Promise<void>,
) {
  disposers.add(disposer)
  return () => {
    disposers.delete(disposer)
  }
}

export async function disposeInstance(directory: string, workspaceID?: WorkspaceV2.ID) {
  await dispose(directory, workspaceID, () =>
    Promise.allSettled([...disposers].map((disposer) => disposer(directory, workspaceID))),
  )
}
