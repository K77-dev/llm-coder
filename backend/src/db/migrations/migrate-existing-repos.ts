import Database from 'better-sqlite3';
import { logger } from '../../utils/logger';

export interface MigrationResult {
  collectionsCreated: number;
  filesLinked: number;
  alreadyMigrated: boolean;
}

export function runExistingReposMigration(db: Database.Database): MigrationResult {
  const hasCodeChunks = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='code_chunks'"
  ).get();
  if (!hasCodeChunks) {
    return { collectionsCreated: 0, filesLinked: 0, alreadyMigrated: false };
  }
  const hasCollections = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='collections'"
  ).get();
  if (!hasCollections) {
    return { collectionsCreated: 0, filesLinked: 0, alreadyMigrated: false };
  }
  const distinctRepos = db.prepare(
    'SELECT DISTINCT repo FROM code_chunks'
  ).all() as { repo: string }[];
  if (distinctRepos.length === 0) {
    logger.debug('No existing repos to migrate');
    return { collectionsCreated: 0, filesLinked: 0, alreadyMigrated: false };
  }
  const result = db.transaction(() => {
    const checkExisting = db.prepare(
      "SELECT id FROM collections WHERE name = ? AND scope = 'global' AND project_dir IS NULL"
    );
    const insertCollection = db.prepare(
      "INSERT INTO collections (name, scope, project_dir) VALUES (?, 'global', NULL)"
    );
    let collectionsCreated = 0;
    for (const { repo } of distinctRepos) {
      const existing = checkExisting.get(repo);
      if (!existing) {
        insertCollection.run(repo);
        collectionsCreated++;
      }
    }
    const insertFiles = db.prepare(`
      INSERT OR IGNORE INTO collection_files (collection_id, file_path, repo, indexed_at)
        SELECT c.id, cc.file_path, cc.repo, cc.indexed_at
        FROM collections c
        JOIN (
          SELECT DISTINCT repo, file_path, MAX(indexed_at) as indexed_at
          FROM code_chunks
          GROUP BY repo, file_path
        ) cc ON c.name = cc.repo
        WHERE c.scope = 'global' AND c.project_dir IS NULL
    `);
    const filesResult = insertFiles.run();
    const filesLinked = filesResult.changes;
    const alreadyMigrated = collectionsCreated === 0 && filesLinked === 0;
    return { collectionsCreated, filesLinked, alreadyMigrated };
  })();
  if (result.alreadyMigrated) {
    logger.debug('Existing repos already migrated to collections');
  } else {
    logger.info(
      { collectionsCreated: result.collectionsCreated, filesLinked: result.filesLinked },
      'Migrated existing repos to collections'
    );
  }
  return result;
}
