import Database from 'better-sqlite3';

export function runCollectionsMigration(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      scope TEXT NOT NULL CHECK(scope IN ('local', 'global')),
      project_dir TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name, scope, project_dir)
    );

    CREATE TABLE IF NOT EXISTS collection_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      repo TEXT NOT NULL,
      indexed_at DATETIME,
      UNIQUE(collection_id, file_path)
    );

    CREATE INDEX IF NOT EXISTS idx_cf_collection ON collection_files(collection_id);
    CREATE INDEX IF NOT EXISTS idx_cf_repo_path ON collection_files(repo, file_path);
  `);
}
