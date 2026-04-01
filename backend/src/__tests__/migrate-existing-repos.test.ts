import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { runCollectionsMigration } from '../db/migrations/add-collections';
import { runExistingReposMigration } from '../db/migrations/migrate-existing-repos';

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

function createCodeChunksTable(db: Database.Database): void {
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
  `);
}

function insertChunk(
  db: Database.Database,
  repo: string,
  filePath: string,
  chunkId: number,
  indexedAt?: string
): void {
  const stmt = db.prepare(
    'INSERT INTO code_chunks (repo, file_path, chunk_id, language, code, indexed_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  stmt.run(repo, filePath, chunkId, 'typescript', `code for ${filePath}`, indexedAt ?? new Date().toISOString());
}

describe('runExistingReposMigration', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    createCodeChunksTable(db);
    runCollectionsMigration(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create global collections for each distinct repo', () => {
    insertChunk(db, 'repo-a', 'src/index.ts', 0);
    insertChunk(db, 'repo-a', 'src/utils.ts', 0);
    insertChunk(db, 'repo-b', 'lib/main.ts', 0);
    insertChunk(db, 'repo-c', 'app.ts', 0);

    const result = runExistingReposMigration(db);

    expect(result.collectionsCreated).toBe(3);
    expect(result.alreadyMigrated).toBe(false);

    const collections = db.prepare('SELECT * FROM collections ORDER BY name').all() as Array<{
      name: string;
      scope: string;
      project_dir: string | null;
    }>;
    expect(collections).toHaveLength(3);
    expect(collections[0].name).toBe('repo-a');
    expect(collections[0].scope).toBe('global');
    expect(collections[0].project_dir).toBeNull();
    expect(collections[1].name).toBe('repo-b');
    expect(collections[2].name).toBe('repo-c');
  });

  it('should link distinct files to their collections', () => {
    insertChunk(db, 'repo-a', 'src/index.ts', 0);
    insertChunk(db, 'repo-a', 'src/index.ts', 1);
    insertChunk(db, 'repo-a', 'src/utils.ts', 0);
    insertChunk(db, 'repo-b', 'lib/main.ts', 0);

    const result = runExistingReposMigration(db);

    expect(result.filesLinked).toBe(3);

    const files = db.prepare('SELECT * FROM collection_files ORDER BY file_path').all() as Array<{
      file_path: string;
      repo: string;
      indexed_at: string | null;
    }>;
    expect(files).toHaveLength(3);
    expect(files[0].file_path).toBe('lib/main.ts');
    expect(files[0].repo).toBe('repo-b');
    expect(files[1].file_path).toBe('src/index.ts');
    expect(files[1].repo).toBe('repo-a');
    expect(files[2].file_path).toBe('src/utils.ts');
    expect(files[2].repo).toBe('repo-a');
  });

  it('should preserve indexed_at from code_chunks using MAX', () => {
    const olderDate = '2025-01-01T00:00:00.000Z';
    const newerDate = '2025-06-01T00:00:00.000Z';
    insertChunk(db, 'repo-a', 'src/index.ts', 0, olderDate);
    insertChunk(db, 'repo-a', 'src/index.ts', 1, newerDate);

    runExistingReposMigration(db);

    const file = db.prepare('SELECT indexed_at FROM collection_files WHERE file_path = ?').get('src/index.ts') as {
      indexed_at: string;
    };
    expect(file.indexed_at).toBe(newerDate);
  });

  it('should return zero counts when no repos exist', () => {
    const result = runExistingReposMigration(db);

    expect(result.collectionsCreated).toBe(0);
    expect(result.filesLinked).toBe(0);
    expect(result.alreadyMigrated).toBe(false);
  });

  it('should be idempotent - running twice does not duplicate collections', () => {
    insertChunk(db, 'repo-a', 'src/index.ts', 0);
    insertChunk(db, 'repo-b', 'lib/main.ts', 0);

    const firstResult = runExistingReposMigration(db);
    expect(firstResult.collectionsCreated).toBe(2);
    expect(firstResult.filesLinked).toBe(2);

    const secondResult = runExistingReposMigration(db);
    expect(secondResult.collectionsCreated).toBe(0);
    expect(secondResult.filesLinked).toBe(0);
    expect(secondResult.alreadyMigrated).toBe(true);

    const collectionCount = (db.prepare('SELECT COUNT(*) as count FROM collections').get() as { count: number }).count;
    expect(collectionCount).toBe(2);

    const fileCount = (db.prepare('SELECT COUNT(*) as count FROM collection_files').get() as { count: number }).count;
    expect(fileCount).toBe(2);
  });

  it('should be idempotent - running three times produces same result', () => {
    insertChunk(db, 'repo-x', 'a.ts', 0);

    runExistingReposMigration(db);
    runExistingReposMigration(db);
    runExistingReposMigration(db);

    const collectionCount = (db.prepare('SELECT COUNT(*) as count FROM collections').get() as { count: number }).count;
    expect(collectionCount).toBe(1);

    const fileCount = (db.prepare('SELECT COUNT(*) as count FROM collection_files').get() as { count: number }).count;
    expect(fileCount).toBe(1);
  });

  it('should not affect manually created collections', () => {
    db.prepare("INSERT INTO collections (name, scope, project_dir) VALUES ('my-custom', 'local', '/projects/app')").run();
    insertChunk(db, 'repo-a', 'src/index.ts', 0);

    const result = runExistingReposMigration(db);

    expect(result.collectionsCreated).toBe(1);
    const collectionCount = (db.prepare('SELECT COUNT(*) as count FROM collections').get() as { count: number }).count;
    expect(collectionCount).toBe(2);
  });

  it('should handle repo name that matches existing global collection', () => {
    db.prepare("INSERT INTO collections (name, scope, project_dir) VALUES ('repo-a', 'global', NULL)").run();
    insertChunk(db, 'repo-a', 'src/index.ts', 0);

    const result = runExistingReposMigration(db);

    expect(result.collectionsCreated).toBe(0);
    const collectionCount = (db.prepare('SELECT COUNT(*) as count FROM collections').get() as { count: number }).count;
    expect(collectionCount).toBe(1);
    const fileCount = (db.prepare('SELECT COUNT(*) as count FROM collection_files').get() as { count: number }).count;
    expect(fileCount).toBe(1);
  });

  it('should return correct result when code_chunks table does not exist', () => {
    db.exec('DROP TABLE code_chunks');

    const result = runExistingReposMigration(db);

    expect(result.collectionsCreated).toBe(0);
    expect(result.filesLinked).toBe(0);
    expect(result.alreadyMigrated).toBe(false);
  });

  it('should return correct result when collections table does not exist', () => {
    db.exec('DROP TABLE collection_files');
    db.exec('DROP TABLE collections');

    const result = runExistingReposMigration(db);

    expect(result.collectionsCreated).toBe(0);
    expect(result.filesLinked).toBe(0);
    expect(result.alreadyMigrated).toBe(false);
  });
});

describe('runExistingReposMigration integration with CollectionService', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    createCodeChunksTable(db);
    runCollectionsMigration(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create collections queryable via CollectionService.listCollections', async () => {
    const { CollectionService } = await import('../services/collection-service');

    insertChunk(db, 'backend-api', 'src/index.ts', 0);
    insertChunk(db, 'backend-api', 'src/routes.ts', 0);
    insertChunk(db, 'frontend-app', 'app/page.tsx', 0);
    insertChunk(db, 'docs', 'README.md', 0);

    runExistingReposMigration(db);

    const service = new CollectionService(db);
    const collections = service.listCollections();

    expect(collections).toHaveLength(3);
    const names = collections.map((c) => c.name).sort();
    expect(names).toEqual(['backend-api', 'docs', 'frontend-app']);

    const backendCollection = collections.find((c) => c.name === 'backend-api');
    expect(backendCollection).toBeDefined();
    expect(backendCollection!.scope).toBe('global');
    expect(backendCollection!.fileCount).toBe(2);

    const docsCollection = collections.find((c) => c.name === 'docs');
    expect(docsCollection).toBeDefined();
    expect(docsCollection!.fileCount).toBe(1);
  });

  it('should create files queryable via CollectionService.getFiles', async () => {
    const { CollectionService } = await import('../services/collection-service');

    insertChunk(db, 'my-repo', 'src/a.ts', 0);
    insertChunk(db, 'my-repo', 'src/a.ts', 1);
    insertChunk(db, 'my-repo', 'src/b.ts', 0);

    runExistingReposMigration(db);

    const service = new CollectionService(db);
    const collections = service.listCollections();
    expect(collections).toHaveLength(1);

    const files = service.getFiles(collections[0].id);
    expect(files).toHaveLength(2);
    const paths = files.map((f) => f.filePath).sort();
    expect(paths).toEqual(['src/a.ts', 'src/b.ts']);
    expect(files[0].indexedAt).toBeDefined();
  });
});
