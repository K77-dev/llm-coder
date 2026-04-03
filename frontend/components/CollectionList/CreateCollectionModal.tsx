'use client';

import { useEffect, useState, useRef } from 'react';
import { getProjectDir } from './get-project-dir';

interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, scope: 'local' | 'global') => void;
}

export function CreateCollectionModal({ isOpen, onClose, onSubmit }: CreateCollectionModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setError('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const modal = document.querySelector('[data-testid="create-collection-modal"]');
        if (!modal) return;
        const focusable = modal.querySelectorAll<HTMLElement>(
          'input, button, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    setError('');
  };

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Collection name is required');
      return;
    }
    const projectDir = getProjectDir();
    const autoScope = projectDir ? 'local' : 'global';
    onSubmit(trimmed, autoScope);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-testid="create-collection-modal"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Create collection"
    >
      <div
        className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-5 w-80"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
          New Collection
        </h3>
        <div className="space-y-3">
          <div>
            <label htmlFor="collection-name" className="block text-xs text-slate-500 dark:text-neutral-400 mb-1">
              Name
            </label>
            <input
              id="collection-name"
              ref={inputRef}
              type="text"
              value={name}
              onChange={handleNameChange}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder="e.g. Backend API"
              className="w-full text-xs bg-slate-100 dark:bg-neutral-700 text-slate-800 dark:text-neutral-200 placeholder-slate-400 dark:placeholder-neutral-500 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              data-testid="collection-name-input"
            />
            {error && (
              <p className="text-xs text-red-400 mt-1" data-testid="create-error">
                {error}
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-neutral-700 text-slate-600 dark:text-neutral-300 hover:bg-slate-300 dark:hover:bg-neutral-600"
            data-testid="create-cancel-btn"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            data-testid="create-submit-btn"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
