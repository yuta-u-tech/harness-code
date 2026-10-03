# Harness Rules Migration

This document explains how Harness rules are automatically migrated to Opencode's `instructions` config array.

## Overview

Harness stores rules in various file locations. When Opencode starts, it reads these files and injects their paths into the `instructions` config array, which Opencode then loads as part of the system prompt.

## Key Guarantees

### 1. Read-Only Migration

The migration **never modifies project files**. We only:

- Read existing rule files from disk
- Inject file paths into the config's `instructions` array
- Never write to the project or modify any files

### 2. Combines with Existing Config (Never Overwrites)

If you have existing opencode config with `instructions`, the Harness rules are **combined**, not replaced:

```typescript
// Example: User has opencode.json with:
{ "instructions": ["AGENTS.md", "custom-rules.md"] }

// Harness rules add:
{ "instructions": [".harnessrules", ".harness/rules/coding.md"] }

// Result (combined, deduplicated):
{ "instructions": ["AGENTS.md", "custom-rules.md", ".harnessrules", ".harness/rules/coding.md"] }
```

### 3. Restart to Pick Up Changes

If you change your Harness configuration (e.g., edit `.harnessrules`), simply restart harness-cli to pick up the new config. No manual migration or conversion needed.

## Source Locations

The migrator reads rules from these locations:

### Project Rules

| Location | Description |
|---|---|
| `.harnessrules` | Legacy single-file rules in project root |
| `.harness/rules/*.md` | Directory-based rules (multiple markdown files) |
| `.harnessrules-{mode}` | Mode-specific legacy rules (e.g., `.harnessrules-code`) |
| `.harness/rules-{mode}/*.md` | Mode-specific rule directories |

### Global Rules

| Location | Description |
|---|---|
| `~/.harness/rules/*.md` | Global rules directory |

## File Mapping

| Harness Location | Opencode Equivalent |
|---|---|
| `.harnessrules` | `instructions: [".harnessrules"]` |
| `.harnessrules-{mode}` | `instructions: [".harnessrules-{mode}"]` |
| `.harness/rules/*.md` | `instructions: [".harness/rules/file.md", ...]` |
| `.harness/rules-{mode}/*.md` | `instructions: [".harness/rules-{mode}/file.md", ...]` |
| `~/.harness/rules/*.md` | `instructions: ["~/.harness/rules/file.md", ...]` |

## AGENTS.md Compatibility

`AGENTS.md` is loaded **natively** by Opencode - no migration needed. Opencode automatically loads:

- `AGENTS.md` in project root
- `CLAUDE.md` in project root
- `~/.config/harness/AGENTS.md` (global)

## Not Migrated

The following are **not** migrated:

- `.roorules` - Roo-specific rules
- `.clinerules` - Cline-specific rules

Only Harness-specific files (`.harnessrules`, `.harness/rules/`) are migrated.

## Mode-Specific Rules

Mode-specific rules (e.g., `.harnessrules-code`, `.harness/rules-architect/`) are included by default. All mode-specific rules are loaded regardless of the current mode.

## Warnings

The migrator generates warnings for:

- **Legacy files**: When `.harnessrules` is found, a warning suggests migrating to `.harness/rules/` directory structure

## Example

### Before (Harness)

```
project/
├── .harnessrules           # Legacy rules
├── .harnessrules-code      # Code-mode specific
└── .harness/
    └── rules/
        ├── coding.md        # Coding standards
        └── testing.md       # Testing guidelines
```

### After (Opencode Config)

```json
{
  "instructions": [
    "/path/to/project/.harness/rules/coding.md",
    "/path/to/project/.harness/rules/testing.md",
    "/path/to/project/.harnessrules",
    "/path/to/project/.harnessrules-code"
  ]
}
```

## Troubleshooting

### Rules not appearing

1. Check the file exists at the expected location
2. Ensure markdown files have `.md` extension
3. Restart harness-cli to pick up changes

### Duplicate rules

The `mergeConfigConcatArrays` function automatically deduplicates the `instructions` array using `Array.from(new Set([...]))`.

## Related Files

- [`rules-migrator.ts`](../rules-migrator.ts) - Core migration logic
- [`config-injector.ts`](../config-injector.ts) - Config building and injection
- [`modes-migration.md`](./modes-migration.md) - Modes migration documentation
