import * as vscode from 'vscode';
import axios from 'axios';

function getApiUrl(): string {
  return vscode.workspace.getConfiguration('codellm').get('apiUrl', 'http://localhost:3001');
}

function getModel(): string {
  return vscode.workspace.getConfiguration('codellm').get('model', 'auto');
}

export interface ChatResponse {
  response: string;
  model: 'local' | 'claude';
  sources: Array<{ repo: string; filePath: string; language: string; score: number }>;
}

export async function sendChat(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<ChatResponse> {
  const { data } = await axios.post<ChatResponse>(`${getApiUrl()}/api/chat`, {
    message,
    history,
    model: getModel(),
  });
  return data;
}

export async function checkHealth(): Promise<boolean> {
  try {
    await axios.get(`${getApiUrl()}/api/health`, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}
