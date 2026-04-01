import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { runCollectionsMigration } from '../db/migrations/add-collections';
import { errorHandler } from '../api/middleware/error';

let testDb: Database.Database;

jest.mock('../db/sqlite-client', () => ({
  getVectorsDb: () => testDb,
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import collectionRouter from '../api/routes/collection-route';
import { resetService } from '../api/controllers/collection.controller';

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/collections', collectionRouter);
  app.use(errorHandler);
  return app;
}

describe('Collection API', () => {
  let app: express.Express;

  beforeEach(() => {
    testDb = new Database(':memory:');
    testDb.pragma('foreign_keys = ON');
    runCollectionsMigration(testDb);
    resetService();
    app = createApp();
  });

  afterEach(() => {
    testDb.close();
  });

  describe('POST /api/collections', () => {
    it('should create a collection and return 201', async () => {
      const res = await request(app)
        .post('/api/collections')
        .send({ name: 'Backend', scope: 'global' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Backend');
      expect(res.body.scope).toBe('global');
      expect(res.body.id).toBeDefined();
      expect(res.body.fileCount).toBe(0);
    });

    it('should create a local collection with projectDir', async () => {
      const res = await request(app)
        .post('/api/collections')
        .send({ name: 'Local Col', scope: 'local', projectDir: '/projects/app' });
      expect(res.status).toBe(201);
      expect(res.body.scope).toBe('local');
      expect(res.body.projectDir).toBe('/projects/app');
    });

    it('should return 400 for missing name', async () => {
      const res = await request(app)
        .post('/api/collections')
        .send({ scope: 'global' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid request');
    });

    it('should return 400 for empty name', async () => {
      const res = await request(app)
        .post('/api/collections')
        .send({ name: '', scope: 'global' });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid scope', async () => {
      const res = await request(app)
        .post('/api/collections')
        .send({ name: 'Test', scope: 'invalid' });
      expect(res.status).toBe(400);
    });

    it('should return 400 for empty body', async () => {
      const res = await request(app)
        .post('/api/collections')
        .send({});
      expect(res.status).toBe(400);
    });

    it('should return 400 for local scope without projectDir', async () => {
      const res = await request(app)
        .post('/api/collections')
        .send({ name: 'Bad Local', scope: 'local' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('projectDir is required for local scope collections');
    });

    it('should return 422 for duplicate name in same scope', async () => {
      await request(app)
        .post('/api/collections')
        .send({ name: 'Dup', scope: 'global' });
      const res = await request(app)
        .post('/api/collections')
        .send({ name: 'Dup', scope: 'global' });
      expect(res.status).toBe(422);
      expect(res.body.error).toContain('already exists');
    });
  });

  describe('GET /api/collections', () => {
    it('should list global collections', async () => {
      await request(app)
        .post('/api/collections')
        .send({ name: 'Global1', scope: 'global' });
      await request(app)
        .post('/api/collections')
        .send({ name: 'Local1', scope: 'local', projectDir: '/proj' });
      const res = await request(app).get('/api/collections');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Global1');
    });

    it('should list global + local collections for a projectDir', async () => {
      await request(app)
        .post('/api/collections')
        .send({ name: 'Global1', scope: 'global' });
      await request(app)
        .post('/api/collections')
        .send({ name: 'Local1', scope: 'local', projectDir: '/proj-a' });
      const res = await request(app).get('/api/collections?projectDir=/proj-a');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('should return empty array when no collections exist', async () => {
      const res = await request(app).get('/api/collections');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('PUT /api/collections/:id', () => {
    it('should rename a collection', async () => {
      const created = await request(app)
        .post('/api/collections')
        .send({ name: 'Old', scope: 'global' });
      const res = await request(app)
        .put(`/api/collections/${created.body.id}`)
        .send({ name: 'New' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New');
      expect(res.body.id).toBe(created.body.id);
    });

    it('should return 400 for missing name', async () => {
      const created = await request(app)
        .post('/api/collections')
        .send({ name: 'Test', scope: 'global' });
      const res = await request(app)
        .put(`/api/collections/${created.body.id}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid id', async () => {
      const res = await request(app)
        .put('/api/collections/abc')
        .send({ name: 'New' });
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent collection', async () => {
      const res = await request(app)
        .put('/api/collections/999')
        .send({ name: 'New' });
      expect(res.status).toBe(404);
    });

    it('should return 422 for duplicate name', async () => {
      await request(app)
        .post('/api/collections')
        .send({ name: 'First', scope: 'global' });
      const second = await request(app)
        .post('/api/collections')
        .send({ name: 'Second', scope: 'global' });
      const res = await request(app)
        .put(`/api/collections/${second.body.id}`)
        .send({ name: 'First' });
      expect(res.status).toBe(422);
    });
  });

  describe('DELETE /api/collections/:id', () => {
    it('should delete a collection and return 204', async () => {
      const created = await request(app)
        .post('/api/collections')
        .send({ name: 'ToDelete', scope: 'global' });
      const res = await request(app).delete(`/api/collections/${created.body.id}`);
      expect(res.status).toBe(204);
      const listRes = await request(app).get('/api/collections');
      expect(listRes.body).toHaveLength(0);
    });

    it('should return 404 for non-existent collection', async () => {
      const res = await request(app).delete('/api/collections/999');
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id', async () => {
      const res = await request(app).delete('/api/collections/abc');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/collections/:id/files', () => {
    it('should list files for a collection', async () => {
      const created = await request(app)
        .post('/api/collections')
        .send({ name: 'Col', scope: 'global' });
      await request(app)
        .post(`/api/collections/${created.body.id}/files`)
        .send({ files: [{ filePath: '/src/a.ts', repo: 'repo' }] });
      const res = await request(app).get(`/api/collections/${created.body.id}/files`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].filePath).toBe('/src/a.ts');
    });

    it('should return 404 for non-existent collection', async () => {
      const res = await request(app).get('/api/collections/999/files');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/collections/:id/files', () => {
    it('should add files and return 201', async () => {
      const created = await request(app)
        .post('/api/collections')
        .send({ name: 'Col', scope: 'global' });
      const res = await request(app)
        .post(`/api/collections/${created.body.id}/files`)
        .send({
          files: [
            { filePath: '/src/a.ts', repo: 'repo' },
            { filePath: '/src/b.ts', repo: 'repo' },
          ],
        });
      expect(res.status).toBe(201);
    });

    it('should return 400 for empty files array', async () => {
      const created = await request(app)
        .post('/api/collections')
        .send({ name: 'Col', scope: 'global' });
      const res = await request(app)
        .post(`/api/collections/${created.body.id}/files`)
        .send({ files: [] });
      expect(res.status).toBe(400);
    });

    it('should return 400 for missing files field', async () => {
      const created = await request(app)
        .post('/api/collections')
        .send({ name: 'Col', scope: 'global' });
      const res = await request(app)
        .post(`/api/collections/${created.body.id}/files`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('should return 400 for files with missing filePath', async () => {
      const created = await request(app)
        .post('/api/collections')
        .send({ name: 'Col', scope: 'global' });
      const res = await request(app)
        .post(`/api/collections/${created.body.id}/files`)
        .send({ files: [{ repo: 'repo' }] });
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent collection', async () => {
      const res = await request(app)
        .post('/api/collections/999/files')
        .send({ files: [{ filePath: '/src/a.ts', repo: 'repo' }] });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/collections/:id/files/:fileId', () => {
    it('should remove a file by fileId and return 204', async () => {
      const created = await request(app)
        .post('/api/collections')
        .send({ name: 'Col', scope: 'global' });
      await request(app)
        .post(`/api/collections/${created.body.id}/files`)
        .send({ files: [{ filePath: '/src/a.ts', repo: 'repo' }] });
      const filesRes = await request(app).get(`/api/collections/${created.body.id}/files`);
      const fileId = filesRes.body[0].id;
      const res = await request(app)
        .delete(`/api/collections/${created.body.id}/files/${fileId}`);
      expect(res.status).toBe(204);
      const listRes = await request(app).get(`/api/collections/${created.body.id}/files`);
      expect(listRes.body).toHaveLength(0);
    });

    it('should return 404 for non-existent fileId', async () => {
      const created = await request(app)
        .post('/api/collections')
        .send({ name: 'Col', scope: 'global' });
      const res = await request(app)
        .delete(`/api/collections/${created.body.id}/files/9999`);
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid fileId', async () => {
      const created = await request(app)
        .post('/api/collections')
        .send({ name: 'Col', scope: 'global' });
      const res = await request(app)
        .delete(`/api/collections/${created.body.id}/files/abc`);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/collections/:id/status', () => {
    it('should return idle when no files', async () => {
      const created = await request(app)
        .post('/api/collections')
        .send({ name: 'Col', scope: 'global' });
      const res = await request(app).get(`/api/collections/${created.body.id}/status`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('idle');
    });

    it('should return done when all files are indexed', async () => {
      const created = await request(app)
        .post('/api/collections')
        .send({ name: 'Col', scope: 'global' });
      await request(app)
        .post(`/api/collections/${created.body.id}/files`)
        .send({ files: [{ filePath: '/src/a.ts', repo: 'repo' }] });
      testDb.prepare('UPDATE collection_files SET indexed_at = CURRENT_TIMESTAMP WHERE collection_id = ?')
        .run(created.body.id);
      const res = await request(app).get(`/api/collections/${created.body.id}/status`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('done');
    });

    it('should return 404 for non-existent collection', async () => {
      const res = await request(app).get('/api/collections/999/status');
      expect(res.status).toBe(404);
    });
  });

  describe('integration flow', () => {
    it('should handle full lifecycle via HTTP', async () => {
      const createRes = await request(app)
        .post('/api/collections')
        .send({ name: 'Full Flow', scope: 'local', projectDir: '/projects/test' });
      expect(createRes.status).toBe(201);
      const collectionId = createRes.body.id;

      const listRes = await request(app).get('/api/collections?projectDir=/projects/test');
      expect(listRes.status).toBe(200);
      expect(listRes.body).toHaveLength(1);
      expect(listRes.body[0].name).toBe('Full Flow');

      const renameRes = await request(app)
        .put(`/api/collections/${collectionId}`)
        .send({ name: 'Renamed Flow' });
      expect(renameRes.status).toBe(200);
      expect(renameRes.body.name).toBe('Renamed Flow');

      const addRes = await request(app)
        .post(`/api/collections/${collectionId}/files`)
        .send({
          files: [
            { filePath: '/src/index.ts', repo: 'test-repo' },
            { filePath: '/src/app.ts', repo: 'test-repo' },
            { filePath: '/src/utils.ts', repo: 'test-repo' },
          ],
        });
      expect(addRes.status).toBe(201);

      const filesRes = await request(app).get(`/api/collections/${collectionId}/files`);
      expect(filesRes.status).toBe(200);
      expect(filesRes.body).toHaveLength(3);

      const statusRes = await request(app).get(`/api/collections/${collectionId}/status`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.status).toBe('idle');

      const fileToRemove = filesRes.body.find((f: { filePath: string }) => f.filePath === '/src/utils.ts');
      const removeRes = await request(app)
        .delete(`/api/collections/${collectionId}/files/${fileToRemove.id}`);
      expect(removeRes.status).toBe(204);

      const filesRes2 = await request(app).get(`/api/collections/${collectionId}/files`);
      expect(filesRes2.body).toHaveLength(2);

      const listRes2 = await request(app).get('/api/collections?projectDir=/projects/test');
      expect(listRes2.body[0].fileCount).toBe(2);

      const deleteRes = await request(app).delete(`/api/collections/${collectionId}`);
      expect(deleteRes.status).toBe(204);

      const listRes3 = await request(app).get('/api/collections?projectDir=/projects/test');
      expect(listRes3.body).toHaveLength(0);
    });
  });
});
