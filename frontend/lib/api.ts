import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  model?: 'local' | 'claude' | 'auto';
  history?: ChatMessage[];
  filter?: { repo?: string; language?: string };
  stream?: boolean;
}

export interface ChatSource {
  repo: string;
  filePath: string;
  language: string;
  score: number;
}

export interface ChatResponse {
  response: string;
  codeBlocks: Array<{ language: string; code: string }>;
  model: 'local' | 'claude';
  sources: ChatSource[];
}

export async function sendChat(request: ChatRequest): Promise<ChatResponse> {
  const { data } = await api.post<ChatResponse>('/chat', request);
  return data;
}

export async function* streamChat(request: ChatRequest): AsyncGenerator<string> {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...request, stream: true }),
  });

  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          if (parsed.text) yield parsed.text;
        } catch {
          // Skip malformed chunks
        }
      }
    }
  }
}

export async function checkHealth() {
  const { data } = await api.get('/health');
  return data;
}

export interface IndexResponse {
  status: string;
  name: string;
  path: string;
  message: string;
}

export async function indexDirectory(dirPath: string, name?: string): Promise<IndexResponse> {
  const { data } = await api.post<IndexResponse>('/index', { dirPath, name });
  return data;
}

export async function getIndexStatus(): Promise<{ isIndexing: boolean }> {
  const { data } = await api.get('/index/status');
  return data;
}

export async function clearIndex(repo?: string): Promise<{ status: string; removed?: number; message?: string }> {
  const url = repo ? `/index/${encodeURIComponent(repo)}` : '/index';
  const { data } = await api.delete(url);
  return data;
}
