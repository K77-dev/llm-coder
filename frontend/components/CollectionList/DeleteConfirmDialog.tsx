'use client';

import { useEffect, useRef } from 'react';
import { Collection } from '../../lib/api';

interface DeleteConfirmDialogProps {
  collection: Collection | null;
  onClose: () => void;
  onConfirm: (id: number) => void;
}

export function DeleteConfirmDialog({ collection, onClose, onConfirm }: DeleteConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!collection) return;
    setTimeout(() => confirmRef.current?.focus(), 50);
  }, [collection]);

  useEffect(() => {
    if (!collection) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const dialog = document.querySelector('[data-testid="delete-dialog"]');
        if (!dialog) return;
        const focusable = dialog.querySelectorAll<HTMLElement>('button');
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
  }, [collection, onClose]);

  if (!collection) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-testid="delete-dialog"
      onClick={onClose}
      role="alertdialog"
      aria-modal="true"
      aria-label={`Delete collection ${collection.name}`}
    >
      <div
        className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-5 w-80"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
          Delete Collection
        </h3>
        <p className="text-xs text-slate-600 dark:text-neutral-400 mb-4">
          Are you sure you want to delete &quot;{collection.name}&quot;? All indexed data will be removed.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-neutral-700 text-slate-600 dark:text-neutral-300 hover:bg-slate-300 dark:hover:bg-neutral-600"
            data-testid="delete-cancel-btn"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            onClick={() => onConfirm(collection.id)}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700"
            data-testid="delete-confirm-btn"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
