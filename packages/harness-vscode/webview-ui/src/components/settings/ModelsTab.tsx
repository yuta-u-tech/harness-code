import { Component, For, Show, createMemo } from "solid-js"
import { Card } from "@harness/harness-ui/card"
import { Select } from "@harness/harness-ui/select"
import { Switch } from "@harness/harness-ui/switch"
import { TextField } from "@harness/harness-ui/text-field"
import { Tooltip } from "@harness/harness-ui/tooltip"
import { useConfig } from "../../context/config"
import { useLanguage } from "../../context/language"
import { useProvider } from "../../context/provider"
import { useSession } from "../../context/session"
import { parseModelString } from "../../../../src/shared/provider-model"
import { ModelSelectorBase } from "../shared/ModelSelector"
import { ThinkingSelectorBase } from "../shared/ThinkingSelector"
import SettingsRow from "./SettingsRow"
import Advanced from "./Advanced"
import { preserveVariant } from "../../context/session-variant-store"

const ModelsTab: Component = () => {
  const { config, updateConfig } = useConfig()
  const language = useLanguage()
  const provider = useProvider()
  const session = useSession()

  function handleModelSelect(configKey: "model" | "small_model") {
    return (providerID: string, modelID: string) => {
      if (!providerID || !modelID) {
        updateConfig({ [configKey]: null })
        return
      }
      updateConfig({ [configKey]: `${providerID}/${modelID}` })
    }
  }

  const subagentModel = createMemo(() => parseModelString(config().subagent_model ?? undefined))
  const variantKey = createMemo(() => config().subagent_model ?? undefined)
  const subagentVariants = createMemo(() => Object.keys(provider.findModel(subagentModel())?.variants ?? {}))
  const subagentVariant = createMemo(() => {
    const key = variantKey()
    if (!key) return undefined
    const value = config().subagent_variant_overrides?.[key]
    if (value) return value
    return config().subagent_model === key ? (config().subagent_variant ?? undefined) : undefined
  })

  function handleSubagentModelSelect(providerID: string, modelID: string) {
    if (!providerID || !modelID) {
      updateConfig({ subagent_model: null, subagent_variant: null })
      return
    }
    const value = `${providerID}/${modelID}`
    const list = Object.keys(provider.findModel({ providerID, modelID })?.variants ?? {})
    const next = preserveVariant(subagentVariant(), list)
    updateConfig({
      subagent_model: value,
      ...(config().subagent_model === value ? {} : { subagent_variant: null }),
      ...(next ? { subagent_variant_overrides: { ...config().subagent_variant_overrides, [value]: next } } : {}),
    })
  }

  function updateSubagentVariant(value: string | null) {
    const key = variantKey()
    if (!key) return
    updateConfig({
      subagent_variant_overrides: { [key]: value },
      ...(config().subagent_model === key ? { subagent_variant: null } : {}),
    })
  }

  return (
    <div>
      <Card>
        <SettingsRow
          last
          title={language.t("settings.providers.defaultModel.title")}
          description={language.t("settings.providers.defaultModel.description")}
        >
          <ModelSelectorBase
            value={parseModelString(config().model ?? undefined)}
            onSelect={handleModelSelect("model")}
            placement="bottom-start"
            allowClear
            clearLabel={language.t("settings.providers.notSet")}
            label={language.t("settings.providers.defaultModel.title")}
            description={language.t("settings.providers.defaultModel.description")}
          />
        </SettingsRow>
      </Card>

      <Advanced>
        <Card>
          <SettingsRow
            last
            title={language.t("settings.providers.subagentModel.title")}
            description={language.t("settings.providers.subagentModel.description")}
          >
            <div style={{ display: "flex", "flex-direction": "column", "align-items": "flex-end", gap: "8px" }}>
              <ModelSelectorBase
                value={subagentModel()}
                onSelect={handleSubagentModelSelect}
                placement="bottom-start"
                allowClear
                clearLabel={language.t("settings.providers.notSet")}
                label={language.t("settings.providers.subagentModel.title")}
                description={language.t("settings.providers.subagentModel.description")}
              />
              <Show when={subagentVariants().length > 0}>
                <ThinkingSelectorBase
                  variants={subagentVariants()}
                  value={subagentVariant()}
                  onSelect={(value) => updateSubagentVariant(value)}
                  onClear={() => updateSubagentVariant(null)}
                  allowClear
                  clearLabel={language.t("settings.providers.notSet")}
                  placement="bottom-start"
                  globalTrigger={false}
                />
              </Show>
            </div>
          </SettingsRow>
        </Card>
      </Advanced>
    </div>
  )
}

export default ModelsTab
