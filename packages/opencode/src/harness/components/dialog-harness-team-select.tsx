/**
 * Harness Gateway Team Selection Dialog
 *
 * Allows switching between organizations and personal account.
 * Marks the current team with "→ (current)" indicator.
 */

import { DialogSelect } from "@tui/ui/dialog-select"
import type { Organization } from "@harness/harness-gateway"
import { getOrganizationOptions } from "@harness/harness-gateway/tui"

interface DialogHarnessTeamSelectProps {
  organizations: Organization[]
  currentOrgId?: string | null
  hasPersonalAccount?: boolean
  onSelect: (orgId: string | null) => Promise<void>
}

export function DialogHarnessTeamSelect(props: DialogHarnessTeamSelectProps) {
  // Get formatted options with current markers
  const options = getOrganizationOptions(
    props.organizations,
    props.currentOrgId || undefined,
    props.hasPersonalAccount !== false,
  )

  return (
    <DialogSelect
      title="Select Team"
      options={options}
      current={props.currentOrgId || null}
      onSelect={async (option: any) => {
        await props.onSelect(option.value)
      }}
    />
  )
}
