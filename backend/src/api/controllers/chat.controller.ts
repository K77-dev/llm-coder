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
    collectionIds: z.array(z.number().int().positive()).optional(),
    ragMinScore: z.number().min(0).max(1).optional(),
    ragTopK: z.number().int().min(1).max(50).optional(),
    stream: z.boolean().optional().default(false),
    projectDir: z.string().optional(),
});

export async function chat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const body = chatSchema.parse(req.body);
        const { message, model, history, filter, collectionIds, ragMinScore, ragTopK, stream, projectDir } = body;

        // RAG: Search for relevant code context filtered by selected collections
        logger.info({ collectionIds, ragMinScore, ragTopK }, 'Chat request RAG params received');
        const collectionRestricted = !!(collectionIds && collectionIds.length > 0);
        const searchFilter = {
            ...filter,
            collectionIds,
            skipScoreFilter: ragMinScore === 0,
            minScore: ragMinScore,
        };
        const topK = ragTopK ?? (collectionRestricted ? 20 : 5);
        const searchResults = await searchSimilar(message, topK, searchFilter).catch(() => []);

        // Trim RAG context to fit within local LLM context window
        // Reserve ~1500 tokens for system prompt, message, history and response
        const MAX_CONTEXT_TOKENS = 2500;
        let trimmedResults = searchResults;
        if (searchResults.length > 0) {
            let totalTokens = 0;
            const fitting = [];
            for (const r of searchResults) {
                const chunkTokens = estimateTokenCount(r.code + (r.summary || ''));
                if (totalTokens + chunkTokens > MAX_CONTEXT_TOKENS && fitting.length > 0) break;
                totalTokens += chunkTokens;
                fitting.push(r);
            }
            trimmedResults = fitting;
        }

        const ragContext = trimmedResults.length > 0
            ? formatContextFromResults(trimmedResults)
            : undefined;

        const prompt = buildChatPrompt(message, history, ragContext, collectionRestricted);
        const systemPrompt = buildSystemPrompt(projectDir, collectionRestricted);
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
            contextChunks: trimmedResults.length,
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
            sources: trimmedResults.map((r) => ({
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
