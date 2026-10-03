import { Component, Show, createMemo } from "solid-js"

import { useProvider } from "../../../context/provider"
import { useLanguage } from "../../../context/language"
import { parseModelString } from "../../../../../src/shared/provider-model"
import { ModelSelectorBase } from "../../shared/ModelSelector"
import { ThinkingSelectorBase } from "../../shared/ThinkingSelector"
import SettingsRow from "../SettingsRow"
import { modelPatch } from "../mode-model"

interface Props {
  model: string | null | undefined
  variant: string | null | undefined
  title: string
  onChange: (patch: { model?: string | null; variant?: string | null }) => void
  last?: boolean
}

/** Model list and reasoning levels come from the provider catalog, so new models appear without edits here. */
const HarnessModelPicker: Component<Props> = (props) => {
  const language = useLanguage()
  const provider = useProvider()

  const selection = createMemo(() => parseModelString(props.model ?? undefined))
  const variants = createMemo(() => {
    const sel = selection()
    return sel ? Object.keys(provider.findModel(sel)?.variants ?? {}) : []
  })

  const select = (providerID: string, modelID: string) => {
    const list = Object.keys(provider.findModel({ providerID, modelID })?.variants ?? {})
    props.onChange(modelPatch(providerID, modelID, list, props.variant))
  }

  return (
    <>
      <SettingsRow title={props.title} last={props.last && variants().length === 0 && !props.variant}>
        <ModelSelectorBase
          value={selection()}
          onSelect={select}
          placement="bottom-start"
          allowClear
          clearLabel={language.t("settings.harness.modelDefault")}
          label={props.title}
        />
      </SettingsRow>
      <Show when={variants().length > 0 || !!props.variant}>
        <SettingsRow title={language.t("settings.harness.reasoning")} last={props.last}>
          <ThinkingSelectorBase
            variants={variants()}
            value={props.variant ?? undefined}
            onSelect={(value) => props.onChange({ variant: value })}
            onClear={() => props.onChange({ variant: null })}
            allowClear
            clearLabel={language.t("settings.providers.notSet")}
            placement="bottom-start"
            globalTrigger={false}
          />
        </SettingsRow>
      </Show>
    </>
  )
}

export default HarnessModelPicker
