export const dict = {
  "harness:autocomplete.statusBar.enabled": "$(sparkle) オートコンプリート",
  "harness:autocomplete.statusBar.snoozed": "一時停止中",
  "harness:autocomplete.statusBar.warning": "$(warning) オートコンプリート",
  "harness:autocomplete.statusBar.tooltip.basic": "Harness Code オートコンプリート",
  "harness:autocomplete.statusBar.tooltip.noUsableProvider":
    "**オートコンプリートモデルが設定されていません**\n\nオートコンプリートを有効にするには、次の対応プロバイダーのいずれかを含むプロファイルを追加してください: {{providers}}。\n\n[設定を開く]({{command}})",
  "harness:autocomplete.statusBar.tooltip.completionSummary":
    "{{startTime}} から {{endTime}} までに {{count}} 件の補完を実行し、合計コストは {{cost}} でした。",
  "harness:autocomplete.statusBar.tooltip.providerInfo":
    "オートコンプリートは {{provider}} 経由の {{model}} によって提供されています。",
  "harness:autocomplete.statusBar.cost.zero": "$0.00",
  "harness:autocomplete.statusBar.cost.lessThanCent": "<$0.01",
  "harness:autocomplete.codeAction.title": "Harness Code: 提案された編集",
  "harness:autocomplete.incompatibilityExtensionPopup.message":
    "Harness Code オートコンプリートは GitHub Copilot との競合によりブロックされています。修正するには、Copilot のインライン提案を無効にする必要があります。",
  "harness:autocomplete.incompatibilityExtensionPopup.disableCopilot": "Copilot を無効化",
  "harness:autocomplete.incompatibilityExtensionPopup.disableInlineAssist": "オートコンプリートを無効化",
  "harness:autocomplete.creditsExhausted.message":
    "Harness Code オートコンプリートは一時停止されました。考えられる原因: Harness アカウントに残りクレジットがない、または設定済みの API キー (BYOK) がクォータ上限に達しています。オートコンプリートを再開するには、Harness クレジットを追加するか API キー設定を確認してください。",
  "harness:autocomplete.creditsExhausted.addCredits": "クレジットを追加",
  "harness:autocomplete.authError.message":
    "Harness Code オートコンプリートは認証の問題により一時停止されました。考えられる原因: Harness にサインインしていない、または API キー (BYOK) が無効または不足しています。再度サインインするか、プロバイダーの API キー設定を確認してください。",
}
