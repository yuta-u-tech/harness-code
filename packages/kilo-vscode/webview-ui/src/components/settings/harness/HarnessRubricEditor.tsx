import { Component, For, Show } from "solid-js"
import { Button } from "@kilocode/kilo-ui/button"
import { IconButton } from "@kilocode/kilo-ui/icon-button"
import { Select } from "@kilocode/kilo-ui/select"
import { TextField } from "@kilocode/kilo-ui/text-field"

import { useLanguage } from "../../../context/language"
import type { HarnessRubricCheck, HarnessRubricItem } from "../../../types/messages"
import SettingsRow from "../SettingsRow"
import HarnessModelPicker from "./HarnessModelPicker"
import HarnessRunnerPicker from "./HarnessRunnerPicker"

interface Props {
  check: HarnessRubricCheck
  onChange: (patch: Partial<Omit<HarnessRubricCheck, "id" | "type">>) => void
  onAddItem: () => void
  onRemoveItem: (itemId: string) => void
  onUpdateItem: (itemId: string, patch: Partial<Omit<HarnessRubricItem, "id">>) => void
}

const RUNS = [1, 3, 5]
const PASS_LINES = [3, 3.5, 4, 4.5]
const WEIGHTS = [1, 2, 3]

const HarnessRubricEditor: Component<Props> = (props) => {
  const language = useLanguage()

  return (
    <div class="harness-rubric">
      <HarnessRunnerPicker runner={props.check.runner} onChange={(runner) => props.onChange({ runner })} />
      <Show when={!props.check.runner}>
        <HarnessModelPicker
          title={language.t("settings.harness.rubric.judge")}
          model={props.check.model}
          variant={props.check.variant}
          onChange={({ model, ...rest }) =>
            props.onChange({ ...rest, ...(model === undefined ? {} : { model: model ?? "" }) })
          }
        />
      </Show>
      <SettingsRow title={language.t("settings.harness.rubric.runs")}>
        <Select
          options={RUNS}
          current={props.check.runs}
          value={(n) => String(n)}
          label={(n) => language.t("settings.harness.rubric.runs.option", { n })}
          onSelect={(n) => n && props.onChange({ runs: n })}
          variant="secondary"
          size="small"
          triggerVariant="settings"
        />
      </SettingsRow>
      <SettingsRow title={language.t("settings.harness.rubric.pass")} last>
        <Select
          options={PASS_LINES}
          current={props.check.pass}
          value={(n) => String(n)}
          label={(n) => n.toFixed(1)}
          onSelect={(n) => n && props.onChange({ pass: n })}
          variant="secondary"
          size="small"
          triggerVariant="settings"
        />
      </SettingsRow>

      <div class="harness-items">
        <For each={props.check.items}>
          {(item) => (
            <div class="harness-item">
              <div class="harness-item-row">
                <TextField
                  value={item.name}
                  placeholder={language.t("settings.harness.rubric.item")}
                  onChange={(name) => name && props.onUpdateItem(item.id, { name })}
                />
                <Select
                  options={WEIGHTS}
                  current={item.weight}
                  value={(n) => String(n)}
                  label={(n) => `${language.t("settings.harness.rubric.weight")} ${n}`}
                  onSelect={(weight) => weight && props.onUpdateItem(item.id, { weight })}
                  variant="secondary"
                  size="small"
                  triggerVariant="settings"
                />
                <IconButton
                  size="small"
                  variant="ghost"
                  icon="close"
                  title={language.t("settings.harness.rubric.removeItem")}
                  onClick={() => props.onRemoveItem(item.id)}
                />
              </div>
              <TextField
                value={item.criterion}
                multiline
                placeholder={language.t("settings.harness.rubric.criterion")}
                onChange={(criterion) => props.onUpdateItem(item.id, { criterion })}
              />
            </div>
          )}
        </For>
        <div>
          <Button variant="secondary" size="small" onClick={props.onAddItem}>
            {language.t("settings.harness.rubric.addItem")}
          </Button>
        </div>
      </div>
      <div class="harness-hint">{language.t("settings.harness.rubric.note")}</div>
    </div>
  )
}

export default HarnessRubricEditor
