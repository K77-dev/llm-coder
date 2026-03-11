'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '../../lib/api';

interface BrowseResult {
  path: string;
  parent: string | null;
  entries: { name: string; path: string }[];
}

interface DirectoryPickerProps {
  onSelect: (path: string) => void;
  onClose: () => void;
}

export function DirectoryPicker({ onSelect, onClose }: DirectoryPickerProps) {
  const [result, setResult] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useCallback(async (path: string) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<BrowseResult>('/browse', { params: { path } });
      setResult(data);
    } catch {
      setError('Não foi possível abrir este diretório.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    navigate('~');
  }, [navigate]);

  // Breadcrumb segments from current path
  const segments = result?.path
    ? result.path.split('/').filter(Boolean).map((seg, i, arr) => ({
        label: seg,
        path: '/' + arr.slice(0, i + 1).join('/'),
      }))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 rounded-xl shadow-2xl w-[520px] max-h-[80vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-neutral-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Selecionar diretório</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-white text-lg leading-none">✕</button>
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

        {/* Directory list */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {loading && (
            <p className="text-xs text-slate-400 dark:text-neutral-500 px-2 py-3">Carregando...</p>
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
                  <span className="text-base">↑</span>
                  <span className="text-xs">..</span>
                </button>
              )}
              {result.entries.length === 0 && (
                <p className="text-xs text-slate-400 dark:text-neutral-500 px-3 py-2">Diretório vazio</p>
              )}
              {result.entries.map((entry) => (
                <button
                  key={entry.path}
                  onClick={() => navigate(entry.path)}
                  className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-600 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white transition-colors group"
                >
                  <span className="text-yellow-500 text-sm">📁</span>
                  <span className="text-xs flex-1">{entry.name}</span>
                  <span className="text-xs text-slate-300 dark:text-neutral-600 group-hover:text-slate-500 dark:group-hover:text-neutral-400">›</span>
                </button>
              ))}
            </>
          )}
        </div>

        {/* Current path + actions */}
        <div className="border-t border-slate-200 dark:border-neutral-800 px-5 py-4 space-y-3">
          <p className="text-xs text-slate-500 dark:text-neutral-400 truncate">
            <span className="text-slate-400 dark:text-neutral-600">Selecionado: </span>
            <span className="text-slate-700 dark:text-neutral-200">{result?.path ?? '—'}</span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 text-xs py-2 rounded-lg bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-600 dark:text-neutral-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => result && onSelect(result.path)}
              disabled={!result}
              className="flex-1 text-xs py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
            >
              Selecionar esta pasta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
