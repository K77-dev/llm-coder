'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getLlamaSettings, updateLlamaSettings, restartLlamaServer, getLlamaModels } from '../../lib/api';
import type { LlamaSettings } from '../../lib/api';
import { useToast } from '../../lib/hooks/useToast';

interface ModelInfo {
  fileName: string;
  displayName: string;
  sizeBytes: number;
}

function formatModelSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function getHiddenModels(): Set<string> {
  try {
    const raw = localStorage.getItem('hiddenModels');
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveHiddenModels(hidden: Set<string>): void {
  localStorage.setItem('hiddenModels', JSON.stringify([...hidden]));
  window.dispatchEvent(new CustomEvent('models:visibility-changed'));
}

const DEFAULT_SETTINGS: LlamaSettings = {
  llamaModelsDir: '~/models',
  llamaServerPort: 8080,
  llamaServerPath: 'llama-server',
  embeddingModel: 'nomic-embed-text',
  embeddingServerPort: 8081,
  embeddingModelFile: 'nomic-embed-text-v1.5.Q4_K_M.gguf',
  contextSize: 8192,
  batchSize: 8192,
  maxMemoryMb: 13000,
  cacheTtl: 3600,
  lruCacheSize: 500,
};

const MIN_PORT = 1024;
const MAX_PORT = 65535;

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ValidationErrors {
  llamaServerPort?: string;
  contextSize?: string;
  batchSize?: string;
  maxMemoryMb?: string;
  cacheTtl?: string;
  lruCacheSize?: string;
}

function isElectronAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI?.dialog;
}

function validateSettings(settings: LlamaSettings): ValidationErrors {
  const errors: ValidationErrors = {};
  if (settings.llamaServerPort < MIN_PORT || settings.llamaServerPort > MAX_PORT) {
    errors.llamaServerPort = `Port must be between ${MIN_PORT} and ${MAX_PORT}`;
  }
  if (!Number.isFinite(settings.llamaServerPort) || !Number.isInteger(settings.llamaServerPort)) {
    errors.llamaServerPort = 'Port must be a valid integer';
  }
  if (settings.contextSize < 0 || settings.contextSize > 16384) {
    errors.contextSize = 'Context size must be between 0 and 16384';
  }
  if (settings.batchSize < 0 || settings.batchSize > 16384) {
    errors.batchSize = 'Batch size must be between 0 and 16384';
  }
  if (settings.maxMemoryMb <= 0) {
    errors.maxMemoryMb = 'Max memory must be greater than 0';
  }
  if (settings.cacheTtl <= 0) {
    errors.cacheTtl = 'Cache TTL must be greater than 0';
  }
  if (settings.lruCacheSize <= 0) {
    errors.lruCacheSize = 'LRU cache size must be greater than 0';
  }
  return errors;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<LlamaSettings>(DEFAULT_SETTINGS);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allModels, setAllModels] = useState<ModelInfo[]>([]);
  const [hiddenModels, setHiddenModels] = useState<Set<string>>(new Set());
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);
  const { showToast } = useToast();

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const [data, modelsResult] = await Promise.all([
        getLlamaSettings(),
        getLlamaModels().catch(() => ({ models: [] })),
      ]);
      setSettings(data);
      setAllModels(modelsResult.models);
      setHiddenModels(getHiddenModels());
      setErrors({});
    } catch {
      showToast({ message: 'Failed to load settings', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen, loadSettings]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'Tab') {
        trapFocus(event);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      firstFocusableRef.current?.focus();
    }
  }, [isOpen, loading]);

  const trapFocus = (event: KeyboardEvent) => {
    const modal = modalRef.current;
    if (!modal) return;
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements.length === 0) return;
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  };

  const handleFieldChange = (field: keyof LlamaSettings, value: string) => {
    const numericFields: (keyof LlamaSettings)[] = [
      'llamaServerPort',
      'contextSize',
      'batchSize',
      'maxMemoryMb',
      'cacheTtl',
      'lruCacheSize',
    ];
    if (numericFields.includes(field)) {
      const numValue = value === '' ? 0 : Number(value);
      setSettings((prev) => ({ ...prev, [field]: numValue }));
    } else {
      setSettings((prev) => ({ ...prev, [field]: value }));
    }
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSelectDirectory = async (field: 'llamaModelsDir') => {
    if (!isElectronAvailable()) return;
    const selected = await window.electronAPI!.dialog.selectDirectory();
    if (selected) {
      setSettings((prev) => ({ ...prev, [field]: selected }));
    }
  };

  const handleSelectFile = async (field: 'llamaServerPath') => {
    if (!isElectronAvailable()) return;
    const selected = await window.electronAPI!.dialog.selectFile();
    if (selected) {
      setSettings((prev) => ({ ...prev, [field]: selected }));
    }
  };

  const handleSave = async () => {
    const validationErrors = validateSettings(settings);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setSaving(true);
    try {
      const result = await updateLlamaSettings(settings);
      if (result.restartRequired) {
        const confirmed = await confirmRestart();
        if (confirmed) {
          try {
            if (isElectronAvailable() && window.electronAPI?.llama?.restart) {
              await window.electronAPI.llama.restart({
                port: settings.llamaServerPort,
                execPath: settings.llamaServerPath,
                modelsDir: settings.llamaModelsDir,
              });
            } else {
              await restartLlamaServer();
            }
            showToast({ message: 'Settings saved. Server restarting...', type: 'success' });
          } catch {
            showToast({ message: 'Settings saved but server restart failed', type: 'error' });
          }
        } else {
          showToast({ message: 'Settings saved. Restart required on next startup.', type: 'success' });
        }
      } else {
        showToast({ message: 'Settings saved successfully', type: 'success' });
      }
      onClose();
    } catch {
      showToast({ message: 'Failed to save settings', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const confirmRestart = async (): Promise<boolean> => {
    const message = 'Server configuration changed. Restart the LLM server now? Active connections will be interrupted.';
    if (isElectronAvailable() && window.electronAPI?.dialog?.showConfirm) {
      return window.electronAPI.dialog.showConfirm(message);
    }
    return window.confirm(message);
  };

  if (!isOpen) return null;

  const hasElectron = isElectronAvailable();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="LLM Settings"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
        data-testid="settings-overlay"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative z-10 w-full max-w-lg max-h-[85vh] bg-white dark:bg-neutral-900 rounded-xl shadow-2xl flex flex-col border border-slate-200 dark:border-neutral-700"
        data-testid="settings-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-neutral-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            LLM Settings
          </h2>
          <button
            ref={firstFocusableRef}
            onClick={onClose}
            className="text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 transition-colors"
            aria-label="Close settings"
            data-testid="settings-close-btn"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8" data-testid="settings-loading">
              <span className="text-sm text-slate-400 dark:text-neutral-500">Loading settings...</span>
            </div>
          ) : (
            <>
              {/* Section: LLM Server */}
              <section data-testid="section-llm-server">
                <h3 className="text-sm font-medium text-slate-700 dark:text-neutral-300 mb-3">
                  LLM Server
                </h3>
                <div className="space-y-3">
                  <FieldGroup
                    label="Models Directory"
                    htmlFor="llamaModelsDir"
                    error={undefined}
                  >
                    <div className="flex gap-2">
                      <input
                        id="llamaModelsDir"
                        type="text"
                        value={settings.llamaModelsDir}
                        onChange={(e) => handleFieldChange('llamaModelsDir', e.target.value)}
                        placeholder={DEFAULT_SETTINGS.llamaModelsDir}
                        className={inputClasses()}
                      />
                      {hasElectron && (
                        <button
                          onClick={() => handleSelectDirectory('llamaModelsDir')}
                          className={filePickerBtnClasses}
                          title="Browse for directory"
                          data-testid="picker-llamaModelsDir"
                          type="button"
                        >
                          Browse
                        </button>
                      )}
                    </div>
                  </FieldGroup>

                  <FieldGroup
                    label="Server Port"
                    htmlFor="llamaServerPort"
                    error={errors.llamaServerPort}
                  >
                    <input
                      id="llamaServerPort"
                      type="number"
                      min={MIN_PORT}
                      max={MAX_PORT}
                      value={settings.llamaServerPort || ''}
                      onChange={(e) => handleFieldChange('llamaServerPort', e.target.value)}
                      placeholder={String(DEFAULT_SETTINGS.llamaServerPort)}
                      className={inputClasses(errors.llamaServerPort)}
                      aria-describedby={errors.llamaServerPort ? 'llamaServerPort-error' : undefined}
                      aria-invalid={!!errors.llamaServerPort}
                    />
                  </FieldGroup>

                  <FieldGroup
                    label="Server Executable Path"
                    htmlFor="llamaServerPath"
                    error={undefined}
                  >
                    <div className="flex gap-2">
                      <input
                        id="llamaServerPath"
                        type="text"
                        value={settings.llamaServerPath}
                        onChange={(e) => handleFieldChange('llamaServerPath', e.target.value)}
                        placeholder={DEFAULT_SETTINGS.llamaServerPath}
                        className={inputClasses()}
                      />
                      {hasElectron && (
                        <button
                          onClick={() => handleSelectFile('llamaServerPath')}
                          className={filePickerBtnClasses}
                          title="Browse for file"
                          data-testid="picker-llamaServerPath"
                          type="button"
                        >
                          Browse
                        </button>
                      )}
                    </div>
                  </FieldGroup>

                  <SliderField
                    label="Context Size (tokens)"
                    id="contextSize"
                    value={settings.contextSize}
                    min={0}
                    max={16384}
                    step={1024}
                    marks={[0, 4096, 8192, 12288, 16384]}
                    onChange={(v) => handleFieldChange('contextSize', String(v))}
                    error={errors.contextSize}
                  />

                  <SliderField
                    label="Batch Size (tokens)"
                    id="batchSize"
                    value={settings.batchSize}
                    min={0}
                    max={16384}
                    step={1024}
                    marks={[0, 4096, 8192, 12288, 16384]}
                    onChange={(v) => handleFieldChange('batchSize', String(v))}
                    error={errors.batchSize}
                  />
                </div>
              </section>

              {/* Section: Embedding Server */}
              <section data-testid="section-embedding">
                <h3 className="text-sm font-medium text-slate-700 dark:text-neutral-300 mb-3">
                  Embedding Server
                </h3>
                <p className="text-xs text-slate-400 dark:text-neutral-500 mb-3">
                  Dedicated server for RAG embeddings (port {settings.embeddingServerPort}). Select a .gguf embedding model.
                </p>
                <div className="space-y-3">
                  <FieldGroup
                    label="Embedding Model File"
                    htmlFor="embeddingModelFile"
                    error={undefined}
                  >
                    {allModels.length > 0 ? (
                      <select
                        id="embeddingModelFile"
                        value={settings.embeddingModelFile}
                        onChange={(e) => handleFieldChange('embeddingModelFile', e.target.value)}
                        className={inputClasses()}
                      >
                        <option value="">None (disabled)</option>
                        {allModels.map((m) => (
                          <option key={m.fileName} value={m.fileName}>
                            {m.displayName} ({formatModelSize(m.sizeBytes)})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id="embeddingModelFile"
                        type="text"
                        value={settings.embeddingModelFile}
                        onChange={(e) => handleFieldChange('embeddingModelFile', e.target.value)}
                        placeholder="embedding-model.gguf"
                        className={inputClasses()}
                      />
                    )}
                  </FieldGroup>

                  <FieldGroup
                    label="Embedding Server Port"
                    htmlFor="embeddingServerPort"
                    error={undefined}
                  >
                    <input
                      id="embeddingServerPort"
                      type="number"
                      min={MIN_PORT}
                      max={MAX_PORT}
                      value={settings.embeddingServerPort || ''}
                      onChange={(e) => handleFieldChange('embeddingServerPort', e.target.value)}
                      placeholder={String(DEFAULT_SETTINGS.embeddingServerPort)}
                      className={inputClasses()}
                    />
                  </FieldGroup>
                </div>
              </section>

              {/* Section: Visible Models */}
              {allModels.length > 0 && (
                <section data-testid="section-visible-models">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-neutral-300 mb-3">
                    Visible Models
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-neutral-500 mb-2">
                    Select which models appear in the sidebar.
                  </p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {allModels.map((model) => {
                      const isVisible = !hiddenModels.has(model.fileName);
                      return (
                        <label
                          key={model.fileName}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={() => {
                              const next = new Set(hiddenModels);
                              if (isVisible) {
                                next.add(model.fileName);
                              } else {
                                next.delete(model.fileName);
                              }
                              setHiddenModels(next);
                              saveHiddenModels(next);
                            }}
                            className="w-3.5 h-3.5 rounded border-slate-300 dark:border-neutral-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs text-slate-700 dark:text-neutral-300 truncate flex-1">
                            {model.displayName}
                          </span>
                          <span className="text-xs text-slate-400 dark:text-neutral-500 shrink-0">
                            {formatModelSize(model.sizeBytes)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Section: Cache & Performance */}
              <section data-testid="section-cache">
                <h3 className="text-sm font-medium text-slate-700 dark:text-neutral-300 mb-3">
                  Cache & Performance
                </h3>
                <div className="space-y-3">
                  <FieldGroup
                    label="Max Memory (MB)"
                    htmlFor="maxMemoryMb"
                    error={errors.maxMemoryMb}
                  >
                    <input
                      id="maxMemoryMb"
                      type="number"
                      min={1}
                      value={settings.maxMemoryMb || ''}
                      onChange={(e) => handleFieldChange('maxMemoryMb', e.target.value)}
                      placeholder={String(DEFAULT_SETTINGS.maxMemoryMb)}
                      className={inputClasses(errors.maxMemoryMb)}
                      aria-describedby={errors.maxMemoryMb ? 'maxMemoryMb-error' : undefined}
                      aria-invalid={!!errors.maxMemoryMb}
                    />
                  </FieldGroup>

                  <FieldGroup
                    label="Cache TTL (seconds)"
                    htmlFor="cacheTtl"
                    error={errors.cacheTtl}
                  >
                    <input
                      id="cacheTtl"
                      type="number"
                      min={1}
                      value={settings.cacheTtl || ''}
                      onChange={(e) => handleFieldChange('cacheTtl', e.target.value)}
                      placeholder={String(DEFAULT_SETTINGS.cacheTtl)}
                      className={inputClasses(errors.cacheTtl)}
                      aria-describedby={errors.cacheTtl ? 'cacheTtl-error' : undefined}
                      aria-invalid={!!errors.cacheTtl}
                    />
                  </FieldGroup>

                  <FieldGroup
                    label="LRU Cache Size"
                    htmlFor="lruCacheSize"
                    error={errors.lruCacheSize}
                  >
                    <input
                      id="lruCacheSize"
                      type="number"
                      min={1}
                      value={settings.lruCacheSize || ''}
                      onChange={(e) => handleFieldChange('lruCacheSize', e.target.value)}
                      placeholder={String(DEFAULT_SETTINGS.lruCacheSize)}
                      className={inputClasses(errors.lruCacheSize)}
                      aria-describedby={errors.lruCacheSize ? 'lruCacheSize-error' : undefined}
                      aria-invalid={!!errors.lruCacheSize}
                    />
                  </FieldGroup>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-neutral-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800"
            data-testid="settings-cancel-btn"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-lg"
            data-testid="settings-save-btn"
            type="button"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface FieldGroupProps {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}

function FieldGroup({ label, htmlFor, error, children }: FieldGroupProps) {
  const errorId = `${htmlFor}-error`;
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium text-slate-500 dark:text-neutral-400 mb-1"
      >
        {label}
      </label>
      {children}
      {error && (
        <p
          id={errorId}
          role="alert"
          aria-live="assertive"
          className="mt-1 text-xs text-red-500"
          data-testid={`error-${htmlFor}`}
        >
          {error}
        </p>
      )}
    </div>
  );
}

interface SliderFieldProps {
  label: string;
  id: string;
  value: number;
  min: number;
  max: number;
  step: number;
  marks: number[];
  onChange: (value: number) => void;
  error?: string;
}

function SliderField({ label, id, value, min, max, step, marks, onChange, error }: SliderFieldProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label htmlFor={id} className="text-xs font-medium text-slate-500 dark:text-neutral-400">
          {label}
        </label>
        <span className="text-xs font-mono text-slate-700 dark:text-neutral-300">{value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full h-1.5 bg-slate-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
      <div className="flex justify-between text-[10px] text-slate-400 dark:text-neutral-500 mt-0.5">
        {marks.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}

function inputClasses(error?: string): string {
  const base = 'w-full text-sm bg-slate-100 dark:bg-neutral-800 text-slate-800 dark:text-neutral-200 placeholder-slate-400 dark:placeholder-neutral-500 rounded-lg px-3 py-2 focus:outline-none focus:ring-1';
  const ring = error
    ? 'ring-1 ring-red-500 focus:ring-red-500'
    : 'focus:ring-blue-500';
  return `${base} ${ring}`;
}

const filePickerBtnClasses = 'shrink-0 px-3 py-2 text-sm font-medium text-slate-600 dark:text-neutral-300 bg-slate-200 dark:bg-neutral-700 hover:bg-slate-300 dark:hover:bg-neutral-600 rounded-lg transition-colors';

export type { SettingsModalProps };
