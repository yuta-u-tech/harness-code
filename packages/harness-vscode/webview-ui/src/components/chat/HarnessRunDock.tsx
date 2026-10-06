import { Component, For, Show, createEffect, createSignal, onCleanup, onMount } from "solid-js"
import { Button } from "@harness/harness-ui/button"
import { Card } from "@harness/harness-ui/card"
import { Tag } from "@harness/harness-ui/tag"
import { TextField } from "@harness/harness-ui/text-field"

import { useConfig } from "../../context/config"
import { useLanguage } from "../../context/language"
import { useVSCode } from "../../context/vscode"
import type { ExtensionMessage, HarnessRun } from "../../types/messages"
import { defaultHarness } from "../settings/harness/harness-state"
import { harnessMode } from "../../context/harness-mode"

/** How often a run that is still going is asked for its state. */
const POLL = 1500

const active = (run: HarnessRun | undefined) => run?.status === "running" || run?.status === "awaiting_review"

/** Progress, checks and review of the harness run, shown above the chat input. */
const HarnessRunDock: Component = () => {
  const language = useLanguage()
  const vscode = useVSCode()
  const { config, isDirty } = useConfig()
  const [run, setRun] = createSignal<HarnessRun | undefined>()
  const [comment, setComment] = createSignal("")
  const [error, setError] = createSignal<string | undefined>()

  const name = (id: string | undefined) =>
    (config().harness ?? defaultHarness()).steps.find((step) => step.id === id)?.name ?? id ?? ""

  onMount(() => {
    const off = vscode.onMessage((message: ExtensionMessage) => {
      if (message.type === "harnessRun") {
        setRun(message.run)
        setError(undefined)
      }
      if (message.type === "harnessRuns") setRun((current) => current ?? message.runs.at(0))
      if (message.type === "harnessError") setError(message.message)
    })
    onCleanup(off)
    vscode.postMessage({ type: "harnessList" })
  })

  // Ask for the state while the run is going, and stop asking once it ends.
  createEffect(() => {
    const id = run()?.id
    if (!id || !active(run())) return
    const timer = setInterval(() => vscode.postMessage({ type: "harnessGet", runID: id }), POLL)
    onCleanup(() => clearInterval(timer))
  })

  const review = (approve: boolean) => {
    const current = run()
    if (!current) return
    vscode.postMessage({ type: "harnessReview", runID: current.id, approve, comment: comment().trim() || undefined })
    setComment("")
  }

  const stop = () => {
    const current = run()
    if (current) vscode.postMessage({ type: "harnessStop", runID: current.id })
  }

  return (
    <Show when={harnessMode() || run()}>
      <Card>
        <div class="harness-run-actions">
          <Show when={harnessMode()}>
            <span class="harness-hint">{language.t("settings.harness.run.ready")}</span>
          </Show>
          <Show when={active(run())}>
            <Button variant="secondary" size="small" onClick={stop}>
              {language.t("settings.harness.run.stop")}
            </Button>
          </Show>
          <Show when={harnessMode() && isDirty()}>
            <span class="harness-hint">{language.t("settings.harness.run.saveFirst")}</span>
          </Show>
        </div>

        <Show when={error()}>
          {(text) => (
            <div class="harness-run-error" role="alert">
              {text()}
            </div>
          )}
        </Show>

        <Show when={run()}>
          {(current) => (
            <div class="harness-run">
              <div class="harness-run-status">
                <Tag>{language.t(`settings.harness.run.status.${current().status}`)}</Tag>
                <span class="harness-hint">
                  {current().task}
                  <Show when={active(current()) && current().step}>
                    {" · "}
                    {name(current().step)}
                  </Show>
                </span>
              </div>

              <Show when={current().reason}>
                <div class="harness-run-error">{current().reason}</div>
              </Show>

              <ol class="harness-run-log">
                <For each={current().log}>
                  {(entry) => (
                    <li data-outcome={entry.outcome}>
                      <details>
                        <summary>
                          <span class="harness-run-step">{name(entry.step)}</span>
                          <span class="harness-hint">
                            {language.t("settings.harness.run.attempt", { n: entry.attempt })}
                          </span>
                          <Tag>{language.t(`settings.harness.run.outcome.${entry.outcome}`)}</Tag>
                        </summary>
                        <pre>{entry.detail || "—"}</pre>
                      </details>
                    </li>
                  )}
                </For>
              </ol>

              <Show when={current().pending}>
                {(pending) => (
                  <div class="harness-review">
                    <div data-slot="settings-row-label-title">{pending().name}</div>
                    <Show when={pending().show.includes("diff")}>
                      <div class="harness-hint">{language.t("settings.harness.run.diff")}</div>
                      <pre class="harness-diff">{pending().diff || language.t("settings.harness.run.noChanges")}</pre>
                    </Show>
                    <Show
                      when={
                        pending().notes.length > 0 &&
                        (pending().show.includes("scores") || pending().show.includes("tests"))
                      }
                    >
                      <div class="harness-hint">{language.t("settings.harness.run.notes")}</div>
                      <pre>{pending().notes.join("\n\n")}</pre>
                    </Show>
                    <Show when={pending().checklist.length > 0}>
                      <div class="harness-hint">{language.t("settings.harness.human.checklist")}</div>
                      <ul class="harness-run-checklist">
                        <For each={pending().checklist}>{(line) => <li>{line}</li>}</For>
                      </ul>
                    </Show>
                    <TextField
                      value={comment()}
                      multiline
                      placeholder={language.t("settings.harness.run.comment")}
                      onChange={setComment}
                    />
                    <div class="harness-run-actions">
                      <Button variant="primary" size="small" onClick={() => review(true)}>
                        {language.t("settings.harness.run.approve")}
                      </Button>
                      <Button variant="secondary" size="small" onClick={() => review(false)}>
                        {language.t("settings.harness.run.reject")}
                      </Button>
                    </div>
                  </div>
                )}
              </Show>
            </div>
          )}
        </Show>
      </Card>
    </Show>
  )
}

export default HarnessRunDock
