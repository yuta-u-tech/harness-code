# @harness/harness-gateway

Unified Harness Gateway package for OpenCode providing authentication, AI provider integration, and API access.

## Features

- **Authentication**: Device authorization flow for Harness Gateway
- **AI Provider**: OpenRouter-based provider with Harness Gateway integration
- **API Integration**: Profile, balance, and model management
- **TUI Helpers**: Utilities for terminal UI components

## Installation

```bash
bun add @harness/harness-gateway
```

## Usage

### Plugin Registration

```typescript
import { HarnessAuthPlugin } from "@harness/harness-gateway"

// Register with OpenCode
const plugins = [HarnessAuthPlugin]
```

### Provider Usage

```typescript
import { createHarness } from "@harness/harness-gateway"

const provider = createHarness({
  harnessToken: process.env.HARNESS_API_KEY,
  harnessOrganizationId: "org-123",
})

const model = provider.languageModel("anthropic/claude-sonnet-4")
```

### API Access

```typescript
import { fetchProfile, fetchBalance } from "@harness/harness-gateway"

const profile = await fetchProfile(token)
const balance = await fetchBalance(token)
```

## License

MIT
