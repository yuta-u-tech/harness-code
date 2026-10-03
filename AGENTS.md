# AGENTS.md

Harness Code is an AI coding agent that works through a harness: a flow of agent steps, command checks, AI-scored checks and your own review.

- Prefer automation: carry out requested actions without asking, unless information is missing or the action cannot be undone.
- Use parallel tool calls when the calls do not depend on each other.

## Build and Dev

- **Backend**: `bun run dev` from the repo root, or `bun run --cwd packages/opencode --conditions=browser src/index.ts`.
- **Extension**: `bun run extension` builds and launches VS Code with the extension in dev mode. `bun run extension:isolated` keeps its own VS Code state in `.harness-dev/`.
- **Typecheck**: `bun run typecheck` (uses `tsgo`, not `tsc`).
- **Test**: run tests inside a package, never from the root. Backend: `bun test` from `packages/opencode/` (or one file). Extension: `bun run test:unit` from `packages/harness-vscode/`. Core: `bun test` from `packages/core/`.
- **SDK**: after changing server routes in `packages/opencode/src/**/httpapi/`, run `./script/generate.ts` from the root to regenerate `packages/sdk/`. Do not edit `packages/sdk/js/src/**/gen/` by hand.
- **Unused exports**: `bun run knip` from `packages/harness-vscode/`.
- **Format**: `bun run format` from `packages/harness-vscode/` before committing there.

## Packages

| Package | Purpose |
|---|---|
| `packages/opencode/` | The backend and CLI: agents, sessions, providers, tools, HTTP server. The harness engine is in `src/harness/run/`. |
| `packages/harness-vscode/` | The VS Code extension. The Harness settings tab is in `webview-ui/src/components/settings/harness/`. |
| `packages/core/` | Shared schemas and runtime. The `harness` config schema is `src/v1/config/harness.ts`. |
| `packages/sdk/` | Generated client for the server API. |
| `packages/harness-ui/` | SolidJS component library used by the extension webview. |
| `packages/harness-i18n/`, `harness-indexing/`, `harness-memory/`, `harness-sandbox/` | Translations, codebase indexing, project memory, command sandboxing. |

## The harness

A flow is an ordered list of steps in the `harness` config key.

- **agent**: runs an agent from the `agent` config (model, prompt, tools), or runs through the Codex or Claude Code CLI when the step has a `runner`.
- **check**: command checks and AI-scored checks. A failing required check sends the flow back to an earlier step with the failure output.
- **human**: waits for approve or reject.

The engine (`src/harness/run/engine.ts`) takes the model, session and review pieces as inputs. Its stepping, retries, command checks, scoring and gating are plain code with real tests. Runs are started and answered through `POST /harness/run` and its siblings.

## Style

- Prefer `const`. Use early returns instead of `else`.
- Avoid `try`/`catch` where possible. Never leave a `catch` empty.
- Avoid `any`. Rely on type inference; annotate exports.
- Use `array.at(index)` instead of `array[index]` when the index may be out of range.
- Prefer short, single-word names for locals and helpers.
- Use Bun APIs when possible (`Bun.file()` and so on).
- Keep functions small and files focused. Never mutate inputs; return new objects.

## Testing

- Write the test first, watch it fail, then write the code.
- Test the real implementation. Replace only what truly cannot run in a test, such as a model or a person.
- A change is not done until typecheck, the package's tests and `knip` (extension) pass.

## Commits

Use conventional commits: `type(scope): summary`. Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`. Scopes: `vscode`, `cli`, `core`, `sdk`.
