import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { AppError } from '../middleware/error';
import { logger } from '../../utils/logger';

const router = Router();

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

function resolveSafePath(rawPath: string): string {
  const expanded = rawPath.replace(/^~/, process.env.HOME || '');
  if (path.isAbsolute(expanded)) return expanded;
  // Resolve relative paths from HOME instead of process.cwd()
  return path.join(process.env.HOME || '/tmp', expanded);
}

// GET /api/files/read?path=...
router.get('/read', (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawPath = req.query.path as string;
    if (!rawPath) throw new AppError(400, 'path é obrigatório');

    const resolved = resolveSafePath(rawPath);

    if (!fs.existsSync(resolved)) throw new AppError(404, `Arquivo não encontrado: ${resolved}`);
    if (fs.statSync(resolved).isDirectory()) throw new AppError(400, 'O caminho é um diretório');

    const stat = fs.statSync(resolved);
    if (stat.size > MAX_FILE_SIZE) throw new AppError(400, 'Arquivo muito grande (máx 1MB)');

    const content = fs.readFileSync(resolved, 'utf-8');
    res.json({ path: resolved, content });
  } catch (err) {
    next(err);
  }
});

// POST /api/files/write — { path, content }
router.post('/write', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { path: rawPath, content } = req.body as { path?: string; content?: string };

    if (!rawPath) throw new AppError(400, 'path é obrigatório');
    if (content === undefined) throw new AppError(400, 'content é obrigatório');

    const resolved = resolveSafePath(rawPath);
    const dir = path.dirname(resolved);

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(resolved, content, 'utf-8');

    logger.info({ path: resolved }, 'File written via API');
    res.json({ status: 'ok', path: resolved });
  } catch (err) {
    next(err);
  }
});

export default router;
