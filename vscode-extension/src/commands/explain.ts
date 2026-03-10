import * as vscode from 'vscode';
import { sendChat } from '../api-client';

export function registerExplainCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('codellm.explain', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('Nenhum editor ativo.');
        return;
      }

      const selection = editor.selection;
      const code = editor.document.getText(selection.isEmpty ? undefined : selection);
      const lang = editor.document.languageId;
      const fileName = editor.document.fileName.split('/').pop() || 'arquivo';

      const prompt = `Explique o seguinte código ${lang} do arquivo ${fileName}:\n\n\`\`\`${lang}\n${code.slice(0, 3000)}\n\`\`\`\n\nSeja conciso e destaque padrões utilizados.`;

      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Code LLM: Analisando código...' },
        async () => {
          try {
            const response = await sendChat(prompt);
            const panel = vscode.window.createWebviewPanel(
              'codellmExplain',
              `Code LLM: ${fileName}`,
              vscode.ViewColumn.Beside,
              { enableScripts: false }
            );
            panel.webview.html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
body { font-family: var(--vscode-font-family); padding: 16px; color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); }
pre { background: var(--vscode-editorWidget-background); padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px; }
h1 { font-size: 16px; }
</style></head>
<body>
<h1>Explicação: ${fileName}</h1>
<div>${response.response.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre>$2</pre>').replace(/\n/g, '<br>')}</div>
<hr><small>Modelo: ${response.model}</small>
</body></html>`;
          } catch (err) {
            vscode.window.showErrorMessage(`Code LLM: ${err instanceof Error ? err.message : 'Erro'}`);
          }
        }
      );
    })
  );
}
