'use client';

import { useEffect, useState, useCallback } from 'react';
import { checkHealth, indexDirectory, getIndexStatus, clearIndex } from '../../lib/api';
import { DirectoryPicker } from '../DirectoryPicker';
import { SettingsModal } from '../SettingsModal';
import { useTheme } from '../ThemeProvider';
import { ModelSelector } from './ModelSelector';

interface HealthStatus {
  status: string;
  ollama: { available: boolean; models: string[] };
  database: { indexed_chunks: number };
  indexing: { running: boolean };
}

export function Sidebar() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [dirPath, setDirPath] = useState('');
  const [dirName, setDirName] = useState('');
  const [indexing, setIndexing] = useState(false);
  const [indexMsg, setIndexMsg] = useState('');
  const [indexError, setIndexError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const loadHealth = useCallback(() => {
    checkHealth().then(setHealth).catch(() => null);
  }, []);

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 10000);
    return () => clearInterval(interval);
  }, [loadHealth]);

  // Poll indexing status while running
  useEffect(() => {
    if (!indexing) return;
    const poll = setInterval(async () => {
      const status = await getIndexStatus().catch(() => null);
      if (status && !status.isIndexing) {
        setIndexing(false);
        setIndexMsg('Indexação concluída!');
        loadHealth();
        clearInterval(poll);
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [indexing, loadHealth]);

  const handleSelectDirectory = async (path: string) => {
    setDirPath(path);
    localStorage.setItem('projectDir', path);
    setPickerOpen(false);
    setIndexMsg('');
    setIndexError('');
    setIndexing(true);
    try {
      await clearIndex();
      const res = await indexDirectory(path, dirName.trim() || undefined);
      setIndexMsg(res.message);
    } catch (err: unknown) {
      setIndexing(false);
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erro ao indexar';
      setIndexError(msg);
    }
  };

  if (collapsed) {
    return (
      <div className="w-12 bg-white dark:bg-neutral-900 border-r border-slate-200 dark:border-neutral-800 flex flex-col items-center py-4 gap-3">
        <button onClick={() => setCollapsed(false)} className="text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white">
          ≫
        </button>
        <button
          onClick={toggleTheme}
          className="text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white text-sm"
          title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white text-sm"
          title="Settings"
          data-testid="gear-icon-btn"
          aria-label="Open settings"
        >
          <GearIcon />
        </button>
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </div>
    );
  }

  return (
    <aside className="w-72 bg-white dark:bg-neutral-900 border-r border-slate-200 dark:border-neutral-800 flex flex-col">
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-xs font-bold text-white">C</span>
          </div>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">Code LLM</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white text-sm"
            title="Settings"
            data-testid="gear-icon-btn"
            aria-label="Open settings"
          >
            <GearIcon />
          </button>
          <button
            onClick={toggleTheme}
            className="text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white text-sm"
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button onClick={() => setCollapsed(true)} className="text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white text-sm">
            ≪
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 space-y-5 overflow-y-auto">

        {/* Indexar diretório */}
        <div>
          <h3 className="text-xs font-medium text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
            Indexar projeto
          </h3>
          <div className="space-y-2">
            <div className="flex gap-1">
              <input
                type="text"
                value={dirPath}
                onChange={(e) => setDirPath(e.target.value)}
                placeholder="~/projetos/meu-repo"
                className="flex-1 min-w-0 text-xs bg-slate-100 dark:bg-neutral-800 text-slate-800 dark:text-neutral-200 placeholder-slate-400 dark:placeholder-neutral-500 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={() => setPickerOpen(true)}
                title="Navegar no Mac"
                className="shrink-0 text-sm px-2.5 py-2 rounded-lg bg-slate-200 dark:bg-neutral-700 hover:bg-slate-300 dark:hover:bg-neutral-600 text-slate-600 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                📂
              </button>
            </div>
            <input
              type="text"
              value={dirName}
              onChange={(e) => setDirName(e.target.value)}
              placeholder="Nome (opcional)"
              className="w-full text-xs bg-slate-100 dark:bg-neutral-800 text-slate-800 dark:text-neutral-200 placeholder-slate-400 dark:placeholder-neutral-500 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {indexing && (
              <p className="text-xs text-blue-400">Indexando...</p>
            )}
            {indexMsg && (
              <p className="text-xs text-green-400">{indexMsg}</p>
            )}
            {indexError && (
              <p className="text-xs text-red-400">{indexError}</p>
            )}
            {!dirPath && !indexing && (
              <p className="text-xs text-slate-400 dark:text-neutral-500 leading-relaxed">
                Selecione uma pasta para indexar o projeto.
              </p>
            )}
          </div>
        </div>

        {/* Status */}
        <div>
          <h3 className="text-xs font-medium text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Status</h3>
          <div className="space-y-2">
            <StatusItem
              label="Ollama"
              ok={health?.ollama.available ?? false}
              detail={health?.ollama.models[0]?.split(':')[0]}
            />
            <StatusItem
              label="Banco de dados"
              ok={true}
              detail={health ? `${health.database.indexed_chunks} chunks` : undefined}
            />
            <StatusItem
              label="Indexação"
              ok={!health?.indexing.running && !indexing}
              detail={(health?.indexing.running || indexing) ? 'Em andamento...' : 'Atualizado'}
            />
          </div>
        </div>

        {/* Local Models (llama-server) */}
        <ModelSelector collapsed={collapsed} />

        {/* Models */}
        {health?.ollama.models && health.ollama.models.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Modelos</h3>
            <div className="space-y-1">
              {health.ollama.models.slice(0, 3).map((m) => (
                <div key={m} className="text-xs text-slate-600 dark:text-neutral-300 px-2 py-1 bg-slate-100 dark:bg-neutral-800 rounded">
                  {m}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-slate-200 dark:border-neutral-800">
        <p className="text-xs text-slate-400 dark:text-neutral-500">Code LLM v1.0</p>
      </div>

      {pickerOpen && (
        <DirectoryPicker
          onSelect={handleSelectDirectory}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </aside>
  );
}

function GearIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function StatusItem({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-400' : 'bg-yellow-400'}`} />
        <span className="text-xs text-slate-600 dark:text-neutral-300">{label}</span>
      </div>
      {detail && <span className="text-xs text-slate-400 dark:text-neutral-500">{detail}</span>}
    </div>
  );
}
