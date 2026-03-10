-- Migration 001: Initial schema
-- Executed automatically by sqlite-client.ts

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

-- Vector embeddings (requires sqlite-vec extension)
CREATE TABLE IF NOT EXISTS vectors (
  id INTEGER PRIMARY KEY,
  chunk_id INTEGER REFERENCES code_chunks(id) ON DELETE CASCADE,
  embedding BLOB NOT NULL
);

-- Embedding cache (cache.db)
CREATE TABLE IF NOT EXISTS embedding_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text_hash TEXT UNIQUE NOT NULL,
  embedding BLOB NOT NULL,
  model TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cache_hash ON embedding_cache(text_hash);

-- Query response cache (cache.db)
CREATE TABLE IF NOT EXISTS query_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query_hash TEXT UNIQUE NOT NULL,
  response TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);
