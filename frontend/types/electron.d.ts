export type ServerStatus = 'stopped' | 'starting' | 'running' | 'error';

export interface LlamaServerState {
  status: ServerStatus;
  activeModel: string | null;
  port: number;
  pid: number | null;
  error: string | null;
}

export interface ModelInfo {
  fileName: string;
  displayName: string;
  sizeBytes: number;
  path: string;
}

export interface LlamaAPI {
  getModels(): Promise<ModelInfo[]>;
  getState(): Promise<LlamaServerState>;
  selectModel(fileName: string): Promise<void>;
  onStateChange(cb: (state: LlamaServerState) => void): () => void;
}

export interface ElectronAPI {
  llama: LlamaAPI;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
