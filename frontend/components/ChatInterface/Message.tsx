'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message as MessageType } from '../../lib/hooks/useChat';
import { writeFile, renameFile, deleteFile, createDir, deleteDir, listDir, listSubdirs as listSubdirsApi, searchFiles as searchFilesApi, listTree as listTreeApi, FileChange, RenameChange, DeleteChange, CreateDir, DeleteDir, ListDir, ListSubdirs, ListTree, SearchFiles, DirEntry, TreeEntry, SearchResult, CommandSuggestion, execCommand } from '../../lib/api';

interface MessageProps {
  message: MessageType;
}

function FileChangeCard({ change }: { change: FileChange }) {
  const [status, setStatus] = useState<'idle' | 'applying' | 'applied' | 'error'>('idle');
  const [expanded, setExpanded] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const apply = async () => {
    setStatus('applying');
    try {
      await writeFile(change.path, change.content);
      setStatus('applied');
    } catch {
      setStatus('error');
      setErrorMsg('Falha ao aplicar. Verifique se o caminho existe e é acessível.');
    }
  };

  const lines = change.content.split('\n').length;

  return (
    <div className={`rounded-lg border text-xs overflow-hidden ${
      status === 'applied' ? 'border-green-600/40 bg-green-50 dark:bg-green-950/20' :
      status === 'error'   ? 'border-red-600/40 bg-red-50 dark:bg-red-950/20' :
                             'border-slate-300 dark:border-neutral-600/40 bg-slate-50 dark:bg-neutral-900/60'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-neutral-800/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-yellow-500">📄</span>
          <span className="font-mono text-slate-700 dark:text-neutral-200 truncate">{change.path}</span>
          <span className="text-slate-400 dark:text-neutral-500 shrink-0">{lines} linhas</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="px-2 py-1 rounded bg-slate-200 dark:bg-neutral-700 hover:bg-slate-300 dark:hover:bg-neutral-600 text-slate-600 dark:text-neutral-300 transition-colors"
          >
            {expanded ? 'Ocultar' : 'Ver'}
          </button>
          {status === 'idle' && (
            <button
              onClick={apply}
              className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
            >
              Aplicar
            </button>
          )}
          {status === 'applying' && (
            <span className="px-2 py-1 text-slate-400">Aplicando...</span>
          )}
          {status === 'applied' && (
            <span className="px-2 py-1 text-green-400 font-medium">✓ Aplicado</span>
          )}
          {status === 'error' && (
            <span className="px-2 py-1 text-red-400">✗ Erro</span>
          )}
        </div>
      </div>

      {/* Error message */}
      {status === 'error' && errorMsg && (
        <p className="px-3 py-1.5 text-red-500 dark:text-red-400 text-xs bg-red-50 dark:bg-red-950/30">{errorMsg}</p>
      )}

      {/* Code preview */}
      {expanded && (
        <pre className="px-3 py-3 overflow-x-auto text-slate-600 dark:text-neutral-300 font-mono text-xs leading-relaxed max-h-80 overflow-y-auto">
          {change.content}
        </pre>
      )}
    </div>
  );
}

function RenameCard({ rename }: { rename: RenameChange }) {
  const [status, setStatus] = useState<'idle' | 'applying' | 'applied' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const apply = async () => {
    setStatus('applying');
    try {
      await renameFile(rename.from, rename.to);
      setStatus('applied');
    } catch {
      setStatus('error');
      setErrorMsg('Falha ao renomear. Verifique se o arquivo existe e é acessível.');
    }
  };

  const fromName = rename.from.split('/').pop();
  const toName = rename.to.split('/').pop();

  return (
    <div className={`rounded-lg border text-xs overflow-hidden ${
      status === 'applied' ? 'border-green-600/40 bg-green-50 dark:bg-green-950/20' :
      status === 'error'   ? 'border-red-600/40 bg-red-50 dark:bg-red-950/20' :
                             'border-slate-300 dark:border-neutral-600/40 bg-slate-50 dark:bg-neutral-900/60'
    }`}>
      <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-neutral-800/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-blue-400">↪</span>
          <span className="font-mono text-slate-500 dark:text-neutral-400 truncate">{fromName}</span>
          <span className="text-slate-400 dark:text-neutral-500">→</span>
          <span className="font-mono text-slate-700 dark:text-neutral-200 truncate">{toName}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {status === 'idle' && (
            <button
              onClick={apply}
              className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
            >
              Renomear
            </button>
          )}
          {status === 'applying' && <span className="px-2 py-1 text-slate-500 dark:text-neutral-400">Renomeando...</span>}
          {status === 'applied' && <span className="px-2 py-1 text-green-600 dark:text-green-400 font-medium">✓ Renomeado</span>}
          {status === 'error' && <span className="px-2 py-1 text-red-500 dark:text-red-400">✗ Erro</span>}
        </div>
      </div>
      {status === 'error' && errorMsg && (
        <p className="px-3 py-1.5 text-red-500 dark:text-red-400 text-xs bg-red-50 dark:bg-red-950/30">{errorMsg}</p>
      )}
    </div>
  );
}

function DeleteCard({ del }: { del: DeleteChange }) {
  const [status, setStatus] = useState<'idle' | 'deleting' | 'deleted' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const apply = async () => {
    setStatus('deleting');
    try {
      await deleteFile(del.path);
      setStatus('deleted');
    } catch {
      setStatus('error');
      setErrorMsg('Falha ao apagar. Verifique se o arquivo existe e é acessível.');
    }
  };

  const fileName = del.path.split('/').pop();

  return (
    <div className={`rounded-lg border text-xs overflow-hidden ${
      status === 'deleted' ? 'border-green-600/40 bg-green-50 dark:bg-green-950/20' :
      status === 'error'   ? 'border-red-600/40 bg-red-50 dark:bg-red-950/20' :
                             'border-slate-300 dark:border-neutral-600/40 bg-slate-50 dark:bg-neutral-900/60'
    }`}>
      <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-neutral-800/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-red-400">🗑</span>
          <span className="font-mono text-slate-700 dark:text-neutral-200 truncate">{fileName}</span>
          <span className="text-slate-400 dark:text-neutral-500 truncate text-xs">{del.path}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {status === 'idle' && (
            <button
              onClick={apply}
              className="px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-white font-medium transition-colors"
            >
              Apagar
            </button>
          )}
          {status === 'deleting' && <span className="px-2 py-1 text-slate-500 dark:text-neutral-400">Apagando...</span>}
          {status === 'deleted'  && <span className="px-2 py-1 text-green-600 dark:text-green-400 font-medium">✓ Apagado</span>}
          {status === 'error'    && <span className="px-2 py-1 text-red-500 dark:text-red-400">✗ Erro</span>}
        </div>
      </div>
      {status === 'error' && errorMsg && (
        <p className="px-3 py-1.5 text-red-500 dark:text-red-400 text-xs bg-red-50 dark:bg-red-950/30">{errorMsg}</p>
      )}
    </div>
  );
}

function CreateDirCard({ item }: { item: CreateDir }) {
  const [status, setStatus] = useState<'idle' | 'creating' | 'created' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const apply = async () => {
    setStatus('creating');
    try {
      await createDir(item.path);
      setStatus('created');
    } catch {
      setStatus('error');
      setErrorMsg('Falha ao criar diretório.');
    }
  };

  return (
    <div className={`rounded-lg border text-xs overflow-hidden ${
      status === 'created' ? 'border-green-600/40 bg-green-50 dark:bg-green-950/20' :
      status === 'error'   ? 'border-red-600/40 bg-red-50 dark:bg-red-950/20' :
                             'border-slate-300 dark:border-neutral-600/40 bg-slate-50 dark:bg-neutral-900/60'
    }`}>
      <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-neutral-800/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-green-400">📁+</span>
          <span className="font-mono text-slate-700 dark:text-neutral-200 truncate">{item.path}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {status === 'idle' && (
            <button onClick={apply} className="px-2 py-1 rounded bg-green-700 hover:bg-green-600 text-white font-medium transition-colors">
              Criar
            </button>
          )}
          {status === 'creating' && <span className="px-2 py-1 text-slate-500 dark:text-neutral-400">Criando...</span>}
          {status === 'created'  && <span className="px-2 py-1 text-green-600 dark:text-green-400 font-medium">✓ Criado</span>}
          {status === 'error'    && <span className="px-2 py-1 text-red-500 dark:text-red-400">✗ Erro</span>}
        </div>
      </div>
      {status === 'error' && errorMsg && (
        <p className="px-3 py-1.5 text-red-500 dark:text-red-400 text-xs bg-red-50 dark:bg-red-950/30">{errorMsg}</p>
      )}
    </div>
  );
}

function DeleteDirCard({ item }: { item: DeleteDir }) {
  const [status, setStatus] = useState<'idle' | 'deleting' | 'deleted' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const apply = async () => {
    setStatus('deleting');
    try {
      await deleteDir(item.path);
      setStatus('deleted');
    } catch {
      setStatus('error');
      setErrorMsg('Falha ao apagar diretório.');
    }
  };

  const dirName = item.path.split('/').filter(Boolean).pop();

  return (
    <div className={`rounded-lg border text-xs overflow-hidden ${
      status === 'deleted' ? 'border-green-600/40 bg-green-50 dark:bg-green-950/20' :
      status === 'error'   ? 'border-red-600/40 bg-red-50 dark:bg-red-950/20' :
                             'border-slate-300 dark:border-neutral-600/40 bg-slate-50 dark:bg-neutral-900/60'
    }`}>
      <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-neutral-800/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-red-400">🗑</span>
          <span className="font-mono text-slate-700 dark:text-neutral-200 truncate">{dirName}/</span>
          <span className="text-slate-400 dark:text-neutral-500 truncate text-xs">{item.path}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {status === 'idle' && (
            <button onClick={apply} className="px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-white font-medium transition-colors">
              Apagar pasta
            </button>
          )}
          {status === 'deleting' && <span className="px-2 py-1 text-slate-500 dark:text-neutral-400">Apagando...</span>}
          {status === 'deleted'  && <span className="px-2 py-1 text-green-600 dark:text-green-400 font-medium">✓ Apagado</span>}
          {status === 'error'    && <span className="px-2 py-1 text-red-500 dark:text-red-400">✗ Erro</span>}
        </div>
      </div>
      {status === 'error' && errorMsg && (
        <p className="px-3 py-1.5 text-red-500 dark:text-red-400 text-xs bg-red-50 dark:bg-red-950/30">{errorMsg}</p>
      )}
    </div>
  );
}

function ListDirCard({ item }: { item: ListDir }) {
  const [entries, setEntries] = useState<DirEntry[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    listDir(item.path)
      .then((r) => setEntries(r.entries))
      .catch(() => setError('Falha ao listar diretório.'));
  }, [item.path]);

  return (
    <div className="rounded-lg border border-slate-300 dark:border-neutral-600/40 bg-slate-50 dark:bg-neutral-900/60 text-xs overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-neutral-800/60">
        <span className="text-yellow-400">📂</span>
        <span className="font-mono text-slate-700 dark:text-neutral-200 truncate">{item.path}</span>
      </div>
      {error && <p className="px-3 py-2 text-red-500 dark:text-red-400">{error}</p>}
      {!entries && !error && <p className="px-3 py-2 text-slate-500 dark:text-neutral-400 animate-pulse">Listando...</p>}
      {entries && (
        <ul className="px-3 py-2 space-y-0.5 max-h-48 overflow-y-auto">
          {entries.map((e) => (
            <li key={e.name} className="flex items-center gap-2 text-slate-600 dark:text-neutral-300">
              <span>{e.type === 'dir' ? '📁' : '📄'}</span>
              <span className="font-mono">{e.name}</span>
              {e.size !== undefined && <span className="text-slate-400 dark:text-neutral-500 ml-auto">{(e.size / 1024).toFixed(1)}KB</span>}
            </li>
          ))}
          {entries.length === 0 && <li className="text-slate-400 dark:text-neutral-500">Diretório vazio</li>}
        </ul>
      )}
    </div>
  );
}

function ListSubdirsCard({ item }: { item: ListSubdirs }) {
  const [entries, setEntries] = useState<DirEntry[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    listSubdirsApi(item.path)
      .then((r) => setEntries(r.entries))
      .catch(() => setError('Falha ao listar subdiretórios.'));
  }, [item.path]);

  return (
    <div className="rounded-lg border border-slate-300 dark:border-neutral-600/40 bg-slate-50 dark:bg-neutral-900/60 text-xs overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-neutral-800/60">
        <span className="text-yellow-400">📁</span>
        <span className="text-slate-500 dark:text-neutral-400">Subdiretórios de</span>
        <span className="font-mono text-slate-700 dark:text-neutral-200 truncate">{item.path}</span>
      </div>
      {error && <p className="px-3 py-2 text-red-500 dark:text-red-400">{error}</p>}
      {!entries && !error && <p className="px-3 py-2 text-slate-500 dark:text-neutral-400 animate-pulse">Listando...</p>}
      {entries && (
        <ul className="px-3 py-2 space-y-0.5 max-h-48 overflow-y-auto">
          {entries.map((e) => (
            <li key={e.name} className="flex items-center gap-2 text-slate-600 dark:text-neutral-300">
              <span>📁</span>
              <span className="font-mono">{e.name}</span>
            </li>
          ))}
          {entries.length === 0 && <li className="text-slate-400 dark:text-neutral-500">Nenhum subdiretório encontrado</li>}
        </ul>
      )}
    </div>
  );
}

function TreeNode({ entry, depth }: { entry: TreeEntry; depth: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const indent = depth * 12;
  if (entry.type === 'dir') {
    return (
      <li>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-1 text-slate-600 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-neutral-100 w-full text-left"
          style={{ paddingLeft: indent }}
        >
          <span className="text-yellow-500 dark:text-yellow-400 shrink-0">{collapsed ? '▶' : '▼'}</span>
          <span className="text-yellow-400 dark:text-yellow-300 shrink-0">📁</span>
          <span className="font-mono">{entry.name}</span>
        </button>
        {!collapsed && entry.children && entry.children.length > 0 && (
          <ul>
            {entry.children.map((child, i) => (
              <TreeNode key={i} entry={child} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  }
  return (
    <li className="flex items-center gap-1 text-slate-500 dark:text-neutral-400" style={{ paddingLeft: indent + 16 }}>
      <span className="shrink-0">📄</span>
      <span className="font-mono">{entry.name}</span>
      {entry.size !== undefined && (
        <span className="text-slate-400 dark:text-neutral-600 ml-auto shrink-0">{(entry.size / 1024).toFixed(1)}KB</span>
      )}
    </li>
  );
}

function ListTreeCard({ item }: { item: ListTree }) {
  const [tree, setTree] = useState<TreeEntry[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    listTreeApi(item.path)
      .then((r) => setTree(r.tree))
      .catch(() => setError('Falha ao listar árvore de diretórios.'));
  }, [item.path]);

  return (
    <div className="rounded-lg border border-slate-300 dark:border-neutral-600/40 bg-slate-50 dark:bg-neutral-900/60 text-xs overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-neutral-800/60">
        <span className="text-yellow-400">🌳</span>
        <span className="text-slate-500 dark:text-neutral-400">Árvore de</span>
        <span className="font-mono text-slate-700 dark:text-neutral-200 truncate">{item.path}</span>
      </div>
      {error && <p className="px-3 py-2 text-red-500 dark:text-red-400">{error}</p>}
      {!tree && !error && <p className="px-3 py-2 text-slate-500 dark:text-neutral-400 animate-pulse">Carregando...</p>}
      {tree && (
        <ul className="px-2 py-2 space-y-0.5 max-h-64 overflow-y-auto">
          {tree.map((entry, i) => (
            <TreeNode key={i} entry={entry} depth={0} />
          ))}
          {tree.length === 0 && <li className="text-slate-400 dark:text-neutral-500 px-3">Diretório vazio</li>}
        </ul>
      )}
    </div>
  );
}

function SearchFilesCard({ item }: { item: SearchFiles }) {
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    searchFilesApi(item.path, item.query)
      .then((r) => setResults(r.results))
      .catch(() => setError('Falha ao buscar arquivos.'));
  }, [item.path, item.query]);

  return (
    <div className="rounded-lg border border-slate-300 dark:border-neutral-600/40 bg-slate-50 dark:bg-neutral-900/60 text-xs overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-neutral-800/60">
        <span className="text-blue-400">🔍</span>
        <span className="text-slate-500 dark:text-neutral-400">Busca:</span>
        <span className="font-mono text-slate-700 dark:text-neutral-200">"{item.query}"</span>
        <span className="text-slate-400 dark:text-neutral-500">em {item.path}</span>
      </div>
      {error && <p className="px-3 py-2 text-red-500 dark:text-red-400">{error}</p>}
      {!results && !error && <p className="px-3 py-2 text-slate-500 dark:text-neutral-400 animate-pulse">Buscando...</p>}
      {results && (
        <ul className="px-3 py-2 space-y-0.5 max-h-48 overflow-y-auto">
          {results.map((r, i) => (
            <li key={i} className="flex items-center gap-2 text-slate-600 dark:text-neutral-300">
              <span>{r.type === 'dir' ? '📁' : '📄'}</span>
              <span className="font-mono truncate">{r.path}</span>
            </li>
          ))}
          {results.length === 0 && <li className="text-slate-400 dark:text-neutral-500">Nenhum resultado encontrado</li>}
        </ul>
      )}
    </div>
  );
}

function CommandCard({ cmd }: { cmd: CommandSuggestion }) {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [output, setOutput] = useState('');
  const [exitCode, setExitCode] = useState<number | null>(null);

  const run = async () => {
    setStatus('running');
    setOutput('');
    setExitCode(null);
    try {
      const code = await execCommand(cmd.command, cmd.cwd, (type, data) => {
        if (type === 'stdout' || type === 'stderr' || type === 'error') {
          setOutput((prev) => prev + data);
        }
        if (type === 'exit') setExitCode(Number(data));
      });
      setExitCode(code);
      setStatus(code === 0 ? 'done' : 'error');
    } catch {
      setOutput((prev) => prev + '\nErro ao executar comando.');
      setStatus('error');
    }
  };

  return (
    <div className={`rounded-lg border text-xs overflow-hidden ${
      status === 'done'  ? 'border-green-600/40 bg-green-50 dark:bg-green-950/20' :
      status === 'error' ? 'border-red-600/40 bg-red-50 dark:bg-red-950/20' :
                           'border-slate-300 dark:border-neutral-600/40 bg-slate-50 dark:bg-neutral-900/60'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-neutral-800/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-green-500">$</span>
          <code className="font-mono text-slate-700 dark:text-neutral-200 truncate">{cmd.command}</code>
          {cmd.cwd && <span className="text-slate-400 dark:text-neutral-500 shrink-0 truncate max-w-[120px]" title={cmd.cwd}>{cmd.cwd}</span>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {status === 'idle' && (
            <button
              onClick={run}
              className="px-2 py-1 rounded bg-green-700 hover:bg-green-600 text-white font-medium transition-colors"
            >
              Executar
            </button>
          )}
          {status === 'running' && <span className="px-2 py-1 text-slate-500 dark:text-neutral-400 animate-pulse">Rodando...</span>}
          {status === 'done'  && <span className="px-2 py-1 text-green-600 dark:text-green-400 font-medium">✓ Concluído ({exitCode})</span>}
          {status === 'error' && <span className="px-2 py-1 text-red-500 dark:text-red-400">✗ Erro ({exitCode})</span>}
        </div>
      </div>

      {cmd.description && (
        <p className="px-3 py-1 text-slate-400 dark:text-neutral-500 border-b border-slate-200 dark:border-neutral-700/50">{cmd.description}</p>
      )}

      {/* Output */}
      {output && (
        <pre className="px-3 py-3 font-mono text-xs leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap text-slate-600 dark:text-neutral-300">
          {output}
        </pre>
      )}
    </div>
  );
}

export function Message({ message }: MessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-3`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-1">
          AI
        </div>
      )}

      <div className={`max-w-[85%] ${isUser ? 'order-first' : ''}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : 'bg-slate-100 dark:bg-neutral-800 text-slate-800 dark:text-neutral-100 rounded-tl-sm'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const isBlock = match || String(children).includes('\n');
                    if (isBlock) {
                      return (
                        <pre className="bg-slate-200 dark:bg-neutral-900 rounded-lg p-3 overflow-x-auto my-2">
                          <code className={`text-slate-700 dark:text-neutral-300 text-xs font-mono ${className || ''}`} {...props}>
                            {children}
                          </code>
                        </pre>
                      );
                    }
                    return (
                      <code className="bg-slate-200 dark:bg-neutral-900 text-blue-600 dark:text-blue-300 px-1 py-0.5 rounded text-xs font-mono" {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
              {message.isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-blue-400 animate-pulse ml-0.5" />
              )}
            </div>
          )}
        </div>

        {/* File changes */}
        {message.fileChanges && message.fileChanges.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <p className="text-xs text-slate-400 dark:text-neutral-500 px-1">
              {message.fileChanges.length === 1
                ? '1 arquivo para aplicar:'
                : `${message.fileChanges.length} arquivos para aplicar:`}
            </p>
            {message.fileChanges.map((change, i) => (
              <FileChangeCard key={i} change={change} />
            ))}
          </div>
        )}

        {/* Renames */}
        {message.renames && message.renames.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <p className="text-xs text-slate-400 dark:text-neutral-500 px-1">
              {message.renames.length === 1 ? '1 arquivo para renomear:' : `${message.renames.length} arquivos para renomear:`}
            </p>
            {message.renames.map((rename, i) => (
              <RenameCard key={i} rename={rename} />
            ))}
          </div>
        )}

        {/* Deletes */}
        {message.deletes && message.deletes.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <p className="text-xs text-slate-400 dark:text-neutral-500 px-1">
              {message.deletes.length === 1 ? '1 arquivo para apagar:' : `${message.deletes.length} arquivos para apagar:`}
            </p>
            {message.deletes.map((del, i) => (
              <DeleteCard key={i} del={del} />
            ))}
          </div>
        )}

        {/* Create dirs */}
        {message.createDirs && message.createDirs.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <p className="text-xs text-slate-400 dark:text-neutral-500 px-1">
              {message.createDirs.length === 1 ? '1 diretório para criar:' : `${message.createDirs.length} diretórios para criar:`}
            </p>
            {message.createDirs.map((item, i) => <CreateDirCard key={i} item={item} />)}
          </div>
        )}

        {/* Delete dirs */}
        {message.deleteDirs && message.deleteDirs.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <p className="text-xs text-slate-400 dark:text-neutral-500 px-1">
              {message.deleteDirs.length === 1 ? '1 diretório para apagar:' : `${message.deleteDirs.length} diretórios para apagar:`}
            </p>
            {message.deleteDirs.map((item, i) => <DeleteDirCard key={i} item={item} />)}
          </div>
        )}

        {/* List dirs */}
        {message.listDirs && message.listDirs.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {message.listDirs.map((item, i) => <ListDirCard key={i} item={item} />)}
          </div>
        )}

        {/* List subdirs */}
        {message.listSubdirs && message.listSubdirs.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {message.listSubdirs.map((item, i) => <ListSubdirsCard key={i} item={item} />)}
          </div>
        )}

        {/* List tree */}
        {message.listTrees && message.listTrees.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {message.listTrees.map((item, i) => <ListTreeCard key={i} item={item} />)}
          </div>
        )}

        {/* Search files */}
        {message.searchFiles && message.searchFiles.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {message.searchFiles.map((item, i) => <SearchFilesCard key={i} item={item} />)}
          </div>
        )}

        {/* Commands */}
        {message.commands && message.commands.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <p className="text-xs text-slate-400 dark:text-neutral-500 px-1">
              {message.commands.length === 1 ? '1 comando sugerido:' : `${message.commands.length} comandos sugeridos:`}
            </p>
            {message.commands.map((cmd, i) => (
              <CommandCard key={i} cmd={cmd} />
            ))}
          </div>
        )}

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {message.sources.slice(0, 3).map((s, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 rounded-full border border-slate-300 dark:border-neutral-700"
                title={`${s.repo}/${s.filePath}`}
              >
                {s.language} · {Math.round(s.score * 100)}%
              </span>
            ))}
          </div>
        )}

        {/* Model indicator */}
        {message.model && (
          <div className="mt-1 text-xs text-slate-400 dark:text-neutral-500">
            via {message.model === 'claude' ? 'Claude API' : 'Ollama local'}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-neutral-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-white flex-shrink-0 mt-1">
          U
        </div>
      )}
    </div>
  );
}
