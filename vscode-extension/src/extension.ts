import * as vscode from 'vscode';
import { registerChatCommand } from './commands/chat';
import { registerExplainCommand } from './commands/explain';

export function activate(context: vscode.ExtensionContext): void {
  console.log('Code LLM extension activated');

  registerChatCommand(context);
  registerExplainCommand(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('codellm.generateTests', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor?.selection) {
        vscode.window.showInformationMessage('Selecione o código para gerar testes.');
        return;
      }
      const code = editor.document.getText(editor.selection);
      const lang = editor.document.languageId;
      await vscode.commands.executeCommand('codellm.chat', `Gere testes unitários para o seguinte código ${lang}:\n\n\`\`\`${lang}\n${code}\n\`\`\``);
    }),

    vscode.commands.registerCommand('codellm.review', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor?.selection) {
        vscode.window.showInformationMessage('Selecione o código para revisar.');
        return;
      }
      const code = editor.document.getText(editor.selection);
      const lang = editor.document.languageId;
      await vscode.commands.executeCommand('codellm.chat', `Revise o seguinte código ${lang} e identifique problemas de segurança, SOLID e performance:\n\n\`\`\`${lang}\n${code}\n\`\`\``);
    })
  );
}

export function deactivate(): void {
  console.log('Code LLM extension deactivated');
}
