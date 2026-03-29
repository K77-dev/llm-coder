import Database from 'better-sqlite3';
import { runLlamaSettingsMigration } from '../migrations/add-llama-settings';

let db: Database.Database;

function getLlamaSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM llama_settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function setLlamaSetting(key: string, value: string): void {
  const updatedAt = new Date().toISOString();
  db.prepare(
    'INSERT INTO llama_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
  ).run(key, value, updatedAt);
}

function deleteLlamaSetting(key: string): void {
  db.prepare('DELETE FROM llama_settings WHERE key = ?').run(key);
}

beforeEach(() => {
  db = new Database(':memory:');
  runLlamaSettingsMigration(db);
});

afterEach(() => {
  db?.close();
});

describe('llama_settings migration', () => {
  it('should create the llama_settings table', () => {
    const tableInfo = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='llama_settings'"
    ).get() as { name: string } | undefined;
    expect(tableInfo).toBeDefined();
    expect(tableInfo?.name).toBe('llama_settings');
  });

  it('should have correct columns', () => {
    const columns = db.pragma('table_info(llama_settings)') as Array<{ name: string; type: string; notnull: number; pk: number }>;
    const columnMap = new Map(columns.map(c => [c.name, c]));
    expect(columnMap.get('key')?.type).toBe('TEXT');
    expect(columnMap.get('key')?.pk).toBe(1);
    expect(columnMap.get('value')?.type).toBe('TEXT');
    expect(columnMap.get('value')?.notnull).toBe(1);
    expect(columnMap.get('updated_at')?.type).toBe('TEXT');
    expect(columnMap.get('updated_at')?.notnull).toBe(1);
  });
});

describe('setLlamaSetting', () => {
  it('should persist a value correctly', () => {
    setLlamaSetting('last_active_model', 'codellama-13b.gguf');
    const row = db.prepare('SELECT value FROM llama_settings WHERE key = ?').get('last_active_model') as { value: string };
    expect(row.value).toBe('codellama-13b.gguf');
  });

  it('should upsert an existing value', () => {
    setLlamaSetting('last_active_model', 'codellama-13b.gguf');
    setLlamaSetting('last_active_model', 'mistral-7b.gguf');
    const row = db.prepare('SELECT value FROM llama_settings WHERE key = ?').get('last_active_model') as { value: string };
    expect(row.value).toBe('mistral-7b.gguf');
  });
});

describe('getLlamaSetting', () => {
  it('should return the persisted value', () => {
    setLlamaSetting('last_active_model', 'codellama-13b.gguf');
    expect(getLlamaSetting('last_active_model')).toBe('codellama-13b.gguf');
  });

  it('should return null for a non-existent key', () => {
    expect(getLlamaSetting('non_existent_key')).toBeNull();
  });
});

describe('deleteLlamaSetting', () => {
  it('should remove the key', () => {
    setLlamaSetting('last_active_model', 'codellama-13b.gguf');
    deleteLlamaSetting('last_active_model');
    expect(getLlamaSetting('last_active_model')).toBeNull();
  });

  it('should not throw when deleting a non-existent key', () => {
    expect(() => deleteLlamaSetting('non_existent_key')).not.toThrow();
  });
});
