# Harness CLI

The backend and CLI of Harness Code: agents, sessions, providers, tools and the local HTTP server that the VS Code extension talks to. The harness engine (flows of agent steps, checks and review) lives in `src/harness/run/`.

See the repository README for an overview: https://github.com/yuta-u-tech/harness-code

## Development

```bash
bun install
bun run dev
```

Run tests from this directory with `bun test` (or pass a single file).
