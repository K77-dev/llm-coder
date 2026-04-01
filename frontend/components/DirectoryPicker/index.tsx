'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '../../lib/api';

interface BrowseEntry {
  name: string;
  path: string;
  type: 'directory' | 'file';
}

interface BrowseResult {
  path: string;
  parent: string | null;
  entries: BrowseEntry[];
}

interface DirectoryPickerProps {
  mode?: 'directory' | 'files';
  onSelect: (path: string) => void;
  onSelectFiles?: (paths: string[]) => void;
  onClose: () => void;
  existingFiles?: Set<string>;
}

export function DirectoryPicker({
  mode = 'directory',
  onSelect,
  onSelectFiles,
  onClose,
  existingFiles,
}: DirectoryPickerProps) {
  const [result, setResult] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const navigate = useCallback(async (path: string) => {
    setLoading(true);
    setError('');
    try {
      const includeFiles = mode === 'files';
      const { data } = await api.get<BrowseResult>('/browse', {
        params: { path, includeFiles },
      });
      setResult(data);
    } catch {
      setError('Could not open this directory.');
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    navigate('~');
  }, [navigate]);

  const toggleFileSelection = useCallback((filePath: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  }, []);

  const handleAddFolder = useCallback(() => {
    if (!result) return;
    onSelect(result.path);
  }, [result, onSelect]);

  const handleAddSelectedFiles = useCallback(() => {
    if (selectedFiles.size === 0) return;
    onSelectFiles?.(Array.from(selectedFiles));
  }, [selectedFiles, onSelectFiles]);

  const isFileAlreadyAdded = useCallback((filePath: string): boolean => {
    return existingFiles?.has(filePath) ?? false;
  }, [existingFiles]);

  const segments = result?.path
    ? result.path.split('/').filter(Boolean).map((seg, i, arr) => ({
        label: seg,
        path: '/' + arr.slice(0, i + 1).join('/'),
      }))
    : [];

  const isFilesMode = mode === 'files';
  const title = isFilesMode ? 'Select files' : 'Select directory';
  const fileEntries = result?.entries.filter((e) => e.type === 'file') ?? [];
  const dirEntries = result?.entries.filter((e) => e.type === 'directory') ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm"
      data-testid="directory-picker"
    >
      <div className="bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 rounded-xl shadow-2xl w-[520px] max-h-[80vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-neutral-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 dark:hover:text-white text-lg leading-none"
            aria-label="Close picker"
          >
            &#x2715;
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 px-5 py-2 border-b border-slate-200 dark:border-neutral-800 overflow-x-auto">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white shrink-0"
          >
            /
          </button>
          {segments.map((seg, i) => (
            <span key={seg.path} className="flex items-center gap-1 shrink-0">
              <span className="text-slate-300 dark:text-neutral-600 text-xs">/</span>
              <button
                onClick={() => navigate(seg.path)}
                className={`text-xs hover:text-slate-900 dark:hover:text-white ${i === segments.length - 1 ? 'text-blue-500 dark:text-blue-400 font-medium' : 'text-slate-500 dark:text-neutral-400'}`}
              >
                {seg.label}
              </button>
            </span>
          ))}
        </div>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {loading && (
            <p className="text-xs text-slate-400 dark:text-neutral-500 px-2 py-3">Loading...</p>
          )}
          {error && (
            <p className="text-xs text-red-500 dark:text-red-400 px-2 py-3">{error}</p>
          )}
          {!loading && !error && result && (
            <>
              {result.parent && (
                <button
                  onClick={() => navigate(result.parent!)}
                  className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <span className="text-base">&uarr;</span>
                  <span className="text-xs">..</span>
                </button>
              )}
              {result.entries.length === 0 && (
                <p className="text-xs text-slate-400 dark:text-neutral-500 px-3 py-2">
                  {isFilesMode ? 'No files or directories here' : 'Empty directory'}
                </p>
              )}
              {dirEntries.map((entry) => (
                <button
                  key={entry.path}
                  onClick={() => navigate(entry.path)}
                  className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-600 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white transition-colors group"
                  data-testid={`dir-entry-${entry.name}`}
                >
                  <span className="text-sm" role="img" aria-label="folder">&#x1F4C1;</span>
                  <span className="text-xs flex-1">{entry.name}</span>
                  <span className="text-xs text-slate-300 dark:text-neutral-600 group-hover:text-slate-500 dark:group-hover:text-neutral-400">&rsaquo;</span>
                </button>
              ))}
              {isFilesMode && fileEntries.map((entry) => {
                const alreadyAdded = isFileAlreadyAdded(entry.path);
                const isSelected = selectedFiles.has(entry.path);
                return (
                  <button
                    key={entry.path}
                    onClick={() => {
                      if (!alreadyAdded) toggleFileSelection(entry.path);
                    }}
                    disabled={alreadyAdded}
                    className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      alreadyAdded
                        ? 'opacity-50 cursor-not-allowed bg-green-50 dark:bg-green-900/20'
                        : isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-600 dark:text-neutral-300'
                    }`}
                    data-testid={`file-entry-${entry.name}`}
                    aria-label={alreadyAdded ? `${entry.name} (already added)` : entry.name}
                  >
                    {alreadyAdded ? (
                      <span className="text-green-500 text-xs" aria-label="Already added" data-testid={`already-added-${entry.name}`}>&#x2713;</span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="w-3 h-3 rounded border-slate-300 dark:border-neutral-600 text-blue-600 pointer-events-none"
                        aria-label={`Select ${entry.name}`}
                      />
                    )}
                    <span className="text-sm" role="img" aria-label="file">&#x1F4C4;</span>
                    <span className="text-xs flex-1 truncate">{entry.name}</span>
                    {alreadyAdded && (
                      <span className="text-[10px] text-green-500 shrink-0">added</span>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-slate-200 dark:border-neutral-800 px-5 py-4 space-y-3">
          <p className="text-xs text-slate-500 dark:text-neutral-400 truncate">
            <span className="text-slate-400 dark:text-neutral-600">Path: </span>
            <span className="text-slate-700 dark:text-neutral-200">{result?.path ?? '\u2014'}</span>
          </p>
          {isFilesMode ? (
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 text-xs py-2 rounded-lg bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-600 dark:text-neutral-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFolder}
                disabled={!result}
                className="flex-1 text-xs py-2 rounded-lg bg-slate-200 dark:bg-neutral-700 hover:bg-slate-300 dark:hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-neutral-200 font-medium transition-colors"
                data-testid="add-folder-btn"
              >
                Add entire folder
              </button>
              <button
                onClick={handleAddSelectedFiles}
                disabled={selectedFiles.size === 0}
                className="flex-1 text-xs py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
                data-testid="add-files-btn"
              >
                Add {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 text-xs py-2 rounded-lg bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-600 dark:text-neutral-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => result && onSelect(result.path)}
                disabled={!result}
                className="flex-1 text-xs py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
              >
                Select this folder
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
