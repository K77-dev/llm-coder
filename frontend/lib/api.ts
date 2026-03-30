import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  model?: 'local' | 'claude' | 'auto';
  history?: ChatMessage[];
  filter?: { repo?: string; language?: string };
  stream?: boolean;
  projectDir?: string;
  collectionIds?: number[];
  ragMinScore?: number;
  ragTopK?: number;
}

export interface ChatSource {
  repo: string;
  filePath: string;
  language: string;
  score: number;
}

export interface FileChange {
  path: string;
  content: string;
}

export interface RenameChange {
  from: string;
  to: string;
}

export interface DeleteChange {
  path: string;
}

export interface ListDir {
  path: string;
}

export interface ListSubdirs {
  path: string;
}

export interface ListTree {
  path: string;
}

export interface CreateDir {
  path: string;
}

export interface DeleteDir {
  path: string;
}

export interface TreeEntry {
  name: string;
  type: 'file' | 'dir';
  size?: number;
  children?: TreeEntry[];
}

export interface SearchFiles {
  path: string;
  query: string;
}

export interface DirEntry {
  name: string;
  type: 'file' | 'dir';
  size?: number;
}

export interface SearchResult {
  path: string;
  type: 'file' | 'dir';
}

export interface CommandSuggestion {
  command: string;
  cwd?: string;
  description?: string;
}

export interface ChatResponse {
  response: string;
  codeBlocks: Array<{ language: string; code: string }>;
  fileChanges: FileChange[];
  renames: RenameChange[];
  deletes: DeleteChange[];
  createDirs: CreateDir[];
  deleteDirs: DeleteDir[];
  listDirs: ListDir[];
  listSubdirs: ListSubdirs[];
  listTrees: ListTree[];
  searchFiles: SearchFiles[];
  commands: CommandSuggestion[];
  model: 'local' | 'claude';
  sources: ChatSource[];
}

export async function execCommand(
  command: string,
  cwd?: string,
  onChunk?: (type: string, data: string) => void
): Promise<number> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const response = await fetch(`${API_BASE}/api/exec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, cwd }),
  });

  if (!response.body) throw new Error('No response body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let exitCode = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value).split('\n');
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6);
      if (payload === '[DONE]') return exitCode;
      try {
        const { type, data } = JSON.parse(payload);
        if (type === 'exit') exitCode = Number(data);
        onChunk?.(type, data);
      } catch { /* skip */ }
    }
  }
  return exitCode;
}

export async function sendChat(request: ChatRequest): Promise<ChatResponse> {
  const { data } = await api.post<ChatResponse>('/chat', request);
  return data;
}

export async function* streamChat(request: ChatRequest): AsyncGenerator<string> {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...request, stream: true }),
  });

  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          if (parsed.text) yield parsed.text;
        } catch {
          // Skip malformed chunks
        }
      }
    }
  }
}

export async function checkHealth() {
  const { data } = await api.get('/health');
  return data;
}

export interface IndexResponse {
  status: string;
  name: string;
  path: string;
  message: string;
}

export async function indexDirectory(dirPath: string, name?: string): Promise<IndexResponse> {
  const { data } = await api.post<IndexResponse>('/index', { dirPath, name });
  return data;
}

export async function getIndexStatus(): Promise<{ isIndexing: boolean }> {
  const { data } = await api.get('/index/status');
  return data;
}

export async function clearIndex(repo?: string): Promise<{ status: string; removed?: number; message?: string }> {
  const url = repo ? `/index/${encodeURIComponent(repo)}` : '/index';
  const { data } = await api.delete(url);
  return data;
}

export async function writeFile(filePath: string, content: string): Promise<{ status: string; path: string }> {
  const { data } = await api.post('/files/write', { path: filePath, content });
  return data;
}

export async function renameFile(from: string, to: string): Promise<{ status: string; from: string; to: string }> {
  const { data } = await api.post('/files/rename', { from, to });
  return data;
}

export async function deleteFile(filePath: string): Promise<{ status: string; path: string }> {
  const { data } = await api.delete('/files/delete', { data: { path: filePath } });
  return data;
}

export async function createDir(dirPath: string): Promise<{ status: string; path: string }> {
  const { data } = await api.post('/files/mkdir', { path: dirPath });
  return data;
}

export async function deleteDir(dirPath: string): Promise<{ status: string; path: string }> {
  const { data } = await api.delete('/files/rmdir', { data: { path: dirPath } });
  return data;
}

export async function listDir(dirPath: string): Promise<{ path: string; entries: DirEntry[] }> {
  const { data } = await api.get('/files/list', { params: { path: dirPath } });
  return data;
}

export async function listSubdirs(dirPath: string): Promise<{ path: string; entries: DirEntry[] }> {
  const { data } = await api.get('/files/list', { params: { path: dirPath, type: 'dir' } });
  return data;
}

export async function searchFiles(dirPath: string, query: string): Promise<{ path: string; query: string; results: SearchResult[] }> {
  const { data } = await api.get('/files/search', { params: { path: dirPath, query } });
  return data;
}

export async function listTree(dirPath: string, depth?: number): Promise<{ path: string; tree: TreeEntry[] }> {
  const { data } = await api.get('/files/tree', { params: { path: dirPath, depth } });
  return data;
}

export async function readFile(filePath: string): Promise<{ path: string; content: string }> {
  const { data } = await api.get('/files/read', { params: { path: filePath } });
  return data;
}

// Llama models API

export interface LlamaModelInfo {
  fileName: string;
  displayName: string;
  sizeBytes: number;
  path: string;
}

export interface LlamaModelsResponse {
  models: LlamaModelInfo[];
  status: 'available' | 'no_directory';
}

export interface LlamaSelectResponse {
  success: boolean;
  activeModel: string;
}

export interface LlamaStatusResponse {
  activeModel: string | null;
  status: 'stopped' | 'starting' | 'running' | 'error';
  pid: number | null;
}

export async function getLlamaModels(): Promise<LlamaModelsResponse> {
  const { data } = await api.get<LlamaModelsResponse>('/llama/models');
  return data;
}

export async function selectLlamaModel(fileName: string): Promise<LlamaSelectResponse> {
  const { data } = await api.post<LlamaSelectResponse>('/llama/select', { fileName });
  return data;
}

export async function getLlamaStatus(): Promise<LlamaStatusResponse> {
  const { data } = await api.get<LlamaStatusResponse>('/llama/status');
  return data;
}

// Llama settings API

export interface LlamaSettings {
  llamaModelsDir: string;
  llamaServerPort: number;
  llamaServerPath: string;
  embeddingModel: string;
  embeddingServerPort: number;
  embeddingModelFile: string;
  contextSize: number;
  batchSize: number;
  maxMemoryMb: number;
  cacheTtl: number;
  lruCacheSize: number;
}

export interface SaveSettingsResponse {
  settings: LlamaSettings;
  restartRequired: boolean;
}

export async function getLlamaSettings(): Promise<LlamaSettings> {
  const { data } = await api.get<LlamaSettings>('/llama/settings');
  return data;
}

export async function updateLlamaSettings(settings: LlamaSettings): Promise<SaveSettingsResponse> {
  const { data } = await api.put<SaveSettingsResponse>('/llama/settings', settings);
  return data;
}

export async function restartLlamaServer(): Promise<void> {
  await api.post('/llama/restart');
}

// Collections API

export interface Collection {
  id: number;
  name: string;
  scope: 'local' | 'global';
  projectDir: string | null;
  fileCount: number;
  createdAt: string;
}

export interface CollectionFile {
  id: number;
  collectionId: number;
  filePath: string;
  repo: string;
  indexedAt: string | null;
}

export interface CreateCollectionParams {
  name: string;
  scope: 'local' | 'global';
  projectDir?: string;
}

export interface CollectionFileInput {
  filePath: string;
  repo: string;
}

export type IndexingStatus = 'idle' | 'indexing' | 'done' | 'error';

export async function fetchCollections(projectDir?: string): Promise<Collection[]> {
  const params = projectDir ? { projectDir } : {};
  const { data } = await api.get<Collection[]>('/collections', { params });
  return data;
}

export async function createCollection(params: CreateCollectionParams): Promise<Collection> {
  const { data } = await api.post<Collection>('/collections', params);
  return data;
}

export async function renameCollection(id: number, name: string): Promise<Collection> {
  const { data } = await api.put<Collection>(`/collections/${id}`, { name });
  return data;
}

export async function deleteCollection(id: number): Promise<void> {
  await api.delete(`/collections/${id}`);
}

export async function fetchCollectionFiles(collectionId: number): Promise<CollectionFile[]> {
  const { data } = await api.get<CollectionFile[]>(`/collections/${collectionId}/files`);
  return data;
}

export async function addCollectionFiles(
  collectionId: number,
  files: CollectionFileInput[]
): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>(
    `/collections/${collectionId}/files`,
    { files }
  );
  return data;
}

export async function removeCollectionFile(collectionId: number, fileId: number): Promise<void> {
  await api.delete(`/collections/${collectionId}/files/${fileId}`);
}

export interface IndexingStatusResponse {
  status: IndexingStatus;
  progress: number;
}

export async function fetchIndexingStatus(collectionId: number): Promise<IndexingStatusResponse> {
  const { data } = await api.get<IndexingStatusResponse>(`/collections/${collectionId}/status`);
  return data;
}

export async function reindexCollection(collectionId: number): Promise<void> {
  await api.post(`/collections/${collectionId}/reindex`);
}
