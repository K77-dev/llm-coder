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

export async function searchSimilar(
  query: string,
  topK = 5,
  filter?: { repo?: string; language?: string }
): Promise<SearchResult[]> {
  const start = Date.now();

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

  if (filter?.repo) {
    conditions.push('c.repo = ?');
    params.push(filter.repo);
  }
  if (filter?.language) {
    conditions.push('c.language = ?');
    params.push(filter.language);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Fetch all chunks with vectors (for brute-force cosine similarity)
  // In production with sqlite-vec, use: SELECT vec_distance_cosine(v.embedding, ?) as score
  const rows = db.prepare(`
    SELECT c.id, c.repo, c.file_path, c.language, c.code, c.summary, v.embedding
    FROM code_chunks c
    JOIN vectors v ON v.chunk_id = c.id
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

  if (rows.length === 0) return [];

  const MIN_SCORE = 0.45;

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
    .filter((r) => r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    // Deduplicate by filePath — keep highest-scoring entry per unique file
    .filter((r, i, arr) => arr.findIndex((x) => x.filePath === r.filePath) === i)
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
  if (a.length !== b.length) return 0;
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
