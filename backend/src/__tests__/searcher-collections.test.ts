import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import Database from 'better-sqlite3';
import { runCollectionsMigration } from '../db/migrations/add-collections';

// Mock dependencies before importing searcher
const mockGenerateEmbedding = jest.fn<() => Promise<number[]>>();
const mockGetVectorsDb = jest.fn<() => Database.Database>();
const mockEmbeddingCache = {
  get: jest.fn(),
  set: jest.fn(),
};

jest.mock('../llm/ollama-client', () => ({
  generateEmbedding: (...args: unknown[]) => mockGenerateEmbedding(...(args as [])),
}));

jest.mock('../db/sqlite-client', () => ({
  getVectorsDb: () => mockGetVectorsDb(),
}));

jest.mock('../utils/cache', () => ({
  embeddingCache: mockEmbeddingCache,
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { searchSimilar } from '../rag/searcher';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
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
    CREATE TABLE IF NOT EXISTS vectors (
      id INTEGER PRIMARY KEY,
      chunk_id INTEGER REFERENCES code_chunks(id) ON DELETE CASCADE,
      embedding BLOB NOT NULL
    );
  `);
  runCollectionsMigration(db);
  return db;
}

function float32ArrayToBuffer(arr: number[]): Buffer {
  const buf = Buffer.alloc(arr.length * 4);
  for (let i = 0; i < arr.length; i++) {
    buf.writeFloatLE(arr[i], i * 4);
  }
  return buf;
}

function insertChunkWithVector(
  db: Database.Database,
  params: { repo: string; filePath: string; chunkId: number; language: string; code: string; summary: string; embedding: number[] }
): number {
  const stmt = db.prepare(
    'INSERT INTO code_chunks (repo, file_path, chunk_id, language, code, summary) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(params.repo, params.filePath, params.chunkId, params.language, params.code, params.summary);
  const id = result.lastInsertRowid as number;
  const embeddingBuf = float32ArrayToBuffer(params.embedding);
  db.prepare('INSERT INTO vectors (chunk_id, embedding) VALUES (?, ?)').run(id, embeddingBuf);
  return id;
}

function normalizeVector(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
  return v.map((x) => x / norm);
}

describe('searchSimilar with collectionIds', () => {
  let db: Database.Database;
  // Use a simple 3-dimensional embedding for testing
  // All embeddings are close enough to query to pass MIN_SCORE (0.45)
  const embeddingA = normalizeVector([1, 0.1, 0]);
  const embeddingB = normalizeVector([0.8, 0.6, 0]);
  const queryEmbedding = normalizeVector([1, 0.2, 0]);

  beforeEach(() => {
    db = createTestDb();
    mockGetVectorsDb.mockReturnValue(db);
    mockEmbeddingCache.get.mockReturnValue(queryEmbedding);
    mockGenerateEmbedding.mockResolvedValue(queryEmbedding);
  });

  afterEach(() => {
    db.close();
    jest.clearAllMocks();
  });

  it('should return empty array when collectionIds is undefined', async () => {
    insertChunkWithVector(db, {
      repo: 'my-repo', filePath: '/src/a.ts', chunkId: 0,
      language: 'typescript', code: 'const a = 1;', summary: 'variable a',
      embedding: embeddingA,
    });
    const results = await searchSimilar('test query', 5);
    expect(results).toEqual([]);
  });

  it('should return empty array when collectionIds is empty', async () => {
    insertChunkWithVector(db, {
      repo: 'my-repo', filePath: '/src/a.ts', chunkId: 0,
      language: 'typescript', code: 'const a = 1;', summary: 'variable a',
      embedding: embeddingA,
    });
    const results = await searchSimilar('test query', 5, { collectionIds: [] });
    expect(results).toEqual([]);
  });

  it('should return only chunks from selected collections', async () => {
    // Create two collections
    db.prepare('INSERT INTO collections (name, scope) VALUES (?, ?)').run('Col A', 'global');
    db.prepare('INSERT INTO collections (name, scope) VALUES (?, ?)').run('Col B', 'global');
    const colAId = 1;
    const colBId = 2;
    // Insert chunks
    insertChunkWithVector(db, {
      repo: 'repo', filePath: '/src/a.ts', chunkId: 0,
      language: 'typescript', code: 'const a = 1;', summary: 'file a',
      embedding: embeddingA,
    });
    insertChunkWithVector(db, {
      repo: 'repo', filePath: '/src/b.ts', chunkId: 0,
      language: 'typescript', code: 'const b = 2;', summary: 'file b',
      embedding: embeddingB,
    });
    // Link files to collections
    db.prepare('INSERT INTO collection_files (collection_id, file_path, repo) VALUES (?, ?, ?)').run(colAId, '/src/a.ts', 'repo');
    db.prepare('INSERT INTO collection_files (collection_id, file_path, repo) VALUES (?, ?, ?)').run(colBId, '/src/b.ts', 'repo');
    // Search only collection A
    const results = await searchSimilar('test', 5, { collectionIds: [colAId] });
    expect(results).toHaveLength(1);
    expect(results[0].filePath).toBe('/src/a.ts');
  });

  it('should return chunks from multiple selected collections', async () => {
    db.prepare('INSERT INTO collections (name, scope) VALUES (?, ?)').run('Col A', 'global');
    db.prepare('INSERT INTO collections (name, scope) VALUES (?, ?)').run('Col B', 'global');
    const colAId = 1;
    const colBId = 2;
    insertChunkWithVector(db, {
      repo: 'repo', filePath: '/src/a.ts', chunkId: 0,
      language: 'typescript', code: 'const a = 1;', summary: 'file a',
      embedding: embeddingA,
    });
    insertChunkWithVector(db, {
      repo: 'repo', filePath: '/src/b.ts', chunkId: 0,
      language: 'typescript', code: 'const b = 2;', summary: 'file b',
      embedding: embeddingB,
    });
    db.prepare('INSERT INTO collection_files (collection_id, file_path, repo) VALUES (?, ?, ?)').run(colAId, '/src/a.ts', 'repo');
    db.prepare('INSERT INTO collection_files (collection_id, file_path, repo) VALUES (?, ?, ?)').run(colBId, '/src/b.ts', 'repo');
    const results = await searchSimilar('test', 5, { collectionIds: [colAId, colBId] });
    expect(results).toHaveLength(2);
    const paths = results.map((r) => r.filePath).sort();
    expect(paths).toEqual(['/src/a.ts', '/src/b.ts']);
  });

  it('should return empty when collection has no files', async () => {
    db.prepare('INSERT INTO collections (name, scope) VALUES (?, ?)').run('Empty', 'global');
    insertChunkWithVector(db, {
      repo: 'repo', filePath: '/src/a.ts', chunkId: 0,
      language: 'typescript', code: 'const a = 1;', summary: 'file a',
      embedding: embeddingA,
    });
    const results = await searchSimilar('test', 5, { collectionIds: [1] });
    expect(results).toEqual([]);
  });

  it('should not duplicate results when file belongs to multiple collections', async () => {
    db.prepare('INSERT INTO collections (name, scope) VALUES (?, ?)').run('Col A', 'global');
    db.prepare('INSERT INTO collections (name, scope) VALUES (?, ?)').run('Col B', 'global');
    const colAId = 1;
    const colBId = 2;
    insertChunkWithVector(db, {
      repo: 'repo', filePath: '/src/shared.ts', chunkId: 0,
      language: 'typescript', code: 'const shared = true;', summary: 'shared file',
      embedding: embeddingA,
    });
    // Same file in both collections
    db.prepare('INSERT INTO collection_files (collection_id, file_path, repo) VALUES (?, ?, ?)').run(colAId, '/src/shared.ts', 'repo');
    db.prepare('INSERT INTO collection_files (collection_id, file_path, repo) VALUES (?, ?, ?)').run(colBId, '/src/shared.ts', 'repo');
    const results = await searchSimilar('test', 5, { collectionIds: [colAId, colBId] });
    expect(results).toHaveLength(1);
    expect(results[0].filePath).toBe('/src/shared.ts');
  });

  it('should file in multiple collections appear when any one is selected', async () => {
    db.prepare('INSERT INTO collections (name, scope) VALUES (?, ?)').run('Col A', 'global');
    db.prepare('INSERT INTO collections (name, scope) VALUES (?, ?)').run('Col B', 'global');
    insertChunkWithVector(db, {
      repo: 'repo', filePath: '/src/shared.ts', chunkId: 0,
      language: 'typescript', code: 'const shared = true;', summary: 'shared file',
      embedding: embeddingA,
    });
    db.prepare('INSERT INTO collection_files (collection_id, file_path, repo) VALUES (?, ?, ?)').run(1, '/src/shared.ts', 'repo');
    db.prepare('INSERT INTO collection_files (collection_id, file_path, repo) VALUES (?, ?, ?)').run(2, '/src/shared.ts', 'repo');
    // Select only collection B
    const results = await searchSimilar('test', 5, { collectionIds: [2] });
    expect(results).toHaveLength(1);
    expect(results[0].filePath).toBe('/src/shared.ts');
  });

  it('should respect repo filter in addition to collectionIds', async () => {
    db.prepare('INSERT INTO collections (name, scope) VALUES (?, ?)').run('Col', 'global');
    insertChunkWithVector(db, {
      repo: 'repo-a', filePath: '/src/a.ts', chunkId: 0,
      language: 'typescript', code: 'const a = 1;', summary: 'file a',
      embedding: embeddingA,
    });
    insertChunkWithVector(db, {
      repo: 'repo-b', filePath: '/src/b.ts', chunkId: 0,
      language: 'typescript', code: 'const b = 2;', summary: 'file b',
      embedding: embeddingA,
    });
    db.prepare('INSERT INTO collection_files (collection_id, file_path, repo) VALUES (?, ?, ?)').run(1, '/src/a.ts', 'repo-a');
    db.prepare('INSERT INTO collection_files (collection_id, file_path, repo) VALUES (?, ?, ?)').run(1, '/src/b.ts', 'repo-b');
    const results = await searchSimilar('test', 5, { collectionIds: [1], repo: 'repo-a' });
    expect(results).toHaveLength(1);
    expect(results[0].repo).toBe('repo-a');
  });
});
