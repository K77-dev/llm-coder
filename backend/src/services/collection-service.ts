import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import {
  Collection,
  CollectionFile,
  CollectionFileInput,
  CollectionFileRow,
  CollectionRow,
  CreateCollectionParams,
  DuplicateNameError,
  IndexingStatus,
  NotFoundError,
  ValidationError,
} from './collection-types';
import { CollectionIndexer } from '../rag/collection-indexer';
import { isIndexable } from '../rag/chunker';

function mapRowToCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    name: row.name,
    scope: row.scope as 'local' | 'global',
    projectDir: row.project_dir,
    fileCount: row.file_count,
    createdAt: row.created_at,
  };
}

function mapRowToCollectionFile(row: CollectionFileRow): CollectionFile {
  return {
    id: row.id,
    collectionId: row.collection_id,
    filePath: row.file_path,
    repo: row.repo,
    indexedAt: row.indexed_at,
  };
}

export class CollectionService {
  private readonly db: Database.Database;
  private indexer: CollectionIndexer | null = null;

  constructor(db: Database.Database) {
    this.db = db;
  }

  setIndexer(indexer: CollectionIndexer): void {
    this.indexer = indexer;
  }

  getIndexer(): CollectionIndexer | null {
    return this.indexer;
  }

  createCollection(params: CreateCollectionParams): Collection {
    const { name, scope, projectDir } = params;
    if (scope === 'local' && !projectDir) {
      throw new ValidationError('projectDir is required for local scope collections');
    }
    const projectDirValue = scope === 'local' ? (projectDir ?? null) : null;
    const duplicate = this.findDuplicateName(name, scope, projectDirValue);
    if (duplicate) {
      logger.error({ name, scope, projectDir: projectDirValue }, 'Duplicate collection name');
      throw new DuplicateNameError(name);
    }
    try {
      const stmt = this.db.prepare(
        'INSERT INTO collections (name, scope, project_dir) VALUES (?, ?, ?)'
      );
      const result = stmt.run(name, scope, projectDirValue);
      const id = result.lastInsertRowid as number;
      logger.info({ collectionId: id, name, scope }, 'Collection created');
      return this.getCollectionById(id);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ name, scope, error: message }, 'Failed to create collection');
      throw error;
    }
  }

  renameCollection(id: number, name: string): Collection {
    const existing = this.getCollectionById(id);
    const duplicate = this.findDuplicateName(name, existing.scope, existing.projectDir, id);
    if (duplicate) {
      logger.error({ collectionId: id, name }, 'Duplicate collection name on rename');
      throw new DuplicateNameError(name);
    }
    const stmt = this.db.prepare('UPDATE collections SET name = ? WHERE id = ?');
    stmt.run(name, id);
    logger.info({ collectionId: id, oldName: existing.name, newName: name }, 'Collection renamed');
    return this.getCollectionById(id);
  }

  deleteCollection(id: number): void {
    const files = this.db.prepare(
      'SELECT file_path, repo FROM collection_files WHERE collection_id = ?'
    ).all(id) as Array<{ file_path: string; repo: string }>;

    const orphans = files.filter(
      (f) => !this.isFileUsedByOtherCollections(id, f.file_path, f.repo)
    );

    const result = this.db.prepare('DELETE FROM collections WHERE id = ?').run(id);
    if (result.changes === 0) {
      throw new NotFoundError('Collection', id);
    }

    for (const orphan of orphans) {
      this.db.prepare('DELETE FROM code_chunks WHERE file_path = ? AND repo = ?').run(orphan.file_path, orphan.repo);
    }

    logger.info({ collectionId: id, chunksCleared: orphans.length }, 'Collection deleted and RAG chunks cleaned');
  }

  listCollections(projectDir?: string): Collection[] {
    const stmt = this.db.prepare(`
      SELECT c.*, COALESCE(cf.cnt, 0) AS file_count
      FROM collections c
      LEFT JOIN (SELECT collection_id, COUNT(*) AS cnt FROM collection_files GROUP BY collection_id) cf
        ON cf.collection_id = c.id
      WHERE c.scope = 'global'
        OR (c.scope = 'local' AND @projectDir IS NOT NULL AND c.project_dir = @projectDir)
      ORDER BY c.name
    `);
    const rows = stmt.all({ projectDir: projectDir ?? null }) as CollectionRow[];
    return rows.map(mapRowToCollection);
  }

  addFiles(
    collectionId: number,
    files: CollectionFileInput[],
    repoBasePaths?: Map<string, string>
  ): void {
    const expanded = this.expandDirectories(files);
    this.insertCollectionFiles(collectionId, expanded);
    if (this.indexer && expanded.length > 0) {
      this.indexer.indexCollectionFilesInBackground(collectionId, expanded, repoBasePaths);
    }
  }

  async addFilesAndIndex(
    collectionId: number,
    files: CollectionFileInput[],
    repoBasePaths?: Map<string, string>
  ): Promise<void> {
    const expanded = this.expandDirectories(files);
    this.insertCollectionFiles(collectionId, expanded);
    if (this.indexer && expanded.length > 0) {
      await this.indexer.indexCollectionFiles(collectionId, expanded, repoBasePaths);
    }
  }

  private expandDirectories(files: CollectionFileInput[]): CollectionFileInput[] {
    const result: CollectionFileInput[] = [];
    for (const file of files) {
      if (path.isAbsolute(file.filePath) && fs.existsSync(file.filePath) && fs.statSync(file.filePath).isDirectory()) {
        const expanded = this.enumerateIndexableFiles(file.filePath, file.repo);
        logger.info({ dir: file.filePath, fileCount: expanded.length }, 'Expanded directory into files');
        result.push(...expanded);
      } else {
        result.push(file);
      }
    }
    return result;
  }

  private enumerateIndexableFiles(dirPath: string, repo: string): CollectionFileInput[] {
    const results: CollectionFileInput[] = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.enumerateIndexableFiles(fullPath, repo));
      } else if (entry.isFile() && isIndexable(fullPath)) {
        results.push({ filePath: fullPath, repo });
      }
    }
    return results;
  }

  private insertCollectionFiles(collectionId: number, files: CollectionFileInput[]): void {
    this.getCollectionById(collectionId);
    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO collection_files (collection_id, file_path, repo) VALUES (?, ?, ?)'
    );
    const insertMany = this.db.transaction((items: CollectionFileInput[]) => {
      for (const file of items) {
        stmt.run(collectionId, file.filePath, file.repo);
      }
    });
    insertMany(files);
    logger.debug({ collectionId, fileCount: files.length }, 'Files added to collection');
  }

  isFileUsedByOtherCollections(collectionId: number, filePath: string, repo: string): boolean {
    const row = this.db.prepare(`
      SELECT COUNT(*) AS cnt FROM collection_files
      WHERE file_path = ? AND repo = ? AND collection_id != ?
    `).get(filePath, repo, collectionId) as { cnt: number };
    return row.cnt > 0;
  }

  removeFile(collectionId: number, fileId: number): void {
    const fileRow = this.db.prepare(
      'SELECT file_path, repo FROM collection_files WHERE id = ? AND collection_id = ?'
    ).get(fileId, collectionId) as { file_path: string; repo: string } | undefined;
    if (!fileRow) {
      throw new NotFoundError('File', fileId);
    }
    const usedElsewhere = this.isFileUsedByOtherCollections(collectionId, fileRow.file_path, fileRow.repo);
    this.db.prepare('DELETE FROM collection_files WHERE id = ? AND collection_id = ?').run(fileId, collectionId);
    if (!usedElsewhere) {
      this.db.prepare('DELETE FROM code_chunks WHERE file_path = ? AND repo = ?').run(fileRow.file_path, fileRow.repo);
      logger.debug({ filePath: fileRow.file_path }, 'Removed RAG chunks for file no longer in any collection');
    }
    logger.debug({ collectionId, fileId }, 'File removed from collection');
  }

  getFiles(collectionId: number): CollectionFile[] {
    this.getCollectionById(collectionId);
    const stmt = this.db.prepare(
      'SELECT * FROM collection_files WHERE collection_id = ? ORDER BY file_path'
    );
    const rows = stmt.all(collectionId) as CollectionFileRow[];
    return rows.map(mapRowToCollectionFile);
  }

  reindexPendingFiles(collectionId: number): void {
    this.getCollectionById(collectionId);
    // Include files with no indexed_at OR files that have indexed_at but no chunks (e.g. previously skipped)
    const pending = this.db.prepare(`
      SELECT DISTINCT cf.file_path, cf.repo
      FROM collection_files cf
      LEFT JOIN code_chunks cc ON cc.file_path = cf.file_path AND cc.repo = cf.repo
      WHERE cf.collection_id = ?
        AND (cf.indexed_at IS NULL OR cc.id IS NULL)
    `).all(collectionId) as Array<{ file_path: string; repo: string }>;
    if (pending.length === 0) return;
    // Reset indexed_at for files with no chunks so the indexer will process them
    const reset = this.db.prepare(
      'UPDATE collection_files SET indexed_at = NULL WHERE collection_id = ? AND file_path = ? AND repo = ?'
    );
    const resetMany = this.db.transaction(() => {
      for (const f of pending) {
        reset.run(collectionId, f.file_path, f.repo);
      }
    });
    resetMany();
    const files = pending.map((f) => ({ filePath: f.file_path, repo: f.repo }));
    if (this.indexer) {
      this.indexer.indexCollectionFilesInBackground(collectionId, files);
    }
    logger.info({ collectionId, fileCount: pending.length }, 'Reindex triggered for pending files');
  }

  getIndexingStatus(collectionId: number): { status: IndexingStatus; progress: number } {
    this.getCollectionById(collectionId);
    if (this.indexer) {
      const indexerStatus = this.indexer.getStatus(collectionId);
      if (indexerStatus === 'error' || indexerStatus === 'indexing') {
        return { status: indexerStatus, progress: this.indexer.getProgress(collectionId) };
      }
    }
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) AS total,
        COUNT(indexed_at) AS indexed
      FROM collection_files
      WHERE collection_id = ?
    `);
    const row = stmt.get(collectionId) as { total: number; indexed: number };
    if (row.total === 0) return { status: 'idle', progress: 0 };
    if (row.indexed === row.total) return { status: 'done', progress: 100 };
    if (row.indexed === 0) return { status: 'idle', progress: 0 };
    const progress = Math.round((row.indexed / row.total) * 100);
    return { status: 'indexing', progress };
  }

  private findDuplicateName(
    name: string,
    scope: string,
    projectDir: string | null,
    excludeId?: number
  ): boolean {
    const projectDirCondition = projectDir === null
      ? 'project_dir IS NULL'
      : 'project_dir = @projectDir';
    const excludeCondition = excludeId !== undefined
      ? 'AND id != @excludeId'
      : '';
    const sql = `SELECT id FROM collections WHERE name = @name AND scope = @scope AND ${projectDirCondition} ${excludeCondition}`;
    const params: Record<string, string | number> = { name, scope };
    if (projectDir !== null) {
      params.projectDir = projectDir;
    }
    if (excludeId !== undefined) {
      params.excludeId = excludeId;
    }
    const row = this.db.prepare(sql).get(params);
    return row !== undefined;
  }

  private getCollectionById(id: number): Collection {
    const stmt = this.db.prepare(`
      SELECT c.*, COALESCE(cf.cnt, 0) AS file_count
      FROM collections c
      LEFT JOIN (SELECT collection_id, COUNT(*) AS cnt FROM collection_files GROUP BY collection_id) cf
        ON cf.collection_id = c.id
      WHERE c.id = ?
    `);
    const row = stmt.get(id) as CollectionRow | undefined;
    if (!row) {
      throw new NotFoundError('Collection', id);
    }
    return mapRowToCollection(row);
  }

  getGlobalCollections(): Collection[] {
    const stmt = this.db.prepare(`
      SELECT c.*, COALESCE(cf.cnt, 0) AS file_count
      FROM collections c
      LEFT JOIN (SELECT collection_id, COUNT(*) AS cnt FROM collection_files GROUP BY collection_id) cf
        ON cf.collection_id = c.id
      WHERE c.scope = 'global'
      ORDER BY c.name
    `);
    const rows = stmt.all() as CollectionRow[];
    return rows.map(mapRowToCollection);
  }
}
