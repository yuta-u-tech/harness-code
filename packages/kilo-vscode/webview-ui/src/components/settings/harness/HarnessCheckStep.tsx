import { Component, For, Match, Switch as Branch } from "solid-js"
import { Button } from "@kilocode/kilo-ui/button"
import { Card } from "@kilocode/kilo-ui/card"
import { IconButton } from "@kilocode/kilo-ui/icon-button"
import { Select } from "@kilocode/kilo-ui/select"
import { Tag } from "@kilocode/kilo-ui/tag"
import { TextField } from "@kilocode/kilo-ui/text-field"

import { useLanguage } from "../../../context/language"
import type { HarnessCheck, HarnessCheckStep, HarnessConfig, HarnessStep } from "../../../types/messages"
import SettingsRow from "../SettingsRow"
import HarnessRubricEditor from "./HarnessRubricEditor"
import {
  addCheck,
  addRubricItem,
  removeCheck,
  removeRubricItem,
  updateCheck,
  updateRubricItem,
  updateStep,
} from "./harness-state"
import { FailToSelect } from "./HarnessFailTo"

interface Props {
  step: HarnessCheckStep
  earlier: HarnessStep[]
  onEdit: (fn: (h: HarnessConfig) => HarnessConfig) => void
}

const RETRIES = [1, 2, 3, 5]

const HarnessCheckStepEditor: Component<Props> = (props) => {
  const language = useLanguage()
  const id = () => props.step.id

  const treatment = (check: HarnessCheck) => (check.required ? "required" : "advisory")

  return (
    <div class="harness-editor">
      <Card>
        <SettingsRow title={language.t("settings.harness.name")}>
          <TextField
            value={props.step.name}
            onChange={(name) => name && props.onEdit((h) => updateStep(h, id(), { name }))}
          />
        </SettingsRow>
        <SettingsRow title={language.t("settings.harness.failTo")}>
          <FailToSelect
            earlier={props.earlier}
            value={props.step.failTo}
            onSelect={(failTo) => props.onEdit((h) => updateStep(h, id(), { failTo }))}
          />
        </SettingsRow>
        <SettingsRow title={language.t("settings.harness.retries")} last>
          <Select
            options={RETRIES}
            current={props.step.retries}
            value={(n) => String(n)}
            label={(n) => language.t("settings.harness.retries.option", { n })}
            onSelect={(retries) => retries && props.onEdit((h) => updateStep(h, id(), { retries }))}
            variant="secondary"
            size="small"
            triggerVariant="settings"
          />
        </SettingsRow>
      </Card>

      <div class="harness-hint">{language.t("settings.harness.checks.rule")}</div>

      <For each={props.step.checks}>
        {(check) => (
          <div class="harness-check">
            <div class="harness-check-head">
              <TextField
                value={check.name}
                onChange={(name) => name && props.onEdit((h) => updateCheck(h, id(), check.id, { name }))}
              />
              <Tag>{language.t(`settings.harness.check.${check.type}`)}</Tag>
              <IconButton
                size="small"
                variant="ghost"
                icon="close"
                title={language.t("settings.harness.check.remove")}
                onClick={() => props.onEdit((h) => removeCheck(h, id(), check.id))}
              />
            </div>
            <SettingsRow title={language.t("settings.harness.check.treat")} last>
              <Select
                options={["required", "advisory"]}
                current={treatment(check)}
                value={(o) => o}
                label={(o) => language.t(`settings.harness.check.treat.${o}`)}
                onSelect={(o) =>
                  o && props.onEdit((h) => updateCheck(h, id(), check.id, { required: o === "required" }))
                }
                variant="secondary"
                size="small"
                triggerVariant="settings"
              />
            </SettingsRow>
            <Branch>
              <Match when={check.type === "command" ? check : undefined}>
                {(cmd) => (
                  <div>
                    <div data-slot="settings-row-label-title" class="harness-label">
                      {language.t("settings.harness.check.cmd")}
                    </div>
                    <TextField
                      value={cmd().command}
                      onChange={(command) =>
                        command && props.onEdit((h) => updateCheck(h, id(), check.id, { command }))
                      }
                    />
                    <div class="harness-hint">{language.t("settings.harness.check.cmd.hint")}</div>
                  </div>
                )}
              </Match>
              <Match when={check.type === "rubric" ? check : undefined}>
                {(rubric) => (
                  <HarnessRubricEditor
                    check={rubric()}
                    onChange={(patch) => props.onEdit((h) => updateCheck(h, id(), check.id, patch))}
                    onAddItem={() => props.onEdit((h) => addRubricItem(h, id(), check.id))}
                    onRemoveItem={(itemId) => props.onEdit((h) => removeRubricItem(h, id(), check.id, itemId))}
                    onUpdateItem={(itemId, patch) =>
                      props.onEdit((h) => updateRubricItem(h, id(), check.id, itemId, patch))
                    }
                  />
                )}
              </Match>
            </Branch>
          </div>
        )}
      </For>

      <div class="harness-add">
        <Button variant="secondary" size="small" onClick={() => props.onEdit((h) => addCheck(h, id(), "command"))}>
          {language.t("settings.harness.check.add.command")}
        </Button>
        <Button variant="secondary" size="small" onClick={() => props.onEdit((h) => addCheck(h, id(), "rubric"))}>
          {language.t("settings.harness.check.add.rubric")}
        </Button>
      </div>
    </div>
  )
}

export default HarnessCheckStepEditor
