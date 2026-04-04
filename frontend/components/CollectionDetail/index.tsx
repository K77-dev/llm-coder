'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Collection,
  CollectionFile,
  fetchCollectionFiles,
  addCollectionFiles,
  removeCollectionFile,
  deleteCollection as apiDeleteCollection,
  reindexCollection,
  fetchIndexingStatus,
  IndexingStatus,
} from '../../lib/api';
import useCollectionStore from '../../stores/collection-store';
import { DirectoryPicker } from '../DirectoryPicker';
import { getProjectDir } from '../CollectionList/get-project-dir';

interface CollectionDetailProps {
  collection: Collection;
  onBack: () => void;
  onDeleted?: () => void;
}

const POLLING_INTERVAL_MS = 3000;
const ERROR_DISPLAY_MS = 3000;

export function CollectionDetail({ collection, onBack, onDeleted }: CollectionDetailProps) {
  const [files, setFiles] = useState<CollectionFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [removing, setRemoving] = useState<Set<number>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const reindexTriggered = useRef(false);
  const { indexingStatus, indexingProgress, setIndexingStatus, fetchCollections } = useCollectionStore();
  const status = indexingStatus[collection.id] as IndexingStatus | undefined;
  const progress = indexingProgress[collection.id] ?? 0;

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCollectionFiles(collection.id);
      setFiles(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load files';
      // Check if collection doesn't exist in backend (404)
      if (message.includes('Not Found') || message.includes('404')) {
        setError('Collection does not exist in the backend. Please go back and create it again.');
      } else {
        setError(message);
      }
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [collection.id]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Auto-reindex once per mount when pending files are detected (e.g. after server restart or DB clear)
  useEffect(() => {
    if (loading || reindexTriggered.current) return;
    const hasPending = files.some((f) => !f.indexedAt);
    if (!hasPending) return;
    reindexTriggered.current = true;
    setIndexingStatus(collection.id, 'indexing');
    reindexCollection(collection.id).catch(() => setIndexingStatus(collection.id, 'error'));
  }, [files, loading, collection.id, setIndexingStatus]);

  useEffect(() => {
    if (status !== 'indexing') return;
    const poll = setInterval(async () => {
      try {
        const result = await fetchIndexingStatus(collection.id);
        setIndexingStatus(collection.id, result.status, result.progress);
        if (result.status !== 'indexing') {
          loadFiles();
          const projectDir = getProjectDir();
          fetchCollections(projectDir);
        }
      } catch {
        setIndexingStatus(collection.id, 'error');
      }
    }, POLLING_INTERVAL_MS);
    return () => clearInterval(poll);
  }, [status, collection.id, setIndexingStatus, loadFiles, fetchCollections]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), ERROR_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [error]);

  const existingFilePaths = useMemo(() => new Set(files.map((f) => f.filePath)), [files]);

  const addToCollection = useCallback(async (filesInput: Array<{ filePath: string; repo: string }>, errorLabel: string) => {
    setPickerOpen(false);
    setIndexingStatus(collection.id, 'indexing');
    try {
      await addCollectionFiles(collection.id, filesInput);
      await loadFiles();
      const projectDir = getProjectDir();
      fetchCollections(projectDir);
    } catch (err) {
      const message = err instanceof Error ? err.message : errorLabel;
      setError(message);
      setIndexingStatus(collection.id, 'error');
    }
  }, [collection.id, setIndexingStatus, loadFiles, fetchCollections]);

  const handleAddFolder = useCallback(async (folderPath: string) => {
    await addToCollection([{ filePath: folderPath, repo: collection.name }], 'Failed to add folder');
  }, [addToCollection, collection.name]);

  const handleAddFiles = useCallback(async (filePaths: string[]) => {
    if (filePaths.length === 0) return;
    const filesInput = filePaths.map((fp) => ({ filePath: fp, repo: collection.name }));
    await addToCollection(filesInput, 'Failed to add files');
  }, [addToCollection, collection.name]);

  const handleRemoveFile = useCallback(async (file: CollectionFile) => {
    setRemoving((prev) => new Set(prev).add(file.id));
    try {
      await removeCollectionFile(collection.id, file.id);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      const projectDir = getProjectDir();
      fetchCollections(projectDir);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove file';
      setError(message);
    } finally {
      setRemoving((prev) => {
        const next = new Set(prev);
        next.delete(file.id);
        return next;
      });
    }
  }, [collection.id, fetchCollections]);

  const handleDeleteCollection = useCallback(async () => {
    setDeleting(true);
    try {
      await apiDeleteCollection(collection.id);
      const projectDir = getProjectDir();
      fetchCollections(projectDir);
      onDeleted ? onDeleted() : onBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete collection';
      setError(message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  }, [collection.id, fetchCollections, onBack, onDeleted]);

  const getFileName = (filePath: string): string => {
    const parts = filePath.split('/');
    return parts[parts.length - 1] || filePath;
  };

  const getStatusLabel = (indexedAt: string | null): string => {
    if (!indexedAt) return 'Pending';
    return 'Indexed';
  };

  const getStatusColor = (indexedAt: string | null): string => {
    if (!indexedAt) return 'text-yellow-500';
    return 'text-green-500';
  };

  const handleOpenPicker = useCallback(async () => {
    // Refetch to ensure backend and frontend are in sync
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCollectionFiles(collection.id);
      setFiles(result);
      setPickerOpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load files';
      if (message.includes('Not Found') || message.includes('404')) {
        setError('Collection does not exist in the backend. Please go back and try again.');
      } else {
        setError(message);
      }
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [collection.id]);

  return (
    <div data-testid="collection-detail">
      {/* Header with back button */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={onBack}
          className="text-xs text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
          aria-label="Back to collections list"
          data-testid="back-btn"
        >
          &larr;
        </button>
        <h3 className="text-xs font-medium text-slate-700 dark:text-neutral-300 truncate flex-1">
          {collection.name}
        </h3>
        <span className="text-[10px] text-slate-400 dark:text-neutral-500">
          {files.length} file{files.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => setConfirmDelete(true)}
          className="text-[10px] text-slate-400 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0 ml-1"
          title="Apagar collection"
          aria-label="Apagar collection"
          data-testid="delete-collection-btn"
        >
          &#x1F5D1;
        </button>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-xs text-red-600 dark:text-red-400 mb-2">
            Apagar &ldquo;{collection.name}&rdquo; e remover todos os seus arquivos do RAG?
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDeleteCollection}
              disabled={deleting}
              className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded"
              data-testid="confirm-delete-collection-btn"
            >
              {deleting ? 'Apagando...' : 'Apagar'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs px-2 py-1 bg-slate-200 dark:bg-neutral-700 text-slate-600 dark:text-neutral-300 hover:bg-slate-300 dark:hover:bg-neutral-600 rounded"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Collection-level indexing status */}
      {status === 'indexing' && (
        <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg" data-testid="indexing-banner">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-[10px] text-blue-600 dark:text-blue-400">Indexing in progress... {progress}%</span>
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg" data-testid="error-banner">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
          <span className="text-[10px] text-red-600 dark:text-red-400 flex-1">Indexing failed — check if the embedding model is running</span>
          <button
            onClick={() => {
              setIndexingStatus(collection.id, 'indexing');
              reindexCollection(collection.id).catch(() => setIndexingStatus(collection.id, 'error'));
            }}
            className="text-[10px] text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline shrink-0"
            data-testid="retry-indexing-btn"
          >
            Retry
          </button>
        </div>
      )}

      {/* Add button */}
      <button
        onClick={handleOpenPicker}
        className="w-full text-xs py-2 mb-3 rounded-lg border border-dashed border-slate-300 dark:border-neutral-600 text-slate-500 dark:text-neutral-400 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors"
        data-testid="add-files-btn"
        aria-label="Add files to collection"
      >
        + Add files or folder
      </button>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400 mb-2" data-testid="detail-error">
          {error}
        </p>
      )}

      {/* Loading */}
      {loading && (
        <p className="text-xs text-slate-400 dark:text-neutral-500" data-testid="loading-files">
          Loading files...
        </p>
      )}

      {/* Empty state */}
      {!loading && files.length === 0 && !error && (
        <p className="text-xs text-slate-400 dark:text-neutral-500" data-testid="empty-files">
          No files in this collection. Click the button above to add files.
        </p>
      )}

      {/* File list */}
      {!loading && files.length > 0 && (
        <div className="space-y-0.5" role="list" aria-label="Collection files" data-testid="file-list">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 group"
              role="listitem"
              data-testid={`file-item-${file.id}`}
            >
              <span className="text-sm shrink-0" role="img" aria-label="file">&#x1F4C4;</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-700 dark:text-neutral-300 truncate" title={file.filePath}>
                  {getFileName(file.filePath)}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-neutral-500 truncate" title={file.filePath}>
                  {file.filePath}
                </p>
              </div>
              <span
                className={`text-[10px] shrink-0 ${getStatusColor(file.indexedAt)}`}
                data-testid={`file-status-${file.id}`}
                aria-label={`Indexing status: ${getStatusLabel(file.indexedAt)}`}
              >
                {getStatusLabel(file.indexedAt)}
              </span>
              <button
                onClick={() => handleRemoveFile(file)}
                disabled={removing.has(file.id)}
                className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-500 disabled:opacity-50 transition-opacity shrink-0"
                aria-label={`Remove ${getFileName(file.filePath)} from collection`}
                data-testid={`remove-file-${file.id}`}
              >
                &#x2715;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* DirectoryPicker in files mode */}
      {pickerOpen && (
        <DirectoryPicker
          mode="files"
          onSelect={handleAddFolder}
          onSelectFiles={handleAddFiles}
          onClose={() => setPickerOpen(false)}
          existingFiles={existingFilePaths}
        />
      )}
    </div>
  );
}
