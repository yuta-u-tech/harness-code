# Harness Code

An open source AI coding agent for VS Code that works through a **harness**: a flow you define of agent steps, checks and your own review.

## Features

Open **Settings → Harness** to build a flow step by step.

- **Agent steps**: pick a model and reasoning level, write the system prompt, choose the tools and which subagents the step may call.
- **Check steps**: mix command checks (exit code 0 passes) with AI-scored checks. A scored check has criteria, weights, a pass line and several scoring runs, and the median is used. A required check that fails sends the flow back to an earlier step with the failure output. An advisory check never stops the flow; its result goes to you.
- **Your review**: the flow waits for you to approve, or to reject with a comment that goes back to the step you choose.

Model lists and reasoning levels come from the provider catalog, so new models appear without changes here.

## Running a flow

Start a run from the backend API (`POST /harness/run` with a task), then poll `GET /harness/run/:id` and answer a waiting review with `POST /harness/run/:id/review`. A run in progress can be stopped with `POST /harness/run/:id/stop`.

A run that was cut off by a restart of the backend is shown as interrupted.

## Develop

```bash
bun install
bun run extension:isolated   # build and open VS Code with the extension in dev mode
```

See [AGENTS.md](./AGENTS.md) for the layout and the checks to run before committing.
