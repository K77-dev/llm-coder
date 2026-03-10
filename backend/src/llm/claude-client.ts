import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-6';
const FALLBACK_THRESHOLD_TOKENS = 30000;

export interface ClaudeOptions {
  maxTokens?: number;
  system?: string;
  temperature?: number;
}

export async function generateWithClaude(
  prompt: string,
  options: ClaudeOptions = {}
): Promise<string> {
  logger.info({ model: MODEL }, 'Using Claude API fallback');

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: options.maxTokens ?? 4096,
    system: options.system,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude');
  return content.text;
}

export async function* streamWithClaude(
  prompt: string,
  options: ClaudeOptions = {}
): AsyncGenerator<string> {
  const stream = await client.messages.create({
    model: MODEL,
    max_tokens: options.maxTokens ?? 4096,
    system: options.system,
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}

export function shouldUseClaude(promptTokenCount: number): boolean {
  return (
    process.env.FALLBACK_ONLY === 'true' ||
    promptTokenCount > FALLBACK_THRESHOLD_TOKENS
  );
}

export function isConfigured(): boolean {
  return !!process.env.CLAUDE_API_KEY;
}
