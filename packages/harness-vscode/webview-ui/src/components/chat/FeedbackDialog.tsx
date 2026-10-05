import { Component, JSX } from "solid-js"
import { Dialog } from "@harness/harness-ui/dialog"
import { Button } from "@harness/harness-ui/button"
import { Icon } from "@harness/harness-ui/icon"
import { useDialog } from "@harness/harness-ui/context/dialog"
import { useVSCode } from "../../context/vscode"
import { useLanguage } from "../../context/language"

const GITHUB_ISSUES_URL = "https://github.com/yuta-u-tech/harness-code/issues/new/choose"

const HarnessLogo = (): JSX.Element => {
  const iconsBaseUri = (window as { ICONS_BASE_URI?: string }).ICONS_BASE_URI || ""
  const isLight =
    document.body.classList.contains("vscode-light") || document.body.classList.contains("vscode-high-contrast-light")
  const iconFile = isLight ? "harness-light.svg" : "harness-dark.svg"

  return (
    <div class="feedback-dialog-logo">
      <img src={`${iconsBaseUri}/${iconFile}`} alt="Harness Code" />
    </div>
  )
}

export const FeedbackDialog: Component = () => {
  const language = useLanguage()
  const dialog = useDialog()
  const vscode = useVSCode()

  const open = (url: string) => {
    vscode.postMessage({ type: "openExternal", url })
    dialog.close()
  }

  return (
    <Dialog title="" fit>
      <div class="feedback-dialog">
        <HarnessLogo />
        <p class="feedback-dialog-message">{language.t("feedback.dialog.message")}</p>
        <div class="feedback-dialog-actions">
          <Button variant="primary" size="large" data-full-width="true" onClick={() => open(GITHUB_ISSUES_URL)}>
            <Icon name="github" size="small" />
            {language.t("feedback.dialog.github")}
          </Button>
        </div>
        <Button variant="ghost" size="small" onClick={() => dialog.close()}>
          {language.t("common.cancel")}
        </Button>
      </div>
    </Dialog>
  )
}
