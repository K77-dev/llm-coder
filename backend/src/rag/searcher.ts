import { generateEmbedding } from '../llm/ollama-client';
import { getVectorsDb } from '../db/sqlite-client';
import { embeddingCache } from '../utils/cache';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface SearchResult {
  id: number;
  repo: string;
  filePath: string;
  language: string;
  code: string;
  summary: string;
  score: number;
}

export interface SearchOptions {
  repo?: string;
  language?: string;
  collectionIds?: number[];
  skipScoreFilter?: boolean;
  minScore?: number;
}

export async function searchSimilar(
  query: string,
  topK = 5,
  filter?: SearchOptions
): Promise<SearchResult[]> {
  const start = Date.now();
  const collectionIds = filter?.collectionIds;
  const skipScoreFilter = filter?.skipScoreFilter ?? false;

  logger.info({ query, topK, collectionIds, skipScoreFilter, minScore: filter?.minScore }, 'RAG search started');

  // When collectionIds is absent or empty, return no results
  if (!collectionIds || collectionIds.length === 0) {
    logger.info('No collectionIds provided — returning empty results');
    return [];
  }

  const textHash = crypto.createHash('sha256').update(query).digest('hex');
  let queryEmbedding = embeddingCache.get(textHash);

  if (!queryEmbedding) {
    queryEmbedding = await generateEmbedding(query);
    embeddingCache.set(textHash, queryEmbedding);
  }

  const db = getVectorsDb();

  // Build filter clause
  const conditions: string[] = [];
  const params: unknown[] = [];

  // Filter by collection_files JOIN
  const placeholders = collectionIds.map(() => '?').join(', ');
  conditions.push(`cf.collection_id IN (${placeholders})`);
  params.push(...collectionIds);

  if (filter?.repo) {
    conditions.push('c.repo = ?');
    params.push(filter.repo);
  }
  if (filter?.language) {
    conditions.push('c.language = ?');
    params.push(filter.language);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Fetch chunks with vectors filtered by collections
  // JOIN collection_files to restrict to selected collections
  // DISTINCT avoids duplicates when a file belongs to multiple collections
  const rows = db.prepare(`
    SELECT DISTINCT c.id, c.repo, c.file_path, c.language, c.code, c.summary, v.embedding
    FROM code_chunks c
    JOIN vectors v ON v.chunk_id = c.id
    JOIN collection_files cf ON cf.repo = c.repo AND cf.file_path = c.file_path
    ${whereClause}
  `).all(...params) as Array<{
    id: number;
    repo: string;
    file_path: string;
    language: string;
    code: string;
    summary: string;
    embedding: Buffer;
  }>;

  logger.info({ totalChunks: rows.length, queryEmbeddingLength: queryEmbedding?.length }, 'RAG chunks fetched from DB');

  if (rows.length === 0) return [];

  const MIN_SCORE = filter?.minScore ?? 0.45;

  // Cosine similarity
  const scored = rows
    .map((row) => {
      const embedding = bufferToFloat32Array(row.embedding);
      return {
        id: row.id,
        repo: row.repo,
        filePath: row.file_path,
        language: row.language,
        code: row.code,
        summary: row.summary,
        score: cosineSimilarity(queryEmbedding!, embedding),
      };
    })
    .filter((r) => skipScoreFilter || r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  const elapsed = Date.now() - start;
  logger.debug({ elapsed, results: scored.length }, 'Vector search completed');

  return scored;
}

export function formatContextFromResults(results: SearchResult[]): string {
  return results
    .map((r, i) => `[${i + 1}] ${r.repo}/${r.filePath} (${r.language})\n\`\`\`${r.language}\n${r.code}\n\`\`\``)
    .join('\n\n');
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    logger.warn({ queryDims: a.length, storedDims: b.length }, 'Embedding dimension mismatch — cosine similarity will be 0');
    return 0;
  }
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function bufferToFloat32Array(buf: Buffer): number[] {
  const arr: number[] = [];
  for (let i = 0; i < buf.length; i += 4) {
    arr.push(buf.readFloatLE(i));
  }
  return arr;
}
