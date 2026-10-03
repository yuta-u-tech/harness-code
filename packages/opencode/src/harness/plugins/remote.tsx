import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@harness/plugin/tui"
import { RemoteIndicator } from "@/harness/remote-tui"

const id = "internal:remote"

function View(props: { api: TuiPluginApi }) {
  return (
    <box flexShrink={0}>
      <RemoteIndicator
        sdk={{ client: props.api.client }}
        theme={props.api.theme.current}
        harness={true}
        event={props.api.event}
      />
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 51,
    slots: {
      session_prompt_right() {
        return <View api={api} />
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = { id, tui }

export default plugin
