import * as vscode from 'vscode';
import { sendChat } from '../api-client';

let chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

export function registerChatCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('codellm.chat', async (initialMessage?: string) => {
      const panel = vscode.window.createWebviewPanel(
        'codellmChatPanel',
        'Code LLM',
        vscode.ViewColumn.Beside,
        { enableScripts: true, retainContextWhenHidden: true }
      );

      panel.webview.html = getChatHtml();

      if (initialMessage) {
        await processMessage(initialMessage, panel);
      }

      panel.webview.onDidReceiveMessage(async (message) => {
        if (message.type === 'send') {
          await processMessage(message.text, panel);
        } else if (message.type === 'clear') {
          chatHistory = [];
        }
      }, undefined, context.subscriptions);
    })
  );
}

async function processMessage(text: string, panel: vscode.WebviewPanel): Promise<void> {
  panel.webview.postMessage({ type: 'userMessage', text });

  try {
    const response = await sendChat(text, chatHistory);
    chatHistory.push({ role: 'user', content: text });
    chatHistory.push({ role: 'assistant', content: response.response });

    // Keep last 10 exchanges
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

    panel.webview.postMessage({
      type: 'assistantMessage',
      text: response.response,
      model: response.model,
    });
  } catch (err) {
    panel.webview.postMessage({
      type: 'error',
      text: err instanceof Error ? err.message : 'Erro ao processar mensagem',
    });
  }
}

function getChatHtml(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Code LLM</title>
<style>
  body { font-family: var(--vscode-font-family); margin: 0; padding: 0; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); display: flex; flex-direction: column; height: 100vh; }
  #messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  .msg { padding: 10px 14px; border-radius: 8px; max-width: 90%; font-size: 13px; line-height: 1.5; }
  .user { background: var(--vscode-button-background); align-self: flex-end; }
  .assistant { background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-widget-border); }
  .error { background: var(--vscode-inputValidation-errorBackground); border: 1px solid var(--vscode-inputValidation-errorBorder); }
  pre { background: var(--vscode-editor-background); padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px; border: 1px solid var(--vscode-widget-border); }
  #inputArea { display: flex; gap: 8px; padding: 12px; border-top: 1px solid var(--vscode-widget-border); }
  #input { flex: 1; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 8px; border-radius: 4px; font-family: inherit; font-size: 13px; resize: none; }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; }
  button:hover { background: var(--vscode-button-hoverBackground); }
  .model-badge { font-size: 10px; opacity: 0.6; margin-top: 4px; }
</style>
</head>
<body>
<div id="messages"><div class="msg assistant">Olá! Sou o Code LLM. Como posso ajudar com Java, Node.js, React ou Angular?</div></div>
<div id="inputArea">
  <textarea id="input" rows="2" placeholder="Pergunta..."></textarea>
  <button onclick="send()">Enviar</button>
</div>
<script>
const vscode = acquireVsCodeApi();
const msgs = document.getElementById('messages');
const input = document.getElementById('input');

input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });

function send() {
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  vscode.postMessage({ type: 'send', text });
}

window.addEventListener('message', ({ data }) => {
  if (data.type === 'userMessage') addMsg(data.text, 'user');
  else if (data.type === 'assistantMessage') {
    addMsg(data.text, 'assistant');
    if (data.model) {
      const last = msgs.lastElementChild;
      if (last) last.insertAdjacentHTML('beforeend', \`<div class="model-badge">via \${data.model}</div>\`);
    }
  }
  else if (data.type === 'error') addMsg(data.text, 'error');
  msgs.scrollTop = msgs.scrollHeight;
});

function addMsg(text, type) {
  const div = document.createElement('div');
  div.className = 'msg ' + type;
  div.innerHTML = text.replace(/\`\`\`(\\w+)?\\n([\\s\\S]*?)\`\`\`/g, '<pre>$2</pre>').replace(/\\n/g, '<br>');
  msgs.appendChild(div);
}
</script>
</body>
</html>`;
}
