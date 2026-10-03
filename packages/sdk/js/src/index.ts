export * from "./client.js"
export * from "./server.js"

import { createHarnessClient } from "./client.js"
import { createHarnessServer } from "./server.js"
import type { ServerOptions } from "./server.js"

export async function createHarness(options?: ServerOptions) {
  const server = await createHarnessServer({
    ...options,
  })

  const client = createHarnessClient({
    baseUrl: server.url,
  })

  return {
    client,
    server,
  }
}
