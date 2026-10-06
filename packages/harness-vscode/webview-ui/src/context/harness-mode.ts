import { createSignal } from "solid-js"

/** While on, a message sent from the chat input starts a harness run instead of a plain chat turn. */
const [harnessMode, setHarnessMode] = createSignal(false)

export { harnessMode, setHarnessMode }
