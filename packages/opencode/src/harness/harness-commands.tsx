import { createMemo } from "solid-js"
import { useBindings } from "@tui/keymap"
import { useSync } from "@tui/context/sync"
import { useDialog } from "@tui/ui/dialog"
import { DialogIndexing } from "./components/dialog-indexing.js"
import { indexingEnabled } from "./indexing-feature"
import { showAboutDialog } from "./cli/cmd/tui/component/dialog-about.js"

// These types are OpenCode-internal and imported at runtime
type UseSDK = any

/**
 * Register the Harness TUI commands.
 * Call this from a component inside the TUI app.
 *
 * @param useSDK - OpenCode's useSDK hook (passed from TUI context)
 */
export function registerHarnessCommands(useSDK: () => UseSDK) {
  const sync = useSync()
  const dialog = useDialog()
  const indexing = createMemo(() => indexingEnabled(sync.data.config))

  useBindings(() => ({
    commands: [
      ...(indexing()
        ? [
            {
              name: "harness.indexing",
              title: "Indexing",
              desc: "Configure codebase indexing",
              category: "Harness",
              slashName: "indexing",
              slashAliases: ["index", "embedding"],
              run: () => {
                dialog.replace(() => <DialogIndexing useSDK={useSDK} />)
              },
            },
          ]
        : []),

      {
        name: "harness.about",
        title: "About",
        desc: "Show version, environment, and diagnostic info",
        category: "Harness",
        slashName: "about",
        run: () => {
          showAboutDialog(dialog)
        },
      },
    ].map((command) => ({
      namespace: "palette",
      ...command,
    })),
  }))
}
