import { z } from 'zod';
import { getLlamaSetting, setLlamaSetting } from '../db/sqlite-client';
import { logger } from '../utils/logger';

export interface LlamaSettings {
  llamaModelsDir: string;
  llamaServerPort: number;
  llamaServerPath: string;
  embeddingModel: string;
  maxMemoryMb: number;
  cacheTtl: number;
  lruCacheSize: number;
}

export const DEFAULT_SETTINGS: LlamaSettings = {
  llamaModelsDir: '~/models',
  llamaServerPort: 8080,
  llamaServerPath: 'llama-server',
  embeddingModel: 'nomic-embed-text',
  maxMemoryMb: 13000,
  cacheTtl: 3600,
  lruCacheSize: 500,
};

const MIN_PORT = 1024;
const MAX_PORT = 65535;

export const llamaSettingsSchema = z.object({
  llamaModelsDir: z.string().min(1),
  llamaServerPort: z.number().int().min(MIN_PORT).max(MAX_PORT),
  llamaServerPath: z.string().min(1),
  embeddingModel: z.string().min(1),
  maxMemoryMb: z.number().int().gt(0),
  cacheTtl: z.number().int().gt(0),
  lruCacheSize: z.number().int().gt(0),
});

interface SettingKeyMapping {
  field: keyof LlamaSettings;
  dbKey: string;
  envVar: string;
  type: 'string' | 'number';
}

const SETTING_KEYS: SettingKeyMapping[] = [
  { field: 'llamaModelsDir', dbKey: 'llama_models_dir', envVar: 'LLAMA_MODELS_DIR', type: 'string' },
  { field: 'llamaServerPort', dbKey: 'llama_server_port', envVar: 'LLAMA_SERVER_PORT', type: 'number' },
  { field: 'llamaServerPath', dbKey: 'llama_server_path', envVar: 'LLAMA_SERVER_PATH', type: 'string' },
  { field: 'embeddingModel', dbKey: 'embedding_model', envVar: 'EMBEDDING_MODEL', type: 'string' },
  { field: 'maxMemoryMb', dbKey: 'max_memory_mb', envVar: 'MAX_MEMORY_MB', type: 'number' },
  { field: 'cacheTtl', dbKey: 'cache_ttl', envVar: 'CACHE_TTL', type: 'number' },
  { field: 'lruCacheSize', dbKey: 'lru_cache_size', envVar: 'LRU_CACHE_SIZE', type: 'number' },
];

const RESTART_REQUIRED_FIELDS: ReadonlySet<keyof LlamaSettings> = new Set([
  'llamaModelsDir',
  'llamaServerPort',
  'llamaServerPath',
]);

function parseNumericValue(value: string): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return NaN;
  return parsed;
}

export function getSettings(): LlamaSettings {
  const result = { ...DEFAULT_SETTINGS };
  for (const mapping of SETTING_KEYS) {
    const dbValue = getLlamaSetting(mapping.dbKey);
    if (dbValue !== null) {
      if (mapping.type === 'number') {
        const parsed = parseNumericValue(dbValue);
        if (!Number.isNaN(parsed)) {
          (result[mapping.field] as number) = parsed;
        }
      } else {
        (result[mapping.field] as string) = dbValue;
      }
      continue;
    }
    const envValue = process.env[mapping.envVar];
    if (envValue !== undefined && envValue !== '') {
      if (mapping.type === 'number') {
        const parsed = parseNumericValue(envValue);
        if (!Number.isNaN(parsed)) {
          (result[mapping.field] as number) = parsed;
        }
      } else {
        (result[mapping.field] as string) = envValue;
      }
    }
  }
  return result;
}

export interface SaveSettingsResult {
  settings: LlamaSettings;
  restartRequired: boolean;
}

export function saveSettings(settings: LlamaSettings): SaveSettingsResult {
  const currentSettings = getSettings();
  let restartRequired = false;
  for (const field of RESTART_REQUIRED_FIELDS) {
    if (String(settings[field]) !== String(currentSettings[field])) {
      restartRequired = true;
      break;
    }
  }
  for (const mapping of SETTING_KEYS) {
    const value = String(settings[mapping.field]);
    setLlamaSetting(mapping.dbKey, value);
  }
  logger.info({ restartRequired }, 'LLM settings saved');
  return { settings, restartRequired };
}
