import type { TuiPlugin } from "@harness/plugin/tui"
import type { InternalTuiPlugin } from "@/plugin/tui/internal"
import { MemorySidebar } from "@/harness/cli/cmd/tui/component/memory-status"

const id = "internal:harness-sidebar-memory"

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 1000,
    slots: {
      sidebar_content(_ctx, props) {
        return <MemorySidebar api={api} sessionID={props.session_id} />
      },
    },
  })
}

const plugin: InternalTuiPlugin = {
  id,
  tui,
}

export default plugin
