import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { indexRepository, getIndexingStatus } from '../../rag/indexer';
import { getVectorsDb } from '../../db/sqlite-client';
import { AppError } from '../middleware/error';
import { logger } from '../../utils/logger';

const router = Router();

// POST /api/index — inicia indexação de um diretório
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dirPath, name } = req.body as { dirPath?: string; name?: string };

    if (!dirPath) {
      throw new AppError(400, 'dirPath é obrigatório');
    }

    const resolved = path.resolve(dirPath.replace(/^~/, process.env.HOME || ''));

    if (!fs.existsSync(resolved)) {
      throw new AppError(400, `Diretório não encontrado: ${resolved}`);
    }

    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      throw new AppError(400, `O caminho não é um diretório: ${resolved}`);
    }

    const { isIndexing } = getIndexingStatus();
    if (isIndexing) {
      throw new AppError(409, 'Indexação já em andamento. Aguarde terminar.');
    }

    const repoName = name || path.basename(resolved);
    logger.info({ path: resolved, name: repoName }, 'Starting directory indexing via API');

    // Roda em background, responde imediatamente
    indexRepository(resolved, repoName)
      .then(({ indexed, skipped }) => {
        logger.info({ repoName, indexed, skipped }, 'Directory indexing finished');
      })
      .catch((err) => {
        logger.error({ err, repoName }, 'Directory indexing failed');
      });

    res.json({
      status: 'started',
      name: repoName,
      path: resolved,
      message: `Indexação de "${repoName}" iniciada em background`,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/index/status
router.get('/status', (_req: Request, res: Response) => {
  res.json(getIndexingStatus());
});

// DELETE /api/index/:repo — remove all chunks and vectors for a repo
router.delete('/:repo', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { repo } = req.params;
    const db = getVectorsDb();

    const chunkIds = db.prepare('SELECT id FROM code_chunks WHERE repo = ?').all(repo) as { id: number }[];
    if (chunkIds.length === 0) {
      throw new AppError(404, `Repo não encontrado: ${repo}`);
    }

    const ids = chunkIds.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM vectors WHERE chunk_id IN (${placeholders})`).run(...ids);
    db.prepare('DELETE FROM code_chunks WHERE repo = ?').run(repo);

    logger.info({ repo, removed: ids.length }, 'Repo index cleared');
    res.json({ status: 'ok', repo, removed: ids.length });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/index — remove ALL chunks and vectors
router.delete('/', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getVectorsDb();
    db.prepare('DELETE FROM vectors').run();
    db.prepare('DELETE FROM code_chunks').run();
    logger.info('All index cleared');
    res.json({ status: 'ok', message: 'Índice completamente limpo' });
  } catch (err) {
    next(err);
  }
});

export default router;
