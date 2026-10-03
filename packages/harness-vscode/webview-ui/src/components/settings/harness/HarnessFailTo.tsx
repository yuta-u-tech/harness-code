import { Component } from "solid-js"
import { Select } from "@harness/harness-ui/select"

import type { HarnessStep } from "../../../types/messages"

interface Props {
  /** Only earlier steps can be returned to. */
  earlier: HarnessStep[]
  value: string
  onSelect: (stepId: string) => void
}

export const FailToSelect: Component<Props> = (props) => (
  <Select
    options={props.earlier}
    current={props.earlier.find((s) => s.id === props.value)}
    value={(s) => s.id}
    label={(s) => s.name}
    onSelect={(s) => s && props.onSelect(s.id)}
    variant="secondary"
    size="small"
    triggerVariant="settings"
  />
)
