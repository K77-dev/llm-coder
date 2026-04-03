// eslint-disable-next-line @typescript-eslint/no-require-imports
const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron') as typeof import('electron');
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { LlamaServerManager } from './llama-server-manager';

// Load .env into process.env for the main process
const envPath = path.join(__dirname, '..', '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^~/, require('os').homedir());
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const isDev = process.env.NODE_ENV === 'development';
const BACKEND_PORT = 3001;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const FRONTEND_DEV_URL = 'http://localhost:3002';

type BrowserWindowType = InstanceType<typeof BrowserWindow>;
let mainWindow: BrowserWindowType | null = null;
let backendProcess: ChildProcess | null = null;
let frontendProcess: ChildProcess | null = null;
let llamaManager: LlamaServerManager | null = null;
let embeddingManager: LlamaServerManager | null = null;
let unsubscribeLlamaState: (() => void) | null = null;

// ── Resolve paths ────────────────────────────────────────────────────────────

function resolveFromRoot(...segments: string[]): string {
  // In packaged app: resources/app/  |  in dev: project root
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'app')
    : path.join(__dirname, '../..');
  return path.join(base, ...segments);
}

// ── Spawn backend ────────────────────────────────────────────────────────────

function startBackend(): void {
  const backendEntry = resolveFromRoot('backend', 'dist', 'index.js');
  const envFile = resolveFromRoot('.env');

  // Use the real Node.js binary (not Electron) to avoid native module ABI mismatch.
  // In dev, NODE_BINARY is injected by the electron:dev script.
  // In packaged apps, fall back to Electron binary with ELECTRON_RUN_AS_NODE=1.
  const nodeBin = process.env.NODE_BINARY || process.execPath;
  const useElectronNode = nodeBin === process.execPath;

  backendProcess = spawn(nodeBin, [backendEntry], {
    env: {
      ...process.env,
      ...(useElectronNode ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
      ELECTRON_APP: '1',
      NODE_ENV: isDev ? 'development' : 'production',
      PORT: String(BACKEND_PORT),
      DOTENV_CONFIG_PATH: envFile,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backendProcess.stdout?.on('data', (d) => process.stdout.write(`[backend] ${d}`));
  backendProcess.stderr?.on('data', (d) => process.stderr.write(`[backend] ${d}`));
  backendProcess.on('exit', (code) => {
    console.log(`[backend] exited with code ${code}`);
  });
}

// ── Spawn Next.js dev server (dev only) ──────────────────────────────────────

function startFrontendDev(): void {
  const frontendDir = resolveFromRoot('frontend');
  frontendProcess = spawn('npm', ['run', 'dev', '--workspace=frontend'], {
    cwd: resolveFromRoot(),
    env: {
      ...process.env,
      NEXT_PUBLIC_API_URL: BACKEND_URL,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  frontendProcess.stdout?.on('data', (d) => process.stdout.write(`[frontend] ${d}`));
  frontendProcess.stderr?.on('data', (d) => process.stderr.write(`[frontend] ${d}`));
  void frontendDir; // suppress unused warning
}

// ── Poll backend until ready ─────────────────────────────────────────────────

function waitForBackend(maxMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      http.get(`${BACKEND_URL}/api/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      }).on('error', retry);
    };
    const retry = () => {
      if (Date.now() - start > maxMs) {
        reject(new Error('Backend did not start in time'));
        return;
      }
      setTimeout(check, 500);
    };
    check();
  });
}

// ── Poll frontend until ready (dev only) ────────────────────────────────────

function waitForFrontend(maxMs = 60_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      http.get(FRONTEND_DEV_URL, (res) => {
        if (res.statusCode && res.statusCode < 500) {
          resolve();
        } else {
          retry();
        }
        res.resume();
      }).on('error', retry);
    };
    const retry = () => {
      if (Date.now() - start > maxMs) {
        reject(new Error('Frontend did not start in time'));
        return;
      }
      setTimeout(check, 1000);
    };
    check();
  });
}

// ── LlamaServerManager setup ────────────────────────────────────────────────

function initializeLlamaManager(): void {
  llamaManager = new LlamaServerManager();
  const embeddingPort = Number(process.env.EMBEDDING_SERVER_PORT) || 8081;
  embeddingManager = new LlamaServerManager({ port: embeddingPort, mode: 'embedding' });
  registerLlamaIpcHandlers();
  subscribeToLlamaStateChanges();
}

function registerLlamaIpcHandlers(): void {
  ipcMain.handle('llama:get-models', () => {
    const modelsDir = process.env.LLAMA_MODELS_DIR;
    if (!modelsDir || !llamaManager) {
      return [];
    }
    return llamaManager.scanModels(modelsDir);
  });

  ipcMain.handle('llama:get-state', () => {
    if (!llamaManager) {
      return { status: 'stopped', activeModel: null, port: 8080, pid: null, error: null };
    }
    return llamaManager.getState();
  });

  ipcMain.handle('llama:select-model', async (_event, fileName: string) => {
    if (!llamaManager) {
      throw new Error('LlamaServerManager not initialized');
    }
    const modelsDir = process.env.LLAMA_MODELS_DIR;
    if (!modelsDir) {
      throw new Error('LLAMA_MODELS_DIR not configured');
    }
    const modelPath = path.join(modelsDir, fileName);
    await llamaManager.restart(modelPath);
    persistLastActiveModel(fileName);
  });

  ipcMain.handle('llama:restart', async (_event, config: { port?: number; execPath?: string; modelsDir?: string }) => {
    if (!llamaManager) {
      throw new Error('LlamaServerManager not initialized');
    }
    await llamaManager.stop();
    if (embeddingManager) {
      await embeddingManager.stop();
    }
    llamaManager = new LlamaServerManager({
      port: config.port,
      execPath: config.execPath,
    });
    const embeddingPort = Number(process.env.EMBEDDING_SERVER_PORT) || 8081;
    embeddingManager = new LlamaServerManager({ port: embeddingPort, mode: 'embedding' });
    subscribeToLlamaStateChanges();
    if (config.modelsDir) {
      process.env.LLAMA_MODELS_DIR = config.modelsDir;
    }
    await autoStartLlama();
  });

  ipcMain.handle('dialog:select-directory', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle('dialog:select-file', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle('dialog:show-confirm', async (_event, message: string) => {
    if (!mainWindow) return false;
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Sim', 'Nao'],
      defaultId: 0,
      cancelId: 1,
      message,
    });
    return result.response === 0;
  });
}

function subscribeToLlamaStateChanges(): void {
  if (!llamaManager) return;
  unsubscribeLlamaState = llamaManager.onStateChange((state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('llama:state-changed', state);
    }
  });
}

async function autoStartLlama(): Promise<void> {
  if (!llamaManager) return;
  const modelsDir = process.env.LLAMA_MODELS_DIR;
  if (!modelsDir) {
    console.log('[llama] LLAMA_MODELS_DIR not set, skipping auto-start');
    return;
  }
  const modelToLoad = loadLastActiveModel();
  if (!modelToLoad) {
    console.log('[llama] No last active model found, skipping auto-start. Select a model to begin.');
    return;
  }
  const modelPath = path.join(modelsDir, modelToLoad);
  try {
    await llamaManager.start(modelPath);
  } catch (err) {
    console.error('[llama] Failed to auto-start llama-server:', err);
  }
  // Auto-start embedding server
  await autoStartEmbeddingServer();
}

async function autoStartEmbeddingServer(): Promise<void> {
  if (!embeddingManager) return;
  const modelsDir = process.env.LLAMA_MODELS_DIR;
  if (!modelsDir) return;
  // Wait for backend to be ready, then load setting via API
  let embeddingModelFile: string | null = null;
  for (let i = 0; i < 15; i++) {
    try {
      const result = require('child_process').execSync(
        `curl -s http://localhost:${BACKEND_PORT}/api/llama/settings`,
        { timeout: 3000, encoding: 'utf-8' }
      );
      const settings = JSON.parse(result);
      if (settings.embeddingModelFile) {
        embeddingModelFile = settings.embeddingModelFile;
        break;
      }
    } catch { /* backend not ready */ }
    await new Promise(r => setTimeout(r, 2000));
  }
  if (!embeddingModelFile) {
    console.log('[embedding] No embedding model configured, skipping auto-start');
    return;
  }
  const modelPath = path.join(modelsDir, embeddingModelFile);
  if (!fs.existsSync(modelPath)) {
    console.log(`[embedding] Model file not found: ${modelPath}`);
    return;
  }
  try {
    await embeddingManager.start(modelPath);
    console.log(`[embedding] Embedding server started with ${embeddingModelFile}`);
  } catch (err) {
    console.error('[embedding] Failed to auto-start embedding server:', err);
  }
}

function loadSetting(key: string): string | null {
  // Try loading from backend's DB via HTTP API (backend must be running)
  try {
    const result = require('child_process').execSync(
      `curl -s http://localhost:${BACKEND_PORT}/api/llama/settings`,
      { timeout: 5000, encoding: 'utf-8' }
    );
    const settings = JSON.parse(result);
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (settings[camelKey] !== undefined && settings[camelKey] !== '') {
      return String(settings[camelKey]);
    }
  } catch { /* backend not ready yet */ }
  // Fallback: try require
  try {
    const { getLlamaSetting } = require(resolveFromRoot('backend', 'dist', 'db', 'sqlite-client'));
    return getLlamaSetting(key);
  } catch { /* DB not initialized */ }
  return null;
}

function persistLastActiveModel(fileName: string): void {
  // Write directly to DB via sqlite3 CLI (avoids Node native module issues in Electron)
  try {
    const dbPath = path.join(require('os').homedir(), '.code-llm', 'vectors.db');
    require('child_process').execSync(
      `sqlite3 "${dbPath}" "INSERT OR REPLACE INTO llama_settings (key, value, updated_at) VALUES ('last_active_model', '${fileName}', datetime('now'));"`,
      { timeout: 3000 }
    );
  } catch (err) {
    console.error('[llama] Failed to persist last active model:', err instanceof Error ? err.message : err);
  }
}

function loadLastActiveModel(): string | null {
  return loadSetting('last_active_model');
}

// ── Create window ────────────────────────────────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Code LLM',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) console.error('[renderer]', message);
  });
  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('[renderer] Failed to load:', code, desc);
  });

  if (isDev) {
    mainWindow.loadURL(FRONTEND_DEV_URL);
  } else {
    mainWindow.loadFile(resolveFromRoot('frontend', 'out', 'index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  startBackend();

  if (isDev) {
    startFrontendDev();
  }

  initializeLlamaManager();

  try {
    await waitForBackend();
  } catch (err) {
    console.error(err);
    // Continue anyway — backend may still be loading
  }

  if (isDev) {
    try {
      console.log('[frontend] Waiting for Next.js dev server...');
      await waitForFrontend();
      console.log('[frontend] Ready');
    } catch (err) {
      console.error(err);
    }
  }

  createWindow();
  autoStartLlama();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  backendProcess?.kill();
  frontendProcess?.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  backendProcess?.kill();
  frontendProcess?.kill();
  if (unsubscribeLlamaState) {
    unsubscribeLlamaState();
    unsubscribeLlamaState = null;
  }
  if (llamaManager) {
    llamaManager.stop().catch((err) => {
      console.error('[llama] Error stopping llama-server during quit:', err);
    });
    llamaManager = null;
  }
  if (embeddingManager) {
    embeddingManager.stop().catch((err) => {
      console.error('[embedding] Error stopping embedding server during quit:', err);
    });
    embeddingManager = null;
  }
});

export { initializeLlamaManager, registerLlamaIpcHandlers, autoStartLlama, persistLastActiveModel, loadLastActiveModel };
