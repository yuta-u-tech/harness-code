import { lazy } from "@/harness/cli/lazy-commands"

export const HarnessConsoleCommand = lazy({
  command: "console",
  describe: "open or stop the local Harness Console (deprecated)",
  load: async () => (await import("@/harness/cli/cmd/console")).HarnessConsoleCommand,
})

export const RollCallCommand = lazy({
  command: "roll-call <filter>",
  describe: "batch-test text models matching a filter for connectivity and latency",
  load: async () => (await import("@/harness/cli/cmd/roll-call")).RollCallCommand,
})

export const DaemonCommand = lazy({
  command: "daemon",
  describe: "manage the local harness daemon",
  load: async () => (await import("@/harness/cli/cmd/daemon")).DaemonCommand,
})

export const ConfigCLICommand = lazy({
  command: "config",
  describe: "configuration tools",
  load: async () => (await import("@/cli/cmd/config")).ConfigCommand,
})

export const WorktreeCommand = lazy({
  command: "worktree",
  describe: "manage git worktrees",
  load: async () => (await import("@/harness/cli/cmd/worktree")).WorktreeCommand,
})

export const PtySmokeCommand = lazy({
  command: "__pty-smoke",
  describe: false,
  load: async () => (await import("@/harness/cli/cmd/pty-smoke")).PtySmokeCommand,
})

export const DevSetupCommand = lazy({
  command: "dev-setup",
  describe: "install a `harnessdev` shell alias for this checkout",
  load: async () => (await import("@/harness/cli/dev-setup")).DevSetupCommand,
})

export const DevAliasCommand = lazy({
  command: "dev-alias [shell]",
  describe: false,
  load: async () => (await import("@/harness/cli/dev-setup")).DevAliasCommand,
})
