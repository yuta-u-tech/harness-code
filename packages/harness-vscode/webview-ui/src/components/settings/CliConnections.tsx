import { Component, For, createSignal, onCleanup, onMount } from "solid-js"
import { Card } from "@harness/harness-ui/card"
import { Tag } from "@harness/harness-ui/tag"

import { useLanguage } from "../../context/language"
import { useVSCode } from "../../context/vscode"
import type { CliKind, CliStatus, ExtensionMessage } from "../../types/messages"
import SettingsRow from "./SettingsRow"

const CLIS: { kind: CliKind; name: string; signIn: string }[] = [
  { kind: "codex", name: "Codex", signIn: "codex login" },
  { kind: "claude", name: "Claude Code", signIn: "claude auth login" },
]

/** Codex and Claude Code run through their own signed-in CLIs, so this shows what each one reports. */
const CliConnections: Component = () => {
  const language = useLanguage()
  const vscode = useVSCode()
  const [status, setStatus] = createSignal<Partial<Record<CliKind, CliStatus>>>({})

  onMount(() => {
    const off = vscode.onMessage((message: ExtensionMessage) => {
      if (message.type === "cliStatusLoaded") setStatus(message.status)
    })
    onCleanup(off)
    vscode.postMessage({ type: "requestCliStatus" })
  })

  const label = (kind: CliKind) => {
    const current = status()[kind]
    if (!current) return language.t("settings.cli.checking")
    if (!current.installed) return language.t("settings.cli.missing")
    return language.t(current.signedIn ? "settings.cli.signedIn" : "settings.cli.signedOut")
  }

  const hint = (kind: CliKind, signIn: string) => {
    const current = status()[kind]
    if (!current || (current.installed && current.signedIn)) return undefined
    return current.installed
      ? language.t("settings.cli.signIn", { command: signIn })
      : language.t("settings.cli.install")
  }

  return (
    <Card>
      <For each={CLIS}>
        {(cli, index) => (
          <SettingsRow title={cli.name} description={hint(cli.kind, cli.signIn)} last={index() === CLIS.length - 1}>
            <Tag>{label(cli.kind)}</Tag>
          </SettingsRow>
        )}
      </For>
    </Card>
  )
}

export default CliConnections
