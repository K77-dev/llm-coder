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

export class DuplicateNameError extends Error {
  constructor(name: string) {
    super(`Collection with name "${name}" already exists in this scope`);
    this.name = 'DuplicateNameError';
  }
}

export class NotFoundError extends Error {
  constructor(resource: string, identifier: string | number) {
    super(`${resource} ${identifier} not found`);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export interface CollectionRow {
  id: number;
  name: string;
  scope: string;
  project_dir: string | null;
  file_count: number;
  created_at: string;
}

export interface CollectionFileRow {
  id: number;
  collection_id: number;
  file_path: string;
  repo: string;
  indexed_at: string | null;
}
