#!/usr/bin/env ts-node
import 'dotenv/config';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import crypto from 'crypto';

const DB_DIR = path.resolve(
  (process.env.DB_PATH || '~/.code-llm/vectors.db').replace('~', os.homedir()).replace('/vectors.db', '')
);
const VECTORS_DB = path.join(DB_DIR, 'vectors.db');
const CACHE_DB = path.join(DB_DIR, 'cache.db');
const LLM_HOST = process.env.LLM_HOST || 'http://localhost:11434';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text';
const BATCH_SIZE = parseInt(process.env.EMBEDDING_BATCH || '32');

async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch(`${LLM_HOST}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBEDDING_MODEL, prompt: text }),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.statusText}`);
  const data = await res.json() as { embedding: number[] };
  return data.embedding;
}

function float32ToBuffer(arr: number[]): Buffer {
  const buf = Buffer.alloc(arr.length * 4);
  arr.forEach((v, i) => buf.writeFloatLE(v, i * 4));
  return buf;
}

async function main() {
  const db = new Database(VECTORS_DB);
  const cacheDb = new Database(CACHE_DB);
  db.pragma('journal_mode = WAL');
  cacheDb.pragma('journal_mode = WAL');

  // Get chunks without embeddings
  const chunks = db.prepare(`
    SELECT c.id, c.code, c.summary
    FROM code_chunks c
    LEFT JOIN vectors v ON v.chunk_id = c.id
    WHERE v.id IS NULL
    LIMIT 10000
  `).all() as Array<{ id: number; code: string; summary: string }>;

  if (chunks.length === 0) {
    console.log('✅ All chunks already have embeddings.');
    return;
  }

  console.log(`🔢 Generating embeddings for ${chunks.length} chunks...`);
  console.log(`   Model: ${EMBEDDING_MODEL} @ ${LLM_HOST}\n`);

  const insertVector = db.prepare('INSERT OR REPLACE INTO vectors (id, chunk_id, embedding) VALUES (?, ?, ?)');
  const insertCache = cacheDb.prepare(
    'INSERT OR REPLACE INTO embedding_cache (text_hash, embedding, model) VALUES (?, ?, ?)'
  );

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    for (const chunk of batch) {
      try {
        const text = `${chunk.summary}\n\n${chunk.code}`.slice(0, 2000);
        const hash = crypto.createHash('sha256').update(text).digest('hex');

        // Check cache
        const cached = cacheDb.prepare('SELECT embedding FROM embedding_cache WHERE text_hash = ?').get(hash) as { embedding: Buffer } | undefined;
        let embBuf: Buffer;

        if (cached) {
          embBuf = cached.embedding;
        } else {
          const embedding = await getEmbedding(text);
          embBuf = float32ToBuffer(embedding);
          insertCache.run(hash, embBuf, EMBEDDING_MODEL);
        }

        insertVector.run(chunk.id, chunk.id, embBuf);
        processed++;
      } catch (err) {
        failed++;
        if (failed <= 3) console.error(`  ❌ Chunk ${chunk.id}: ${err}`);
      }
    }

    process.stdout.write(`\r  ${processed}/${chunks.length} (${failed} failed)...`);
  }

  db.close();
  cacheDb.close();

  console.log(`\n\n✨ Done! ${processed} embeddings generated, ${failed} failed.`);
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
