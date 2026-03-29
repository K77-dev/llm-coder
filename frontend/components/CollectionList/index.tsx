'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import useCollectionStore from '../../stores/collection-store';
import {
  Collection,
  createCollection as apiCreateCollection,
  renameCollection as apiRenameCollection,
  deleteCollection as apiDeleteCollection,
} from '../../lib/api';
import { CreateCollectionModal } from './CreateCollectionModal';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { ContextMenu } from './ContextMenu';
import { IndexingStatusIndicator } from './IndexingStatusIndicator';
import { ScopeBadge } from './ScopeBadge';
import { getProjectDir } from './get-project-dir';

const CRUD_ERROR_DISPLAY_MS = 3000;

interface CollectionListProps {
  onSelectCollection?: (collection: Collection) => void;
}

export function CollectionList({ onSelectCollection }: CollectionListProps = {}) {
  const {
    collections,
    selectedIds,
    indexingStatus,
    loading,
    error,
    fetchCollections,
    toggleSelection,
    selectAll,
    deselectAll,
  } = useCollectionStore();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [crudError, setCrudError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ collection: Collection; x: number; y: number } | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const projectDir = getProjectDir();
    fetchCollections(projectDir);
  }, [fetchCollections]);

  useEffect(() => {
    if (renamingId !== null) {
      setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }, 50);
    }
  }, [renamingId]);

  useEffect(() => {
    if (!crudError) return;
    const timer = setTimeout(() => setCrudError(null), CRUD_ERROR_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [crudError]);

  const allSelected = collections.length > 0 && collections.every((c) => selectedIds.has(c.id));
  const someSelected = collections.some((c) => selectedIds.has(c.id)) && !allSelected;

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      deselectAll();
    } else {
      selectAll();
    }
  }, [allSelected, deselectAll, selectAll]);

  const handleCreate = useCallback(async (name: string, scope: 'local' | 'global') => {
    try {
      const projectDir = getProjectDir();
      await apiCreateCollection({ name, scope, projectDir });
      setCreateModalOpen(false);
      await fetchCollections(projectDir);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create collection';
      setCrudError(message);
    }
  }, [fetchCollections]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await apiDeleteCollection(id);
      setDeleteTarget(null);
      const projectDir = getProjectDir();
      await fetchCollections(projectDir);
    } catch (err) {
      setDeleteTarget(null);
      const message = err instanceof Error ? err.message : 'Failed to delete collection';
      setCrudError(message);
    }
  }, [fetchCollections]);

  const handleRenameSubmit = useCallback(async (id: number) => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingId(null);
      return;
    }
    try {
      await apiRenameCollection(id, trimmed);
      setRenamingId(null);
      const projectDir = getProjectDir();
      await fetchCollections(projectDir);
    } catch (err) {
      setRenamingId(null);
      const message = err instanceof Error ? err.message : 'Failed to rename collection';
      setCrudError(message);
    }
  }, [renameValue, fetchCollections]);

  const startRename = useCallback((collection: Collection) => {
    setRenamingId(collection.id);
    setRenameValue(collection.name);
    setContextMenu(null);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, collection: Collection) => {
    e.preventDefault();
    setContextMenu({ collection, x: e.clientX, y: e.clientY });
  }, []);

  const handleDoubleClick = useCallback((collection: Collection) => {
    startRename(collection);
  }, [startRename]);

  return (
    <div data-testid="collection-list">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
          Collections
        </h3>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCreateModalOpen(true)}
            className="text-xs px-1.5 py-0.5 rounded bg-slate-200 dark:bg-neutral-700 text-slate-600 dark:text-neutral-300 hover:bg-slate-300 dark:hover:bg-neutral-600"
            title="Create collection"
            aria-label="Create collection"
            data-testid="create-collection-btn"
          >
            +
          </button>
          <label className="flex items-center gap-1 cursor-pointer" title="Select all collections">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = someSelected; }}
              onChange={handleSelectAll}
              className="w-3 h-3 rounded border-slate-300 dark:border-neutral-600 text-blue-600 focus:ring-blue-500"
              aria-label="Select all collections"
              data-testid="select-all-checkbox"
            />
            <span className="text-[10px] text-slate-400 dark:text-neutral-500">All</span>
          </label>
        </div>
      </div>

      {loading && (
        <p className="text-xs text-slate-400 dark:text-neutral-500" data-testid="loading-indicator">
          Loading...
        </p>
      )}

      {error && (
        <p className="text-xs text-red-400" data-testid="error-message">
          {error}
        </p>
      )}

      {crudError && (
        <p className="text-xs text-red-400 mb-1" data-testid="crud-error-message">
          {crudError}
        </p>
      )}

      {!loading && !error && collections.length === 0 && (
        <p className="text-xs text-slate-400 dark:text-neutral-500" data-testid="empty-message">
          No collections yet. Click + to create one.
        </p>
      )}

      <div className="space-y-0.5" role="list" aria-label="Collections list">
        {collections.map((collection) => (
          <div
            key={collection.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 group"
            onContextMenu={(e) => handleContextMenu(e, collection)}
            onDoubleClick={() => handleDoubleClick(collection)}
            role="listitem"
            aria-label={`Collection ${collection.name}, ${collection.fileCount} files, ${collection.scope}`}
            data-testid={`collection-item-${collection.id}`}
          >
            <input
              type="checkbox"
              checked={selectedIds.has(collection.id)}
              onChange={() => toggleSelection(collection.id)}
              className="w-3 h-3 rounded border-slate-300 dark:border-neutral-600 text-blue-600 focus:ring-blue-500 shrink-0"
              aria-label={`Select collection ${collection.name} for RAG context`}
              data-testid={`checkbox-${collection.id}`}
            />
            {renamingId === collection.id ? (
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => handleRenameSubmit(collection.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit(collection.id);
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                className="flex-1 min-w-0 text-xs bg-slate-100 dark:bg-neutral-700 text-slate-800 dark:text-neutral-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                data-testid={`rename-input-${collection.id}`}
              />
            ) : (
              <button
                onClick={() => onSelectCollection?.(collection)}
                className="flex-1 min-w-0 text-xs text-slate-700 dark:text-neutral-300 truncate text-left hover:text-blue-500 dark:hover:text-blue-400"
                data-testid={`collection-name-${collection.id}`}
                aria-label={`Open collection ${collection.name}`}
              >
                {collection.name}
              </button>
            )}
            <span className="text-[10px] text-slate-400 dark:text-neutral-500 shrink-0">
              ({collection.fileCount})
            </span>
            <IndexingStatusIndicator status={indexingStatus[collection.id]} />
            <ScopeBadge scope={collection.scope} />
          </div>
        ))}
      </div>

      <CreateCollectionModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteConfirmDialog
        collection={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onRename={() => startRename(contextMenu.collection)}
          onDelete={() => {
            setDeleteTarget(contextMenu.collection);
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
