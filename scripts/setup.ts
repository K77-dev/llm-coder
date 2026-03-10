#!/usr/bin/env ts-node
import 'dotenv/config';
import path from 'path';
import os from 'os';
import fs from 'fs';
import Database from 'better-sqlite3';

const DB_DIR = path.resolve(
  (process.env.DB_PATH || '~/.code-llm/vectors.db')
    .replace('~', os.homedir())
    .replace('/vectors.db', '')
);

const VECTORS_DB = path.join(DB_DIR, 'vectors.db');
const CACHE_DB = path.join(DB_DIR, 'cache.db');
const CONFIG_FILE = path.join(DB_DIR, 'config.json');

function run() {
  console.log('🚀 Setting up Code LLM databases...\n');

  // Create directory
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    console.log(`✅ Created directory: ${DB_DIR}`);
  } else {
    console.log(`📁 Directory exists: ${DB_DIR}`);
  }

  // Setup vectors DB
  const vectorsDb = new Database(VECTORS_DB);
  vectorsDb.pragma('journal_mode = WAL');
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
  vectorsDb.close();
  console.log(`✅ Vectors database: ${VECTORS_DB}`);

  // Setup cache DB
  const cacheDb = new Database(CACHE_DB);
  cacheDb.pragma('journal_mode = WAL');
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
  cacheDb.close();
  console.log(`✅ Cache database: ${CACHE_DB}`);

  // Write config
  const config = {
    version: '1.0',
    created: new Date().toISOString(),
    db_path: VECTORS_DB,
    cache_path: CACHE_DB,
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  console.log(`✅ Config: ${CONFIG_FILE}`);

  // Create logs directory
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log(`✅ Logs directory: ${logsDir}`);
  }

  console.log('\n✨ Setup complete! Run `npm run dev` to start.');
}

run();
