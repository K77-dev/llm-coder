import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { logger } from '../utils/logger';
import { runLlamaSettingsMigration } from './migrations/add-llama-settings';

const DB_DIR = path.resolve((process.env.DB_PATH || '~/.code-llm/vectors.db').replace('~', os.homedir())).replace('/vectors.db', '');
const VECTORS_DB = path.join(DB_DIR, 'vectors.db');
const CACHE_DB = path.join(DB_DIR, 'cache.db');

let vectorsDb: Database.Database;
let cacheDb: Database.Database;

export function getVectorsDb(): Database.Database {
  if (!vectorsDb) throw new Error('Database not initialized. Call initDatabase() first.');
  return vectorsDb;
}

export function getCacheDb(): Database.Database {
  if (!cacheDb) throw new Error('Cache DB not initialized.');
  return cacheDb;
}

export async function initDatabase(): Promise<void> {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    logger.info({ dir: DB_DIR }, 'Created database directory');
  }

  vectorsDb = new Database(VECTORS_DB);
  cacheDb = new Database(CACHE_DB);

  // WAL mode for better concurrent reads
  vectorsDb.pragma('journal_mode = WAL');
  cacheDb.pragma('journal_mode = WAL');
  vectorsDb.pragma('synchronous = NORMAL');

  // Try to load sqlite-vec extension
  try {
    vectorsDb.loadExtension('vec0');
    logger.info('sqlite-vec extension loaded');
  } catch {
    logger.warn('sqlite-vec extension not found — vector search will use fallback');
  }

  runMigrations();
  logger.info({ vectors: VECTORS_DB, cache: CACHE_DB }, 'Database initialized');
}

function runMigrations(): void {
  vectorsDb.exec(`
    CREATE TABLE IF NOT EXISTS code_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo TEXT NOT NULL,
      file_path TEXT NOT NULL,
      chunk_id INTEGER NOT NULL,
      language TEXT NOT NULL,
      code TEXT NOT NULL,
      summary TEXT,
      indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(repo, file_path, chunk_id)
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_repo ON code_chunks(repo);
    CREATE INDEX IF NOT EXISTS idx_chunks_language ON code_chunks(language);

    CREATE TABLE IF NOT EXISTS vectors (
      id INTEGER PRIMARY KEY,
      chunk_id INTEGER REFERENCES code_chunks(id) ON DELETE CASCADE,
      embedding BLOB NOT NULL
    );
  `);

  cacheDb.exec(`
    CREATE TABLE IF NOT EXISTS embedding_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text_hash TEXT UNIQUE NOT NULL,
      embedding BLOB NOT NULL,
      model TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_cache_hash ON embedding_cache(text_hash);

    CREATE TABLE IF NOT EXISTS query_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query_hash TEXT UNIQUE NOT NULL,
      response TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    );
  `);

  runLlamaSettingsMigration(vectorsDb);
}

export function getLlamaSetting(key: string): string | null {
  const db = getVectorsDb();
  const row = db.prepare('SELECT value FROM llama_settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setLlamaSetting(key: string, value: string): void {
  const db = getVectorsDb();
  const updatedAt = new Date().toISOString();
  db.prepare(
    'INSERT INTO llama_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
  ).run(key, value, updatedAt);
}

export function deleteLlamaSetting(key: string): void {
  const db = getVectorsDb();
  db.prepare('DELETE FROM llama_settings WHERE key = ?').run(key);
}

export function closeDatabase(): void {
  vectorsDb?.close();
  cacheDb?.close();
}
