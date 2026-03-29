import Database from 'better-sqlite3';

export function runLlamaSettingsMigration(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS llama_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}
