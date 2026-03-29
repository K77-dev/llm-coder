import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, ChildProcess, execSync } from 'child_process';
import { getLlamaSetting, setLlamaSetting } from '../../db/sqlite-client';
import { logger } from '../../utils/logger';
import axios from 'axios';

let llamaProcess: ChildProcess | null = null;
let serverStatus: 'stopped' | 'starting' | 'running' | 'error' = 'stopped';
let activeModelName: string | null = null;

interface ModelInfo {
  fileName: string;
  displayName: string;
  sizeBytes: number;
  path: string;
}

const selectModelSchema = z.object({
  fileName: z.string().min(1),
});

export async function getModels(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const modelsDir = process.env.LLAMA_MODELS_DIR;
    if (!modelsDir) {
      res.json({ models: [], status: 'no_directory' });
      return;
    }
    const resolvedDir = modelsDir.replace('~', os.homedir());
    if (!fs.existsSync(resolvedDir)) {
      res.json({ models: [], status: 'no_directory' });
      return;
    }
    const files = fs.readdirSync(resolvedDir);
    const models: ModelInfo[] = files
      .filter((f) => f.endsWith('.gguf'))
      .map((fileName) => {
        const filePath = path.join(resolvedDir, fileName);
        const stats = fs.statSync(filePath);
        const displayName = fileName
          .replace(/\.gguf$/, '')
          .replace(/[-_]/g, ' ');
        return {
          fileName,
          displayName,
          sizeBytes: stats.size,
          path: filePath,
        };
      });
    logger.info({ count: models.length, dir: resolvedDir }, 'Listed llama models');
    res.json({ models, status: 'available' });
  } catch (error) {
    next(error);
  }
}

function stopLlamaServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!llamaProcess) {
      resolve();
      return;
    }
    const proc = llamaProcess;
    llamaProcess = null;
    proc.kill('SIGTERM');
    const timeout = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch { /* already dead */ }
      resolve();
    }, 5000);
    proc.on('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function startLlamaServer(modelPath: string, port: string): Promise<void> {
  await stopLlamaServer();
  const execPath = process.env.LLAMA_SERVER_PATH || 'llama-server';
  serverStatus = 'starting';
  activeModelName = path.basename(modelPath);
  try {
    // Kill orphan process on port
    try {
      const pid = execSync(`lsof -ti :${port}`, { encoding: 'utf-8' }).trim();
      if (pid) {
        execSync(`kill ${pid}`);
        logger.info({ component: 'llama-server', pid }, 'Killed orphan process on port');
      }
    } catch { /* no process on port */ }
    const proc = spawn(execPath, ['-m', modelPath, '--port', port], { stdio: 'pipe' });
    llamaProcess = proc;
    proc.stdout?.on('data', (data: Buffer) => {
      logger.debug({ component: 'llama-server' }, data.toString().trim());
    });
    proc.stderr?.on('data', (data: Buffer) => {
      logger.debug({ component: 'llama-server' }, data.toString().trim());
    });
    proc.on('error', (err) => {
      if (llamaProcess !== proc) return;
      logger.error({ component: 'llama-server', error: err.message }, 'Process error');
      serverStatus = 'error';
      llamaProcess = null;
    });
    proc.on('exit', (code) => {
      if (llamaProcess !== proc) return;
      logger.info({ component: 'llama-server', code }, 'Process exited');
      serverStatus = 'stopped';
      llamaProcess = null;
    });
    // Health check polling
    const startTime = Date.now();
    const healthUrl = `http://localhost:${port}/health`;
    while (Date.now() - startTime < 120000) {
      try {
        const resp = await axios.get(healthUrl, { timeout: 2000 });
        if (resp.status === 200) {
          serverStatus = 'running';
          logger.info({ component: 'llama-server', model: activeModelName, port }, 'Server ready');
          return;
        }
      } catch { /* not ready yet */ }
      await new Promise((r) => setTimeout(r, 1000));
    }
    serverStatus = 'error';
    logger.error({ component: 'llama-server' }, 'Health check timeout');
  } catch (err) {
    serverStatus = 'error';
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ component: 'llama-server', error: msg }, 'Failed to start');
  }
}

export async function selectModel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = selectModelSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid request', details: result.error.issues });
      return;
    }
    const { fileName } = result.data;
    const modelsDir = process.env.LLAMA_MODELS_DIR;
    if (!modelsDir) {
      res.status(400).json({ error: 'LLAMA_MODELS_DIR not configured' });
      return;
    }
    const resolvedDir = modelsDir.replace('~', os.homedir());
    const modelPath = path.join(resolvedDir, fileName);
    if (!fs.existsSync(modelPath)) {
      res.status(404).json({ error: 'Model file not found' });
      return;
    }
    setLlamaSetting('last_active_model', fileName);
    serverStatus = 'starting';
    activeModelName = fileName;
    const port = process.env.LLAMA_SERVER_PORT || '8080';
    // Start llama-server in background (don't await full health check)
    startLlamaServer(modelPath, port);
    logger.info({ fileName, port }, 'Llama model selected and server starting');
    res.json({ success: true, activeModel: fileName, status: 'starting' });
  } catch (error) {
    next(error);
  }
}

export async function getStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const persistedModel = getLlamaSetting('last_active_model');
    const port = process.env.LLAMA_SERVER_PORT || '8080';
    let realStatus = serverStatus;
    // If internal state says stopped/error, check if llama-server is actually running
    if (realStatus !== 'starting') {
      try {
        const resp = await axios.get(`http://localhost:${port}/health`, { timeout: 1000 });
        if (resp.status === 200) {
          realStatus = 'running';
        }
      } catch {
        if (realStatus === 'running') {
          realStatus = 'stopped';
        }
      }
    }
    res.json({
      activeModel: activeModelName || persistedModel,
      status: realStatus,
      pid: llamaProcess?.pid || null,
    });
  } catch (error) {
    next(error);
  }
}

// Called after DB is initialized (from index.ts)
export function autoStartLlamaServer(): void {
  try {
    const lastModel = getLlamaSetting('last_active_model');
    const modelsDir = process.env.LLAMA_MODELS_DIR;
    if (!lastModel || !modelsDir) return;
    const resolvedDir = modelsDir.replace('~', os.homedir());
    const modelPath = path.join(resolvedDir, lastModel);
    if (!fs.existsSync(modelPath)) return;
    const port = process.env.LLAMA_SERVER_PORT || '8080';
    logger.info({ component: 'llama-server', model: lastModel }, 'Auto-starting with last model');
    startLlamaServer(modelPath, port);
  } catch {
    logger.warn({ component: 'llama-server' }, 'Could not auto-start, DB may not be ready');
  }
}

// Cleanup on process exit
process.on('beforeExit', () => { stopLlamaServer(); });
process.on('SIGTERM', () => { stopLlamaServer(); });
process.on('SIGINT', () => { stopLlamaServer(); });
