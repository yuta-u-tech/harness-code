/** Vscode-free presence state for the Agent Manager.
 *
 * Owns the displayed session id. It is gated on panel visibility: when the
 * panel is hidden (retainContextWhenHidden keeps the webview alive), flush()
 * clears the registration so the retained webview's reactive updates cannot
 * keep a stale session visible. When the panel returns, flush() re-registers
 * from stored state. */

type Register = (ids: string[]) => void

type PresenceMessage = { type: "agentManager.visibleSession"; sessionID: string | null }

export class AgentManagerVisiblePresence {
  private id: string | null = null
  constructor(
    private readonly register: Register,
    private readonly panelVisible: () => boolean,
  ) {}

  setDisplayed(id: string | null): void {
    this.id = id
    this.flush()
  }

  flush(): void {
    this.register(this.panelVisible() && this.id ? [this.id] : [])
  }

  handle(m: PresenceMessage): void {
    this.id = m.sessionID
    this.flush()
  }

  clear(): void {
    this.id = null
    this.register([])
  }
}
