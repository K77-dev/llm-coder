import { Router } from 'express';
import { isAvailable, getLoadedModels } from '../../llm/ollama-client';
import { getVectorsDb, consumeRepoMigrationNotification } from '../../db/sqlite-client';
import { getIndexingStatus } from '../../rag/indexer';

const router = Router();

router.get('/', async (_req, res) => {
  const ollamaOk = await isAvailable().catch(() => false);
  const models = ollamaOk ? await getLoadedModels().catch(() => []) : [];
  const db = getVectorsDb();
  const chunkCount = (db.prepare('SELECT COUNT(*) as count FROM code_chunks').get() as { count: number }).count;
  const { isIndexing } = getIndexingStatus();
  const migrationNotification = consumeRepoMigrationNotification();
  const collectionCount = (db.prepare('SELECT COUNT(*) as count FROM collections').get() as { count: number }).count;

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    ollama: {
      available: ollamaOk,
      models,
    },
    config: {
      llmModel: process.env.LLM_MODEL || 'qwen2.5-coder:7b',
      embeddingModel: process.env.EMBEDDING_MODEL || 'nomic-embed-text',
    },
    database: {
      indexed_chunks: chunkCount,
      collection_count: collectionCount,
    },
    indexing: {
      running: isIndexing,
    },
    ...(migrationNotification ? {
      migration: {
        collectionsCreated: migrationNotification.collectionsCreated,
        filesLinked: migrationNotification.filesLinked,
        message: `${migrationNotification.collectionsCreated} existing repositories were automatically migrated to collections.`,
      },
    } : {}),
  });
});

export default router;
