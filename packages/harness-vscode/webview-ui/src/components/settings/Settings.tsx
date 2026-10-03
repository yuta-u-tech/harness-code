import { Component, createSignal, createEffect, on, Show } from "solid-js"
import { Icon } from "@harness/harness-ui/icon"
import { Tabs } from "@harness/harness-ui/tabs"
import { Button } from "@harness/harness-ui/button"
import { Tooltip } from "@harness/harness-ui/tooltip"
import { showToast } from "@harness/harness-ui/toast"
import { useVSCode } from "../../context/vscode"
import { useLanguage } from "../../context/language"
import { useConfig } from "../../context/config"
import { useSession } from "../../context/session"
import { configMessage } from "../../utils/open-config"
import HarnessTab from "./harness/HarnessTab"
import ModelsTab from "./ModelsTab"
import ProvidersTab from "./ProvidersTab"
import AgentBehaviourTab from "./AgentBehaviourTab"
import AutoApproveTab from "./AutoApproveTab"
import DisplayTab from "./DisplayTab"
import LanguageTab from "./LanguageTab"
import NotificationsTab from "./NotificationsTab"

export interface SettingsProps {
  tab?: string
  onTabChange?: (tab: string) => void
}

/** The tabs that exist, in order. */
const TABS = ["harness", "agentBehaviour", "models", "autoApprove", "display"] as const
type Tab = (typeof TABS)[number]

/** Tab ids that other parts of the app still send, mapped to the tab that now holds them. */
const MOVED: Record<string, Tab> = {
  providers: "models",
  language: "display",
  notifications: "display",
}

export function resolveTab(id: string | undefined): Tab {
  const found = TABS.find((tab) => tab === id)
  if (found) return found
  return (id && MOVED[id]) || "harness"
}

const Section: Component<{ title: string; children: import("solid-js").JSX.Element }> = (props) => (
  <section class="settings-section">
    <h4>{props.title}</h4>
    {props.children}
  </section>
)

const Settings: Component<SettingsProps> = (props) => {
  const language = useLanguage()
  const vscode = useVSCode()
  const { isDirty, saving, saveError, saveConfig, discardConfig } = useConfig()
  const session = useSession()
  const [active, setActive] = createSignal<Tab>(resolveTab(props.tab))
  const [errorExpanded, setErrorExpanded] = createSignal(false)

  const busyCount = () => Object.values(session.allStatusMap()).filter((s) => s.type === "busy").length

  const handleSave = () => {
    const busy = busyCount()
    if (busy === 0) {
      saveConfig()
      return
    }
    const msg = busy === 1 ? language.t("settings.saveBar.warning.one") : language.t("settings.saveBar.warning.many")
    showToast({
      variant: "error",
      title: msg,
      persistent: true,
      actions: [
        { label: language.t("settings.saveBar.saveAnyway"), onClick: saveConfig },
        { label: language.t("settings.saveBar.cancel"), onClick: "dismiss" },
      ],
    })
  }

  const open = (scope: "local" | "global") => {
    vscode.postMessage(configMessage(scope, language.t))
  }

  // Follow the parent when it navigates to a tab (for example from a link elsewhere in the app).
  createEffect(
    on(
      () => props.tab,
      (tab) => {
        if (tab) setActive(resolveTab(tab))
      },
    ),
  )

  const onTabChange = (tab: string) => {
    const next = resolveTab(tab)
    setActive(next)
    props.onTabChange?.(next)
    vscode.postMessage({ type: "settingsTabChanged", tab: next })
  }

  return (
    <div style={{ display: "flex", "flex-direction": "column", height: "100%", "min-height": 0 }}>
      <div
        style={{
          padding: "12px 16px",
          "border-bottom": "1px solid var(--border-weak-base)",
          display: "flex",
          "align-items": "center",
          "flex-wrap": "wrap",
          gap: "8px",
        }}
      >
        <h2 style={{ "font-size": "var(--harness-font-size-16)", "font-weight": "600", margin: 0, flex: 1 }}>
          {language.t("sidebar.settings")}
        </h2>
        <Button variant="secondary" size="small" icon="edit" onClick={() => open("local")}>
          {language.t("settings.openLocalConfig")}
        </Button>
        <Button variant="secondary" size="small" icon="edit" onClick={() => open("global")}>
          {language.t("settings.openGlobalConfig")}
        </Button>
        <Tooltip value={language.t("common.reloadDescription")} placement="bottom">
          <Button variant="secondary" size="small" onClick={() => vscode.postMessage({ type: "reload" })}>
            <Icon name="reload" size="small" />
            {language.t("common.reload")}
          </Button>
        </Tooltip>
      </div>

      <Tabs
        orientation="vertical"
        variant="settings"
        value={active()}
        onChange={onTabChange}
        style={{ flex: 1, overflow: "hidden" }}
      >
        <Tabs.List>
          <Tabs.Trigger value="harness" aria-label={language.t("settings.harness.title")}>
            <Icon name="layers" />
            <span class="label">{language.t("settings.harness.title")}</span>
          </Tabs.Trigger>
          <Tabs.Trigger value="agentBehaviour" aria-label={language.t("settings.agentBehaviour.title")}>
            <Icon name="brain" />
            <span class="label">{language.t("settings.agentBehaviour.title")}</span>
          </Tabs.Trigger>
          <Tabs.Trigger value="models" aria-label={language.t("settings.connections.title")}>
            <Icon name="models" />
            <span class="label">{language.t("settings.connections.title")}</span>
          </Tabs.Trigger>
          <Tabs.Trigger value="autoApprove" aria-label={language.t("settings.autoApprove.title")}>
            <Icon name="checklist" />
            <span class="label">{language.t("settings.autoApprove.title")}</span>
          </Tabs.Trigger>
          <Tabs.Trigger value="display" aria-label={language.t("settings.display.title")}>
            <Icon name="eye" />
            <span class="label">{language.t("settings.display.title")}</span>
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="harness">
          <h3>{language.t("settings.harness.title")}</h3>
          <HarnessTab />
        </Tabs.Content>
        <Tabs.Content value="agentBehaviour">
          <h3>{language.t("settings.agentBehaviour.title")}</h3>
          <AgentBehaviourTab />
        </Tabs.Content>
        <Tabs.Content value="models">
          <h3>{language.t("settings.connections.title")}</h3>
          <Section title={language.t("settings.models.title")}>
            <ModelsTab />
          </Section>
          <Section title={language.t("settings.providers.title")}>
            <ProvidersTab />
          </Section>
        </Tabs.Content>
        <Tabs.Content value="autoApprove">
          <h3>{language.t("settings.autoApprove.title")}</h3>
          <AutoApproveTab />
        </Tabs.Content>
        <Tabs.Content value="display">
          <h3>{language.t("settings.display.title")}</h3>
          <DisplayTab />
          <Section title={language.t("settings.language.title")}>
            <LanguageTab />
          </Section>
          <Section title={language.t("settings.notifications.title")}>
            <NotificationsTab />
          </Section>
        </Tabs.Content>
      </Tabs>

      {/* Save bar: slides in when there are unsaved config changes */}
      <Show when={isDirty()}>
        <div class="settings-save-bar-wrap">
          <Show when={saveError()}>
            {(err) => (
              <div class="settings-save-bar-error">
                <div
                  class="settings-save-bar-error-header"
                  onClick={() => setErrorExpanded((v) => !v)}
                  role="button"
                  aria-expanded={errorExpanded()}
                >
                  <span
                    class={`settings-save-bar-error-chevron${
                      errorExpanded() ? " settings-save-bar-error-chevron-expanded" : ""
                    }`}
                  >
                    <Icon name="chevron-right" size="small" />
                  </span>
                  <span class="settings-save-bar-error-title">
                    {language.t("settings.saveBar.saveFailed")}:{" "}
                    <span class="settings-save-bar-error-firstline">{err().message}</span>
                  </span>
                </div>
                <Show when={errorExpanded()}>
                  <pre class="settings-save-bar-error-details">{err().details ?? err().message}</pre>
                </Show>
              </div>
            )}
          </Show>
          <div class="settings-save-bar">
            <span class="settings-save-bar-label">{language.t("settings.saveBar.unsavedChanges")}</span>
            <Button variant="ghost" size="small" onClick={discardConfig} disabled={saving()}>
              {language.t("settings.saveBar.discard")}
            </Button>
            <Button variant="primary" size="small" onClick={handleSave} disabled={saving()}>
              {saving() ? language.t("settings.saveBar.saving") : language.t("settings.saveBar.save")}
            </Button>
          </div>
        </div>
      </Show>
    </div>
  )
}

export default Settings
