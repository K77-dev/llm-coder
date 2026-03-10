import fs from 'fs';
import path from 'path';
import { chunkFile, isIndexable, CodeChunk } from './chunker';
import { generateEmbedding } from '../llm/ollama-client';
import { getVectorsDb, getCacheDb } from '../db/sqlite-client';
import { embeddingCache } from '../utils/cache';
import { logger } from '../utils/logger';
import crypto from 'crypto';

let isIndexing = false;

export async function indexRepository(
  repoPath: string,
  repoName: string
): Promise<{ indexed: number; skipped: number }> {
  if (isIndexing) {
    logger.warn('Indexing already in progress');
    return { indexed: 0, skipped: 0 };
  }

  isIndexing = true;
  let indexed = 0;
  let skipped = 0;

  try {
    logger.info({ repo: repoName, path: repoPath }, 'Starting repository indexing');
    const files = getAllFiles(repoPath);

    for (const filePath of files) {
      if (!isIndexable(filePath)) {
        skipped++;
        continue;
      }

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const relativePath = path.relative(repoPath, filePath);
        const chunks = chunkFile(repoName, relativePath, content);

        for (const chunk of chunks) {
          await upsertChunk(chunk);
          indexed++;
        }
      } catch (err) {
        logger.warn({ file: filePath, err }, 'Failed to index file');
        skipped++;
      }
    }

    logger.info({ repo: repoName, indexed, skipped }, 'Repository indexing complete');
    return { indexed, skipped };
  } finally {
    isIndexing = false;
  }
}

async function upsertChunk(chunk: CodeChunk): Promise<void> {
  const db = getVectorsDb();
  const cacheDb = getCacheDb();

  const textToEmbed = `${chunk.summary}\n\n${chunk.code}`;
  const textHash = crypto.createHash('sha256').update(textToEmbed).digest('hex');

  // Check embedding cache first
  let embedding = embeddingCache.get(textHash);

  if (!embedding) {
    const cached = cacheDb.prepare(
      'SELECT embedding FROM embedding_cache WHERE text_hash = ?'
    ).get(textHash) as { embedding: Buffer } | undefined;

    if (cached) {
      embedding = bufferToFloat32Array(cached.embedding);
      embeddingCache.set(textHash, embedding);
    }
  }

  if (!embedding) {
    embedding = await generateEmbedding(textToEmbed);
    embeddingCache.set(textHash, embedding);

    cacheDb.prepare(
      'INSERT OR REPLACE INTO embedding_cache (text_hash, embedding, model) VALUES (?, ?, ?)'
    ).run(textHash, float32ArrayToBuffer(embedding), process.env.EMBEDDING_MODEL || 'nomic-embed-text');
  }

  // Upsert chunk
  const result = db.prepare(`
    INSERT INTO code_chunks (repo, file_path, chunk_id, language, code, summary)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(repo, file_path, chunk_id) DO UPDATE SET
      code = excluded.code,
      summary = excluded.summary,
      indexed_at = CURRENT_TIMESTAMP
    RETURNING id
  `).get(chunk.repo, chunk.filePath, chunk.chunkId, chunk.language, chunk.code, chunk.summary) as { id: number };

  // Upsert vector
  db.prepare(
    'INSERT OR REPLACE INTO vectors (id, chunk_id, embedding) VALUES (?, ?, ?)'
  ).run(result.id, result.id, float32ArrayToBuffer(embedding));
}

function getAllFiles(dir: string): string[] {
  const results: string[] = [];
  const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'target', '.next']);

  function walk(current: string) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          walk(path.join(current, entry.name));
        }
      } else {
        results.push(path.join(current, entry.name));
      }
    }
  }

  walk(dir);
  return results;
}

function float32ArrayToBuffer(arr: number[]): Buffer {
  const buf = Buffer.alloc(arr.length * 4);
  arr.forEach((v, i) => buf.writeFloatLE(v, i * 4));
  return buf;
}

function bufferToFloat32Array(buf: Buffer): number[] {
  const arr: number[] = [];
  for (let i = 0; i < buf.length; i += 4) {
    arr.push(buf.readFloatLE(i));
  }
  return arr;
}

export function getIndexingStatus(): { isIndexing: boolean } {
  return { isIndexing };
}
