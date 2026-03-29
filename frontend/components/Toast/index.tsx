'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  duration?: number;
}

interface ToastEntry extends ToastProps {
  id: string;
}

interface ToastContextType {
  showToast: (toast: ToastProps) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

const DEFAULT_DURATION = 3000;

function ToastItem({ id, message, type, duration = DEFAULT_DURATION, onRemove }: ToastEntry & { onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const showTimer = requestAnimationFrame(() => setVisible(true));
    const exitTimer = setTimeout(() => {
      setExiting(true);
    }, duration - 300);
    const removeTimer = setTimeout(() => {
      onRemove(id);
    }, duration);
    return () => {
      cancelAnimationFrame(showTimer);
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, [id, duration, onRemove]);

  const baseClasses = 'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 pointer-events-auto max-w-sm';
  const typeClasses = type === 'success'
    ? 'bg-green-600 text-white dark:bg-green-700'
    : 'bg-red-600 text-white dark:bg-red-700';
  const animationClasses = !visible || exiting
    ? 'opacity-0 translate-y-2'
    : 'opacity-100 translate-y-0';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`${baseClasses} ${typeClasses} ${animationClasses}`}
      data-testid={`toast-${type}`}
    >
      <span className="flex-shrink-0">
        {type === 'success' ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </span>
      <span>{message}</span>
    </div>
  );
}

function ToastContainer({ toasts, onRemove }: { toasts: ToastEntry[]; onRemove: (id: string) => void }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      data-testid="toast-container"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} id={toast.id} message={toast.message} type={toast.type} duration={toast.duration} onRemove={onRemove} />
      ))}
    </div>,
    document.body,
  );
}

let toastCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((toast: ToastProps) => {
    toastCounter += 1;
    const id = `toast-${toastCounter}-${Date.now()}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToastContext(): ToastContextType {
  return useContext(ToastContext);
}

export type { ToastProps, ToastEntry, ToastContextType };
