'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { getLlamaModels, selectLlamaModel, getLlamaStatus } from '../../lib/api';
import { getHiddenModels } from '../SettingsModal';

type ServerStatus = 'stopped' | 'starting' | 'running' | 'error';

interface LlamaServerState {
  status: ServerStatus;
  activeModel: string | null;
  port: number;
  pid: number | null;
  error: string | null;
}

interface ModelInfo {
  fileName: string;
  displayName: string;
  sizeBytes: number;
  path: string;
}

type TransportMode = 'ipc' | 'http';

const POLLING_INTERVAL_MS = 5000;

function isElectronAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI?.llama;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1_073_741_824) {
    return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  }
  if (bytes >= 1_048_576) {
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatErrorMessage(error: string): string {
  const lower = error.toLowerCase();
  if (lower.includes('not found') || lower.includes('enoent')) {
    return 'llama-server nao encontrado. Verifique o caminho em Settings.';
  }
  if (lower.includes('out of memory') || lower.includes('outofmemory') || lower.includes('insufficient memory')) {
    return 'Memoria insuficiente para carregar o modelo. Tente um modelo menor.';
  }
  if (lower.includes('health check timed out')) {
    return 'O modelo demorou demais para carregar. Tente novamente ou use um modelo menor.';
  }
  if (lower.includes('address already in use') || lower.includes('eaddrinuse')) {
    return 'A porta ja esta em uso. Feche outros processos ou mude a porta em Settings.';
  }
  if (lower.includes('exited with code')) {
    return 'O servidor parou inesperadamente. Tente recarregar o modelo.';
  }
  if (lower.includes('500') || lower.includes('internal server error')) {
    return 'Erro interno no servidor. O modelo pode nao ser compativel.';
  }
  return 'Ocorreu um erro no servidor LLM.';
}

const STATUS_CONFIG: Record<ServerStatus, { color: string; label: string }> = {
  running: { color: 'bg-green-400', label: 'Running' },
  starting: { color: 'bg-yellow-400', label: 'Starting...' },
  error: { color: 'bg-red-400', label: 'Error' },
  stopped: { color: 'bg-slate-400 dark:bg-neutral-500', label: 'Stopped' },
};

async function fetchModelsHTTP(): Promise<ModelInfo[]> {
  try {
    const result = await getLlamaModels();
    return result.models;
  } catch {
    return [];
  }
}

async function selectModelHTTP(fileName: string): Promise<void> {
  await selectLlamaModel(fileName);
}

async function fetchStatusHTTP(): Promise<{ activeModel: string | null; status: ServerStatus }> {
  try {
    const result = await getLlamaStatus();
    return { activeModel: result.activeModel, status: result.status };
  } catch {
    return { activeModel: null, status: 'stopped' };
  }
}

interface ModelSelectorProps {
  collapsed?: boolean;
}

export function ModelSelector({ collapsed = false }: ModelSelectorProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [serverState, setServerState] = useState<LlamaServerState>({
    status: 'stopped',
    activeModel: null,
    port: 8080,
    pid: null,
    error: null,
  });
  const [isExpanded, setIsExpanded] = useState(true);
  const [loadingModel, setLoadingModel] = useState<string | null>(null);
  const [transport] = useState<TransportMode>(() => isElectronAvailable() ? 'ipc' : 'http');
  const [hiddenModels, setHiddenModels] = useState<Set<string>>(() => getHiddenModels());
  const listRef = useRef<HTMLUListElement>(null);

  const visibleModels = useMemo(
    () => models.filter((m) => !hiddenModels.has(m.fileName)),
    [models, hiddenModels]
  );

  const fetchModels = useCallback(async () => {
    if (transport === 'ipc') {
      try {
        const result = await window.electronAPI!.llama.getModels();
        setModels(result);
      } catch {
        setModels([]);
      }
    } else {
      const result = await fetchModelsHTTP();
      setModels(result);
    }
  }, [transport]);

  const fetchState = useCallback(async () => {
    if (transport === 'ipc') {
      try {
        const state = await window.electronAPI!.llama.getState();
        setServerState(state);
      } catch {
        // Keep current state on error
      }
    } else {
      const { activeModel, status } = await fetchStatusHTTP();
      setServerState((prev) => ({
        ...prev,
        activeModel,
        status,
      }));
    }
  }, [transport]);

  useEffect(() => {
    fetchModels();
    fetchState();
  }, [fetchModels, fetchState]);

  useEffect(() => {
    const handleVisibilityChange = () => setHiddenModels(getHiddenModels());
    window.addEventListener('models:visibility-changed', handleVisibilityChange);
    return () => window.removeEventListener('models:visibility-changed', handleVisibilityChange);
  }, []);

  // IPC state change listener
  useEffect(() => {
    if (transport !== 'ipc' || !isElectronAvailable()) return;
    const unsubscribe = window.electronAPI!.llama.onStateChange((state) => {
      setServerState(state);
      if (state.status !== 'starting') {
        setLoadingModel(null);
      }
    });
    return unsubscribe;
  }, [transport]);

  // HTTP polling for status updates
  useEffect(() => {
    if (transport !== 'http') return;
    const interval = setInterval(() => {
      fetchState();
    }, POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [transport, fetchState]);

  const handleSelectModel = useCallback(async (fileName: string) => {
    if (fileName === serverState.activeModel) return;
    setLoadingModel(fileName);
    window.dispatchEvent(new CustomEvent('llm:model-changing'));
    try {
      if (transport === 'ipc') {
        await window.electronAPI!.llama.selectModel(fileName);
      } else {
        await selectModelHTTP(fileName);
        setServerState((prev) => ({
          ...prev,
          activeModel: fileName,
          status: 'starting',
        }));
      }
    } catch {
      setLoadingModel(null);
    }
  }, [serverState.activeModel, transport]);

  const handleRefresh = useCallback(() => {
    fetchModels();
  }, [fetchModels]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent, fileName: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSelectModel(fileName);
    }
  }, [handleSelectModel]);

  if (collapsed) {
    return null;
  }

  const statusConfig = STATUS_CONFIG[serverState.status];
  const isStarting = serverState.status === 'starting';
  const hasError = serverState.status === 'error';
  const hasNoModels = visibleModels.length === 0;

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left group"
        aria-expanded={isExpanded}
        aria-controls="model-selector-list"
      >
        <h3 className="text-xs font-medium text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
          Local Models
        </h3>
        <span className="text-xs text-slate-400 dark:text-neutral-500 group-hover:text-slate-600 dark:group-hover:text-neutral-300 transition-colors">
          {isExpanded ? '\u25B4' : '\u25BE'}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2" id="model-selector-list">
          {/* Server status */}
          <div
            className="flex items-center justify-between"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.color} ${isStarting ? 'animate-pulse' : ''}`} />
              <span className="text-xs text-slate-600 dark:text-neutral-300">
                {statusConfig.label}
              </span>
            </div>
            <button
              onClick={handleRefresh}
              className="text-xs text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 transition-colors"
              title="Refresh model list"
              aria-label="Refresh model list"
            >
              &#x21BB;
            </button>
          </div>

          {/* Error message */}
          {hasError && serverState.error && (
            <div className="px-2 py-2 bg-red-900/20 border border-red-800/40 rounded-lg space-y-1">
              <p className="text-xs font-medium text-red-400">
                {formatErrorMessage(serverState.error)}
              </p>
              <p className="text-[10px] text-red-500/70 break-all">
                {serverState.error}
              </p>
            </div>
          )}

          {/* Empty state */}
          {hasNoModels && !hasError && (
            <p className="text-xs text-slate-400 dark:text-neutral-500 leading-relaxed">
              No models found. Add .gguf files to the directory configured in LLAMA_MODELS_DIR.
            </p>
          )}

          {/* Model list */}
          {!hasNoModels && (
            <ul
              ref={listRef}
              role="listbox"
              aria-label="Available models"
              aria-activedescendant={serverState.activeModel ? `model-${serverState.activeModel}` : undefined}
              className="space-y-1"
            >
              {visibleModels.map((model) => {
                const isActive = model.fileName === serverState.activeModel;
                const isLoading = model.fileName === loadingModel;
                return (
                  <li
                    key={model.fileName}
                    id={`model-${model.fileName}`}
                    role="option"
                    aria-selected={isActive}
                    tabIndex={0}
                    onClick={() => handleSelectModel(model.fileName)}
                    onKeyDown={(e) => handleKeyDown(e, model.fileName)}
                    className={`
                      flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors text-xs
                      ${isActive
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800'
                      }
                      ${isLoading ? 'opacity-70' : ''}
                      focus:outline-none focus:ring-1 focus:ring-blue-500
                    `}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isLoading ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse shrink-0" />
                      ) : isActive ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                      ) : (
                        <div className="w-1.5 h-1.5 shrink-0" />
                      )}
                      <span className="truncate">{model.displayName}</span>
                    </div>
                    <span className="text-xs text-slate-400 dark:text-neutral-500 shrink-0 ml-2">
                      {formatFileSize(model.sizeBytes)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
