import { Component, Show } from "solid-js"
import { Select } from "@harness/harness-ui/select"

import { useLanguage } from "../../../context/language"
import type { HarnessRunner } from "../../../types/messages"
import SettingsRow from "../SettingsRow"

type Choice = "model" | HarnessRunner["kind"]

const CHOICES: Choice[] = ["model", "codex", "claude"]

/** Reasoning levels each CLI accepts. An empty choice leaves the CLI's own default. */
export const EFFORTS: Record<HarnessRunner["kind"], string[]> = {
  codex: ["minimal", "low", "medium", "high"],
  claude: ["low", "medium", "high", "xhigh", "max"],
}

/** Models each CLI is offered with. An empty choice leaves the CLI's own default. */
export const CLI_MODELS: Record<HarnessRunner["kind"], string[]> = {
  codex: ["gpt-5-codex", "gpt-5"],
  claude: ["claude-fable-5-1", "claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-4-5-20251001"],
}

interface Props {
  runner: HarnessRunner | undefined
  onChange: (runner: HarnessRunner | undefined) => void
}

/** Chooses between the model catalog and an official CLI that is already signed in. */
const HarnessRunnerPicker: Component<Props> = (props) => {
  const language = useLanguage()
  const choice = (): Choice => props.runner?.kind ?? "model"
  // A model typed into the config earlier stays selectable.
  const models = () => {
    const runner = props.runner
    if (!runner) return [""]
    const known = CLI_MODELS[runner.kind]
    return ["", ...(runner.model && !known.includes(runner.model) ? [runner.model] : []), ...known]
  }
  const efforts = () => (props.runner ? ["", ...EFFORTS[props.runner.kind]] : [""])

  const pick = (next: Choice | undefined) => {
    if (!next || next === choice()) return
    props.onChange(next === "model" ? undefined : { kind: next })
  }

  return (
    <>
      <SettingsRow
        title={language.t("settings.harness.runner.title")}
        description={language.t("settings.harness.runner.note")}
      >
        <Select
          options={CHOICES}
          current={choice()}
          value={(item) => item}
          label={(item) => language.t(`settings.harness.runner.${item}`)}
          onSelect={pick}
          variant="secondary"
          size="small"
          triggerVariant="settings"
        />
      </SettingsRow>
      <Show when={props.runner}>
        {(runner) => (
          <>
            <SettingsRow title={language.t("settings.harness.runner.cliModel")}>
              <Select
                options={models()}
                current={runner().model ?? ""}
                value={(item) => item}
                label={(item) => item || language.t("settings.harness.runner.cliDefault")}
                onSelect={(model) => props.onChange({ ...runner(), model: model || undefined })}
                variant="secondary"
                size="small"
                triggerVariant="settings"
              />
            </SettingsRow>
            <SettingsRow title={language.t("settings.harness.reasoning")} last>
              <Select
                options={efforts()}
                current={runner().effort ?? ""}
                value={(item) => item}
                label={(item) => item || language.t("settings.harness.runner.cliDefault")}
                onSelect={(effort) => props.onChange({ ...runner(), effort: effort || undefined })}
                variant="secondary"
                size="small"
                triggerVariant="settings"
              />
            </SettingsRow>
          </>
        )}
      </Show>
    </>
  )
}

export default HarnessRunnerPicker
