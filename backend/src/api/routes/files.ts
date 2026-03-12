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

// DELETE /api/files/delete — { path }
router.delete('/delete', (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawPath = (req.body as { path?: string }).path;
    if (!rawPath) throw new AppError(400, 'path é obrigatório');

    const resolved = resolveSafePath(rawPath);
    if (!fs.existsSync(resolved)) throw new AppError(404, `Arquivo não encontrado: ${resolved}`);
    if (fs.statSync(resolved).isDirectory()) throw new AppError(400, 'Use rmdir para diretórios');

    fs.unlinkSync(resolved);
    logger.info({ path: resolved }, 'File deleted via API');
    res.json({ status: 'ok', path: resolved });
  } catch (err) {
    next(err);
  }
});

// POST /api/files/rename — { from, to }
router.post('/rename', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from: rawFrom, to: rawTo } = req.body as { from?: string; to?: string };

    if (!rawFrom) throw new AppError(400, 'from é obrigatório');
    if (!rawTo) throw new AppError(400, 'to é obrigatório');

    const resolvedFrom = resolveSafePath(rawFrom);

    // Se `to` é apenas um nome de arquivo (sem /), resolve relativo ao dir de `from`
    let resolvedTo: string;
    const expandedTo = rawTo.replace(/^~/, process.env.HOME || '');
    if (path.isAbsolute(expandedTo)) {
      resolvedTo = expandedTo;
    } else if (!expandedTo.includes('/')) {
      resolvedTo = path.join(path.dirname(resolveSafePath(rawFrom)), expandedTo);
    } else {
      resolvedTo = path.join(process.env.HOME || '/tmp', expandedTo);
    }

    if (!fs.existsSync(resolvedFrom)) throw new AppError(404, `Arquivo não encontrado: ${resolvedFrom}`);

    const toDir = path.dirname(resolvedTo);
    fs.mkdirSync(toDir, { recursive: true });
    fs.renameSync(resolvedFrom, resolvedTo);

    logger.info({ from: resolvedFrom, to: resolvedTo }, 'File renamed via API');
    res.json({ status: 'ok', from: resolvedFrom, to: resolvedTo });
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

// GET /api/files/list?path=...
router.get('/list', (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawPath = req.query.path as string;
    if (!rawPath) throw new AppError(400, 'path é obrigatório');

    const resolved = resolveSafePath(rawPath);
    if (!fs.existsSync(resolved)) throw new AppError(404, `Diretório não encontrado: ${resolved}`);
    if (!fs.statSync(resolved).isDirectory()) throw new AppError(400, 'O caminho não é um diretório');

    const typeFilter = req.query.type as string | undefined; // 'dir' | 'file' | undefined
    const allEntries = fs.readdirSync(resolved, { withFileTypes: true });
    const entries = allEntries
      .filter((e) => !typeFilter || (typeFilter === 'dir' ? e.isDirectory() : e.isFile()))
      .map((e) => ({
        name: e.name,
        type: e.isDirectory() ? 'dir' : 'file',
        size: e.isFile() ? fs.statSync(path.join(resolved, e.name)).size : undefined,
      }));

    res.json({ path: resolved, entries });
  } catch (err) {
    next(err);
  }
});

// POST /api/files/mkdir — { path }
router.post('/mkdir', (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawPath = (req.body as { path?: string }).path;
    if (!rawPath) throw new AppError(400, 'path é obrigatório');

    const resolved = resolveSafePath(rawPath);
    fs.mkdirSync(resolved, { recursive: true });
    logger.info({ path: resolved }, 'Directory created via API');
    res.json({ status: 'ok', path: resolved });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/files/rmdir — { path }
router.delete('/rmdir', (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawPath = (req.body as { path?: string }).path;
    if (!rawPath) throw new AppError(400, 'path é obrigatório');

    const resolved = resolveSafePath(rawPath);
    if (!fs.existsSync(resolved)) throw new AppError(404, `Diretório não encontrado: ${resolved}`);
    if (!fs.statSync(resolved).isDirectory()) throw new AppError(400, 'O caminho não é um diretório');

    fs.rmSync(resolved, { recursive: true, force: true });
    logger.info({ path: resolved }, 'Directory deleted via API');
    res.json({ status: 'ok', path: resolved });
  } catch (err) {
    next(err);
  }
});

// GET /api/files/tree?path=...&depth=...
router.get('/tree', (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawPath = req.query.path as string;
    if (!rawPath) throw new AppError(400, 'path é obrigatório');

    const maxDepth = Math.min(Number(req.query.depth) || 4, 8);
    const resolved = resolveSafePath(rawPath);
    if (!fs.existsSync(resolved)) throw new AppError(404, `Diretório não encontrado: ${resolved}`);
    if (!fs.statSync(resolved).isDirectory()) throw new AppError(400, 'O caminho não é um diretório');

    interface TreeEntry { name: string; type: 'file' | 'dir'; size?: number; children?: TreeEntry[]; }

    function buildTree(dir: string, depth: number): TreeEntry[] {
      if (depth > maxDepth) return [];
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
      return entries
        .filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules')
        .sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        })
        .map((e) => {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) {
            return { name: e.name, type: 'dir' as const, children: buildTree(full, depth + 1) };
          }
          return { name: e.name, type: 'file' as const, size: fs.statSync(full).size };
        });
    }

    const tree = buildTree(resolved, 0);
    res.json({ path: resolved, tree });
  } catch (err) {
    next(err);
  }
});

// GET /api/files/search?path=...&query=...
router.get('/search', (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawPath = req.query.path as string;
    const query = (req.query.query as string || '').toLowerCase();
    if (!rawPath) throw new AppError(400, 'path é obrigatório');
    if (!query) throw new AppError(400, 'query é obrigatório');

    const resolved = resolveSafePath(rawPath);
    if (!fs.existsSync(resolved)) throw new AppError(404, `Diretório não encontrado: ${resolved}`);

    const MAX_RESULTS = 50;
    const results: { path: string; type: string }[] = [];

    function walk(dir: string, depth: number) {
      if (depth > 6 || results.length >= MAX_RESULTS) return;
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (results.length >= MAX_RESULTS) break;
        if (e.name.startsWith('.') || e.name === 'node_modules') continue;
        const full = path.join(dir, e.name);
        if (e.name.toLowerCase().includes(query)) {
          results.push({ path: full, type: e.isDirectory() ? 'dir' : 'file' });
        }
        if (e.isDirectory()) walk(full, depth + 1);
      }
    }

    walk(resolved, 0);
    res.json({ path: resolved, query, results });
  } catch (err) {
    next(err);
  }
});

export default router;
