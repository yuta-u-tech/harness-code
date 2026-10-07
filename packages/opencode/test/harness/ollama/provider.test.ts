import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { catalog, contextOf, host, installed } from "@/harness/ollama/provider"

describe("ollama provider", () => {
  const server = Bun.serve({
    port: 0,
    fetch: (req) =>
      new URL(req.url).pathname === "/api/tags"
        ? Response.json({ models: [{ name: "qwen3-coder-64k:30b" }, { name: "gpt-oss:20b" }] })
        : new Response("no", { status: 404 }),
  })
  const base = `http://127.0.0.1:${server.port}`
  beforeAll(() => {})
  afterAll(() => server.stop(true))

  test("lists installed models from /api/tags", async () => {
    expect(await installed(base)).toEqual(["qwen3-coder-64k:30b", "gpt-oss:20b"])
  })

  test("builds an openai-compatible catalog entry pointing at /v1", () => {
    const provider = catalog(["gpt-oss:20b"], base)
    expect(provider.npm).toBe("@ai-sdk/openai-compatible")
    expect(provider.api).toBe(`${base}/v1`)
    expect(Object.keys(provider.models)).toEqual(["gpt-oss:20b"])
  })

  test("reads the context window from the model name", () => {
    expect(contextOf("qwen3-coder-64k:30b")).toBe(65536)
    expect(contextOf("qwen2.5:7b")).toBe(32768)
  })

  test("honours OLLAMA_HOST with or without a scheme", () => {
    expect(host({ OLLAMA_HOST: "10.0.0.5:11434/" })).toBe("http://10.0.0.5:11434")
    expect(host({})).toBe("http://127.0.0.1:11434")
  })
})
