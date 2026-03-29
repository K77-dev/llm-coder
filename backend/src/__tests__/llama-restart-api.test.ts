import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

const tmpDir = path.join(os.tmpdir(), `llama-restart-test-${Date.now()}`);
const testDbPath = path.join(tmpDir, 'test-vectors.db');

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

const mockSpawn = jest.fn();
const mockExecSync = jest.fn();
jest.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

jest.mock('axios');

import {
  restartServerHandler,
  autoStartLlamaServer,
} from '../api/controllers/llama.controller';
import { DEFAULT_SETTINGS } from '../llm/settings.service';
import { logger } from '../utils/logger';

function createMockProcess() {
  const eventHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  return {
    pid: 99999,
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!eventHandlers[event]) eventHandlers[event] = [];
      eventHandlers[event].push(handler);
    }),
    kill: jest.fn((_signal?: string) => {
      const handlers = eventHandlers['exit'] ?? [];
      for (const h of handlers) {
        h(0);
      }
    }),
  };
}

let existsSyncSpy: jest.SpyInstance;

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.post('/api/llama/restart', restartServerHandler);
  return app;
}

function setDbSetting(key: string, value: string): void {
  const updatedAt = new Date().toISOString();
  testDb.prepare(
    'INSERT INTO llama_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
  ).run(key, value, updatedAt);
}

describe('POST /api/llama/restart (integration)', () => {
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
    jest.clearAllMocks();
    mockExecSync.mockImplementation(() => { throw new Error('no process'); });
    mockSpawn.mockReturnValue({
      pid: 99999,
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      kill: jest.fn(),
    });
    existsSyncSpy = jest.spyOn(fs, 'existsSync');
    delete process.env.LLAMA_MODELS_DIR;
    delete process.env.LLAMA_SERVER_PORT;
    delete process.env.LLAMA_SERVER_PATH;
  });

  afterEach(() => {
    existsSyncSpy?.mockRestore();
  });

  it('should return 400 when no active model is selected', async () => {
    const res = await request(app).post('/api/llama/restart');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('No active model');
  });

  it('should return 404 when model file does not exist', async () => {
    setDbSetting('last_active_model', 'missing-model.gguf');
    existsSyncSpy.mockReturnValue(false);
    const res = await request(app).post('/api/llama/restart');
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('not found');
  });

  it('should return 200 and start restart when model exists', async () => {
    setDbSetting('last_active_model', 'test-model.gguf');
    existsSyncSpy.mockReturnValue(true);
    const res = await request(app).post('/api/llama/restart');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('starting');
    expect(res.body.activeModel).toBe('test-model.gguf');
  });

  it('should use settings from SQLite for port', async () => {
    setDbSetting('last_active_model', 'test-model.gguf');
    setDbSetting('llama_server_port', '7777');
    existsSyncSpy.mockReturnValue(true);
    const res = await request(app).post('/api/llama/restart');
    expect(res.status).toBe(200);
    expect(res.body.port).toBe(7777);
  });

  it('should log warn when restart is requested', async () => {
    setDbSetting('last_active_model', 'test-model.gguf');
    existsSyncSpy.mockReturnValue(true);
    await request(app).post('/api/llama/restart');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ component: 'llama-server' }),
      expect.stringContaining('restart requested'),
    );
  });

  it('should use default port when no SQLite or env value exists', async () => {
    setDbSetting('last_active_model', 'test-model.gguf');
    existsSyncSpy.mockReturnValue(true);
    const res = await request(app).post('/api/llama/restart');
    expect(res.status).toBe(200);
    expect(res.body.port).toBe(DEFAULT_SETTINGS.llamaServerPort);
  });
});

describe('autoStartLlamaServer() config hierarchy', () => {
  beforeAll(() => {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    if (!testDb || !testDb.open) {
      testDb = new Database(testDbPath);
      testDb.exec(`
        CREATE TABLE IF NOT EXISTS llama_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
    }
  });

  beforeEach(() => {
    testDb.exec('DELETE FROM llama_settings');
    jest.clearAllMocks();
    mockExecSync.mockImplementation(() => { throw new Error('no process'); });
    mockSpawn.mockReturnValue(createMockProcess());
    existsSyncSpy = jest.spyOn(fs, 'existsSync');
    delete process.env.LLAMA_MODELS_DIR;
    delete process.env.LLAMA_SERVER_PORT;
    delete process.env.LLAMA_SERVER_PATH;
  });

  afterEach(() => {
    existsSyncSpy?.mockRestore();
  });

  it('should not start when no last model is saved', () => {
    autoStartLlamaServer();
    expect(logger.info).not.toHaveBeenCalledWith(
      expect.objectContaining({ component: 'llama-server' }),
      expect.stringContaining('Auto-starting'),
    );
  });

  it('should use SQLite modelsDir over .env when both exist', () => {
    setDbSetting('last_active_model', 'test.gguf');
    setDbSetting('llama_models_dir', '/sqlite/models');
    process.env.LLAMA_MODELS_DIR = '/env/models';
    existsSyncSpy.mockReturnValue(true);
    autoStartLlamaServer();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ component: 'llama-server', model: 'test.gguf' }),
      expect.stringContaining('Auto-starting'),
    );
    expect(existsSyncSpy).toHaveBeenCalledWith(
      expect.stringContaining('/sqlite/models'),
    );
  });

  it('should use .env modelsDir when SQLite has no value', () => {
    setDbSetting('last_active_model', 'test.gguf');
    process.env.LLAMA_MODELS_DIR = '/env/models';
    existsSyncSpy.mockReturnValue(true);
    autoStartLlamaServer();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ component: 'llama-server', model: 'test.gguf' }),
      expect.stringContaining('Auto-starting'),
    );
    expect(existsSyncSpy).toHaveBeenCalledWith(
      expect.stringContaining('/env/models'),
    );
  });

  it('should use SQLite port over .env when both exist', () => {
    setDbSetting('last_active_model', 'test.gguf');
    setDbSetting('llama_models_dir', '/models');
    setDbSetting('llama_server_port', '5555');
    process.env.LLAMA_SERVER_PORT = '6666';
    existsSyncSpy.mockReturnValue(true);
    autoStartLlamaServer();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ component: 'llama-server', port: '5555' }),
      expect.stringContaining('Auto-starting'),
    );
  });

  it('should use default port when no SQLite or env value', () => {
    setDbSetting('last_active_model', 'test.gguf');
    setDbSetting('llama_models_dir', '/models');
    existsSyncSpy.mockReturnValue(true);
    autoStartLlamaServer();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ component: 'llama-server', port: String(DEFAULT_SETTINGS.llamaServerPort) }),
      expect.stringContaining('Auto-starting'),
    );
  });
});
