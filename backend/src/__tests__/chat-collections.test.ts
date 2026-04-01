import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';

// Mock all dependencies
const mockSearchSimilar = jest.fn<() => Promise<unknown[]>>();
const mockFormatContextFromResults = jest.fn<() => string>();
const mockGenerateResponse = jest.fn<() => Promise<string>>();
const mockIsAvailable = jest.fn<() => Promise<boolean>>();
const mockGenerateWithClaude = jest.fn<() => Promise<string>>();
const mockShouldUseClaude = jest.fn<() => boolean>();
const mockIsConfigured = jest.fn<() => boolean>();

jest.mock('../../src/rag/searcher', () => ({
  searchSimilar: (...args: unknown[]) => mockSearchSimilar(...(args as [])),
  formatContextFromResults: (...args: unknown[]) => mockFormatContextFromResults(...(args as [])),
}));

jest.mock('../../src/llm/ollama-client', () => ({
  generateResponse: (...args: unknown[]) => mockGenerateResponse(...(args as [])),
  streamResponse: jest.fn(),
  isAvailable: () => mockIsAvailable(),
  generateEmbedding: jest.fn(),
}));

jest.mock('../../src/llm/claude-client', () => ({
  generateWithClaude: (...args: unknown[]) => mockGenerateWithClaude(...(args as [])),
  streamWithClaude: jest.fn(),
  shouldUseClaude: (...args: unknown[]) => mockShouldUseClaude(...(args as [])),
  isConfigured: () => mockIsConfigured(),
}));

jest.mock('../../src/llm/prompt-templates', () => ({
  buildChatPrompt: jest.fn().mockReturnValue('test prompt'),
  buildSystemPrompt: jest.fn().mockReturnValue('test system prompt'),
}));

jest.mock('../../src/llm/response-parser', () => ({
  parseResponse: jest.fn().mockReturnValue({
    text: 'test response',
    codeBlocks: [],
    fileChanges: [],
    renames: [],
    deletes: [],
    createDirs: [],
    deleteDirs: [],
    listDirs: [],
    listSubdirs: [],
    listTrees: [],
    searchFiles: [],
    commands: [],
  }),
  estimateTokenCount: jest.fn().mockReturnValue(100),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { chat } from '../api/controllers/chat.controller';

function createMockReqRes(body: Record<string, unknown>): {
  req: Request;
  res: Response;
  next: NextFunction;
  jsonSpy: jest.Mock;
} {
  const jsonSpy = jest.fn();
  const req = { body } as Request;
  const res = {
    json: jsonSpy,
    setHeader: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
    status: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const next = jest.fn() as unknown as NextFunction;
  return { req, res, next, jsonSpy };
}

describe('chat controller with collectionIds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchSimilar.mockResolvedValue([]);
    mockFormatContextFromResults.mockReturnValue('');
    mockIsAvailable.mockResolvedValue(true);
    mockGenerateResponse.mockResolvedValue('test response');
    mockShouldUseClaude.mockReturnValue(false);
    mockIsConfigured.mockReturnValue(false);
  });

  it('should pass collectionIds to searchSimilar when provided', async () => {
    const { req, res, next } = createMockReqRes({
      message: 'How does the auth work?',
      collectionIds: [1, 2, 3],
    });
    await chat(req, res, next);
    expect(mockSearchSimilar).toHaveBeenCalledWith(
      'How does the auth work?',
      20,
      expect.objectContaining({ collectionIds: [1, 2, 3] })
    );
  });

  it('should pass undefined collectionIds when not provided', async () => {
    const { req, res, next } = createMockReqRes({
      message: 'How does the auth work?',
    });
    await chat(req, res, next);
    expect(mockSearchSimilar).toHaveBeenCalledWith(
      'How does the auth work?',
      5,
      expect.objectContaining({ collectionIds: undefined })
    );
  });

  it('should use custom ragTopK when provided', async () => {
    const { req, res, next } = createMockReqRes({
      message: 'test',
      collectionIds: [1],
      ragTopK: 10,
    });
    await chat(req, res, next);
    expect(mockSearchSimilar).toHaveBeenCalledWith(
      'test',
      10,
      expect.objectContaining({ collectionIds: [1] })
    );
  });

  it('should use custom ragMinScore when provided', async () => {
    const { req, res, next } = createMockReqRes({
      message: 'test',
      collectionIds: [1],
      ragMinScore: 0.2,
    });
    await chat(req, res, next);
    expect(mockSearchSimilar).toHaveBeenCalledWith(
      'test',
      20,
      expect.objectContaining({ collectionIds: [1], minScore: 0.2 })
    );
  });

  it('should combine filter and collectionIds in searchSimilar call', async () => {
    const { req, res, next } = createMockReqRes({
      message: 'test',
      filter: { repo: 'my-repo', language: 'typescript' },
      collectionIds: [5],
    });
    await chat(req, res, next);
    expect(mockSearchSimilar).toHaveBeenCalledWith(
      'test',
      20,
      expect.objectContaining({ repo: 'my-repo', language: 'typescript', collectionIds: [5] })
    );
  });

  it('should return successful response without collectionIds', async () => {
    const { req, res, next, jsonSpy } = createMockReqRes({
      message: 'Hello',
    });
    await chat(req, res, next);
    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        response: 'test response',
        sources: [],
      })
    );
  });

  it('should return successful response with collectionIds', async () => {
    mockSearchSimilar.mockResolvedValue([
      { repo: 'repo', filePath: '/src/a.ts', language: 'typescript', score: 0.9 },
    ]);
    mockFormatContextFromResults.mockReturnValue('context');
    const { req, res, next, jsonSpy } = createMockReqRes({
      message: 'Hello',
      collectionIds: [1],
    });
    await chat(req, res, next);
    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        response: 'test response',
        sources: [{ repo: 'repo', filePath: '/src/a.ts', language: 'typescript', score: 0.9 }],
      })
    );
  });

  it('should reject invalid collectionIds (non-integer)', async () => {
    const { req, res, next } = createMockReqRes({
      message: 'test',
      collectionIds: [1.5],
    });
    await chat(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 })
    );
  });

  it('should reject invalid collectionIds (negative)', async () => {
    const { req, res, next } = createMockReqRes({
      message: 'test',
      collectionIds: [-1],
    });
    await chat(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 })
    );
  });

  it('should reject invalid collectionIds (non-array)', async () => {
    const { req, res, next } = createMockReqRes({
      message: 'test',
      collectionIds: 'not-an-array',
    });
    await chat(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 })
    );
  });

  it('should accept empty collectionIds array', async () => {
    const { req, res, next, jsonSpy } = createMockReqRes({
      message: 'Hello',
      collectionIds: [],
    });
    await chat(req, res, next);
    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({ response: 'test response' })
    );
  });
});
