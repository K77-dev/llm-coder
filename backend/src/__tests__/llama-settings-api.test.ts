import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Create a temp database for integration tests
const tmpDir = path.join(os.tmpdir(), `llama-settings-test-${Date.now()}`);
const testDbPath = path.join(tmpDir, 'test-vectors.db');

// We must mock sqlite-client to use our test database
let testDb: Database.Database;

jest.mock('../db/sqlite-client', () => {
  return {
    getLlamaSetting: (key: string): string | null => {
      const row = testDb.prepare('SELECT value FROM llama_settings WHERE key = ?').get(key) as { value: string } | undefined;
      return row?.value ?? null;
    },
    setLlamaSetting: (key: string, value: string): void => {
      const updatedAt = new Date().toISOString();
      testDb.prepare(
        'INSERT INTO llama_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
      ).run(key, value, updatedAt);
    },
  };
});

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock the parts of llama.controller that do process management
jest.mock('axios');
jest.mock('child_process', () => ({
  spawn: jest.fn(),
  execSync: jest.fn(),
}));

import {
  getSettingsHandler,
  updateSettingsHandler,
} from '../api/controllers/llama.controller';
import { DEFAULT_SETTINGS } from '../llm/settings.service';

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.get('/api/llama/settings', getSettingsHandler);
  app.put('/api/llama/settings', updateSettingsHandler);
  return app;
}

describe('GET/PUT /api/llama/settings (integration)', () => {
  let app: express.Express;

  beforeAll(() => {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    testDb = new Database(testDbPath);
    testDb.exec(`
      CREATE TABLE IF NOT EXISTS llama_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    app = createApp();
  });

  afterAll(() => {
    testDb?.close();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  beforeEach(() => {
    testDb.exec('DELETE FROM llama_settings');
    // Clear env vars
    delete process.env.LLAMA_MODELS_DIR;
    delete process.env.LLAMA_SERVER_PORT;
    delete process.env.LLAMA_SERVER_PATH;
    delete process.env.EMBEDDING_MODEL;
    delete process.env.MAX_MEMORY_MB;
    delete process.env.CACHE_TTL;
    delete process.env.LRU_CACHE_SIZE;
  });

  describe('GET /api/llama/settings', () => {
    it('should return defaults initially', async () => {
      const res = await request(app).get('/api/llama/settings');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(DEFAULT_SETTINGS);
    });

    it('should return numeric types for numeric fields', async () => {
      const res = await request(app).get('/api/llama/settings');
      expect(typeof res.body.llamaServerPort).toBe('number');
      expect(typeof res.body.maxMemoryMb).toBe('number');
      expect(typeof res.body.cacheTtl).toBe('number');
      expect(typeof res.body.lruCacheSize).toBe('number');
    });

    it('should return values from .env when SQLite is empty', async () => {
      process.env.LLAMA_MODELS_DIR = '/env/models';
      process.env.LLAMA_SERVER_PORT = '6060';
      const res = await request(app).get('/api/llama/settings');
      expect(res.status).toBe(200);
      expect(res.body.llamaModelsDir).toBe('/env/models');
      expect(res.body.llamaServerPort).toBe(6060);
    });
  });

  describe('PUT /api/llama/settings', () => {
    it('should persist and return saved values', async () => {
      const payload = {
        ...DEFAULT_SETTINGS,
        llamaServerPort: 9090,
        cacheTtl: 1800,
      };
      const putRes = await request(app)
        .put('/api/llama/settings')
        .send(payload);
      expect(putRes.status).toBe(200);
      expect(putRes.body.settings.llamaServerPort).toBe(9090);
      expect(putRes.body.settings.cacheTtl).toBe(1800);
      expect(putRes.body.restartRequired).toBe(true);
      // Verify persistence via GET
      const getRes = await request(app).get('/api/llama/settings');
      expect(getRes.body.llamaServerPort).toBe(9090);
      expect(getRes.body.cacheTtl).toBe(1800);
    });

    it('should return restartRequired true when port changes', async () => {
      const payload = { ...DEFAULT_SETTINGS, llamaServerPort: 4444 };
      const res = await request(app)
        .put('/api/llama/settings')
        .send(payload);
      expect(res.status).toBe(200);
      expect(res.body.restartRequired).toBe(true);
    });

    it('should return restartRequired false when only cache changes', async () => {
      // First save defaults to establish baseline
      await request(app)
        .put('/api/llama/settings')
        .send(DEFAULT_SETTINGS);
      // Then change only cache settings
      const payload = { ...DEFAULT_SETTINGS, cacheTtl: 7200 };
      const res = await request(app)
        .put('/api/llama/settings')
        .send(payload);
      expect(res.status).toBe(200);
      expect(res.body.restartRequired).toBe(false);
    });

    it('should return 400 for invalid port below 1024', async () => {
      const payload = { ...DEFAULT_SETTINGS, llamaServerPort: 80 };
      const res = await request(app)
        .put('/api/llama/settings')
        .send(payload);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid request');
    });

    it('should return 400 for invalid port above 65535', async () => {
      const payload = { ...DEFAULT_SETTINGS, llamaServerPort: 70000 };
      const res = await request(app)
        .put('/api/llama/settings')
        .send(payload);
      expect(res.status).toBe(400);
    });

    it('should return 400 for negative numeric fields', async () => {
      const payload = { ...DEFAULT_SETTINGS, maxMemoryMb: -1 };
      const res = await request(app)
        .put('/api/llama/settings')
        .send(payload);
      expect(res.status).toBe(400);
    });

    it('should return 400 for empty body', async () => {
      const res = await request(app)
        .put('/api/llama/settings')
        .send({});
      expect(res.status).toBe(400);
    });

    it('should persist values that override .env on next GET', async () => {
      process.env.LLAMA_MODELS_DIR = '/env/models';
      // First verify env value is returned
      const getRes1 = await request(app).get('/api/llama/settings');
      expect(getRes1.body.llamaModelsDir).toBe('/env/models');
      // Now save via PUT
      const payload = { ...DEFAULT_SETTINGS, llamaModelsDir: '/sqlite/models' };
      await request(app).put('/api/llama/settings').send(payload);
      // SQLite should override env
      const getRes2 = await request(app).get('/api/llama/settings');
      expect(getRes2.body.llamaModelsDir).toBe('/sqlite/models');
    });
  });
});
