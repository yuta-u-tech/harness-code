import { Component, For, Match, Show, Switch, createMemo, createSignal } from "solid-js"

import { useConfig } from "../../../context/config"
import { useLanguage } from "../../../context/language"
import type { HarnessConfig, HarnessStep } from "../../../types/messages"
import HarnessAgentStepEditor from "./HarnessAgentStep"
import HarnessCheckStepEditor from "./HarnessCheckStep"
import HarnessHumanStepEditor from "./HarnessHumanStep"
import HarnessRunPanel from "./HarnessRunPanel"
import HarnessStepList from "./HarnessStepList"
import { addStep, defaultHarness, harnessIssues, moveStep, removeStep, summarize, updateStep } from "./harness-state"

const agentStep = (s: HarnessStep) => (s.kind === "agent" ? s : undefined)
const checkStep = (s: HarnessStep) => (s.kind === "check" ? s : undefined)
const humanStep = (s: HarnessStep) => (s.kind === "human" ? s : undefined)

const HarnessTab: Component = () => {
  const language = useLanguage()
  const { config, updateConfig } = useConfig()

  // Until the user edits something, show the default flow without writing it to the config.
  const harness = createMemo<HarnessConfig>(() => config().harness ?? defaultHarness())
  const [pickedId, setPickedId] = createSignal<string | undefined>()

  const selected = createMemo(() => harness().steps.find((s) => s.id === pickedId()) ?? harness().steps.at(0))
  const earlier = createMemo(() => {
    const current = selected()
    const steps = harness().steps
    return current
      ? steps.slice(
          0,
          steps.findIndex((s) => s.id === current.id),
        )
      : []
  })
  const issues = createMemo(() => harnessIssues(harness()))
  const summary = createMemo(() => summarize(harness()))

  const edit = (fn: (h: HarnessConfig) => HarnessConfig) => updateConfig({ harness: fn(harness()) })

  const describe = (step: HarnessStep) => {
    if (step.kind === "agent" && step.runner) {
      const detail = [step.runner.model, step.runner.effort].filter(Boolean).join(" · ")
      const name = language.t(`settings.harness.runner.${step.runner.kind}`)
      return detail ? `${name} · ${detail}` : name
    }
    if (step.kind === "agent") return config().agent?.[step.agent]?.model ?? language.t("settings.harness.modelDefault")
    if (step.kind === "check") {
      const commands = step.checks.filter((c) => c.type === "command").length
      return language.t("settings.harness.checkSummary", { commands, scoring: step.checks.length - commands })
    }
    return language.t("settings.harness.humanSummary", { count: step.checklist.length })
  }

  const add = (kind: HarnessStep["kind"]) => {
    const next = addStep(harness(), kind)
    edit(() => next)
    setPickedId(next.steps.at(-1)?.id)
  }

  return (
    <div class="harness-tab">
      <p class="harness-intro">{language.t("settings.harness.intro")}</p>
      <div class="harness-summary">
        {language.t("settings.harness.summary", {
          agents: summary().agents,
          judgeRuns: summary().judgeRuns,
          commands: summary().commands,
        })}
      </div>

      <Show when={issues().length > 0}>
        <div class="harness-issues" role="alert">
          <strong>{language.t("settings.harness.issues")}</strong>
          <ul>
            <For each={issues()}>{(issue) => <li>{issue}</li>}</For>
          </ul>
        </div>
      </Show>

      <HarnessRunPanel steps={harness().steps} />

      <div class="harness-cols">
        <HarnessStepList
          steps={harness().steps}
          selectedId={selected()?.id ?? ""}
          describe={describe}
          onSelect={setPickedId}
          onAdd={add}
          onMove={(id, delta) => edit((h) => moveStep(h, id, delta))}
          onRemove={(id) => edit((h) => removeStep(h, id))}
        />
        <Show when={selected()}>
          {(step) => (
            <Switch>
              <Match when={agentStep(step())}>
                {(agent) => (
                  <HarnessAgentStepEditor
                    step={agent()}
                    onChange={(patch) => edit((h) => updateStep(h, step().id, patch))}
                  />
                )}
              </Match>
              <Match when={checkStep(step())}>
                {(check) => <HarnessCheckStepEditor step={check()} earlier={earlier()} onEdit={edit} />}
              </Match>
              <Match when={humanStep(step())}>
                {(human) => <HarnessHumanStepEditor step={human()} earlier={earlier()} onEdit={edit} />}
              </Match>
            </Switch>
          )}
        </Show>
      </div>
    </div>
  )
}

export default HarnessTab
