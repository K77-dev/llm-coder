import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

const router = Router();

// GET /api/browse?path=/Users/kelsen&includeFiles=true
router.get('/', (req: Request, res: Response) => {
  const rawPath = (req.query.path as string) || '~';
  const includeFiles = req.query.includeFiles === 'true';
  const resolved = path.resolve(rawPath.replace(/^~/, process.env.HOME || ''));

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    res.status(400).json({ error: 'Caminho inválido' });
    return;
  }

  let entries: { name: string; path: string; type: 'directory' | 'file' }[] = [];
  try {
    entries = fs
      .readdirSync(resolved, { withFileTypes: true })
      .filter((d) => {
        if (d.name.startsWith('.')) return false;
        return d.isDirectory() || (includeFiles && d.isFile());
      })
      .map((d) => ({
        name: d.name,
        path: path.join(resolved, d.name),
        type: (d.isDirectory() ? 'directory' : 'file') as 'directory' | 'file',
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  } catch {
    // Permission denied — return empty list
  }

  const parent = resolved !== '/' ? path.dirname(resolved) : null;

  res.json({ path: resolved, parent, entries });
});

export default router;
