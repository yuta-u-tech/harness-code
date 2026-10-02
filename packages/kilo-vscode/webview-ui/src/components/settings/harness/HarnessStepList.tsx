import { Component, For } from "solid-js"
import { Button } from "@kilocode/kilo-ui/button"
import { IconButton } from "@kilocode/kilo-ui/icon-button"
import { Tag } from "@kilocode/kilo-ui/tag"

import { useLanguage } from "../../../context/language"
import type { HarnessStep } from "../../../types/messages"

interface Props {
  steps: HarnessStep[]
  selectedId: string
  /** One-line description shown under each step name. */
  describe: (step: HarnessStep) => string
  onSelect: (id: string) => void
  onAdd: (kind: HarnessStep["kind"]) => void
  onMove: (id: string, delta: -1 | 1) => void
  onRemove: (id: string) => void
}

const KINDS: HarnessStep["kind"][] = ["agent", "check", "human"]

const HarnessStepList: Component<Props> = (props) => {
  const language = useLanguage()
  const kindLabel = (kind: HarnessStep["kind"]) => language.t(`settings.harness.kind.${kind}`)

  return (
    <div class="harness-steps">
      <ol class="harness-step-list">
        <For each={props.steps}>
          {(step, index) => (
            <li class="harness-step" data-selected={step.id === props.selectedId ? "true" : "false"}>
              <button
                type="button"
                class="harness-step-main"
                aria-current={step.id === props.selectedId}
                onClick={() => props.onSelect(step.id)}
              >
                <span class="harness-step-head">
                  <span class="harness-step-name">{step.name}</span>
                  <Tag>{kindLabel(step.kind)}</Tag>
                </span>
                <span class="harness-step-sub">{props.describe(step)}</span>
              </button>
              <span class="harness-step-actions">
                <span class="harness-flip">
                  <IconButton
                    size="small"
                    variant="ghost"
                    icon="chevron-down"
                    title={language.t("settings.harness.moveUp")}
                    disabled={index() === 0}
                    onClick={() => props.onMove(step.id, -1)}
                  />
                </span>
                <IconButton
                  size="small"
                  variant="ghost"
                  icon="chevron-down"
                  title={language.t("settings.harness.moveDown")}
                  disabled={index() === props.steps.length - 1}
                  onClick={() => props.onMove(step.id, 1)}
                />
                <IconButton
                  size="small"
                  variant="ghost"
                  icon="close"
                  title={language.t("settings.harness.remove")}
                  disabled={props.steps.length <= 1}
                  onClick={() => props.onRemove(step.id)}
                />
              </span>
            </li>
          )}
        </For>
      </ol>
      <div class="harness-add">
        <span class="harness-add-label">{language.t("settings.harness.addStep")}</span>
        <For each={KINDS}>
          {(kind) => (
            <Button variant="secondary" size="small" onClick={() => props.onAdd(kind)}>
              {kindLabel(kind)}
            </Button>
          )}
        </For>
      </div>
    </div>
  )
}

export default HarnessStepList
