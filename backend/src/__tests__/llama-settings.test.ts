import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock sqlite-client before importing the service
const mockGetLlamaSetting = jest.fn();
const mockSetLlamaSetting = jest.fn();

jest.mock('../db/sqlite-client', () => ({
  getLlamaSetting: (key: string) => mockGetLlamaSetting(key),
  setLlamaSetting: (key: string, value: string) => mockSetLlamaSetting(key, value),
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  getSettings,
  saveSettings,
  llamaSettingsSchema,
  DEFAULT_SETTINGS,
  LlamaSettings,
} from '../llm/settings.service';

describe('LlamaSettings Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    // Clear all llama-related env vars
    delete process.env.LLAMA_MODELS_DIR;
    delete process.env.LLAMA_SERVER_PORT;
    delete process.env.LLAMA_SERVER_PATH;
    delete process.env.EMBEDDING_MODEL;
    delete process.env.MAX_MEMORY_MB;
    delete process.env.CACHE_TTL;
    delete process.env.LRU_CACHE_SIZE;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getSettings', () => {
    it('should return defaults when SQLite and .env are empty', () => {
      mockGetLlamaSetting.mockReturnValue(null);
      const settings = getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('should prioritize SQLite over .env', () => {
      mockGetLlamaSetting.mockImplementation((key: string) => {
        if (key === 'llama_server_port') return '9090';
        return null;
      });
      process.env.LLAMA_SERVER_PORT = '7070';
      const settings = getSettings();
      expect(settings.llamaServerPort).toBe(9090);
    });

    it('should use .env as fallback when SQLite has no value', () => {
      mockGetLlamaSetting.mockReturnValue(null);
      process.env.LLAMA_MODELS_DIR = '/custom/models';
      process.env.LLAMA_SERVER_PORT = '3333';
      const settings = getSettings();
      expect(settings.llamaModelsDir).toBe('/custom/models');
      expect(settings.llamaServerPort).toBe(3333);
    });

    it('should convert numeric values from SQLite strings to numbers', () => {
      mockGetLlamaSetting.mockImplementation((key: string) => {
        const values: Record<string, string> = {
          llama_server_port: '4444',
          max_memory_mb: '8000',
          cache_ttl: '1800',
          lru_cache_size: '250',
        };
        return values[key] ?? null;
      });
      const settings = getSettings();
      expect(settings.llamaServerPort).toBe(4444);
      expect(settings.maxMemoryMb).toBe(8000);
      expect(settings.cacheTtl).toBe(1800);
      expect(settings.lruCacheSize).toBe(250);
    });

    it('should use defaults for invalid numeric values in SQLite', () => {
      mockGetLlamaSetting.mockImplementation((key: string) => {
        if (key === 'llama_server_port') return 'not-a-number';
        return null;
      });
      const settings = getSettings();
      expect(settings.llamaServerPort).toBe(DEFAULT_SETTINGS.llamaServerPort);
    });

    it('should read all 7 settings from SQLite', () => {
      mockGetLlamaSetting.mockImplementation((key: string) => {
        const values: Record<string, string> = {
          llama_models_dir: '/my/models',
          llama_server_port: '5555',
          llama_server_path: '/usr/bin/llama',
          embedding_model: 'custom-embed',
          max_memory_mb: '16000',
          cache_ttl: '7200',
          lru_cache_size: '1000',
        };
        return values[key] ?? null;
      });
      const settings = getSettings();
      expect(settings.llamaModelsDir).toBe('/my/models');
      expect(settings.llamaServerPort).toBe(5555);
      expect(settings.llamaServerPath).toBe('/usr/bin/llama');
      expect(settings.embeddingModel).toBe('custom-embed');
      expect(settings.maxMemoryMb).toBe(16000);
      expect(settings.cacheTtl).toBe(7200);
      expect(settings.lruCacheSize).toBe(1000);
    });
  });

  describe('saveSettings', () => {
    it('should detect restartRequired when port changes', () => {
      mockGetLlamaSetting.mockReturnValue(null);
      const newSettings: LlamaSettings = {
        ...DEFAULT_SETTINGS,
        llamaServerPort: 9999,
      };
      const result = saveSettings(newSettings);
      expect(result.restartRequired).toBe(true);
      expect(result.settings).toEqual(newSettings);
    });

    it('should detect restartRequired when llamaModelsDir changes', () => {
      mockGetLlamaSetting.mockReturnValue(null);
      const newSettings: LlamaSettings = {
        ...DEFAULT_SETTINGS,
        llamaModelsDir: '/new/models',
      };
      const result = saveSettings(newSettings);
      expect(result.restartRequired).toBe(true);
    });

    it('should detect restartRequired when llamaServerPath changes', () => {
      mockGetLlamaSetting.mockReturnValue(null);
      const newSettings: LlamaSettings = {
        ...DEFAULT_SETTINGS,
        llamaServerPath: '/usr/local/bin/llama-server',
      };
      const result = saveSettings(newSettings);
      expect(result.restartRequired).toBe(true);
    });

    it('should return restartRequired false when only cache settings change', () => {
      mockGetLlamaSetting.mockReturnValue(null);
      const newSettings: LlamaSettings = {
        ...DEFAULT_SETTINGS,
        cacheTtl: 7200,
        lruCacheSize: 1000,
        maxMemoryMb: 16000,
      };
      const result = saveSettings(newSettings);
      expect(result.restartRequired).toBe(false);
    });

    it('should return restartRequired false when embeddingModel changes', () => {
      mockGetLlamaSetting.mockReturnValue(null);
      const newSettings: LlamaSettings = {
        ...DEFAULT_SETTINGS,
        embeddingModel: 'all-minilm',
      };
      const result = saveSettings(newSettings);
      expect(result.restartRequired).toBe(false);
    });

    it('should persist all 7 keys via setLlamaSetting', () => {
      mockGetLlamaSetting.mockReturnValue(null);
      const newSettings: LlamaSettings = {
        llamaModelsDir: '/data/models',
        llamaServerPort: 7777,
        llamaServerPath: '/opt/llama',
        embeddingModel: 'bge-small',
        maxMemoryMb: 4096,
        cacheTtl: 600,
        lruCacheSize: 200,
      };
      saveSettings(newSettings);
      expect(mockSetLlamaSetting).toHaveBeenCalledTimes(7);
      expect(mockSetLlamaSetting).toHaveBeenCalledWith('llama_models_dir', '/data/models');
      expect(mockSetLlamaSetting).toHaveBeenCalledWith('llama_server_port', '7777');
      expect(mockSetLlamaSetting).toHaveBeenCalledWith('llama_server_path', '/opt/llama');
      expect(mockSetLlamaSetting).toHaveBeenCalledWith('embedding_model', 'bge-small');
      expect(mockSetLlamaSetting).toHaveBeenCalledWith('max_memory_mb', '4096');
      expect(mockSetLlamaSetting).toHaveBeenCalledWith('cache_ttl', '600');
      expect(mockSetLlamaSetting).toHaveBeenCalledWith('lru_cache_size', '200');
    });
  });

  describe('llamaSettingsSchema (Zod validation)', () => {
    it('should accept valid settings', () => {
      const result = llamaSettingsSchema.safeParse(DEFAULT_SETTINGS);
      expect(result.success).toBe(true);
    });

    it('should reject port below 1024', () => {
      const result = llamaSettingsSchema.safeParse({
        ...DEFAULT_SETTINGS,
        llamaServerPort: 80,
      });
      expect(result.success).toBe(false);
    });

    it('should reject port above 65535', () => {
      const result = llamaSettingsSchema.safeParse({
        ...DEFAULT_SETTINGS,
        llamaServerPort: 70000,
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative maxMemoryMb', () => {
      const result = llamaSettingsSchema.safeParse({
        ...DEFAULT_SETTINGS,
        maxMemoryMb: -100,
      });
      expect(result.success).toBe(false);
    });

    it('should reject zero cacheTtl', () => {
      const result = llamaSettingsSchema.safeParse({
        ...DEFAULT_SETTINGS,
        cacheTtl: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative lruCacheSize', () => {
      const result = llamaSettingsSchema.safeParse({
        ...DEFAULT_SETTINGS,
        lruCacheSize: -1,
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty string for llamaModelsDir', () => {
      const result = llamaSettingsSchema.safeParse({
        ...DEFAULT_SETTINGS,
        llamaModelsDir: '',
      });
      expect(result.success).toBe(false);
    });

    it('should accept port at boundary 1024', () => {
      const result = llamaSettingsSchema.safeParse({
        ...DEFAULT_SETTINGS,
        llamaServerPort: 1024,
      });
      expect(result.success).toBe(true);
    });

    it('should accept port at boundary 65535', () => {
      const result = llamaSettingsSchema.safeParse({
        ...DEFAULT_SETTINGS,
        llamaServerPort: 65535,
      });
      expect(result.success).toBe(true);
    });
  });
});
