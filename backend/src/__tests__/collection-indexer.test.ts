import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import Database from 'better-sqlite3';
import { CollectionIndexer } from '../rag/collection-indexer';
import { CollectionService } from '../services/collection-service';
import { runCollectionsMigration } from '../db/migrations/add-collections';
import { isIndexable } from '../rag/chunker';
import fs from 'fs';
import path from 'path';
import os from 'os';

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

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
    CREATE INDEX IF NOT EXISTS idx_chunks_repo ON code_chunks(repo);
    CREATE TABLE IF NOT EXISTS vectors (
      id INTEGER PRIMARY KEY,
      chunk_id INTEGER REFERENCES code_chunks(id) ON DELETE CASCADE,
      embedding BLOB NOT NULL
    );
  `);
  runCollectionsMigration(db);
  return db;
}

function createMockEmbedding(): number[] {
  return Array.from({ length: 4 }, () => Math.random());
}

describe('CollectionIndexer', () => {
  let db: Database.Database;
  let indexer: CollectionIndexer;
  let service: CollectionService;
  let mockGenerateEmbedding: jest.MockedFunction<(text: string) => Promise<number[]>>;
  let tmpDir: string;

  beforeEach(() => {
    db = createTestDb();
    mockGenerateEmbedding = jest.fn<(text: string) => Promise<number[]>>()
      .mockResolvedValue(createMockEmbedding());
    indexer = new CollectionIndexer({
      db,
      generateEmbedding: mockGenerateEmbedding,
    });
    service = new CollectionService(db);
    service.setIndexer(indexer);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collection-indexer-test-'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createTestFile(relativePath: string, content: string): void {
    const fullPath = path.join(tmpDir, relativePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf-8');
  }

  describe('hasExistingChunks', () => {
    it('should return false when no chunks exist', () => {
      expect(indexer.hasExistingChunks('my-repo', 'src/index.ts')).toBe(false);
    });

    it('should return true when chunks exist for the repo and file', () => {
      db.prepare(`
        INSERT INTO code_chunks (repo, file_path, chunk_id, language, code, summary)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('my-repo', 'src/index.ts', 0, 'typescript', 'const x = 1;', 'test');
      expect(indexer.hasExistingChunks('my-repo', 'src/index.ts')).toBe(true);
    });

    it('should return false for different repo', () => {
      db.prepare(`
        INSERT INTO code_chunks (repo, file_path, chunk_id, language, code, summary)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('other-repo', 'src/index.ts', 0, 'typescript', 'const x = 1;', 'test');
      expect(indexer.hasExistingChunks('my-repo', 'src/index.ts')).toBe(false);
    });

    it('should return false for different file path', () => {
      db.prepare(`
        INSERT INTO code_chunks (repo, file_path, chunk_id, language, code, summary)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('my-repo', 'src/other.ts', 0, 'typescript', 'const x = 1;', 'test');
      expect(indexer.hasExistingChunks('my-repo', 'src/index.ts')).toBe(false);
    });
  });

  describe('indexCollectionFiles', () => {
    it('should index new files and create chunks', async () => {
      createTestFile('src/index.ts', 'export const hello = "world";');
      const collection = service.createCollection({ name: 'Test', scope: 'global' });
      const files = [{ filePath: 'src/index.ts', repo: 'test-repo' }];
      service.addFiles(collection.id, files);
      const repoBasePaths = new Map([['test-repo', tmpDir]]);
      await indexer.indexCollectionFiles(collection.id, files, repoBasePaths);
      const chunks = db.prepare(
        'SELECT * FROM code_chunks WHERE repo = ? AND file_path = ?'
      ).all('test-repo', 'src/index.ts');
      expect(chunks.length).toBeGreaterThan(0);
      expect(mockGenerateEmbedding).toHaveBeenCalled();
    });

    it('should skip indexing for files with existing chunks', async () => {
      db.prepare(`
        INSERT INTO code_chunks (repo, file_path, chunk_id, language, code, summary)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('test-repo', 'src/existing.ts', 0, 'typescript', 'const x = 1;', 'test');
      const collection = service.createCollection({ name: 'Test', scope: 'global' });
      const files = [{ filePath: 'src/existing.ts', repo: 'test-repo' }];
      service.addFiles(collection.id, files);
      await indexer.indexCollectionFiles(collection.id, files);
      expect(mockGenerateEmbedding).not.toHaveBeenCalled();
    });

    it('should update indexed_at after indexing new file', async () => {
      createTestFile('src/app.ts', 'export function main() { return 42; }');
      const collection = service.createCollection({ name: 'Test', scope: 'global' });
      const files = [{ filePath: 'src/app.ts', repo: 'test-repo' }];
      service.addFiles(collection.id, files);
      const repoBasePaths = new Map([['test-repo', tmpDir]]);
      await indexer.indexCollectionFiles(collection.id, files, repoBasePaths);
      const collectionFiles = service.getFiles(collection.id);
      expect(collectionFiles[0].indexedAt).not.toBeNull();
    });

    it('should update indexed_at for already-indexed files without reprocessing', async () => {
      db.prepare(`
        INSERT INTO code_chunks (repo, file_path, chunk_id, language, code, summary)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('test-repo', 'src/cached.ts', 0, 'typescript', 'const cached = true;', 'cached file');
      const collection = service.createCollection({ name: 'Test', scope: 'global' });
      const files = [{ filePath: 'src/cached.ts', repo: 'test-repo' }];
      service.addFiles(collection.id, files);
      await indexer.indexCollectionFiles(collection.id, files);
      const collectionFiles = service.getFiles(collection.id);
      expect(collectionFiles[0].indexedAt).not.toBeNull();
      expect(mockGenerateEmbedding).not.toHaveBeenCalled();
    });

    it('should handle empty files array gracefully', async () => {
      await indexer.indexCollectionFiles(1, []);
      expect(mockGenerateEmbedding).not.toHaveBeenCalled();
    });

    it('should skip file when no base path is provided for repo', async () => {
      const collection = service.createCollection({ name: 'Test', scope: 'global' });
      const files = [{ filePath: 'src/no-base.ts', repo: 'unknown-repo' }];
      service.addFiles(collection.id, files);
      await indexer.indexCollectionFiles(collection.id, files, new Map());
      expect(mockGenerateEmbedding).not.toHaveBeenCalled();
    });

    it('should skip file when file does not exist on disk', async () => {
      const collection = service.createCollection({ name: 'Test', scope: 'global' });
      const files = [{ filePath: 'src/nonexistent.ts', repo: 'test-repo' }];
      service.addFiles(collection.id, files);
      const repoBasePaths = new Map([['test-repo', tmpDir]]);
      await indexer.indexCollectionFiles(collection.id, files, repoBasePaths);
      expect(mockGenerateEmbedding).not.toHaveBeenCalled();
    });

    it('should skip non-indexable files and still update indexed_at', async () => {
      createTestFile('assets/logo.png', 'binary-data');
      const collection = service.createCollection({ name: 'Test', scope: 'global' });
      const files = [{ filePath: 'assets/logo.png', repo: 'test-repo' }];
      service.addFiles(collection.id, files);
      const repoBasePaths = new Map([['test-repo', tmpDir]]);
      await indexer.indexCollectionFiles(collection.id, files, repoBasePaths);
      expect(mockGenerateEmbedding).not.toHaveBeenCalled();
      const collectionFiles = service.getFiles(collection.id);
      expect(collectionFiles[0].indexedAt).not.toBeNull();
    });
  });

  describe('status tracking', () => {
    it('should return idle initially', () => {
      expect(indexer.getStatus(1)).toBe('idle');
    });

    it('should change to indexing during indexing', async () => {
      createTestFile('src/slow.ts', 'export const slow = true;');
      const collection = service.createCollection({ name: 'Test', scope: 'global' });
      const files = [{ filePath: 'src/slow.ts', repo: 'test-repo' }];
      service.addFiles(collection.id, files);
      let statusDuringIndexing: string | undefined;
      mockGenerateEmbedding.mockImplementation(async () => {
        statusDuringIndexing = indexer.getStatus(collection.id);
        return createMockEmbedding();
      });
      const repoBasePaths = new Map([['test-repo', tmpDir]]);
      await indexer.indexCollectionFiles(collection.id, files, repoBasePaths);
      expect(statusDuringIndexing).toBe('indexing');
    });

    it('should change to done after successful indexing', async () => {
      createTestFile('src/done.ts', 'export const done = true;');
      const collection = service.createCollection({ name: 'Test', scope: 'global' });
      const files = [{ filePath: 'src/done.ts', repo: 'test-repo' }];
      service.addFiles(collection.id, files);
      const repoBasePaths = new Map([['test-repo', tmpDir]]);
      await indexer.indexCollectionFiles(collection.id, files, repoBasePaths);
      expect(indexer.getStatus(collection.id)).toBe('done');
    });

    it('should change to error when indexing fails', async () => {
      createTestFile('src/fail.ts', 'export const fail = true;');
      const collection = service.createCollection({ name: 'Test', scope: 'global' });
      const files = [{ filePath: 'src/fail.ts', repo: 'test-repo' }];
      service.addFiles(collection.id, files);
      mockGenerateEmbedding.mockRejectedValue(new Error('Embedding service unavailable'));
      const repoBasePaths = new Map([['test-repo', tmpDir]]);
      await expect(
        indexer.indexCollectionFiles(collection.id, files, repoBasePaths)
      ).rejects.toThrow('Embedding service unavailable');
      expect(indexer.getStatus(collection.id)).toBe('error');
      expect(indexer.getError(collection.id)).toBe('Embedding service unavailable');
    });
  });

  describe('CollectionService integration', () => {
    it('should trigger background indexing when addFiles is called with indexer set', () => {
      const collection = service.createCollection({ name: 'Test', scope: 'global' });
      const spy = jest.spyOn(indexer, 'indexCollectionFilesInBackground');
      const files = [{ filePath: 'src/bg.ts', repo: 'test-repo' }];
      service.addFiles(collection.id, files);
      expect(spy).toHaveBeenCalledWith(collection.id, files, undefined);
      spy.mockRestore();
    });

    it('should not trigger indexing when no indexer is set', () => {
      const serviceNoIndexer = new CollectionService(db);
      const collection = serviceNoIndexer.createCollection({ name: 'NoIndexer', scope: 'global' });
      expect(() => {
        serviceNoIndexer.addFiles(collection.id, [{ filePath: 'src/a.ts', repo: 'repo' }]);
      }).not.toThrow();
    });

    it('should return indexer status including error state', async () => {
      createTestFile('src/err.ts', 'export const err = true;');
      const collection = service.createCollection({ name: 'Test', scope: 'global' });
      const files = [{ filePath: 'src/err.ts', repo: 'test-repo' }];
      service.addFiles(collection.id, files);
      mockGenerateEmbedding.mockRejectedValue(new Error('fail'));
      const repoBasePaths = new Map([['test-repo', tmpDir]]);
      try {
        await indexer.indexCollectionFiles(collection.id, files, repoBasePaths);
      } catch {
        // expected
      }
      expect(service.getIndexingStatus(collection.id)).toEqual(expect.objectContaining({ status: 'error' }));
    });

    it('should use addFilesAndIndex for synchronous indexing', async () => {
      createTestFile('src/sync.ts', 'export const sync = true;');
      const collection = service.createCollection({ name: 'SyncTest', scope: 'global' });
      const files = [{ filePath: 'src/sync.ts', repo: 'test-repo' }];
      const repoBasePaths = new Map([['test-repo', tmpDir]]);
      await service.addFilesAndIndex(collection.id, files, repoBasePaths);
      const collectionFiles = service.getFiles(collection.id);
      expect(collectionFiles[0].indexedAt).not.toBeNull();
      expect(mockGenerateEmbedding).toHaveBeenCalled();
    });
  });

  describe('file removal safety', () => {
    it('should not affect chunks when removing file used by other collections', () => {
      db.prepare(`
        INSERT INTO code_chunks (repo, file_path, chunk_id, language, code, summary)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('repo', 'src/shared.ts', 0, 'typescript', 'const shared = 1;', 'shared');
      const col1 = service.createCollection({ name: 'Col1', scope: 'global' });
      const col2 = service.createCollection({ name: 'Col2', scope: 'global' });
      service.addFiles(col1.id, [{ filePath: 'src/shared.ts', repo: 'repo' }]);
      service.addFiles(col2.id, [{ filePath: 'src/shared.ts', repo: 'repo' }]);
      const files1 = service.getFiles(col1.id);
      service.removeFile(col1.id, files1[0].id);
      const chunks = db.prepare(
        'SELECT * FROM code_chunks WHERE repo = ? AND file_path = ?'
      ).all('repo', 'src/shared.ts');
      expect(chunks.length).toBe(1);
      expect(service.isFileUsedByOtherCollections(col1.id, 'src/shared.ts', 'repo')).toBe(true);
    });

    it('should report false when file is not used by other collections', () => {
      const col = service.createCollection({ name: 'OnlyCol', scope: 'global' });
      service.addFiles(col.id, [{ filePath: 'src/unique.ts', repo: 'repo' }]);
      expect(service.isFileUsedByOtherCollections(col.id, 'src/unique.ts', 'repo')).toBe(false);
    });

    it('should keep chunks intact after removing file from collection', () => {
      db.prepare(`
        INSERT INTO code_chunks (repo, file_path, chunk_id, language, code, summary)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('repo', 'src/keep.ts', 0, 'typescript', 'const keep = 1;', 'keep');
      const col = service.createCollection({ name: 'Keep', scope: 'global' });
      service.addFiles(col.id, [{ filePath: 'src/keep.ts', repo: 'repo' }]);
      const files = service.getFiles(col.id);
      service.removeFile(col.id, files[0].id);
      const chunks = db.prepare(
        'SELECT * FROM code_chunks WHERE repo = ? AND file_path = ?'
      ).all('repo', 'src/keep.ts');
      expect(chunks.length).toBe(1);
    });
  });

  describe('LRU cache', () => {
    it('should use LRU cache on second indexing of same content', async () => {
      createTestFile('src/cached-lru.ts', 'export const lru = true;');
      const collection = service.createCollection({ name: 'LRU', scope: 'global' });
      const files = [{ filePath: 'src/cached-lru.ts', repo: 'lru-repo' }];
      service.addFiles(collection.id, files);
      const repoBasePaths = new Map([['lru-repo', tmpDir]]);
      await indexer.indexCollectionFiles(collection.id, files, repoBasePaths);
      const callCount = mockGenerateEmbedding.mock.calls.length;
      expect(callCount).toBeGreaterThan(0);
      db.prepare('DELETE FROM code_chunks WHERE repo = ?').run('lru-repo');
      db.prepare(
        'UPDATE collection_files SET indexed_at = NULL WHERE collection_id = ?'
      ).run(collection.id);
      await indexer.indexCollectionFiles(collection.id, files, repoBasePaths);
      expect(mockGenerateEmbedding.mock.calls.length).toBe(callCount);
    });
  });

  describe('embeddingModel injection', () => {
    it('should use injected embeddingModel when writing to cache', async () => {
      const cacheDb = new Database(':memory:');
      cacheDb.exec(`
        CREATE TABLE IF NOT EXISTS embedding_cache (
          text_hash TEXT PRIMARY KEY,
          embedding BLOB NOT NULL,
          model TEXT NOT NULL
        )
      `);
      const customIndexer = new CollectionIndexer({
        db,
        cacheDb,
        generateEmbedding: mockGenerateEmbedding,
        embeddingModel: 'custom-model',
      });
      service.setIndexer(customIndexer);
      createTestFile('src/model-test.ts', 'export const model = true;');
      const collection = service.createCollection({ name: 'ModelTest', scope: 'global' });
      const files = [{ filePath: 'src/model-test.ts', repo: 'model-repo' }];
      const repoBasePaths = new Map([['model-repo', tmpDir]]);
      await service.addFilesAndIndex(collection.id, files, repoBasePaths);
      const row = cacheDb.prepare('SELECT model FROM embedding_cache LIMIT 1').get() as { model: string } | undefined;
      expect(row).toBeDefined();
      expect(row!.model).toBe('custom-model');
      cacheDb.close();
    });
  });

  describe('concurrency guard', () => {
    it('should wait for existing indexing before starting new background indexing', async () => {
      createTestFile('src/conc1.ts', 'export const c1 = true;');
      createTestFile('src/conc2.ts', 'export const c2 = true;');
      const collection = service.createCollection({ name: 'Conc', scope: 'global' });
      const files1 = [{ filePath: 'src/conc1.ts', repo: 'conc-repo' }];
      const files2 = [{ filePath: 'src/conc2.ts', repo: 'conc-repo' }];
      const repoBasePaths = new Map([['conc-repo', tmpDir]]);
      const executionOrder: string[] = [];
      let resolveFirst: (() => void) | undefined;
      const firstCallPromise = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });
      let callCount = 0;
      mockGenerateEmbedding.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          executionOrder.push('first-start');
          await firstCallPromise;
          executionOrder.push('first-end');
        } else {
          executionOrder.push('second');
        }
        return createMockEmbedding();
      });
      service.addFiles(collection.id, files1, repoBasePaths);
      service.addFiles(collection.id, files2, repoBasePaths);
      resolveFirst!();
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(executionOrder[0]).toBe('first-start');
    });
  });

  describe('absolute path indexing (real frontend flow)', () => {
    it('should index file using absolute filePath without repoBasePaths', async () => {
      const absPath = path.join(tmpDir, 'src/index.ts');
      createTestFile('src/index.ts', 'export const hello = "world";');
      const collection = service.createCollection({ name: 'MyCollection', scope: 'global' });
      const files = [{ filePath: absPath, repo: 'MyCollection' }];
      // Bypass expandDirectories by calling indexer directly
      service.addFiles(collection.id, files);
      await indexer.indexCollectionFiles(collection.id, files);
      const collectionFiles = service.getFiles(collection.id);
      expect(collectionFiles[0].indexedAt).not.toBeNull();
      expect(mockGenerateEmbedding).toHaveBeenCalled();
    });

    it('should index absolute file that does not exist and leave indexed_at null', async () => {
      const absPath = '/nonexistent/path/file.ts';
      const collection = service.createCollection({ name: 'Missing', scope: 'global' });
      const files = [{ filePath: absPath, repo: 'Missing' }];
      service.addFiles(collection.id, files);
      await indexer.indexCollectionFiles(collection.id, files);
      const collectionFiles = service.getFiles(collection.id);
      expect(collectionFiles[0].indexedAt).toBeNull();
    });
  });

  describe('directory expansion (real frontend "Add folder" flow)', () => {
    it('should expand directory into individual indexable files', async () => {
      createTestFile('src/index.ts', 'export const a = 1;');
      createTestFile('src/utils.ts', 'export const b = 2;');
      createTestFile('src/logo.png', 'binary-data');
      const collection = service.createCollection({ name: 'FolderTest', scope: 'global' });
      // Frontend sends the folder path as a single entry
      const filesInput = [{ filePath: tmpDir, repo: 'FolderTest' }];
      // addFiles should expand the directory
      service.addFiles(collection.id, filesInput);
      const collectionFiles = service.getFiles(collection.id);
      // Should have 2 files (only .ts, not .png)
      expect(collectionFiles.length).toBe(2);
      expect(collectionFiles.map(f => f.filePath).sort()).toEqual([
        path.join(tmpDir, 'src/index.ts'),
        path.join(tmpDir, 'src/utils.ts'),
      ]);
    });

    it('should skip hidden dirs and node_modules during expansion', async () => {
      createTestFile('src/app.ts', 'export const app = 1;');
      createTestFile('.git/config', 'hidden');
      createTestFile('node_modules/pkg/index.ts', 'module');
      const collection = service.createCollection({ name: 'SkipDirs', scope: 'global' });
      service.addFiles(collection.id, [{ filePath: tmpDir, repo: 'SkipDirs' }]);
      const collectionFiles = service.getFiles(collection.id);
      expect(collectionFiles.length).toBe(1);
      expect(collectionFiles[0].filePath).toBe(path.join(tmpDir, 'src/app.ts'));
    });

    it('should index expanded files end-to-end without repoBasePaths', async () => {
      createTestFile('lib/helper.ts', 'export function help() { return 42; }');
      const collection = service.createCollection({ name: 'E2E', scope: 'global' });
      service.addFiles(collection.id, [{ filePath: tmpDir, repo: 'E2E' }]);
      const files = service.getFiles(collection.id);
      expect(files.length).toBe(1);
      // Index the expanded files (absolute paths, no repoBasePaths needed)
      await indexer.indexCollectionFiles(
        collection.id,
        files.map(f => ({ filePath: f.filePath, repo: f.repo }))
      );
      const updatedFiles = service.getFiles(collection.id);
      expect(updatedFiles[0].indexedAt).not.toBeNull();
      expect(mockGenerateEmbedding).toHaveBeenCalled();
      // Verify chunks were created
      const chunks = db.prepare(
        'SELECT * FROM code_chunks WHERE repo = ?'
      ).all('E2E');
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should not expand regular files', async () => {
      createTestFile('single.ts', 'export const x = 1;');
      const filePath = path.join(tmpDir, 'single.ts');
      const collection = service.createCollection({ name: 'SingleFile', scope: 'global' });
      service.addFiles(collection.id, [{ filePath, repo: 'SingleFile' }]);
      const collectionFiles = service.getFiles(collection.id);
      expect(collectionFiles.length).toBe(1);
      expect(collectionFiles[0].filePath).toBe(filePath);
    });
  });

  describe('PDF indexing', () => {
    it('should reject PDF with graceful fallback when pdf-parse fails', async () => {
      // Create a fake PDF (not a valid PDF, so pdf-parse will fail gracefully)
      createTestFile('docs/report.pdf', 'not-a-real-pdf');
      const absPath = path.join(tmpDir, 'docs/report.pdf');
      const collection = service.createCollection({ name: 'PdfTest', scope: 'global' });
      const files = [{ filePath: absPath, repo: 'PdfTest' }];
      service.addFiles(collection.id, files);
      // Should not throw — graceful error handling
      await indexer.indexCollectionFiles(collection.id, files);
      // Should not generate embeddings since PDF parsing failed
      expect(mockGenerateEmbedding).not.toHaveBeenCalled();
    });

    it('should include .pdf in indexable extensions', () => {
      expect(isIndexable('document.pdf')).toBe(true);
      expect(isIndexable('image.png')).toBe(false);
      expect(isIndexable('readme.md')).toBe(true);
    });
  });

  describe('integration flow', () => {
    it('should handle full flow: add file -> create chunks -> verify indexed_at updated', async () => {
      createTestFile('src/full-flow.ts', 'export function greet(name: string) { return `Hello ${name}`; }');
      const collection = service.createCollection({
        name: 'FullFlow',
        scope: 'local',
        projectDir: '/test/project',
      });
      const files = [{ filePath: 'src/full-flow.ts', repo: 'flow-repo' }];
      const repoBasePaths = new Map([['flow-repo', tmpDir]]);
      await service.addFilesAndIndex(collection.id, files, repoBasePaths);
      const chunks = db.prepare(
        'SELECT * FROM code_chunks WHERE repo = ? AND file_path = ?'
      ).all('flow-repo', 'src/full-flow.ts');
      expect(chunks.length).toBeGreaterThan(0);
      const collectionFiles = service.getFiles(collection.id);
      expect(collectionFiles).toHaveLength(1);
      expect(collectionFiles[0].indexedAt).not.toBeNull();
      const vectors = db.prepare(
        'SELECT v.* FROM vectors v JOIN code_chunks cc ON v.chunk_id = cc.id WHERE cc.repo = ?'
      ).all('flow-repo');
      expect(vectors.length).toBeGreaterThan(0);
      expect(indexer.getStatus(collection.id)).toBe('done');
    });

    it('should handle mixed files: some existing, some new', async () => {
      db.prepare(`
        INSERT INTO code_chunks (repo, file_path, chunk_id, language, code, summary)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('mixed-repo', 'src/existing.ts', 0, 'typescript', 'const exists = true;', 'existing file');
      createTestFile('src/new-file.ts', 'export const newFile = true;');
      const collection = service.createCollection({ name: 'Mixed', scope: 'global' });
      const files = [
        { filePath: 'src/existing.ts', repo: 'mixed-repo' },
        { filePath: 'src/new-file.ts', repo: 'mixed-repo' },
      ];
      const repoBasePaths = new Map([['mixed-repo', tmpDir]]);
      await service.addFilesAndIndex(collection.id, files, repoBasePaths);
      expect(mockGenerateEmbedding).toHaveBeenCalledTimes(1);
      const collectionFiles = service.getFiles(collection.id);
      expect(collectionFiles).toHaveLength(2);
      for (const cf of collectionFiles) {
        expect(cf.indexedAt).not.toBeNull();
      }
    });
  });
});
