import { Router } from 'express';
import { isAvailable, getLoadedModels } from '../../llm/ollama-client';
import { getVectorsDb } from '../../db/sqlite-client';
import { getIndexingStatus } from '../../rag/indexer';

const router = Router();

router.get('/', async (_req, res) => {
  const ollamaOk = await isAvailable().catch(() => false);
  const models = ollamaOk ? await getLoadedModels().catch(() => []) : [];
  const db = getVectorsDb();
  const chunkCount = (db.prepare('SELECT COUNT(*) as count FROM code_chunks').get() as { count: number }).count;
  const { isIndexing } = getIndexingStatus();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    ollama: {
      available: ollamaOk,
      models,
    },
    database: {
      indexed_chunks: chunkCount,
    },
    indexing: {
      running: isIndexing,
    },
  });
});

export default router;
