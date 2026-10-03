/**
 * Harness Gateway TUI Integration
 *
 * This module provides TUI-specific functionality for harness-gateway.
 * It requires OpenCode TUI dependencies to be injected at runtime.
 *
 * Import from "@harness/harness-gateway/tui" for TUI features.
 */

// ============================================================================
// TUI Dependency Injection
// ============================================================================
export { initializeTUIDependencies, getTUIDependencies, areTUIDependenciesInitialized } from "./tui/context.js"
export type { TUIDependencies } from "./tui/types.js"

// ============================================================================
// TUI Helpers
// ============================================================================
export { formatProfileInfo, getOrganizationOptions, getDefaultOrganizationSelection } from "./tui/helpers.js"

// ============================================================================
// NOTE: TUI Components Moved to OpenCode
// ============================================================================
// All TUI components with JSX have been moved to packages/opencode/src/harness/
// to ensure correct JSX transpilation with @opentui/solid.
//
// Components moved:
// - registerHarnessCommands -> @/harness/harness-commands
// - DialogHarnessTeamSelect -> @/harness/components/dialog-harness-team-select
// - DialogHarnessOrganization -> @/harness/components/dialog-harness-organization
// - DialogHarnessProfile -> @/harness/components/dialog-harness-profile
// - HarnessAutoMethod -> @/harness/components/dialog-harness-auto-method
// - HarnessNews -> @/harness/components/harness-news
// - NotificationBanner -> @/harness/components/notification-banner
// - DialogHarnessNotifications -> @/harness/components/dialog-harness-notifications
