// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');

import type { LlamaServerState, ModelInfo } from './types';

contextBridge.exposeInMainWorld('electronAPI', {
  llama: {
    getModels(): Promise<ModelInfo[]> {
      return ipcRenderer.invoke('llama:get-models');
    },
    getState(): Promise<LlamaServerState> {
      return ipcRenderer.invoke('llama:get-state');
    },
    selectModel(fileName: string): Promise<void> {
      return ipcRenderer.invoke('llama:select-model', fileName);
    },
    restart(config: { port?: number; execPath?: string; modelsDir?: string }): Promise<void> {
      return ipcRenderer.invoke('llama:restart', config);
    },
    onStateChange(cb: (state: LlamaServerState) => void): () => void {
      const handler = (_event: Electron.IpcRendererEvent, state: LlamaServerState) => {
        cb(state);
      };
      ipcRenderer.on('llama:state-changed', handler);
      return () => {
        ipcRenderer.removeListener('llama:state-changed', handler);
      };
    },
  },
  dialog: {
    selectDirectory(): Promise<string | null> {
      return ipcRenderer.invoke('dialog:select-directory');
    },
    selectFile(): Promise<string | null> {
      return ipcRenderer.invoke('dialog:select-file');
    },
    showConfirm(message: string): Promise<boolean> {
      return ipcRenderer.invoke('dialog:show-confirm', message);
    },
  },
});
