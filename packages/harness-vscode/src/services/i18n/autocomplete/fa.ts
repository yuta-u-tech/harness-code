// English runtime translations for autocomplete (harness:autocomplete.* namespace)
// Source: src/i18n/locales/en/harness.json → "autocomplete" section

export const dict = {
  "harness:autocomplete.statusBar.enabled": "$(sparkle) تکمیل خودکار",
  "harness:autocomplete.statusBar.snoozed": "به تعویق افتاده",
  "harness:autocomplete.statusBar.warning": "$(warning) تکمیل خودکار",
  "harness:autocomplete.statusBar.tooltip.basic": "تکمیل خودکار Harness Code",
  "harness:autocomplete.statusBar.tooltip.noUsableProvider":
    "**هیچ مدل تکمیل خودکاری پیکربندی نشده است**\n\nبرای فعال‌سازی تکمیل خودکار، یک پروفایل با یکی از ارائه‌دهندگان پشتیبانی‌شده زیر اضافه کنید: {{providers}}.\n\n[باز کردن تنظیمات]({{command}})",
  "harness:autocomplete.statusBar.tooltip.completionSummary":
    "{{count}} تکمیل بین {{startTime}} و {{endTime}} انجام شد، با هزینه کل {{cost}}.",
  "harness:autocomplete.statusBar.tooltip.providerInfo":
    "تکمیل خودکار توسط {{model}} از طریق {{provider}} ارائه می‌شود.",
  "harness:autocomplete.statusBar.cost.zero": "۰.۰۰$",
  "harness:autocomplete.statusBar.cost.lessThanCent": "<۰.۰۱$",
  "harness:autocomplete.codeAction.title": "Harness Code: ویرایش‌های پیشنهادی",
  "harness:autocomplete.incompatibilityExtensionPopup.message":
    "تکمیل خودکار Harness Code به دلیل تعارض با GitHub Copilot مسدود شده است. برای رفع این مشکل، باید پیشنهادات درون‌خطی Copilot را غیرفعال کنید.",
  "harness:autocomplete.incompatibilityExtensionPopup.disableCopilot": "غیرفعال کردن Copilot",
  "harness:autocomplete.incompatibilityExtensionPopup.disableInlineAssist": "غیرفعال کردن تکمیل خودکار",
  "harness:autocomplete.creditsExhausted.message":
    "تکمیل خودکار Harness Code متوقف شده است. دلایل احتمالی: حساب Harness شما اعتبار کافی ندارد، یا کلید API پیکربندی‌شده (BYOK) به سقف مجاز خود رسیده است. برای از سرگیری تکمیل خودکار، اعتبار Harness اضافه کنید یا تنظیمات کلید API خود را بررسی کنید.",
  "harness:autocomplete.creditsExhausted.addCredits": "افزودن اعتبار",
  "harness:autocomplete.authError.message":
    "تکمیل خودکار Harness Code به دلیل مشکل احراز هویت متوقف شده است. دلایل احتمالی: وارد Harness نشده‌اید، یا کلید API (BYOK) شما نامعتبر یا وارد نشده است. لطفاً دوباره وارد شوید یا تنظیمات کلید API ارائه‌دهنده خود را بررسی کنید.",
}
