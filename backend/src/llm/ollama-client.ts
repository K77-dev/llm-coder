import axios from 'axios';
import { logger } from '../utils/logger';

const LLAMA_SERVER_PORT = process.env.LLAMA_SERVER_PORT || '8080';
const LLM_BASE_URL = process.env.LLM_HOST || `http://localhost:${LLAMA_SERVER_PORT}`;
const DEFAULT_MODEL = process.env.LLM_MODEL || 'default';

export type RuntimeType = 'ollama' | 'llama-server' | 'unavailable';

export interface GenerateOptions {
  model?: string;
  system?: string;
  context?: string[];
  temperature?: number;
  maxTokens?: number;
}

let cachedRuntime: RuntimeType | null = null;

export function getCachedRuntime(): RuntimeType | null {
  return cachedRuntime;
}

export function clearCachedRuntime(): void {
  cachedRuntime = null;
}

export async function detectRuntime(): Promise<RuntimeType> {
  if (cachedRuntime) return cachedRuntime;

  try {
    const llamaResponse = await axios.get(`${LLM_BASE_URL}/health`, {
      timeout: 3000,
    });
    if (llamaResponse.status >= 200 && llamaResponse.status < 300) {
      cachedRuntime = 'llama-server';
      logger.info({ runtime: 'llama-server', baseUrl: LLM_BASE_URL }, 'Detected llama-server runtime');
      return cachedRuntime;
    }
  } catch {
    // llama-server not responding, try Ollama
  }

  try {
    const ollamaResponse = await axios.get(`${LLM_BASE_URL}/api/tags`, {
      timeout: 3000,
    });
    if (ollamaResponse.status >= 200 && ollamaResponse.status < 300) {
      cachedRuntime = 'ollama';
      logger.info({ runtime: 'ollama', baseUrl: LLM_BASE_URL }, 'Detected Ollama runtime');
      return cachedRuntime;
    }
  } catch {
    // Ollama not responding either
  }

  logger.warn({ baseUrl: LLM_BASE_URL }, 'No LLM runtime detected');
  return 'unavailable';
}

export async function generateResponse(
  prompt: string,
  options: GenerateOptions = {}
): Promise<string> {
  const runtime = await detectRuntime();
  if (runtime === 'unavailable') {
    throw new Error('No LLM runtime available');
  }
  const model = options.model || DEFAULT_MODEL;
  logger.debug({ model, runtime, promptLength: prompt.length }, 'Generating response');

  if (runtime === 'ollama') {
    return generateOllamaResponse(prompt, model, options);
  }
  return generateLlamaServerResponse(prompt, model, options);
}

async function generateOllamaResponse(
  prompt: string,
  model: string,
  options: GenerateOptions
): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    prompt,
    stream: false,
    options: {
      temperature: options.temperature ?? 0.1,
      num_predict: options.maxTokens ?? 2048,
    },
  };
  if (options.system) {
    body.system = options.system;
  }

  const response = await axios.post(`${LLM_BASE_URL}/api/generate`, body);
  const data = response.data as { response: string };
  return data.response;
}

async function generateLlamaServerResponse(
  prompt: string,
  model: string,
  options: GenerateOptions
): Promise<string> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (options.system) messages.push({ role: 'system', content: options.system });
  messages.push({ role: 'user', content: prompt });

  const response = await axios.post(`${LLM_BASE_URL}/v1/chat/completions`, {
    model,
    messages,
    temperature: options.temperature ?? 0.1,
    max_tokens: options.maxTokens ?? 2048,
    stream: false,
  });

  const data = response.data as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (content === undefined || content === null) {
    throw new Error('llama-server returned an unexpected response: missing choices[0].message.content');
  }
  return content;
}

export async function* streamResponse(
  prompt: string,
  options: GenerateOptions = {}
): AsyncGenerator<string> {
  const runtime = await detectRuntime();
  if (runtime === 'unavailable') {
    throw new Error('No LLM runtime available');
  }
  const model = options.model || DEFAULT_MODEL;

  if (runtime === 'ollama') {
    yield* streamOllamaResponse(prompt, model, options);
  } else {
    yield* streamLlamaServerResponse(prompt, model, options);
  }
}

async function* streamOllamaResponse(
  prompt: string,
  model: string,
  options: GenerateOptions
): AsyncGenerator<string> {
  const body: Record<string, unknown> = {
    model,
    prompt,
    stream: true,
    options: {
      temperature: options.temperature ?? 0.1,
      num_predict: options.maxTokens ?? 2048,
    },
  };
  if (options.system) {
    body.system = options.system;
  }

  const response = await axios.post(`${LLM_BASE_URL}/api/generate`, body, {
    responseType: 'stream',
  });

  const stream = response.data as NodeJS.ReadableStream;
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of stream) {
    const raw = chunk instanceof Uint8Array ? chunk : Buffer.from(String(chunk));
    buffer += decoder.decode(raw, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed) as { response?: string; done?: boolean };
        if (parsed.done) return;
        if (parsed.response) yield parsed.response;
      } catch {
        // skip malformed chunks
      }
    }
  }
}

async function* streamLlamaServerResponse(
  prompt: string,
  model: string,
  options: GenerateOptions
): AsyncGenerator<string> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (options.system) messages.push({ role: 'system', content: options.system });
  messages.push({ role: 'user', content: prompt });

  const response = await axios.post(`${LLM_BASE_URL}/v1/chat/completions`, {
    model,
    messages,
    temperature: options.temperature ?? 0.1,
    max_tokens: options.maxTokens ?? 2048,
    stream: true,
  }, {
    responseType: 'stream',
  });

  const stream = response.data as NodeJS.ReadableStream;
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of stream) {
    const raw = chunk instanceof Uint8Array ? chunk : Buffer.from(String(chunk));
    buffer += decoder.decode(raw, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const payload = trimmed.slice(6);
      if (payload === '[DONE]') return;

      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {
        // skip malformed chunks
      }
    }
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const runtime = await detectRuntime();
  if (runtime === 'unavailable') {
    throw new Error('No LLM runtime available for embeddings');
  }

  if (runtime === 'llama-server') {
    // Use llama-server embeddings endpoint
    try {
      const response = await axios.post(`${LLM_BASE_URL}/embedding`, {
        content: text,
      });
      const data = response.data as { embedding: number[] };
      return data.embedding;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 501) {
        throw new Error('Embeddings are not supported. Start llama-server with --embeddings flag');
      }
      throw error;
    }
  }

  // Use Ollama embeddings endpoint
  const response = await axios.post(`${LLM_BASE_URL}/api/embeddings`, {
    model: DEFAULT_MODEL,
    prompt: text,
  });

  const data = response.data as { embedding: number[] };
  return data.embedding;
}

export async function isAvailable(): Promise<boolean> {
  clearCachedRuntime();
  const runtime = await detectRuntime();
  if (runtime === 'unavailable') {
    return false;
  }
  return true;
}

export async function getLoadedModels(): Promise<string[]> {
  const runtime = await detectRuntime();
  if (runtime === 'ollama') {
    try {
      const response = await axios.get(`${LLM_BASE_URL}/api/tags`);
      const data = response.data as {
        models: Array<{ name: string }>;
      };
      return data.models.map((m) => m.name);
    } catch {
      return [DEFAULT_MODEL];
    }
  }
  if (runtime === 'llama-server') {
    try {
      const response = await axios.get(`${LLM_BASE_URL}/v1/models`);
      const data = response.data as {
        data: Array<{ id: string }>;
      };
      return data.data.map((m) => m.id);
    } catch {
      return [DEFAULT_MODEL];
    }
  }
  return [DEFAULT_MODEL];
}
