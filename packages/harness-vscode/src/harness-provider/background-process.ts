import type { HarnessClient } from "@harness/sdk/v2/client"

export async function stopSessionProcesses(
  client: HarnessClient | null,
  sessionID: string,
  directory: string,
): Promise<void> {
  if (!client) return
  await client.backgroundProcess
    .stopSession({ sessionID, directory })
    .catch((err: unknown) => console.warn("[Harness New] HarnessProvider: Failed to stop background processes:", err))
}
