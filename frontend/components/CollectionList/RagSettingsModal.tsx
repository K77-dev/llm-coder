'use client';

import { useEffect, useRef, useState } from 'react';
import useRagSettingsStore from '../../stores/rag-settings-store';
import useCollectionStore from '../../stores/collection-store';
import { reindexCollection } from '../../lib/api';

interface RagSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RagSettingsModal({ isOpen, onClose }: RagSettingsModalProps) {
  const { minScore, topK, setMinScore, setTopK, reset } = useRagSettingsStore();
  const [localMinScore, setLocalMinScore] = useState(minScore);
  const [localTopK, setLocalTopK] = useState(topK);
  const [reindexing, setReindexing] = useState(false);
  const [reindexMsg, setReindexMsg] = useState('');
  const backdropRef = useRef<HTMLDivElement>(null);
  const collections = useCollectionStore((s) => s.collections);

  useEffect(() => {
    if (isOpen) {
      setLocalMinScore(minScore);
      setLocalTopK(topK);
    }
  }, [isOpen, minScore, topK]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = () => {
    setMinScore(localMinScore);
    setTopK(localTopK);
    onClose();
  };

  const handleReset = () => {
    reset();
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className="bg-[#252526] border border-[#3e3e3e] rounded-lg shadow-xl w-80 p-5">
        <h2 className="text-sm font-semibold text-neutral-200 mb-4">RAG Search Settings</h2>

        <div className="space-y-4">
          {/* Min Score */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-neutral-400">Min Score (similarity)</label>
              <span className="text-xs font-mono text-neutral-300">{localMinScore.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={localMinScore}
              onChange={(e) => setLocalMinScore(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 mt-0.5">
              <span>0 (all)</span>
              <span>1 (exact)</span>
            </div>
          </div>

          {/* Top K */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-neutral-400">Top K (max results)</label>
              <span className="text-xs font-mono text-neutral-300">{localTopK}</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={localTopK}
              onChange={(e) => setLocalTopK(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 mt-0.5">
              <span>1</span>
              <span>50</span>
            </div>
          </div>
        </div>

        {/* Reindex */}
        <div className="mt-4 pt-4 border-t border-[#3e3e3e]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-400">Reindex all collections</p>
              <p className="text-[10px] text-neutral-500">Regenerate embeddings for all files</p>
            </div>
            <button
              onClick={async () => {
                if (reindexing || collections.length === 0) return;
                setReindexing(true);
                setReindexMsg('');
                try {
                  for (const c of collections) {
                    await reindexCollection(c.id);
                  }
                  setReindexMsg('Done!');
                } catch {
                  setReindexMsg('Error');
                }
                setReindexing(false);
              }}
              disabled={reindexing || collections.length === 0}
              className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
            >
              {reindexing ? 'Reindexing...' : 'Reindex'}
            </button>
          </div>
          {reindexMsg && (
            <p className={`text-[10px] mt-1 ${reindexMsg === 'Done!' ? 'text-green-400' : 'text-red-400'}`}>
              {reindexMsg}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-5">
          <button
            onClick={handleReset}
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Reset defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
