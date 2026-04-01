import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { CollectionService } from '../services/collection-service';
import { DuplicateNameError, NotFoundError, ValidationError } from '../services/collection-types';
import { runCollectionsMigration } from '../db/migrations/add-collections';

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('CollectionService', () => {
  let db: Database.Database;
  let service: CollectionService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runCollectionsMigration(db);
    service = new CollectionService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('createCollection', () => {
    it('should create a collection with valid name', () => {
      const collection = service.createCollection({
        name: 'Backend API',
        scope: 'local',
        projectDir: '/projects/my-app',
      });
      expect(collection.id).toBeDefined();
      expect(collection.name).toBe('Backend API');
      expect(collection.scope).toBe('local');
      expect(collection.projectDir).toBe('/projects/my-app');
      expect(collection.fileCount).toBe(0);
      expect(collection.createdAt).toBeDefined();
    });

    it('should create a global collection with null projectDir', () => {
      const collection = service.createCollection({
        name: 'Docs',
        scope: 'global',
      });
      expect(collection.scope).toBe('global');
      expect(collection.projectDir).toBeNull();
    });

    it('should throw DuplicateNameError for duplicate name in same scope and project', () => {
      service.createCollection({
        name: 'Backend API',
        scope: 'local',
        projectDir: '/projects/my-app',
      });
      expect(() =>
        service.createCollection({
          name: 'Backend API',
          scope: 'local',
          projectDir: '/projects/my-app',
        })
      ).toThrow(DuplicateNameError);
    });

    it('should allow same name in different scopes', () => {
      const local = service.createCollection({
        name: 'Shared',
        scope: 'local',
        projectDir: '/projects/my-app',
      });
      const global = service.createCollection({
        name: 'Shared',
        scope: 'global',
      });
      expect(local.id).not.toBe(global.id);
    });

    it('should allow same name in different projects', () => {
      const col1 = service.createCollection({
        name: 'Backend',
        scope: 'local',
        projectDir: '/projects/app-a',
      });
      const col2 = service.createCollection({
        name: 'Backend',
        scope: 'local',
        projectDir: '/projects/app-b',
      });
      expect(col1.id).not.toBe(col2.id);
    });

    it('should throw ValidationError when local scope is missing projectDir', () => {
      expect(() =>
        service.createCollection({ name: 'Local No Dir', scope: 'local' })
      ).toThrow(ValidationError);
      expect(() =>
        service.createCollection({ name: 'Local No Dir', scope: 'local' })
      ).toThrow('projectDir is required for local scope collections');
    });

    it('should throw ValidationError when local scope has empty projectDir', () => {
      expect(() =>
        service.createCollection({ name: 'Local Empty Dir', scope: 'local', projectDir: '' })
      ).toThrow(ValidationError);
      expect(() =>
        service.createCollection({ name: 'Local Empty Dir', scope: 'local', projectDir: '' })
      ).toThrow('projectDir is required for local scope collections');
    });

    it('should set projectDir to null for global scope even if provided', () => {
      const collection = service.createCollection({
        name: 'GlobalCol',
        scope: 'global',
        projectDir: '/projects/my-app',
      });
      expect(collection.projectDir).toBeNull();
    });
  });

  describe('renameCollection', () => {
    it('should rename a collection successfully', () => {
      const collection = service.createCollection({
        name: 'Old Name',
        scope: 'global',
      });
      const renamed = service.renameCollection(collection.id, 'New Name');
      expect(renamed.name).toBe('New Name');
      expect(renamed.id).toBe(collection.id);
    });

    it('should throw DuplicateNameError when renaming to duplicate name', () => {
      service.createCollection({ name: 'First', scope: 'global' });
      const second = service.createCollection({ name: 'Second', scope: 'global' });
      expect(() => service.renameCollection(second.id, 'First')).toThrow(DuplicateNameError);
    });

    it('should throw NotFoundError when collection does not exist', () => {
      expect(() => service.renameCollection(999, 'Name')).toThrow(NotFoundError);
    });
  });

  describe('deleteCollection', () => {
    it('should delete a collection', () => {
      const collection = service.createCollection({ name: 'ToDelete', scope: 'global' });
      service.deleteCollection(collection.id);
      const list = service.listCollections();
      expect(list).toHaveLength(0);
    });

    it('should remove associated files via CASCADE', () => {
      const collection = service.createCollection({ name: 'WithFiles', scope: 'global' });
      service.addFiles(collection.id, [
        { filePath: '/src/index.ts', repo: 'my-repo' },
        { filePath: '/src/app.ts', repo: 'my-repo' },
      ]);
      expect(service.getFiles(collection.id)).toHaveLength(2);
      service.deleteCollection(collection.id);
      const fileCount = db.prepare('SELECT COUNT(*) as cnt FROM collection_files WHERE collection_id = ?')
        .get(collection.id) as { cnt: number };
      expect(fileCount.cnt).toBe(0);
    });

    it('should throw NotFoundError when collection does not exist', () => {
      expect(() => service.deleteCollection(999)).toThrow(NotFoundError);
    });
  });

  describe('listCollections', () => {
    it('should return global collections when no projectDir', () => {
      service.createCollection({ name: 'Global1', scope: 'global' });
      service.createCollection({ name: 'Local1', scope: 'local', projectDir: '/proj' });
      const list = service.listCollections();
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('Global1');
    });

    it('should return global + local collections for a given projectDir', () => {
      service.createCollection({ name: 'Global1', scope: 'global' });
      service.createCollection({ name: 'Local1', scope: 'local', projectDir: '/proj-a' });
      service.createCollection({ name: 'Local2', scope: 'local', projectDir: '/proj-b' });
      const list = service.listCollections('/proj-a');
      expect(list).toHaveLength(2);
      const names = list.map((c) => c.name).sort();
      expect(names).toEqual(['Global1', 'Local1']);
    });

    it('should return empty array when no collections exist', () => {
      const list = service.listCollections();
      expect(list).toHaveLength(0);
    });

    it('should include correct fileCount', () => {
      const collection = service.createCollection({ name: 'WithFiles', scope: 'global' });
      service.addFiles(collection.id, [
        { filePath: '/src/a.ts', repo: 'repo' },
        { filePath: '/src/b.ts', repo: 'repo' },
      ]);
      const list = service.listCollections();
      expect(list[0].fileCount).toBe(2);
    });
  });

  describe('addFiles', () => {
    it('should add files to a collection', () => {
      const collection = service.createCollection({ name: 'Col', scope: 'global' });
      service.addFiles(collection.id, [
        { filePath: '/src/index.ts', repo: 'my-repo' },
        { filePath: '/src/app.ts', repo: 'my-repo' },
      ]);
      const files = service.getFiles(collection.id);
      expect(files).toHaveLength(2);
      expect(files[0].filePath).toBe('/src/app.ts');
      expect(files[0].repo).toBe('my-repo');
      expect(files[0].collectionId).toBe(collection.id);
    });

    it('should ignore duplicate files silently', () => {
      const collection = service.createCollection({ name: 'Col', scope: 'global' });
      service.addFiles(collection.id, [{ filePath: '/src/index.ts', repo: 'repo' }]);
      service.addFiles(collection.id, [{ filePath: '/src/index.ts', repo: 'repo' }]);
      const files = service.getFiles(collection.id);
      expect(files).toHaveLength(1);
    });

    it('should throw NotFoundError when collection does not exist', () => {
      expect(() =>
        service.addFiles(999, [{ filePath: '/src/index.ts', repo: 'repo' }])
      ).toThrow(NotFoundError);
    });

    it('should handle empty files array', () => {
      const collection = service.createCollection({ name: 'Col', scope: 'global' });
      service.addFiles(collection.id, []);
      const files = service.getFiles(collection.id);
      expect(files).toHaveLength(0);
    });
  });

  describe('removeFile', () => {
    it('should remove a file from a collection by fileId', () => {
      const collection = service.createCollection({ name: 'Col', scope: 'global' });
      service.addFiles(collection.id, [
        { filePath: '/src/index.ts', repo: 'repo' },
        { filePath: '/src/app.ts', repo: 'repo' },
      ]);
      const files = service.getFiles(collection.id);
      const indexFile = files.find((f) => f.filePath === '/src/index.ts')!;
      service.removeFile(collection.id, indexFile.id);
      const remainingFiles = service.getFiles(collection.id);
      expect(remainingFiles).toHaveLength(1);
      expect(remainingFiles[0].filePath).toBe('/src/app.ts');
    });

    it('should throw NotFoundError when fileId does not exist in collection', () => {
      const collection = service.createCollection({ name: 'Col', scope: 'global' });
      expect(() =>
        service.removeFile(collection.id, 9999)
      ).toThrow(NotFoundError);
    });
  });

  describe('getFiles', () => {
    it('should return files ordered by file_path', () => {
      const collection = service.createCollection({ name: 'Col', scope: 'global' });
      service.addFiles(collection.id, [
        { filePath: '/src/z.ts', repo: 'repo' },
        { filePath: '/src/a.ts', repo: 'repo' },
        { filePath: '/src/m.ts', repo: 'repo' },
      ]);
      const files = service.getFiles(collection.id);
      expect(files.map((f) => f.filePath)).toEqual(['/src/a.ts', '/src/m.ts', '/src/z.ts']);
    });

    it('should throw NotFoundError when collection does not exist', () => {
      expect(() => service.getFiles(999)).toThrow(NotFoundError);
    });
  });

  describe('getIndexingStatus', () => {
    it('should return idle when no files', () => {
      const collection = service.createCollection({ name: 'Col', scope: 'global' });
      expect(service.getIndexingStatus(collection.id)).toEqual({ status: 'idle', progress: 0 });
    });

    it('should return idle when no files are indexed', () => {
      const collection = service.createCollection({ name: 'Col', scope: 'global' });
      service.addFiles(collection.id, [{ filePath: '/src/a.ts', repo: 'repo' }]);
      expect(service.getIndexingStatus(collection.id)).toEqual({ status: 'idle', progress: 0 });
    });

    it('should return done when all files are indexed', () => {
      const collection = service.createCollection({ name: 'Col', scope: 'global' });
      service.addFiles(collection.id, [{ filePath: '/src/a.ts', repo: 'repo' }]);
      db.prepare('UPDATE collection_files SET indexed_at = CURRENT_TIMESTAMP WHERE collection_id = ?')
        .run(collection.id);
      expect(service.getIndexingStatus(collection.id)).toEqual({ status: 'done', progress: 100 });
    });

    it('should return indexing when some files are indexed', () => {
      const collection = service.createCollection({ name: 'Col', scope: 'global' });
      service.addFiles(collection.id, [
        { filePath: '/src/a.ts', repo: 'repo' },
        { filePath: '/src/b.ts', repo: 'repo' },
      ]);
      db.prepare('UPDATE collection_files SET indexed_at = CURRENT_TIMESTAMP WHERE file_path = ?')
        .run('/src/a.ts');
      expect(service.getIndexingStatus(collection.id)).toEqual({ status: 'indexing', progress: 50 });
    });

    it('should throw NotFoundError when collection does not exist', () => {
      expect(() => service.getIndexingStatus(999)).toThrow(NotFoundError);
    });
  });

  describe('integration flow', () => {
    it('should handle full lifecycle: create -> add files -> list files -> remove file -> delete collection', () => {
      const collection = service.createCollection({
        name: 'Full Flow',
        scope: 'local',
        projectDir: '/projects/test',
      });
      expect(collection.name).toBe('Full Flow');
      service.addFiles(collection.id, [
        { filePath: '/src/index.ts', repo: 'test-repo' },
        { filePath: '/src/app.ts', repo: 'test-repo' },
        { filePath: '/src/utils.ts', repo: 'test-repo' },
      ]);
      let files = service.getFiles(collection.id);
      expect(files).toHaveLength(3);
      const utilsFile = files.find((f) => f.filePath === '/src/utils.ts')!;
      service.removeFile(collection.id, utilsFile.id);
      files = service.getFiles(collection.id);
      expect(files).toHaveLength(2);
      const list = service.listCollections('/projects/test');
      expect(list).toHaveLength(1);
      expect(list[0].fileCount).toBe(2);
      service.deleteCollection(collection.id);
      const finalList = service.listCollections('/projects/test');
      expect(finalList).toHaveLength(0);
    });
  });
});
