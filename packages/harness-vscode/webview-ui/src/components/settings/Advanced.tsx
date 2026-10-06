import type { Component, JSX } from "solid-js"
import { useLanguage } from "../../context/language"

/** Rarely used settings, folded away until opened. */
const Advanced: Component<{ children: JSX.Element }> = (props) => {
  const language = useLanguage()
  return (
    <details class="settings-advanced">
      <summary>{language.t("settings.advanced")}</summary>
      {props.children}
    </details>
  )
}

export default Advanced
