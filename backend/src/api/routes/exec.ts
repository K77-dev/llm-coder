import { Router, Request, Response, NextFunction } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { AppError } from '../middleware/error';
import { logger } from '../../utils/logger';

const router = Router();

const TIMEOUT_MS = 120_000; // 2 minutes max

// POST /api/exec — { command, cwd? }
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { command, cwd: rawCwd } = req.body as { command?: string; cwd?: string };

    if (!command?.trim()) throw new AppError(400, 'command é obrigatório');

    const cwd = rawCwd
      ? path.resolve(rawCwd.replace(/^~/, process.env.HOME || ''))
      : process.env.HOME || '/tmp';

    if (!fs.existsSync(cwd)) throw new AppError(400, `Diretório não encontrado: ${cwd}`);

    logger.info({ command, cwd }, 'Executing command via API');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const send = (type: string, data: string) =>
      res.write(`data: ${JSON.stringify({ type, data })}\n\n`);

    const proc = spawn('bash', ['-c', command], {
      cwd,
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      send('error', 'Timeout: comando excedeu 2 minutos.');
      res.write('data: [DONE]\n\n');
      res.end();
    }, TIMEOUT_MS);

    proc.stdout.on('data', (chunk: Buffer) => send('stdout', chunk.toString()));
    proc.stderr.on('data', (chunk: Buffer) => send('stderr', chunk.toString()));

    proc.on('close', (code) => {
      clearTimeout(timer);
      send('exit', String(code ?? 0));
      res.write('data: [DONE]\n\n');
      res.end();
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      send('error', err.message);
      res.write('data: [DONE]\n\n');
      res.end();
    });

    req.on('close', () => proc.kill('SIGTERM'));
  } catch (err) {
    next(err);
  }
});

export default router;
