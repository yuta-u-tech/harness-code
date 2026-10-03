import { createMemo, Match, Switch, type JSX } from "solid-js"
import { SplitBorder } from "@tui/ui/border"
import { useTheme } from "@tui/context/theme"
import { parseHarnessErrorCode, harnessErrorTitle, harnessErrorDescription } from "@/harness/harness-errors"
import type { AssistantMessage } from "@harness/sdk/v2"

interface HarnessErrorBlockProps {
  error: NonNullable<AssistantMessage["error"]>
  fallback: JSX.Element
}

export function HarnessErrorBlock(props: HarnessErrorBlockProps) {
  const { theme } = useTheme()

  const harnessErrorCode = createMemo(() => {
    return parseHarnessErrorCode(props.error)
  })

  const title = createMemo(() => {
    const code = harnessErrorCode()
    return code ? harnessErrorTitle(code) : undefined
  })

  const description = createMemo(() => {
    const code = harnessErrorCode()
    return code ? harnessErrorDescription(code) : undefined
  })

  return (
    <Switch fallback={props.fallback}>
      <Match when={harnessErrorCode()}>
        <box
          border={["left"]}
          paddingTop={1}
          paddingBottom={1}
          paddingLeft={2}
          marginTop={1}
          backgroundColor={theme.backgroundPanel}
          customBorderChars={SplitBorder.customBorderChars}
          borderColor={theme.primary}
        >
          <text fg={theme.text}>{title()}</text>
          <text fg={theme.textMuted}>{description()}</text>
          <text fg={theme.primary}>{"Run /connect or `harness auth login` to connect to Harness Gateway"}</text>
        </box>
      </Match>
    </Switch>
  )
}
