import { onCleanup, onMount, type Component, type ParentComponent } from "solid-js"
import { ThemeProvider } from "@harness/harness-ui/theme"
import { DialogProvider } from "@harness/harness-ui/context/dialog"
import { MarkedProvider } from "@harness/harness-ui/context/marked"
import { CodeComponentProvider } from "@harness/harness-ui/context/code"
import { DiffComponentProvider } from "@harness/harness-ui/context/diff"
import { FileComponentProvider } from "@harness/harness-ui/context/file"
import { Code } from "@harness/harness-ui/code"
import { Diff } from "@harness/harness-ui/diff"
import { File } from "@harness/harness-ui/file"
import { Toast } from "@harness/harness-ui/toast"
import { VSCodeProvider, useVSCode } from "./vscode"
import { ServerProvider } from "./server"
import { ProviderProvider } from "./provider"
import { ConfigProvider } from "./config"
import { DisplayProvider } from "./display"
import { IndexingProvider } from "./indexing"
import { MemoryProvider } from "./memory"
import { SessionProvider } from "./session"
import { LanguageBridge } from "./language-bridge"
import { FeedbackProvider } from "./feedback"
import { ImageModelsProvider } from "./image-models"

type MermaidImageEvent = CustomEvent<{ dataUrl: string; filename: string }>

const MermaidDownloadBridge: Component = () => {
  const vscode = useVSCode()

  onMount(() => {
    const save = (event: Event) => {
      const detail = (event as MermaidImageEvent).detail
      if (!detail?.dataUrl || !detail.filename) return
      event.preventDefault()
      vscode.postMessage({ type: "saveImage", dataUrl: detail.dataUrl, filename: detail.filename })
    }
    window.addEventListener("harness:save-image", save)
    onCleanup(() => window.removeEventListener("harness:save-image", save))
  })

  return null
}

const Root: ParentComponent = (props) => (
  <ThemeProvider defaultTheme="harness-vscode">
    <DialogProvider>
      <VSCodeProvider>
        <MermaidDownloadBridge />
        <ServerProvider>
          <LanguageBridge>
            {/* MarkedProvider is required here for all markdown consumers in the tree,
                including PRPanel's PRDescription and PRComments components. Do not remove. */}
            <MarkedProvider>
              <DiffComponentProvider component={Diff}>
                <CodeComponentProvider component={Code}>
                  <FileComponentProvider component={File}>
                    <ProviderProvider>
                      <ConfigProvider>
                        <DisplayProvider>{props.children}</DisplayProvider>
                      </ConfigProvider>
                    </ProviderProvider>
                  </FileComponentProvider>
                </CodeComponentProvider>
              </DiffComponentProvider>
            </MarkedProvider>
          </LanguageBridge>
        </ServerProvider>
      </VSCodeProvider>
      <Toast.Region />
    </DialogProvider>
  </ThemeProvider>
)

const Session: ParentComponent = (props) => (
  <IndexingProvider>
    <ImageModelsProvider>
      <SessionProvider>{props.children}</SessionProvider>
    </ImageModelsProvider>
  </IndexingProvider>
)

const Chat: ParentComponent = (props) => (
  <MemoryProvider>
    <FeedbackProvider>{props.children}</FeedbackProvider>
  </MemoryProvider>
)

export const ProviderShell = { Root, Session, Chat }
