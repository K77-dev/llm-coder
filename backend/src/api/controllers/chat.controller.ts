import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { searchSimilar, formatContextFromResults } from '../../rag/searcher';
import { generateResponse, streamResponse, isAvailable } from '../../llm/ollama-client';
import { generateWithClaude, streamWithClaude, shouldUseClaude, isConfigured } from '../../llm/claude-client';
import { buildChatPrompt, buildSystemPrompt } from '../../llm/prompt-templates';
import { parseResponse, estimateTokenCount } from '../../llm/response-parser';
import { AppError } from '../middleware/error';
import { logger } from '../../utils/logger';

const chatSchema = z.object({
  message: z.string().min(1).max(10000),
  model: z.enum(['local', 'claude', 'auto']).default('auto'),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional().default([]),
  filter: z.object({
    repo: z.string().optional(),
    language: z.string().optional(),
  }).optional(),
  stream: z.boolean().optional().default(false),
  projectDir: z.string().optional(),
});

export async function chat(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = chatSchema.parse(req.body);
    const { message, model, history, filter, stream, projectDir } = body;

    // RAG: Search for relevant code context
    const searchResults = await searchSimilar(message, 5, filter).catch(() => []);
    const ragContext = searchResults.length > 0
      ? formatContextFromResults(searchResults)
      : undefined;

    const prompt = buildChatPrompt(message, history, ragContext);
    const systemPrompt = buildSystemPrompt(projectDir);
    const tokenCount = estimateTokenCount(prompt);

    const useClaudeApi =
      model === 'claude' ||
      (model === 'auto' && shouldUseClaude(tokenCount)) ||
      (model === 'auto' && !(await isAvailable()));

    if (useClaudeApi && !isConfigured()) {
      throw new AppError(503, 'Claude API not configured and local LLM unavailable');
    }

    logger.info({
      model: useClaudeApi ? 'claude' : 'ollama',
      contextChunks: searchResults.length,
      tokenCount,
      stream,
    }, 'Processing chat request');

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const generator = useClaudeApi
        ? streamWithClaude(prompt, { system: systemPrompt })
        : streamResponse(prompt, { system: systemPrompt });

      for await (const chunk of generator) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const raw = useClaudeApi
      ? await generateWithClaude(prompt, { system: systemPrompt })
      : await generateResponse(prompt, { system: systemPrompt });

    const parsed = parseResponse(raw);

    res.json({
      response: parsed.text,
      codeBlocks: parsed.codeBlocks,
      fileChanges: parsed.fileChanges,
      renames: parsed.renames,
      deletes: parsed.deletes,
      createDirs: parsed.createDirs,
      deleteDirs: parsed.deleteDirs,
      listDirs: parsed.listDirs,
      listSubdirs: parsed.listSubdirs,
      listTrees: parsed.listTrees,
      searchFiles: parsed.searchFiles,
      commands: parsed.commands,
      model: useClaudeApi ? 'claude' : 'local',
      sources: searchResults.map((r) => ({
        repo: r.repo,
        filePath: r.filePath,
        language: r.language,
        score: r.score,
      })),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, 'Invalid request', err.errors));
    } else {
      next(err);
    }
  }
}
