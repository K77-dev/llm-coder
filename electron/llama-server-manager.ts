import { spawn, execSync, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { ServerStatus, LlamaServerState, ModelInfo } from './types';

export { ServerStatus, LlamaServerState, ModelInfo };

type StateChangeCallback = (state: LlamaServerState) => void;

interface Logger {
  info(obj: Record<string, unknown>, msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
  error(obj: Record<string, unknown>, msg: string): void;
}

const DEFAULT_PORT = 8080;
const HEALTH_CHECK_TIMEOUT_MS = 60_000;
const HEALTH_CHECK_INTERVAL_MS = 500;
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 5_000;

export class LlamaServerManager {
  private state: LlamaServerState;
  private process: ChildProcess | null = null;
  private listeners: StateChangeCallback[] = [];
  private readonly logger: Logger;
  private execPath: string;

  constructor(options?: { logger?: Logger; execPath?: string; port?: number }) {
    const port = options?.port ?? (Number(process.env.LLAMA_SERVER_PORT) || DEFAULT_PORT);
    this.execPath = options?.execPath ?? process.env.LLAMA_SERVER_PATH ?? 'llama-server';
    this.logger = options?.logger ?? createDefaultLogger();
    this.state = {
      status: 'stopped',
      activeModel: null,
      port,
      pid: null,
      error: null,
    };
  }

  getState(): LlamaServerState {
    return { ...this.state };
  }

  onStateChange(cb: StateChangeCallback): () => void {
    this.listeners.push(cb);
    return () => {
      const index = this.listeners.indexOf(cb);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  async start(modelPath: string): Promise<void> {
    if (this.state.status === 'running' || this.state.status === 'starting') {
      await this.stop();
    }
    await this.killOrphanProcess();
    const modelFileName = path.basename(modelPath);
    this.setState({ status: 'starting', activeModel: modelFileName, error: null });
    this.logger.info({ component: 'llama-server', modelPath, port: this.state.port }, 'Starting llama-server');
    try {
      this.process = spawn(this.execPath, ['-m', modelPath, '--port', String(this.state.port)], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      this.state.pid = this.process.pid ?? null;
      this.process.stdout?.on('data', (data: Buffer) => {
        this.logger.info({ component: 'llama-server' }, data.toString().trimEnd());
      });
      this.process.stderr?.on('data', (data: Buffer) => {
        this.logger.warn({ component: 'llama-server' }, data.toString().trimEnd());
      });
      this.process.on('error', (err: Error) => {
        this.logger.error({ component: 'llama-server', error: err.message }, 'llama-server process error');
        this.setState({ status: 'error', error: err.message, pid: null });
      });
      this.process.on('exit', (code: number | null) => {
        if (this.state.status !== 'stopped') {
          const msg = `llama-server exited with code ${code}`;
          this.logger.warn({ component: 'llama-server', code }, msg);
          this.setState({ status: 'error', error: msg, pid: null });
        }
      });
      await this.waitForHealthy();
      this.setState({ status: 'running' });
      this.logger.info({ component: 'llama-server', modelPath, pid: this.state.pid }, 'llama-server is running');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error({ component: 'llama-server', error: message }, 'Failed to start llama-server');
      this.setState({ status: 'error', error: message, pid: null });
      this.killProcess();
    }
  }

  async stop(): Promise<void> {
    if (!this.process) {
      this.setState({ status: 'stopped', activeModel: null, pid: null, error: null });
      return;
    }
    this.logger.info({ component: 'llama-server', pid: this.state.pid }, 'Stopping llama-server');
    const proc = this.process;
    this.process = null;
    const exited = await this.gracefulKill(proc);
    if (!exited) {
      this.logger.warn({ component: 'llama-server', pid: proc.pid }, 'llama-server did not exit gracefully, sending SIGKILL');
      proc.kill('SIGKILL');
    }
    this.setState({ status: 'stopped', activeModel: null, pid: null, error: null });
  }

  async restart(modelPath: string, config?: { port?: number; execPath?: string }): Promise<void> {
    await this.stop();
    if (config?.port !== undefined) {
      this.state = { ...this.state, port: config.port };
    }
    if (config?.execPath !== undefined) {
      this.execPath = config.execPath;
    }
    await this.start(modelPath);
  }

  scanModels(dirPath: string): ModelInfo[] {
    try {
      if (!fs.existsSync(dirPath)) {
        this.logger.warn({ component: 'llama-server', dirPath }, 'Models directory does not exist');
        return [];
      }
      const entries = fs.readdirSync(dirPath);
      const models: ModelInfo[] = [];
      for (const entry of entries) {
        if (!entry.endsWith('.gguf')) {
          continue;
        }
        const fullPath = path.join(dirPath, entry);
        try {
          const stats = fs.statSync(fullPath);
          if (stats.isFile()) {
            models.push({
              fileName: entry,
              displayName: entry.replace(/\.gguf$/, ''),
              sizeBytes: stats.size,
              path: fullPath,
            });
          }
        } catch {
          this.logger.warn({ component: 'llama-server', filePath: fullPath }, 'Cannot read model file stats');
        }
      }
      return models;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error({ component: 'llama-server', error: message, dirPath }, 'Failed to scan models directory');
      return [];
    }
  }

  private setState(partial: Partial<LlamaServerState>): void {
    this.state = { ...this.state, ...partial };
    const snapshot = this.getState();
    for (const cb of this.listeners) {
      cb(snapshot);
    }
  }

  private waitForHealthy(): Promise<void> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const req = http.get(`http://localhost:${this.state.port}/health`, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            retry();
          }
          res.resume();
        });
        req.on('error', () => retry());
        req.setTimeout(2000, () => {
          req.destroy();
          retry();
        });
      };
      const retry = () => {
        if (Date.now() - start > HEALTH_CHECK_TIMEOUT_MS) {
          reject(new Error('Health check timed out after 60s'));
          return;
        }
        if (this.state.status === 'error') {
          reject(new Error(this.state.error ?? 'Process exited during health check'));
          return;
        }
        setTimeout(check, HEALTH_CHECK_INTERVAL_MS);
      };
      check();
    });
  }

  private gracefulKill(proc: ChildProcess): Promise<boolean> {
    return new Promise((resolve) => {
      let resolved = false;
      const onExit = () => {
        if (!resolved) {
          resolved = true;
          resolve(true);
        }
      };
      proc.once('exit', onExit);
      proc.kill('SIGTERM');
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          proc.removeListener('exit', onExit);
          resolve(false);
        }
      }, GRACEFUL_SHUTDOWN_TIMEOUT_MS);
    });
  }

  private killProcess(): void {
    if (this.process) {
      try {
        this.process.kill('SIGKILL');
      } catch {
        // Process may already be dead
      }
      this.process = null;
    }
  }

  private async killOrphanProcess(): Promise<void> {
    try {
      const port = this.state.port;
      const output = execSync(`lsof -ti tcp:${port} 2>/dev/null`, { encoding: 'utf-8' }).trim();
      if (output) {
        const pids = output.split('\n').map((p) => p.trim()).filter(Boolean);
        for (const pid of pids) {
          this.logger.warn({ component: 'llama-server', pid, port }, 'Killing orphan process on llama-server port');
          try {
            process.kill(Number(pid), 'SIGKILL');
          } catch {
            // Process may already be dead
          }
        }
      }
    } catch {
      // lsof returns non-zero if no process found — expected
    }
  }
}

function createDefaultLogger(): Logger {
  return {
    info(_obj: Record<string, unknown>, msg: string) {
      console.log(`[llama-server] ${msg}`);
    },
    warn(_obj: Record<string, unknown>, msg: string) {
      console.warn(`[llama-server] ${msg}`);
    },
    error(_obj: Record<string, unknown>, msg: string) {
      console.error(`[llama-server] ${msg}`);
    },
  };
}
