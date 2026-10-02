# Harness Code

An open source AI coding agent for VS Code that works through a **harness**: a flow you define of agent steps, checks and your own review.

- **Agent steps**: choose a model and reasoning level, write the system prompt, pick the tools and the subagents a step may call.
- **Check steps**: mix command checks with AI-scored checks (criteria, weights, a pass line, several runs with the median taken). A failing required check sends the flow back to an earlier step together with the failure output.
- **Your review**: the flow waits for you to approve, or to reject with a comment that goes back to a step you choose.

## Layout

| Path | What it is |
|---|---|
| `packages/kilo-vscode/` | The VS Code extension, including the Harness settings tab |
| `packages/opencode/` | The backend: agents, sessions, providers and the harness engine (`src/kilocode/harness/`) |
| `packages/core/` | Shared schemas, including the `harness` config (`src/v1/config/harness.ts`) |

## Develop

```bash
bun install
bun run extension:isolated   # build and open VS Code with the extension in dev mode
```

See [AGENTS.md](./AGENTS.md) for the checks to run before committing.

## License

MIT. See [LICENSE](./LICENSE).
