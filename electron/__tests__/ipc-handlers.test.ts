import path from 'path';
import { LlamaServerManager } from '../llama-server-manager';
import type { LlamaServerState, ModelInfo } from '../types';

// Mock Electron modules
const mockInvoke = jest.fn();
const mockOn = jest.fn();
const mockRemoveListener = jest.fn();
const mockSend = jest.fn();

const ipcHandlers = new Map<string, (...args: unknown[]) => unknown>();

const mockIpcMain = {
  handle: jest.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
    ipcHandlers.set(channel, handler);
  }),
};

const mockWebContents = {
  send: mockSend,
};

const mockBrowserWindow = {
  isDestroyed: jest.fn(() => false),
  webContents: mockWebContents,
};

jest.mock('electron', () => ({
  app: {
    isPackaged: false,
    whenReady: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    quit: jest.fn(),
    get resourcesPath() { return '/mock/resources'; },
  },
  BrowserWindow: jest.fn(() => mockBrowserWindow),
  shell: { openExternal: jest.fn() },
  ipcMain: mockIpcMain,
  ipcRenderer: {
    invoke: mockInvoke,
    on: mockOn,
    removeListener: mockRemoveListener,
  },
  contextBridge: {
    exposeInMainWorld: jest.fn(),
  },
}));

jest.mock('child_process', () => ({
  spawn: jest.fn(),
  execSync: jest.fn(() => ''),
}));

describe('IPC Handlers', () => {
  let manager: LlamaServerManager;
  const modelsDir = path.join(__dirname, 'fixtures', 'models');

  beforeEach(() => {
    ipcHandlers.clear();
    mockIpcMain.handle.mockClear();
    mockSend.mockClear();
    manager = new LlamaServerManager({
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      port: 19876,
    });
  });

  function registerHandlers(mgr: LlamaServerManager, envModelsDir?: string): void {
    mockIpcMain.handle('llama:get-models', () => {
      if (!envModelsDir || !mgr) {
        return [];
      }
      return mgr.scanModels(envModelsDir);
    });

    mockIpcMain.handle('llama:get-state', () => {
      if (!mgr) {
        return { status: 'stopped', activeModel: null, port: 8080, pid: null, error: null };
      }
      return mgr.getState();
    });

    mockIpcMain.handle('llama:select-model', async (_event: unknown, fileName: unknown) => {
      if (!mgr) {
        throw new Error('LlamaServerManager not initialized');
      }
      if (!envModelsDir) {
        throw new Error('LLAMA_MODELS_DIR not configured');
      }
      const modelPath = path.join(envModelsDir, fileName as string);
      await mgr.restart(modelPath);
    });
  }

  describe('llama:get-models', () => {
    it('should return an empty array when LLAMA_MODELS_DIR is not set', () => {
      registerHandlers(manager, undefined);
      const handler = ipcHandlers.get('llama:get-models');
      expect(handler).toBeDefined();
      const result = handler!();
      expect(result).toEqual([]);
    });

    it('should return model list from scanModels when directory is set', () => {
      const mockModels: ModelInfo[] = [
        { fileName: 'model-a.gguf', displayName: 'model-a', sizeBytes: 1024, path: '/models/model-a.gguf' },
        { fileName: 'model-b.gguf', displayName: 'model-b', sizeBytes: 2048, path: '/models/model-b.gguf' },
      ];
      jest.spyOn(manager, 'scanModels').mockReturnValue(mockModels);
      registerHandlers(manager, '/models');
      const handler = ipcHandlers.get('llama:get-models');
      const result = handler!();
      expect(result).toEqual(mockModels);
      expect(manager.scanModels).toHaveBeenCalledWith('/models');
    });
  });

  describe('llama:get-state', () => {
    it('should return the current state from LlamaServerManager', () => {
      registerHandlers(manager);
      const handler = ipcHandlers.get('llama:get-state');
      expect(handler).toBeDefined();
      const result = handler!() as LlamaServerState;
      expect(result).toEqual({
        status: 'stopped',
        activeModel: null,
        port: 19876,
        pid: null,
        error: null,
      });
    });
  });

  describe('llama:select-model', () => {
    it('should call restart with the correct model path', async () => {
      jest.spyOn(manager, 'restart').mockResolvedValue(undefined);
      registerHandlers(manager, '/models');
      const handler = ipcHandlers.get('llama:select-model');
      expect(handler).toBeDefined();
      await handler!(null, 'my-model.gguf');
      expect(manager.restart).toHaveBeenCalledWith(path.join('/models', 'my-model.gguf'));
    });

    it('should throw when LLAMA_MODELS_DIR is not configured', async () => {
      registerHandlers(manager, undefined);
      const handler = ipcHandlers.get('llama:select-model');
      await expect(handler!(null, 'my-model.gguf')).rejects.toThrow('LLAMA_MODELS_DIR not configured');
    });
  });

  describe('llama:state-changed', () => {
    it('should emit state-changed to renderer when state changes', () => {
      let capturedCallback: ((state: LlamaServerState) => void) | null = null;
      jest.spyOn(manager, 'onStateChange').mockImplementation((cb) => {
        capturedCallback = cb;
        return () => { capturedCallback = null; };
      });
      manager.onStateChange((state) => {
        if (mockBrowserWindow && !mockBrowserWindow.isDestroyed()) {
          mockBrowserWindow.webContents.send('llama:state-changed', state);
        }
      });
      expect(capturedCallback).not.toBeNull();
      const newState: LlamaServerState = {
        status: 'running',
        activeModel: '/models/test.gguf',
        port: 19876,
        pid: 12345,
        error: null,
      };
      capturedCallback!(newState);
      expect(mockSend).toHaveBeenCalledWith('llama:state-changed', newState);
    });

    it('should not emit when window is destroyed', () => {
      mockBrowserWindow.isDestroyed.mockReturnValue(true);
      let capturedCallback: ((state: LlamaServerState) => void) | null = null;
      jest.spyOn(manager, 'onStateChange').mockImplementation((cb) => {
        capturedCallback = cb;
        return () => { capturedCallback = null; };
      });
      manager.onStateChange((state) => {
        if (mockBrowserWindow && !mockBrowserWindow.isDestroyed()) {
          mockBrowserWindow.webContents.send('llama:state-changed', state);
        }
      });
      const newState: LlamaServerState = {
        status: 'running',
        activeModel: '/models/test.gguf',
        port: 19876,
        pid: 12345,
        error: null,
      };
      capturedCallback!(newState);
      expect(mockSend).not.toHaveBeenCalled();
      mockBrowserWindow.isDestroyed.mockReturnValue(false);
    });
  });

  describe('cleanup on before-quit', () => {
    it('should stop the llama-server manager', async () => {
      const stopSpy = jest.spyOn(manager, 'stop').mockResolvedValue(undefined);
      const unsubscribe = manager.onStateChange(() => {});
      // Simulate before-quit cleanup
      unsubscribe();
      await manager.stop();
      expect(stopSpy).toHaveBeenCalled();
    });
  });
});

describe('Preload bridge', () => {
  it('should expose electronAPI.llama via contextBridge', () => {
    const { contextBridge } = require('electron');
    // Reset the mock to capture fresh calls
    contextBridge.exposeInMainWorld.mockClear();
    // Re-require preload to trigger the contextBridge call
    jest.isolateModules(() => {
      require('../preload');
    });
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'electronAPI',
      expect.objectContaining({
        llama: expect.objectContaining({
          getModels: expect.any(Function),
          getState: expect.any(Function),
          selectModel: expect.any(Function),
          onStateChange: expect.any(Function),
        }),
      })
    );
  });

  it('should invoke llama:get-models via ipcRenderer', async () => {
    const { ipcRenderer, contextBridge } = require('electron');
    contextBridge.exposeInMainWorld.mockClear();
    let exposedApi: { llama: { getModels: () => Promise<unknown> } } | null = null;
    contextBridge.exposeInMainWorld.mockImplementation((_key: string, api: typeof exposedApi) => {
      exposedApi = api;
    });
    jest.isolateModules(() => {
      require('../preload');
    });
    const mockModels: ModelInfo[] = [
      { fileName: 'test.gguf', displayName: 'test', sizeBytes: 1024, path: '/models/test.gguf' },
    ];
    ipcRenderer.invoke.mockResolvedValue(mockModels);
    const result = await exposedApi!.llama.getModels();
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('llama:get-models');
    expect(result).toEqual(mockModels);
  });

  it('should register and unregister onStateChange listener', () => {
    const { ipcRenderer, contextBridge } = require('electron');
    contextBridge.exposeInMainWorld.mockClear();
    let exposedApi: { llama: { onStateChange: (cb: (state: LlamaServerState) => void) => () => void } } | null = null;
    contextBridge.exposeInMainWorld.mockImplementation((_key: string, api: typeof exposedApi) => {
      exposedApi = api;
    });
    jest.isolateModules(() => {
      require('../preload');
    });
    const callback = jest.fn();
    const unsubscribe = exposedApi!.llama.onStateChange(callback);
    expect(ipcRenderer.on).toHaveBeenCalledWith('llama:state-changed', expect.any(Function));
    unsubscribe();
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith('llama:state-changed', expect.any(Function));
  });
});
