import type { HarnessClient } from "@harness/sdk/v2/client"
import type { MarketplaceItemRef, RemoveResult } from "./types"

/** Removes configured agents, MCP servers and skills through the backend. */
export class MarketplaceService {
  async remove(
    client: HarnessClient,
    item: MarketplaceItemRef,
    scope: "project" | "global",
    dir: string,
  ): Promise<RemoveResult> {
    const { data } = await client.harness.marketplace.remove(
      { directory: dir, item: { id: item.id, type: item.type }, scope },
      { throwOnError: true },
    )
    return data as RemoveResult
  }

  dispose(): void {}
}

export type { RemoveResult } from "./types"
