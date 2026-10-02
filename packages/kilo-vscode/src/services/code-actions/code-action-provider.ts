import * as vscode from "vscode"

export class KiloCodeActionProvider implements vscode.CodeActionProvider {
  static readonly metadata: vscode.CodeActionProviderMetadata = {
    providedCodeActionKinds: [vscode.CodeActionKind.QuickFix, vscode.CodeActionKind.RefactorRewrite],
  }

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    if (range.isEmpty) return []

    const actions: vscode.CodeAction[] = []

    const add = new vscode.CodeAction("Add to Harness Code", vscode.CodeActionKind.RefactorRewrite)
    add.command = { command: "harness-code.addToContext", title: "Add to Harness Code" }
    actions.push(add)

    const hasDiagnostics = context.diagnostics.length > 0

    if (hasDiagnostics) {
      const fix = new vscode.CodeAction("Fix with Harness Code", vscode.CodeActionKind.QuickFix)
      fix.command = { command: "harness-code.fixCode", title: "Fix with Harness Code" }
      fix.isPreferred = true
      actions.push(fix)
    }

    if (!hasDiagnostics) {
      const explain = new vscode.CodeAction("Explain with Harness Code", vscode.CodeActionKind.RefactorRewrite)
      explain.command = { command: "harness-code.explainCode", title: "Explain with Harness Code" }
      actions.push(explain)

      const improve = new vscode.CodeAction("Improve with Harness Code", vscode.CodeActionKind.RefactorRewrite)
      improve.command = { command: "harness-code.improveCode", title: "Improve with Harness Code" }
      actions.push(improve)
    }

    return actions
  }
}
