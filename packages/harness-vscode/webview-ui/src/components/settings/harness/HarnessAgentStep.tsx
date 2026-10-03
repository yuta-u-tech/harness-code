import { Component, For, Show, createMemo } from "solid-js"
import { Card } from "@harness/harness-ui/card"
import { Switch } from "@harness/harness-ui/switch"
import { TextField } from "@harness/harness-ui/text-field"

import { useConfig } from "../../../context/config"
import { useLanguage } from "../../../context/language"
import { useSession } from "../../../context/session"
import type { AgentConfig, HarnessAgentStep, PermissionConfig } from "../../../types/messages"
import PermissionEditor from "../PermissionEditor"
import SettingsRow from "../SettingsRow"
import HarnessModelPicker from "./HarnessModelPicker"
import HarnessRunnerPicker from "./HarnessRunnerPicker"
import { toggled } from "./harness-lists"

interface Props {
  step: HarnessAgentStep
  onChange: (patch: Partial<Pick<HarnessAgentStep, "name" | "subagents" | "runner">>) => void
}

/** A step's model, prompt and tools live in the regular `agent` config entry named by step.agent. */
const HarnessAgentStepEditor: Component<Props> = (props) => {
  const language = useLanguage()
  const session = useSession()
  const { config, updateConfig } = useConfig()

  const cfg = createMemo<AgentConfig>(() => config().agent?.[props.step.agent] ?? {})

  const update = (partial: Partial<AgentConfig>) => {
    const existing = config().agent ?? {}
    // Harness agents are only run by the harness, so keep them out of the mode picker.
    const base: AgentConfig = { mode: "subagent", hidden: true, description: props.step.name }
    updateConfig({
      agent: { ...existing, [props.step.agent]: { ...base, ...existing[props.step.agent], ...partial } },
    })
  }

  const updatePermission = (patch: PermissionConfig) => {
    updateConfig({ agent: { [props.step.agent]: { permission: patch } } })
  }

  const subagents = createMemo(() =>
    session.allAgents().filter((a) => a.mode === "subagent" && !a.hidden && !a.name.startsWith("harness-")),
  )
  const chosen = () => props.step.subagents ?? []

  return (
    <div class="harness-editor">
      <Card>
        <SettingsRow title={language.t("settings.harness.name")}>
          <TextField value={props.step.name} onChange={(name) => name && props.onChange({ name })} />
        </SettingsRow>
        <HarnessRunnerPicker runner={props.step.runner} onChange={(runner) => props.onChange({ runner })} />
        <Show when={!props.step.runner}>
          <HarnessModelPicker
            title={language.t("settings.harness.model")}
            model={cfg().model}
            variant={cfg().variant}
            onChange={update}
            last
          />
        </Show>
      </Card>

      <Card>
        <div data-slot="settings-row-label-title" class="harness-label">
          {language.t("settings.harness.prompt")}
        </div>
        <TextField
          value={cfg().prompt ?? ""}
          multiline
          onChange={(prompt) => update({ prompt: prompt || undefined })}
        />
        <div class="harness-hint">{language.t("settings.harness.prompt.hint")}</div>
      </Card>

      <Card>
        <div data-slot="settings-row-label-title" class="harness-label">
          {language.t("settings.harness.subagents")}
        </div>
        <Show
          when={subagents().length > 0}
          fallback={<div class="harness-hint">{language.t("settings.harness.subagents.none")}</div>}
        >
          <For each={subagents()}>
            {(agent) => (
              <SettingsRow title={agent.displayName ?? agent.name} description={agent.description} last>
                <Switch
                  checked={chosen().includes(agent.name)}
                  onChange={(on) => props.onChange({ subagents: toggled(chosen(), agent.name, on) })}
                  hideLabel
                >
                  {agent.name}
                </Switch>
              </SettingsRow>
            )}
          </For>
        </Show>
      </Card>

      <Card>
        <div data-slot="settings-row-label-title" class="harness-label">
          {language.t("settings.harness.tools")}
        </div>
        <PermissionEditor
          permissions={cfg().permission}
          component="agent-permission-settings"
          inherited
          onChange={updatePermission}
        />
      </Card>
    </div>
  )
}

export default HarnessAgentStepEditor
