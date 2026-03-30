import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { chunkFile, isIndexable, CodeChunk } from './chunker';
import { LRUCache } from '../utils/cache';
import { logger } from '../utils/logger';
import { CollectionFileInput, IndexingStatus } from '../services/collection-types';

const DEFAULT_EMBEDDING_MODEL = 'nomic-embed-text';

interface EmbeddingGenerator {
  (text: string): Promise<number[]>;
}

interface CollectionIndexerDeps {
  db: Database.Database;
  cacheDb?: Database.Database;
  generateEmbedding: EmbeddingGenerator;
  embeddingModel?: string;
}

interface IndexingState {
  status: IndexingStatus;
  error?: string;
  total: number;
  indexed: number;
}

export class CollectionIndexer {
  private readonly db: Database.Database;
  private readonly cacheDb: Database.Database | undefined;
  private readonly generateEmbedding: EmbeddingGenerator;
  private readonly embeddingModel: string;
  private readonly embeddingLruCache: LRUCache<number[]>;
  private readonly indexingStates: Map<number, IndexingState> = new Map();
  private readonly activeIndexing: Map<number, Promise<void>> = new Map();

  constructor(deps: CollectionIndexerDeps) {
    this.db = deps.db;
    this.cacheDb = deps.cacheDb;
    this.generateEmbedding = deps.generateEmbedding;
    this.embeddingModel = deps.embeddingModel ?? DEFAULT_EMBEDDING_MODEL;
    this.embeddingLruCache = new LRUCache<number[]>(500, 3600);
  }

  getStatus(collectionId: number): IndexingStatus {
    const state = this.indexingStates.get(collectionId);
    if (state) return state.status;
    return this.computeStatusFromDb(collectionId);
  }

  getError(collectionId: number): string | undefined {
    return this.indexingStates.get(collectionId)?.error;
  }

  getProgress(collectionId: number): number {
    const state = this.indexingStates.get(collectionId);
    if (!state || state.total === 0) return 0;
    return Math.round((state.indexed / state.total) * 100);
  }

  async indexCollectionFiles(
    collectionId: number,
    files: CollectionFileInput[],
    repoBasePaths?: Map<string, string>
  ): Promise<void> {
    if (files.length === 0) return;
    const existingPromise = this.activeIndexing.get(collectionId);
    if (existingPromise) {
      await existingPromise;
    }
    const indexPromise = this.runIndexing(collectionId, files, repoBasePaths);
    this.activeIndexing.set(collectionId, indexPromise);
    try {
      await indexPromise;
    } finally {
      this.activeIndexing.delete(collectionId);
    }
  }

  indexCollectionFilesInBackground(
    collectionId: number,
    files: CollectionFileInput[],
    repoBasePaths?: Map<string, string>
  ): void {
    if (files.length === 0) return;
    const existingPromise = this.activeIndexing.get(collectionId);
    const startIndexing = async (): Promise<void> => {
      if (existingPromise) {
        await existingPromise;
      }
      await this.runIndexing(collectionId, files, repoBasePaths);
    };
    const indexPromise = startIndexing();
    this.activeIndexing.set(collectionId, indexPromise);
    indexPromise
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error({ collectionId, error: message }, 'Background indexing failed');
      })
      .finally(() => {
        this.activeIndexing.delete(collectionId);
      });
  }

  hasExistingChunks(repo: string, filePath: string): boolean {
    const row = this.db.prepare(
      'SELECT COUNT(*) AS cnt FROM code_chunks WHERE repo = ? AND file_path = ?'
    ).get(repo, filePath) as { cnt: number };
    return row.cnt > 0;
  }

  private async runIndexing(
    collectionId: number,
    files: CollectionFileInput[],
    repoBasePaths?: Map<string, string>
  ): Promise<void> {
    this.indexingStates.set(collectionId, { status: 'indexing', total: files.length, indexed: 0 });
    logger.info(
      { collectionId, fileCount: files.length },
      'Starting collection indexing'
    );
    try {
      for (let i = 0; i < files.length; i++) {
        await this.indexSingleFile(collectionId, files[i], repoBasePaths);
        this.indexingStates.set(collectionId, { status: 'indexing', total: files.length, indexed: i + 1 });
      }
      this.indexingStates.set(collectionId, { status: 'done', total: files.length, indexed: files.length });
      logger.info({ collectionId }, 'Collection indexing complete');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const current = this.indexingStates.get(collectionId);
      this.indexingStates.set(collectionId, { status: 'error', error: message, total: current?.total ?? 0, indexed: current?.indexed ?? 0 });
      logger.error({ collectionId, error: message }, 'Collection indexing failed');
      throw err;
    }
  }

  private async indexSingleFile(
    collectionId: number,
    file: CollectionFileInput,
    repoBasePaths?: Map<string, string>
  ): Promise<void> {
    const { repo, filePath } = file;
    if (this.hasExistingChunks(repo, filePath)) {
      logger.debug({ repo, filePath }, 'Chunks already exist, skipping indexing');
      this.updateIndexedAt(collectionId, filePath);
      return;
    }
    let fullPath: string;
    if (path.isAbsolute(filePath)) {
      fullPath = filePath;
    } else {
      const basePath = repoBasePaths?.get(repo);
      if (!basePath) {
        logger.warn(
          { repo, filePath },
          'No base path for repo, skipping file indexing'
        );
        return;
      }
      fullPath = path.resolve(basePath, filePath);
    }
    if (!fs.existsSync(fullPath)) {
      logger.warn({ fullPath, filePath }, 'File does not exist on disk');
      return;
    }
    if (!isIndexable(fullPath)) {
      logger.debug({ filePath }, 'File is not indexable, skipping');
      this.updateIndexedAt(collectionId, filePath);
      return;
    }
    const content = await this.readFileContent(fullPath);
    if (!content) {
      logger.warn({ filePath }, 'Could not extract content from file');
      return;
    }
    const chunks = chunkFile(repo, filePath, content);
    for (const chunk of chunks) {
      await this.upsertChunk(chunk);
    }
    this.updateIndexedAt(collectionId, filePath);
    logger.debug(
      { collectionId, filePath, chunkCount: chunks.length },
      'File indexed for collection'
    );
  }

  private async upsertChunk(chunk: CodeChunk): Promise<void> {
    const textToEmbed = `${chunk.summary}\n\n${chunk.code}`;
    const textHash = crypto.createHash('sha256').update(textToEmbed).digest('hex');
    let embedding = this.embeddingLruCache.get(textHash);
    if (!embedding && this.cacheDb) {
      const cached = this.cacheDb.prepare(
        'SELECT embedding FROM embedding_cache WHERE text_hash = ?'
      ).get(textHash) as { embedding: Buffer } | undefined;
      if (cached) {
        embedding = bufferToFloat32Array(cached.embedding);
        this.embeddingLruCache.set(textHash, embedding);
      }
    }
    if (!embedding) {
      embedding = await this.generateEmbedding(textToEmbed);
      this.embeddingLruCache.set(textHash, embedding);
      if (this.cacheDb) {
        this.cacheDb.prepare(
          'INSERT OR REPLACE INTO embedding_cache (text_hash, embedding, model) VALUES (?, ?, ?)'
        ).run(textHash, float32ArrayToBuffer(embedding), this.embeddingModel);
      }
    }
    const result = this.db.prepare(`
      INSERT INTO code_chunks (repo, file_path, chunk_id, language, code, summary)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(repo, file_path, chunk_id) DO UPDATE SET
        code = excluded.code,
        summary = excluded.summary,
        indexed_at = CURRENT_TIMESTAMP
      RETURNING id
    `).get(chunk.repo, chunk.filePath, chunk.chunkId, chunk.language, chunk.code, chunk.summary) as { id: number };
    this.db.prepare(
      'INSERT OR REPLACE INTO vectors (id, chunk_id, embedding) VALUES (?, ?, ?)'
    ).run(result.id, result.id, float32ArrayToBuffer(embedding));
  }

  private async readFileContent(fullPath: string): Promise<string | null> {
    const ext = fullPath.substring(fullPath.lastIndexOf('.')).toLowerCase();
    if (ext === '.pdf') {
      return this.extractPdfText(fullPath);
    }
    if (ext === '.docx' || ext === '.doc') {
      return this.extractDocxText(fullPath);
    }
    try {
      return fs.readFileSync(fullPath, 'utf-8');
    } catch {
      return null;
    }
  }

  private async extractDocxText(fullPath: string): Promise<string | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mammoth = require('mammoth') as { extractRawText: (opts: { path: string }) => Promise<{ value: string }> };
      const result = await mammoth.extractRawText({ path: fullPath });
      return result.value || null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error({ fullPath, error: message }, 'Failed to parse DOCX');
      return null;
    }
  }

  private async extractPdfText(fullPath: string): Promise<string | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PDFParse } = require('pdf-parse') as { PDFParse: new (opts: { data: Buffer }) => { getText: () => Promise<{ pages: Array<{ text: string }> }> } };
      const buffer = fs.readFileSync(fullPath);
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      const text = result.pages.map((p) => p.text).join('\n\n');
      return text || null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error({ fullPath, error: message }, 'Failed to parse PDF');
      return null;
    }
  }

  private updateIndexedAt(collectionId: number, filePath: string): void {
    this.db.prepare(
      'UPDATE collection_files SET indexed_at = CURRENT_TIMESTAMP WHERE collection_id = ? AND file_path = ?'
    ).run(collectionId, filePath);
  }

  private computeStatusFromDb(collectionId: number): IndexingStatus {
    const row = this.db.prepare(`
      SELECT
        COUNT(*) AS total,
        COUNT(indexed_at) AS indexed
      FROM collection_files
      WHERE collection_id = ?
    `).get(collectionId) as { total: number; indexed: number };
    if (row.total === 0) return 'idle';
    if (row.indexed === row.total) return 'done';
    if (row.indexed === 0) return 'idle';
    return 'indexing';
  }
}

function float32ArrayToBuffer(arr: number[]): Buffer {
  const buf = Buffer.alloc(arr.length * 4);
  arr.forEach((v, i) => buf.writeFloatLE(v, i * 4));
  return buf;
}

function bufferToFloat32Array(buf: Buffer): number[] {
  const arr: number[] = [];
  for (let i = 0; i < buf.length; i += 4) {
    arr.push(buf.readFloatLE(i));
  }
  return arr;
}
