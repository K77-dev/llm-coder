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
});
