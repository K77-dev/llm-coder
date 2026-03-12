// eslint-disable-next-line @typescript-eslint/no-require-imports
const { app, BrowserWindow, shell } = require('electron') as typeof import('electron');
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import http from 'http';

const isDev = process.env.NODE_ENV === 'development';
const BACKEND_PORT = 3001;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const FRONTEND_DEV_URL = 'http://localhost:3002';

type BrowserWindowType = InstanceType<typeof BrowserWindow>;
let mainWindow: BrowserWindowType | null = null;
let backendProcess: ChildProcess | null = null;
let frontendProcess: ChildProcess | null = null;

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

  if (isDev) {
    mainWindow.loadURL(FRONTEND_DEV_URL);
    mainWindow.webContents.openDevTools();
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

  try {
    await waitForBackend();
  } catch (err) {
    console.error(err);
    // Continue anyway — backend may still be loading
  }

  createWindow();

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
});
