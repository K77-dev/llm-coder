import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

const router = Router();

// GET /api/browse?path=/Users/kelsen
router.get('/', (req: Request, res: Response) => {
  const rawPath = (req.query.path as string) || '~';
  const resolved = path.resolve(rawPath.replace(/^~/, process.env.HOME || ''));

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    res.status(400).json({ error: 'Caminho inválido' });
    return;
  }

  let entries: { name: string; path: string }[] = [];
  try {
    entries = fs
      .readdirSync(resolved, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => ({
        name: d.name,
        path: path.join(resolved, d.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    // Permission denied — return empty list
  }

  const parent = resolved !== '/' ? path.dirname(resolved) : null;

  res.json({ path: resolved, parent, entries });
});

export default router;
