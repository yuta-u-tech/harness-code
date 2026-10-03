import { type Component } from "solid-js"
import { Button } from "@harness/harness-ui/button"
import { Icon } from "@harness/harness-ui/icon"
import { useLanguage } from "../../../context/language"

export const GoalHeader: Component<{ onCancel: () => void }> = (props) => {
  const language = useLanguage()
  return (
    <div class="prompt-goal-header">
      <Icon name="target" size="small" />
      <span>{language.t("prompt.goal.set")}</span>
      <Button variant="ghost" size="small" onClick={props.onCancel}>
        {language.t("common.cancel")}
      </Button>
    </div>
  )
}
