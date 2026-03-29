import { useToastContext } from '../../components/Toast';
import type { ToastProps } from '../../components/Toast';

export function useToast() {
  const { showToast } = useToastContext();
  return { showToast };
}

export type { ToastProps };
