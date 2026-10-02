import { Component, For } from "solid-js"
import { Card } from "@kilocode/kilo-ui/card"
import { Switch } from "@kilocode/kilo-ui/switch"
import { TextField } from "@kilocode/kilo-ui/text-field"

import { useLanguage } from "../../../context/language"
import type { HarnessConfig, HarnessHumanStep, HarnessStep } from "../../../types/messages"
import SettingsRow from "../SettingsRow"
import { FailToSelect } from "./HarnessFailTo"
import { splitLines, toggled } from "./harness-lists"
import { REVIEW_PANELS, updateStep } from "./harness-state"

interface Props {
  step: HarnessHumanStep
  earlier: HarnessStep[]
  onEdit: (fn: (h: HarnessConfig) => HarnessConfig) => void
}

const HarnessHumanStepEditor: Component<Props> = (props) => {
  const language = useLanguage()
  const id = () => props.step.id

  return (
    <div class="harness-editor">
      <Card>
        <SettingsRow title={language.t("settings.harness.name")}>
          <TextField
            value={props.step.name}
            onChange={(name) => name && props.onEdit((h) => updateStep(h, id(), { name }))}
          />
        </SettingsRow>
        <SettingsRow title={language.t("settings.harness.human.failTo")} last>
          <FailToSelect
            earlier={props.earlier}
            value={props.step.failTo}
            onSelect={(failTo) => props.onEdit((h) => updateStep(h, id(), { failTo }))}
          />
        </SettingsRow>
      </Card>

      <Card>
        <div data-slot="settings-row-label-title" class="harness-label">
          {language.t("settings.harness.human.show")}
        </div>
        <For each={REVIEW_PANELS}>
          {(panel, index) => (
            <SettingsRow
              title={language.t(`settings.harness.human.show.${panel}`)}
              last={index() === REVIEW_PANELS.length - 1}
            >
              <Switch
                checked={props.step.show.includes(panel)}
                onChange={(on) =>
                  props.onEdit((h) => updateStep(h, id(), { show: toggled(props.step.show, panel, on) }))
                }
                hideLabel
              >
                {language.t(`settings.harness.human.show.${panel}`)}
              </Switch>
            </SettingsRow>
          )}
        </For>
      </Card>

      <Card>
        <div data-slot="settings-row-label-title" class="harness-label">
          {language.t("settings.harness.human.checklist")}
        </div>
        <TextField
          value={props.step.checklist.join("\n")}
          multiline
          onChange={(text) => props.onEdit((h) => updateStep(h, id(), { checklist: splitLines(text) }))}
        />
        <div class="harness-hint">{language.t("settings.harness.human.checklist.hint")}</div>
      </Card>
    </div>
  )
}

export default HarnessHumanStepEditor
