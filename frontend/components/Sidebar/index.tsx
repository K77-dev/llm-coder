'use client';

import { useEffect, useState, useCallback } from 'react';
import { checkHealth, indexDirectory, getIndexStatus, clearIndex } from '../../lib/api';
import { DirectoryPicker } from '../DirectoryPicker';

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
      <div className="w-12 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-4">
        <button onClick={() => setCollapsed(false)} className="text-slate-400 hover:text-white">
          ≫
        </button>
      </div>
    );
  }

  return (
    <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-xs font-bold text-white">C</span>
          </div>
          <span className="text-sm font-semibold text-white">Code LLM</span>
        </div>
        <button onClick={() => setCollapsed(true)} className="text-slate-400 hover:text-white text-sm">
          ≪
        </button>
      </div>

      <div className="flex-1 px-4 py-4 space-y-5 overflow-y-auto">

        {/* Indexar diretório */}
        <div>
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
            Indexar projeto
          </h3>
          <div className="space-y-2">
            <div className="flex gap-1">
              <input
                type="text"
                value={dirPath}
                onChange={(e) => setDirPath(e.target.value)}
                placeholder="~/projetos/meu-repo"
                className="flex-1 min-w-0 text-xs bg-slate-800 text-slate-200 placeholder-slate-500 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={() => setPickerOpen(true)}
                title="Navegar no Mac"
                className="shrink-0 text-sm px-2.5 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
              >
                📂
              </button>
            </div>
            <input
              type="text"
              value={dirName}
              onChange={(e) => setDirName(e.target.value)}
              placeholder="Nome (opcional)"
              className="w-full text-xs bg-slate-800 text-slate-200 placeholder-slate-500 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              <p className="text-xs text-slate-500 leading-relaxed">
                Selecione uma pasta para indexar o projeto.
              </p>
            )}
          </div>
        </div>

        {/* Status */}
        <div>
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Status</h3>
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

        {/* Models */}
        {health?.ollama.models && health.ollama.models.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Modelos</h3>
            <div className="space-y-1">
              {health.ollama.models.slice(0, 3).map((m) => (
                <div key={m} className="text-xs text-slate-300 px-2 py-1 bg-slate-800 rounded">
                  {m}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-slate-800">
        <p className="text-xs text-slate-500">Code LLM v1.0</p>
      </div>

      {pickerOpen && (
        <DirectoryPicker
          onSelect={handleSelectDirectory}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </aside>
  );
}

function StatusItem({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-400' : 'bg-yellow-400'}`} />
        <span className="text-xs text-slate-300">{label}</span>
      </div>
      {detail && <span className="text-xs text-slate-500">{detail}</span>}
    </div>
  );
}
