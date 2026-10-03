/**
 * Language context
 * Provides i18n translations for harness-ui components.
 * Merges UI translations from @opencode-ai/ui and Harness overrides from @harness/harness-i18n.
 *
 * Locale priority: user override → VS Code display language → browser language → "en"
 */

import { createSignal, createMemo, createEffect, ParentComponent, Accessor } from "solid-js"
import { I18nProvider, pluralCategory, pluralKey } from "@harness/harness-ui/context"
import type { UiI18nKey, UiI18nParams, UiI18nPluralKey } from "@harness/harness-ui/context"
import { dict as uiEn } from "@harness/harness-ui/i18n/en"
import { dict as uiZh } from "@harness/harness-ui/i18n/zh"
import { dict as uiZht } from "@harness/harness-ui/i18n/zht"
import { dict as uiKo } from "@harness/harness-ui/i18n/ko"
import { dict as uiDe } from "@harness/harness-ui/i18n/de"
import { dict as uiEs } from "@harness/harness-ui/i18n/es"
import { dict as uiFr } from "@harness/harness-ui/i18n/fr"
import { dict as uiDa } from "@harness/harness-ui/i18n/da"
import { dict as uiJa } from "@harness/harness-ui/i18n/ja"
import { dict as uiPl } from "@harness/harness-ui/i18n/pl"
import { dict as uiRu } from "@harness/harness-ui/i18n/ru"
import { dict as uiAr } from "@harness/harness-ui/i18n/ar"
import { dict as uiNo } from "@harness/harness-ui/i18n/no"
import { dict as uiBr } from "@harness/harness-ui/i18n/br"
import { dict as uiTh } from "@harness/harness-ui/i18n/th"
import { dict as uiBs } from "@harness/harness-ui/i18n/bs"
import { dict as uiTr } from "@harness/harness-ui/i18n/tr"
import { dict as uiNl } from "@harness/harness-ui/i18n/nl"
import { dict as uiUk } from "@harness/harness-ui/i18n/uk"
import { dict as uiIt } from "@harness/harness-ui/i18n/it"
import { dict as uiFa } from "@harness/harness-ui/i18n/fa"
import { dict as appEn } from "../i18n/en"
import { dict as appZh } from "../i18n/zh"
import { dict as appZht } from "../i18n/zht"
import { dict as appKo } from "../i18n/ko"
import { dict as appDe } from "../i18n/de"
import { dict as appEs } from "../i18n/es"
import { dict as appFr } from "../i18n/fr"
import { dict as appDa } from "../i18n/da"
import { dict as appJa } from "../i18n/ja"
import { dict as appPl } from "../i18n/pl"
import { dict as appRu } from "../i18n/ru"
import { dict as appAr } from "../i18n/ar"
import { dict as appNo } from "../i18n/no"
import { dict as appBr } from "../i18n/br"
import { dict as appTh } from "../i18n/th"
import { dict as appBs } from "../i18n/bs"
import { dict as appTr } from "../i18n/tr"
import { dict as appNl } from "../i18n/nl"
import { dict as appUk } from "../i18n/uk"
import { dict as appIt } from "../i18n/it"
import { dict as appFa } from "../i18n/fa"
import { dict as amEn } from "../../agent-manager/i18n/en"
import { dict as amZh } from "../../agent-manager/i18n/zh"
import { dict as amZht } from "../../agent-manager/i18n/zht"
import { dict as amKo } from "../../agent-manager/i18n/ko"
import { dict as amDe } from "../../agent-manager/i18n/de"
import { dict as amEs } from "../../agent-manager/i18n/es"
import { dict as amFr } from "../../agent-manager/i18n/fr"
import { dict as amDa } from "../../agent-manager/i18n/da"
import { dict as amJa } from "../../agent-manager/i18n/ja"
import { dict as amPl } from "../../agent-manager/i18n/pl"
import { dict as amRu } from "../../agent-manager/i18n/ru"
import { dict as amAr } from "../../agent-manager/i18n/ar"
import { dict as amNo } from "../../agent-manager/i18n/no"
import { dict as amBr } from "../../agent-manager/i18n/br"
import { dict as amTh } from "../../agent-manager/i18n/th"
import { dict as amBs } from "../../agent-manager/i18n/bs"
import { dict as amTr } from "../../agent-manager/i18n/tr"
import { dict as amNl } from "../../agent-manager/i18n/nl"
import { dict as amUk } from "../../agent-manager/i18n/uk"
import { dict as amIt } from "../../agent-manager/i18n/it"
import { dict as amFa } from "../../agent-manager/i18n/fa"
import { dict as harnessEn } from "@harness/harness-i18n/en"
import { dict as harnessZh } from "@harness/harness-i18n/zh"
import { dict as harnessZht } from "@harness/harness-i18n/zht"
import { dict as harnessKo } from "@harness/harness-i18n/ko"
import { dict as harnessDe } from "@harness/harness-i18n/de"
import { dict as harnessEs } from "@harness/harness-i18n/es"
import { dict as harnessFr } from "@harness/harness-i18n/fr"
import { dict as harnessDa } from "@harness/harness-i18n/da"
import { dict as harnessJa } from "@harness/harness-i18n/ja"
import { dict as harnessPl } from "@harness/harness-i18n/pl"
import { dict as harnessRu } from "@harness/harness-i18n/ru"
import { dict as harnessAr } from "@harness/harness-i18n/ar"
import { dict as harnessNo } from "@harness/harness-i18n/no"
import { dict as harnessBr } from "@harness/harness-i18n/br"
import { dict as harnessTh } from "@harness/harness-i18n/th"
import { dict as harnessBs } from "@harness/harness-i18n/bs"
import { dict as harnessTr } from "@harness/harness-i18n/tr"
import { dict as harnessNl } from "@harness/harness-i18n/nl"
import { dict as harnessUk } from "@harness/harness-i18n/uk"
import { dict as harnessIt } from "@harness/harness-i18n/it"
import { useVSCode } from "./vscode"
import { normalizeLocale as _normalizeLocale, resolveTemplate as _resolveTemplate } from "./language-utils"

export type { Locale } from "./language-utils"
export { LOCALES } from "./language-utils"
import type { Locale } from "./language-utils"
import { LOCALES, RTL_LOCALES, localeToBcp47 } from "./language-utils"

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  zh: "简体中文",
  zht: "繁體中文",
  ko: "한국어",
  de: "Deutsch",
  es: "Español",
  fr: "Français",
  da: "Dansk",
  ja: "日本語",
  pl: "Polski",
  ru: "Русский",
  ar: "العربية",
  no: "Norsk",
  br: "Português (Brasil)",
  th: "ภาษาไทย",
  bs: "Bosanski",
  tr: "Türkçe",
  nl: "Nederlands",
  uk: "Українська",
  it: "Italiano",
  fa: "فارسی",
}

// Merge 4 dict layers: app + ui + harness + agent manager (harness and agent manager override last)
const base = { ...appEn, ...uiEn, ...harnessEn }
const dicts: Record<Locale, Record<string, string>> = {
  en: { ...base, ...amEn },
  zh: { ...base, ...appZh, ...uiZh, ...harnessZh, ...amEn, ...amZh },
  zht: { ...base, ...appZht, ...uiZht, ...harnessZht, ...amEn, ...amZht },
  ko: { ...base, ...appKo, ...uiKo, ...harnessKo, ...amEn, ...amKo },
  de: { ...base, ...appDe, ...uiDe, ...harnessDe, ...amEn, ...amDe },
  es: { ...base, ...appEs, ...uiEs, ...harnessEs, ...amEn, ...amEs },
  fr: { ...base, ...appFr, ...uiFr, ...harnessFr, ...amEn, ...amFr },
  da: { ...base, ...appDa, ...uiDa, ...harnessDa, ...amEn, ...amDa },
  ja: { ...base, ...appJa, ...uiJa, ...harnessJa, ...amEn, ...amJa },
  pl: { ...base, ...appPl, ...uiPl, ...harnessPl, ...amEn, ...amPl },
  ru: { ...base, ...appRu, ...uiRu, ...harnessRu, ...amEn, ...amRu },
  ar: { ...base, ...appAr, ...uiAr, ...harnessAr, ...amEn, ...amAr },
  no: { ...base, ...appNo, ...uiNo, ...harnessNo, ...amEn, ...amNo },
  br: { ...base, ...appBr, ...uiBr, ...harnessBr, ...amEn, ...amBr },
  th: { ...base, ...appTh, ...uiTh, ...harnessTh, ...amEn, ...amTh },
  bs: { ...base, ...appBs, ...uiBs, ...harnessBs, ...amEn, ...amBs },
  tr: { ...base, ...appTr, ...uiTr, ...harnessTr, ...amEn, ...amTr },
  nl: { ...base, ...appNl, ...uiNl, ...harnessNl, ...amEn, ...amNl },
  uk: { ...base, ...appUk, ...uiUk, ...harnessUk, ...amEn, ...amUk },
  it: { ...base, ...appIt, ...uiIt, ...harnessIt, ...amEn, ...amIt },
  // Persian (Harness fork addition). App, UI, and agent-manager layers are localized;
  // the Harness overrides layer falls back to English via `base`.
  fa: { ...base, ...appFa, ...uiFa, ...amEn, ...amFa },
}

function normalizeLocale(lang: string): Locale {
  return _normalizeLocale(lang)
}

function resolveTemplate(text: string, params?: UiI18nParams) {
  return _resolveTemplate(text, params as Record<string, string | number | boolean | undefined>)
}

interface LanguageProviderProps {
  vscodeLanguage?: Accessor<string | undefined>
  languageOverride?: Accessor<string | undefined>
}

export const LanguageProvider: ParentComponent<LanguageProviderProps> = (props) => {
  const vscode = useVSCode()
  const [userOverride, setUserOverride] = createSignal<Locale | "">("")

  // Initialize from extension-side override
  createEffect(() => {
    const override = props.languageOverride?.()
    if (override) {
      setUserOverride(normalizeLocale(override))
    }
  })

  // Resolved locale: user override → VS Code language → browser language → "en"
  const locale = createMemo<Locale>(() => {
    const override = userOverride()
    if (override) {
      return override
    }
    const vscodeLang = props.vscodeLanguage?.()
    if (vscodeLang) {
      return normalizeLocale(vscodeLang)
    }
    if (typeof navigator !== "undefined" && navigator.language) {
      return normalizeLocale(navigator.language)
    }
    return "en"
  })

  const dict = createMemo(() => dicts[locale()] ?? dicts.en)

  // Update <html lang> and <html dir> when locale changes
  createEffect(() => {
    const loc = locale()
    document.documentElement.lang = localeToBcp47(loc)
    document.documentElement.dir = RTL_LOCALES.has(loc) ? "rtl" : "ltr"
  })

  const t = (key: UiI18nKey, params?: UiI18nParams) => {
    const text = (dict() as Record<string, string>)[key] ?? (dicts.en as Record<string, string>)[key] ?? String(key)
    return resolveTemplate(text, params)
  }
  const plural = (key: UiI18nPluralKey, count: number, params?: UiI18nParams) =>
    t(pluralKey(key, pluralCategory(localeToBcp47(locale()), count)), { ...params, count })

  const setLocale = (next: Locale | "") => {
    setUserOverride(next)
    vscode.postMessage({ type: "setLanguage", locale: next })
  }

  return (
    <LanguageContext.Provider
      value={{ locale, setLocale, userOverride, t: t as (key: string, params?: UiI18nParams) => string }}
    >
      {/* Shared UI formats dates and numbers with Intl from this value, so it
          must be a BCP-47 tag (Harness's "zht" is not one). */}
      <I18nProvider value={{ locale: () => localeToBcp47(locale()), t, plural }}>{props.children}</I18nProvider>
    </LanguageContext.Provider>
  )
}

// Expose locale + setLocale for the LanguageTab
import { createContext, useContext } from "solid-js"

export interface LanguageContextValue {
  locale: Accessor<Locale>
  setLocale: (locale: Locale | "") => void
  userOverride: Accessor<Locale | "">
  t: (key: string, params?: UiI18nParams) => string
}

export const LanguageContext = createContext<LanguageContextValue>()

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return ctx
}
