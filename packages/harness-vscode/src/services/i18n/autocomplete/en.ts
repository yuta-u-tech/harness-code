// English runtime translations for autocomplete (harness:autocomplete.* namespace)
// Source: src/i18n/locales/en/harness.json → "autocomplete" section

export const dict = {
  "harness:autocomplete.statusBar.enabled": "$(sparkle) Autocomplete",
  "harness:autocomplete.statusBar.snoozed": "snoozed",
  "harness:autocomplete.statusBar.warning": "$(warning) Autocomplete",
  "harness:autocomplete.statusBar.tooltip.basic": "Harness Code Autocomplete",
  "harness:autocomplete.statusBar.tooltip.noUsableProvider":
    "**No autocomplete model configured**\n\nTo enable autocomplete, add a profile with one of these supported providers: {{providers}}.\n\n[Open Settings]({{command}})",
  "harness:autocomplete.statusBar.tooltip.completionSummary":
    "Performed {{count}} completions between {{startTime}} and {{endTime}}, for a total cost of {{cost}}.",
  "harness:autocomplete.statusBar.tooltip.providerInfo": "Autocompletions provided by {{model}} via {{provider}}.",
  "harness:autocomplete.statusBar.cost.zero": "$0.00",
  "harness:autocomplete.statusBar.cost.lessThanCent": "<$0.01",
  "harness:autocomplete.codeAction.title": "Harness Code: Suggested Edits",
  "harness:autocomplete.incompatibilityExtensionPopup.message":
    "The Harness Code Autocomplete is being blocked by a conflict with GitHub Copilot. To fix this, you must disable Copilot's inline suggestions.",
  "harness:autocomplete.incompatibilityExtensionPopup.disableCopilot": "Disable Copilot",
  "harness:autocomplete.incompatibilityExtensionPopup.disableInlineAssist": "Disable Autocomplete",
  "harness:autocomplete.creditsExhausted.message":
    "Harness Code Autocomplete has been paused. Possible causes: your Harness account has no remaining credits, or your configured API key (BYOK) has reached its quota limit. Add Harness credits or check your API key configuration to resume autocomplete.",
  "harness:autocomplete.creditsExhausted.addCredits": "Add Credits",
  "harness:autocomplete.authError.message":
    "Harness Code Autocomplete has been paused due to an authentication issue. Possible causes: you are not signed in to Harness, or your API key (BYOK) is invalid or missing. Please sign in again or check your provider API key settings.",
}
