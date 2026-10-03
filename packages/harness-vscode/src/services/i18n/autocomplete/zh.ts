export const dict = {
  "harness:autocomplete.statusBar.enabled": "$(sparkle) 自动补全",
  "harness:autocomplete.statusBar.snoozed": "已暂停",
  "harness:autocomplete.statusBar.warning": "$(warning) 自动补全",
  "harness:autocomplete.statusBar.tooltip.basic": "Harness Code 自动补全",
  "harness:autocomplete.statusBar.tooltip.noUsableProvider":
    "**未配置自动补全模型**\n\n要启用自动补全，请添加一个包含以下受支持提供商之一的配置文件：{{providers}}。\n\n[打开设置]({{command}})",
  "harness:autocomplete.statusBar.tooltip.completionSummary":
    "在 {{startTime}} 到 {{endTime}} 之间执行了 {{count}} 次补全，总成本为 {{cost}}。",
  "harness:autocomplete.statusBar.tooltip.providerInfo": "自动补全由 {{provider}} 通过 {{model}} 提供。",
  "harness:autocomplete.statusBar.cost.zero": "$0.00",
  "harness:autocomplete.statusBar.cost.lessThanCent": "<$0.01",
  "harness:autocomplete.codeAction.title": "Harness Code：建议的编辑",
  "harness:autocomplete.incompatibilityExtensionPopup.message":
    "Harness Code 自动补全因与 GitHub Copilot 冲突而被阻止。要修复此问题，必须禁用 Copilot 的内联建议。",
  "harness:autocomplete.incompatibilityExtensionPopup.disableCopilot": "禁用 Copilot",
  "harness:autocomplete.incompatibilityExtensionPopup.disableInlineAssist": "禁用自动补全",
  "harness:autocomplete.creditsExhausted.message":
    "Harness Code 自动补全已暂停。可能原因：你的 Harness 账户没有剩余额度，或你配置的 API 密钥（BYOK）已达到配额限制。请添加 Harness 额度或检查 API 密钥配置以恢复自动补全。",
  "harness:autocomplete.creditsExhausted.addCredits": "添加额度",
  "harness:autocomplete.authError.message":
    "Harness Code 自动补全因身份验证问题已暂停。可能原因：你尚未登录 Harness，或你的 API 密钥（BYOK）无效或缺失。请重新登录或检查提供商 API 密钥设置。",
}
