import {
  detectRuntime,
  clearCachedRuntime,
  getCachedRuntime,
  generateResponse,
  streamResponse,
  generateEmbedding,
  isAvailable,
  getLoadedModels,
} from '../ollama-client';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock axios
jest.mock('axios');
import axios from 'axios';
const mockAxios = axios as jest.Mocked<typeof axios>;

function createNodeStream(chunks: string[]): NodeJS.ReadableStream {
  const { Readable } = require('stream');
  let index = 0;
  return new Readable({
    read() {
      if (index < chunks.length) {
        this.push(Buffer.from(chunks[index]));
        index++;
      } else {
        this.push(null);
      }
    },
  });
}

beforeEach(() => {
  clearCachedRuntime();
  jest.resetAllMocks();
});

describe('detectRuntime', () => {
  it('should detect llama-server when /health responds 200', async () => {
    mockAxios.get.mockResolvedValueOnce({ status: 200, data: {} });

    const runtime = await detectRuntime();

    expect(runtime).toBe('llama-server');
    expect(mockAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/health'),
      expect.objectContaining({ timeout: 3000 })
    );
  });

  it('should detect Ollama when /api/tags responds 200', async () => {
    mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'));
    mockAxios.get.mockResolvedValueOnce({ status: 200, data: {} });

    const runtime = await detectRuntime();

    expect(runtime).toBe('ollama');
    expect(mockAxios.get).toHaveBeenCalledTimes(2);
  });

  it('should return unavailable when neither responds', async () => {
    mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'));
    mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'));

    const runtime = await detectRuntime();

    expect(runtime).toBe('unavailable');
  });

  it('should not cache unavailable state', async () => {
    mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'));
    mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'));

    await detectRuntime();

    expect(getCachedRuntime()).toBeNull();

    mockAxios.get.mockResolvedValueOnce({ status: 200, data: {} });
    const secondResult = await detectRuntime();

    expect(secondResult).toBe('llama-server');
    expect(getCachedRuntime()).toBe('llama-server');
  });

  it('should return unavailable when /health returns non-ok and /api/tags fails', async () => {
    mockAxios.get.mockResolvedValueOnce({ status: 503, data: {} });
    mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'));

    const runtime = await detectRuntime();

    expect(runtime).toBe('unavailable');
  });

  it('should cache the detection result', async () => {
    mockAxios.get.mockResolvedValueOnce({ status: 200, data: {} });

    await detectRuntime();
    const secondResult = await detectRuntime();

    expect(secondResult).toBe('llama-server');
    expect(mockAxios.get).toHaveBeenCalledTimes(1);
  });

  it('should clear cache and re-detect after clearCachedRuntime', async () => {
    mockAxios.get.mockResolvedValueOnce({ status: 200, data: {} });
    await detectRuntime();
    expect(getCachedRuntime()).toBe('llama-server');

    clearCachedRuntime();
    expect(getCachedRuntime()).toBeNull();

    mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'));
    mockAxios.get.mockResolvedValueOnce({ status: 200, data: {} });

    const runtime = await detectRuntime();
    expect(runtime).toBe('ollama');
  });
});

describe('generateResponse', () => {
  it('should format request for Ollama runtime', async () => {
    // Detect as Ollama
    mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'));
    mockAxios.get.mockResolvedValueOnce({ status: 200, data: {} });

    // Generate response
    mockAxios.post.mockResolvedValueOnce({
      data: { response: 'Hello from Ollama' },
    });

    const result = await generateResponse('test prompt', { system: 'be helpful' });

    expect(result).toBe('Hello from Ollama');
    expect(mockAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/generate'),
      expect.objectContaining({
        prompt: 'test prompt',
        system: 'be helpful',
        stream: false,
      })
    );
  });

  it('should format request for llama-server runtime (OpenAI format)', async () => {
    // Detect as llama-server
    mockAxios.get.mockResolvedValueOnce({ status: 200, data: {} });

    // Generate response
    mockAxios.post.mockResolvedValueOnce({
      data: { choices: [{ message: { content: 'Hello from llama-server' } }] },
    });

    const result = await generateResponse('test prompt', { system: 'be helpful' });

    expect(result).toBe('Hello from llama-server');
    expect(mockAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/v1/chat/completions'),
      expect.objectContaining({
        messages: [
          { role: 'system', content: 'be helpful' },
          { role: 'user', content: 'test prompt' },
        ],
        stream: false,
      })
    );
  });

  it('should throw when llama-server returns unexpected response', async () => {
    mockAxios.get.mockResolvedValueOnce({ status: 200, data: {} });

    mockAxios.post.mockResolvedValueOnce({
      data: { choices: [] },
    });

    await expect(generateResponse('test')).rejects.toThrow(
      'llama-server returned an unexpected response: missing choices[0].message.content'
    );
  });

  it('should throw when llama-server returns no choices field', async () => {
    mockAxios.get.mockResolvedValueOnce({ status: 200, data: {} });

    mockAxios.post.mockResolvedValueOnce({
      data: {},
    });

    await expect(generateResponse('test')).rejects.toThrow(
      'llama-server returned an unexpected response: missing choices[0].message.content'
    );
  });

  it('should throw when runtime is unavailable', async () => {
    mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'));
    mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'));

    await expect(generateResponse('test')).rejects.toThrow('No LLM runtime available');
  });
});

describe('streamResponse', () => {
  it('should parse Ollama streaming format', async () => {
    // Detect as Ollama
    mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'));
    mockAxios.get.mockResolvedValueOnce({ status: 200, data: {} });

    const nodeStream = createNodeStream([
      '{"response":"Hello"}\n',
      '{"response":" world"}\n',
      '{"response":"","done":true}\n',
    ]);

    mockAxios.post.mockResolvedValueOnce({ data: nodeStream });

    const tokens: string[] = [];
    for await (const token of streamResponse('test prompt')) {
      tokens.push(token);
    }

    expect(tokens).toEqual(['Hello', ' world']);
  });

  it('should parse llama-server SSE format (OpenAI)', async () => {
    // Detect as llama-server
    mockAxios.get.mockResolvedValueOnce({ status: 200, data: {} });

    const nodeStream = createNodeStream([
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: [DONE]\n\n',
    ]);

    mockAxios.post.mockResolvedValueOnce({ data: nodeStream });

    const tokens: string[] = [];
    for await (const token of streamResponse('test prompt')) {
      tokens.push(token);
    }

    expect(tokens).toEqual(['Hello', ' world']);
  });

  it('should throw when runtime is unavailable', async () => {
    mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'));
    mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'));

    const generator = streamResponse('test');
    await expect(generator.next()).rejects.toThrow('No LLM runtime available');
  });
});

describe('generateEmbedding', () => {
  it('should reject with error when runtime is llama-server', async () => {
    mockAxios.get.mockResolvedValueOnce({ status: 200, data: {} });

    await expect(generateEmbedding('test text')).rejects.toThrow(
      'Embeddings are not supported with llama-server'
    );
  });

  it('should work with Ollama runtime', async () => {
    // Detect as Ollama
    mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'));
    mockAxios.get.mockResolvedValueOnce({ status: 200, data: {} });

    // Embedding response
    mockAxios.post.mockResolvedValueOnce({
      data: { embedding: [0.1, 0.2, 0.3] },
    });

    const result = await generateEmbedding('test text');
    expect(result).toEqual([0.1, 0.2, 0.3]);

    expect(mockAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/embeddings'),
      expect.objectContaining({ prompt: 'test text' })
    );
  });

  it('should throw when runtime is unavailable', async () => {
    mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'));
    mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'));

    await expect(generateEmbedding('test')).rejects.toThrow(
      'No LLM runtime available for embeddings'
    );
  });
});

describe('isAvailable', () => {
  it('should return true when llama-server is available', async () => {
    mockAxios.get.mockResolvedValueOnce({ status: 200, data: {} });

    const result = await isAvailable();
    expect(result).toBe(true);
  });

  it('should return true when Ollama is available', async () => {
    mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'));
    mockAxios.get.mockResolvedValueOnce({ status: 200, data: {} });

    const result = await isAvailable();
    expect(result).toBe(true);
  });

  it('should return false when no runtime is available', async () => {
    mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'));
    mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'));

    const result = await isAvailable();
    expect(result).toBe(false);
  });

  it('should invalidate cache on each call', async () => {
    // First call - llama-server available
    mockAxios.get.mockResolvedValueOnce({ status: 200, data: {} });
    await isAvailable();
    expect(getCachedRuntime()).toBe('llama-server');

    // Second call - isAvailable clears cache and re-detects
    mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'));
    mockAxios.get.mockResolvedValueOnce({ status: 200, data: {} });
    await isAvailable();
    expect(getCachedRuntime()).toBe('ollama');
  });
});

describe('getLoadedModels', () => {
  it('should return models from Ollama /api/tags', async () => {
    // Detect as Ollama
    mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'));
    mockAxios.get.mockResolvedValueOnce({ status: 200, data: {} });

    // Models response
    mockAxios.get.mockResolvedValueOnce({
      data: {
        models: [
          { name: 'codellama:13b' },
          { name: 'llama2:7b' },
        ],
      },
    });

    const models = await getLoadedModels();
    expect(models).toEqual(['codellama:13b', 'llama2:7b']);
  });

  it('should return models from llama-server /v1/models', async () => {
    // Detect as llama-server
    mockAxios.get.mockResolvedValueOnce({ status: 200, data: {} });

    // Models response
    mockAxios.get.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'my-model' },
          { id: 'another-model' },
        ],
      },
    });

    const models = await getLoadedModels();
    expect(models).toEqual(['my-model', 'another-model']);
  });

  it('should return default model when Ollama /api/tags fails', async () => {
    // Detect as Ollama
    mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'));
    mockAxios.get.mockResolvedValueOnce({ status: 200, data: {} });

    // Models request fails
    mockAxios.get.mockRejectedValueOnce(new Error('Network error'));

    const models = await getLoadedModels();
    expect(models).toEqual(['default']);
  });

  it('should return default model when llama-server /v1/models fails', async () => {
    // Detect as llama-server
    mockAxios.get.mockResolvedValueOnce({ status: 200, data: {} });

    // Models request fails
    mockAxios.get.mockRejectedValueOnce(new Error('Network error'));

    const models = await getLoadedModels();
    expect(models).toEqual(['default']);
  });

  it('should return default model when runtime is unavailable', async () => {
    mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'));
    mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'));

    const models = await getLoadedModels();
    expect(models).toEqual(['default']);
  });
});
