import { useEffect, useRef } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ContextMenu({ x, y, onRename, onDelete, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 min-w-[120px]"
      style={{ left: x, top: y }}
      data-testid="context-menu"
      role="menu"
    >
      <button
        className="w-full text-left text-xs px-3 py-1.5 text-slate-700 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-700"
        onClick={onRename}
        role="menuitem"
        data-testid="ctx-rename"
      >
        Rename
      </button>
      <button
        className="w-full text-left text-xs px-3 py-1.5 text-red-500 hover:bg-slate-100 dark:hover:bg-neutral-700"
        onClick={onDelete}
        role="menuitem"
        data-testid="ctx-delete"
      >
        Delete
      </button>
    </div>
  );
}
