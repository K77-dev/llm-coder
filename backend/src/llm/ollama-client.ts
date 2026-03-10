import { Ollama } from 'ollama';
import { logger } from '../utils/logger';

const ollama = new Ollama({
  host: process.env.LLM_HOST || 'http://localhost:11434',
});

const DEFAULT_MODEL = process.env.LLM_MODEL || 'codellama:13b-instruct-q4_K_M';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text';

export interface GenerateOptions {
  model?: string;
  system?: string;
  context?: string[];
  temperature?: number;
  maxTokens?: number;
}

export async function generateResponse(
  prompt: string,
  options: GenerateOptions = {}
): Promise<string> {
  const model = options.model || DEFAULT_MODEL;

  logger.debug({ model, promptLength: prompt.length }, 'Generating response with Ollama');

  const response = await ollama.generate({
    model,
    prompt,
    system: options.system,
    options: {
      temperature: options.temperature ?? 0.1,
      num_predict: options.maxTokens ?? 2048,
    },
  });

  return response.response;
}

export async function* streamResponse(
  prompt: string,
  options: GenerateOptions = {}
): AsyncGenerator<string> {
  const model = options.model || DEFAULT_MODEL;

  const stream = await ollama.generate({
    model,
    prompt,
    system: options.system,
    stream: true,
    options: {
      temperature: options.temperature ?? 0.1,
      num_predict: options.maxTokens ?? 2048,
    },
  });

  for await (const chunk of stream) {
    if (chunk.response) yield chunk.response;
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await ollama.embeddings({
    model: EMBEDDING_MODEL,
    prompt: text,
  });
  return response.embedding;
}

export async function isAvailable(): Promise<boolean> {
  try {
    await ollama.list();
    return true;
  } catch {
    return false;
  }
}

export async function getLoadedModels(): Promise<string[]> {
  const { models } = await ollama.list();
  return models.map((m) => m.name);
}
