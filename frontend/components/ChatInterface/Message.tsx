'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message as MessageType } from '../../lib/hooks/useChat';
import { writeFile, renameFile, deleteFile, createDir, deleteDir, listDir, listSubdirs as listSubdirsApi, searchFiles as searchFilesApi, listTree as listTreeApi, FileChange, RenameChange, DeleteChange, CreateDir, DeleteDir, ListDir, ListSubdirs, ListTree, SearchFiles, DirEntry, TreeEntry, SearchResult, CommandSuggestion, execCommand } from '../../lib/api';

interface MessageProps {
  message: MessageType;
}

/* ── Card shell used by all operation cards ── */
function CardShell({ children, status }: { children: React.ReactNode; status?: 'ok' | 'err' | 'neutral' }) {
  const border =
    status === 'ok'  ? 'border-green-500/30' :
    status === 'err' ? 'border-red-500/30' :
                       'border-[#333]/60';
  return (
    <div className={`rounded-md border ${border} bg-[#1a1a1a] text-[13px] font-mono overflow-hidden`}>
      {children}
    </div>
  );
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-[6px] bg-[#222] border-b border-[#333]/40">
      {children}
    </div>
  );
}

/* ── Status badge ── */
function Badge({ status, children }: { status: 'idle' | 'ok' | 'loading' | 'err'; children: React.ReactNode }) {
  const cls =
    status === 'ok'      ? 'text-green-400' :
    status === 'err'     ? 'text-red-400' :
    status === 'loading' ? 'text-neutral-400 animate-pulse' :
                           '';
  return <span className={`text-[12px] ${cls}`}>{String(children)}</span>;
}

/* ── File write card ── */
function FileChangeCard({ change }: { change: FileChange }) {
  const [status, setStatus] = useState<'idle' | 'applying' | 'applied' | 'error'>('idle');
  const [expanded, setExpanded] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const lines = change.content.split('\n').length;

  const apply = async () => {
    setStatus('applying');
    try { await writeFile(change.path, change.content); setStatus('applied'); }
    catch { setStatus('error'); setErrorMsg('Falha ao aplicar.'); }
  };

  const cardStatus = status === 'applied' ? 'ok' : status === 'error' ? 'err' : 'neutral';

  return (
    <CardShell status={cardStatus}>
      <CardHeader>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-green-400">{status === 'applied' ? '\u2713' : '\u25CB'}</span>
          <span className="text-neutral-300 truncate">{change.path}</span>
          <span className="text-neutral-500">{lines} linhas</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <button onClick={() => setExpanded(v => !v)} className="px-2 py-0.5 rounded text-[12px] text-neutral-400 hover:text-white hover:bg-[#333] transition-colors">
            {expanded ? 'Ocultar' : 'Ver'}
          </button>
          {status === 'idle' && (
            <button onClick={apply} className="px-2.5 py-0.5 rounded bg-[#2ea043] hover:bg-[#3fb950] text-white text-[12px] font-medium transition-colors">
              Aplicar
            </button>
          )}
          {status === 'applying' && <Badge status="loading">Aplicando...</Badge>}
          {status === 'applied'  && <Badge status="ok">{'\u2713'} Aplicado</Badge>}
          {status === 'error'    && <Badge status="err">{'\u2717'} Erro</Badge>}
        </div>
      </CardHeader>
      {status === 'error' && errorMsg && (
        <p className="px-3 py-1 text-red-400 text-[12px]">{errorMsg}</p>
      )}
      {expanded && (
        <pre className="px-3 py-2 overflow-x-auto text-neutral-400 text-[12px] leading-[18px] max-h-72 overflow-y-auto">
          {change.content}
        </pre>
      )}
    </CardShell>
  );
}

/* ── Rename card ── */
function RenameCard({ rename }: { rename: RenameChange }) {
  const [status, setStatus] = useState<'idle' | 'applying' | 'applied' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const apply = async () => {
    setStatus('applying');
    try { await renameFile(rename.from, rename.to); setStatus('applied'); }
    catch (err) { setStatus('error'); setErrorMsg(err instanceof Error ? err.message : 'Falha ao renomear.'); }
  };
  const cardStatus = status === 'applied' ? 'ok' : status === 'error' ? 'err' : 'neutral';
  return (
    <CardShell status={cardStatus}>
      <CardHeader>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-blue-400">{'\u21AA'}</span>
          <span className="text-neutral-500 truncate">{rename.from.split('/').pop()}</span>
          <span className="text-neutral-500">{'\u2192'}</span>
          <span className="text-neutral-300 truncate">{rename.to.split('/').pop()}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {status === 'idle' && <button onClick={apply} className="px-2.5 py-0.5 rounded bg-[#2ea043] hover:bg-[#3fb950] text-white text-[12px] font-medium transition-colors">Renomear</button>}
          {status === 'applying' && <Badge status="loading">Renomeando...</Badge>}
          {status === 'applied'  && <Badge status="ok">{'\u2713'} Renomeado</Badge>}
          {status === 'error'    && <Badge status="err">{'\u2717'} Erro</Badge>}
        </div>
      </CardHeader>
      {status === 'error' && errorMsg && <p className="px-3 py-1 text-red-400 text-[12px]">{errorMsg}</p>}
    </CardShell>
  );
}

/* ── Delete card ── */
function DeleteCard({ del }: { del: DeleteChange }) {
  const [status, setStatus] = useState<'idle' | 'deleting' | 'deleted' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const apply = async () => {
    setStatus('deleting');
    try { await deleteFile(del.path); setStatus('deleted'); }
    catch (err) { setStatus('error'); setErrorMsg(err instanceof Error ? err.message : 'Falha ao apagar.'); }
  };
  const cardStatus = status === 'deleted' ? 'ok' : status === 'error' ? 'err' : 'neutral';
  return (
    <CardShell status={cardStatus}>
      <CardHeader>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-red-400">{'\u2717'}</span>
          <span className="text-neutral-300 truncate">{del.path}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {status === 'idle' && <button onClick={apply} className="px-2.5 py-0.5 rounded bg-red-700 hover:bg-red-600 text-white text-[12px] font-medium transition-colors">Apagar</button>}
          {status === 'deleting' && <Badge status="loading">Apagando...</Badge>}
          {status === 'deleted'  && <Badge status="ok">{'\u2713'} Apagado</Badge>}
          {status === 'error'    && <Badge status="err">{'\u2717'} Erro</Badge>}
        </div>
      </CardHeader>
      {status === 'error' && errorMsg && <p className="px-3 py-1 text-red-400 text-[12px]">{errorMsg}</p>}
    </CardShell>
  );
}

/* ── Create dir card ── */
function CreateDirCard({ item }: { item: CreateDir }) {
  const [status, setStatus] = useState<'idle' | 'creating' | 'created' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const apply = async () => {
    setStatus('creating');
    try { await createDir(item.path); setStatus('created'); }
    catch { setStatus('error'); setErrorMsg('Falha ao criar diretorio.'); }
  };
  const cardStatus = status === 'created' ? 'ok' : status === 'error' ? 'err' : 'neutral';
  return (
    <CardShell status={cardStatus}>
      <CardHeader>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-green-400">+</span>
          <span className="text-neutral-300 truncate">{item.path}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {status === 'idle' && <button onClick={apply} className="px-2.5 py-0.5 rounded bg-[#2ea043] hover:bg-[#3fb950] text-white text-[12px] font-medium transition-colors">Criar</button>}
          {status === 'creating' && <Badge status="loading">Criando...</Badge>}
          {status === 'created'  && <Badge status="ok">{'\u2713'} Criado</Badge>}
          {status === 'error'    && <Badge status="err">{'\u2717'} Erro</Badge>}
        </div>
      </CardHeader>
      {status === 'error' && errorMsg && <p className="px-3 py-1 text-red-400 text-[12px]">{errorMsg}</p>}
    </CardShell>
  );
}

/* ── Delete dir card ── */
function DeleteDirCard({ item }: { item: DeleteDir }) {
  const [status, setStatus] = useState<'idle' | 'deleting' | 'deleted' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const apply = async () => {
    setStatus('deleting');
    try { await deleteDir(item.path); setStatus('deleted'); }
    catch { setStatus('error'); setErrorMsg('Falha ao apagar diretorio.'); }
  };
  const cardStatus = status === 'deleted' ? 'ok' : status === 'error' ? 'err' : 'neutral';
  return (
    <CardShell status={cardStatus}>
      <CardHeader>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-red-400">{'\u2717'}</span>
          <span className="text-neutral-300 truncate">{item.path}/</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {status === 'idle' && <button onClick={apply} className="px-2.5 py-0.5 rounded bg-red-700 hover:bg-red-600 text-white text-[12px] font-medium transition-colors">Apagar</button>}
          {status === 'deleting' && <Badge status="loading">Apagando...</Badge>}
          {status === 'deleted'  && <Badge status="ok">{'\u2713'} Apagado</Badge>}
          {status === 'error'    && <Badge status="err">{'\u2717'} Erro</Badge>}
        </div>
      </CardHeader>
      {status === 'error' && errorMsg && <p className="px-3 py-1 text-red-400 text-[12px]">{errorMsg}</p>}
    </CardShell>
  );
}

/* ── List dir card ── */
function ListDirCard({ item }: { item: ListDir }) {
  const [entries, setEntries] = useState<DirEntry[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { listDir(item.path).then(r => setEntries(r.entries)).catch(() => setError('Falha ao listar.')); }, [item.path]);
  return (
    <CardShell>
      <CardHeader>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-green-400">{entries ? '\u2713' : '\u25CB'}</span>
          <span className="text-neutral-400">Listando</span>
          <span className="text-neutral-200 truncate">{item.path}</span>
        </div>
      </CardHeader>
      {error && <p className="px-3 py-1.5 text-red-400 text-[12px]">{error}</p>}
      {!entries && !error && <p className="px-3 py-1.5 text-neutral-500 text-[12px] animate-pulse">Carregando...</p>}
      {entries && (
        <div className="px-3 py-1.5 max-h-48 overflow-y-auto space-y-px">
          {entries.map(e => (
            <div key={e.name} className="flex items-center gap-2 text-[12px] leading-[20px]">
              <span className={e.type === 'dir' ? 'text-yellow-400' : 'text-neutral-500'}>{e.type === 'dir' ? '\u25B8' : ' '}</span>
              <span className={e.type === 'dir' ? 'text-yellow-300' : 'text-neutral-400'}>{e.name}{e.type === 'dir' ? '/' : ''}</span>
              {e.size !== undefined && <span className="text-neutral-600 ml-auto">{(e.size / 1024).toFixed(1)}K</span>}
            </div>
          ))}
          {entries.length === 0 && <div className="text-neutral-500 text-[12px]">(vazio)</div>}
        </div>
      )}
    </CardShell>
  );
}

/* ── List subdirs card ── */
function ListSubdirsCard({ item }: { item: ListSubdirs }) {
  const [entries, setEntries] = useState<DirEntry[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { listSubdirsApi(item.path).then(r => setEntries(r.entries)).catch(() => setError('Falha ao listar.')); }, [item.path]);
  return (
    <CardShell>
      <CardHeader>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-green-400">{entries ? '\u2713' : '\u25CB'}</span>
          <span className="text-neutral-400">Subdiretorios de</span>
          <span className="text-neutral-200 truncate">{item.path}</span>
        </div>
      </CardHeader>
      {error && <p className="px-3 py-1.5 text-red-400 text-[12px]">{error}</p>}
      {!entries && !error && <p className="px-3 py-1.5 text-neutral-500 text-[12px] animate-pulse">Carregando...</p>}
      {entries && (
        <div className="px-3 py-1.5 max-h-48 overflow-y-auto space-y-px">
          {entries.map(e => (
            <div key={e.name} className="text-[12px] leading-[20px] text-yellow-300">{'\u25B8'} {e.name}/</div>
          ))}
          {entries.length === 0 && <div className="text-neutral-500 text-[12px]">(nenhum)</div>}
        </div>
      )}
    </CardShell>
  );
}

/* ── Tree node ── */
function TreeNode({ entry, depth }: { entry: TreeEntry; depth: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const indent = depth * 16;
  if (entry.type === 'dir') {
    return (
      <div>
        <button
          onClick={() => setCollapsed(v => !v)}
          className="flex items-center gap-1 text-[12px] leading-[20px] text-yellow-300 hover:text-yellow-200 w-full text-left"
          style={{ paddingLeft: indent }}
        >
          <span className="text-[10px] w-3 text-center text-neutral-500">{collapsed ? '\u25B8' : '\u25BE'}</span>
          <span>{entry.name}/</span>
        </button>
        {!collapsed && entry.children?.map((child, i) => (
          <TreeNode key={i} entry={child} depth={depth + 1} />
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-[12px] leading-[20px] text-neutral-400" style={{ paddingLeft: indent + 16 }}>
      <span>{entry.name}</span>
      {entry.size !== undefined && <span className="text-neutral-600 ml-auto">{(entry.size / 1024).toFixed(1)}K</span>}
    </div>
  );
}

/* ── List tree card ── */
function ListTreeCard({ item }: { item: ListTree }) {
  const [tree, setTree] = useState<TreeEntry[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { listTreeApi(item.path).then(r => setTree(r.tree)).catch(() => setError('Falha ao listar arvore.')); }, [item.path]);
  return (
    <CardShell>
      <CardHeader>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-green-400">{tree ? '\u2713' : '\u25CB'}</span>
          <span className="text-neutral-400">Arvore de</span>
          <span className="text-neutral-200 truncate">{item.path}</span>
        </div>
      </CardHeader>
      {error && <p className="px-3 py-1.5 text-red-400 text-[12px]">{error}</p>}
      {!tree && !error && <p className="px-3 py-1.5 text-neutral-500 text-[12px] animate-pulse">Carregando...</p>}
      {tree && (
        <div className="px-2 py-1.5 max-h-64 overflow-y-auto">
          {tree.map((entry, i) => <TreeNode key={i} entry={entry} depth={0} />)}
          {tree.length === 0 && <div className="text-neutral-500 text-[12px] px-3">(vazio)</div>}
        </div>
      )}
    </CardShell>
  );
}

/* ── Search files card ── */
function SearchFilesCard({ item }: { item: SearchFiles }) {
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { searchFilesApi(item.path, item.query).then(r => setResults(r.results)).catch(() => setError('Falha ao buscar.')); }, [item.path, item.query]);
  return (
    <CardShell>
      <CardHeader>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-green-400">{results ? '\u2713' : '\u25CB'}</span>
          <span className="text-neutral-400">Busca:</span>
          <span className="text-green-300">{item.query}</span>
          <span className="text-neutral-500">em {item.path}</span>
        </div>
      </CardHeader>
      {error && <p className="px-3 py-1.5 text-red-400 text-[12px]">{error}</p>}
      {!results && !error && <p className="px-3 py-1.5 text-neutral-500 text-[12px] animate-pulse">Buscando...</p>}
      {results && (
        <div className="px-3 py-1.5 max-h-48 overflow-y-auto space-y-px">
          {results.map((r, i) => (
            <div key={i} className="text-[12px] leading-[20px] text-neutral-400">
              <span className={r.type === 'dir' ? 'text-yellow-300' : 'text-neutral-300'}>{r.path}</span>
            </div>
          ))}
          {results.length === 0 && <div className="text-neutral-500 text-[12px]">Nenhum resultado</div>}
        </div>
      )}
    </CardShell>
  );
}

/* ── Command card (Warp-style action block) ── */
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
        if (type === 'stdout' || type === 'stderr' || type === 'error') setOutput(prev => prev + data);
        if (type === 'exit') setExitCode(Number(data));
      });
      setExitCode(code);
      setStatus(code === 0 ? 'done' : 'error');
    } catch {
      setOutput(prev => prev + '\nErro ao executar comando.');
      setStatus('error');
    }
  };

  const cardStatus = status === 'done' ? 'ok' : status === 'error' ? 'err' : 'neutral';

  return (
    <CardShell status={cardStatus}>
      {/* Warp-style confirmation bar */}
      {status === 'idle' && (
        <div className="flex items-center justify-between px-3 py-2 bg-[#1a1a1a]">
          <span className="text-[13px] text-neutral-300">OK if I run this command and read the output?</span>
          <div className="flex items-center gap-1.5 shrink-0 ml-3">
            <span className="text-[11px] text-neutral-500 px-1">Reject</span>
            <span className="text-neutral-600 text-[11px]">{'\u2038'}</span>
            <span className="text-neutral-600 text-[11px]">C</span>
            <span className="text-[11px] text-neutral-500 px-1">Edit</span>
            <span className="text-neutral-600 text-[11px]">{'\u2318'}</span>
            <span className="text-neutral-600 text-[11px]">E</span>
            <button
              onClick={run}
              className="ml-1 flex items-center gap-1 px-3 py-1 rounded bg-[#2ea043] hover:bg-[#3fb950] text-white text-[12px] font-medium transition-colors"
            >
              Run
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              <span className="text-white/60 text-[10px] ml-0.5">{'\u25BC'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Command display */}
      <div className="px-3 py-2 bg-[#111]">
        <code className="text-[13px] text-neutral-300 leading-[20px]">{cmd.command}</code>
      </div>

      {/* Running/Done header */}
      {status !== 'idle' && (
        <div className="flex items-center gap-2 px-3 py-1 border-t border-[#333]/40">
          {status === 'running' && <Badge status="loading">Executando...</Badge>}
          {status === 'done'    && <Badge status="ok">{'\u2713'} Concluido (exit {exitCode})</Badge>}
          {status === 'error'   && <Badge status="err">{'\u2717'} Erro (exit {exitCode})</Badge>}
        </div>
      )}

      {/* Output */}
      {output && (
        <pre className="px-3 py-2 text-[12px] leading-[18px] max-h-64 overflow-y-auto whitespace-pre-wrap text-neutral-400 border-t border-[#333]/40">
          {output}
        </pre>
      )}
    </CardShell>
  );
}

/* ══════════════════════════════════════════════════
   Main Message component — Warp terminal block style
   ══════════════════════════════════════════════════ */
export function Message({ message }: MessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className="group">
      {/* ── User message: avatar + bold text, like Warp prompt block ── */}
      {isUser ? (
        <div className="flex items-start gap-2.5">
          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-0.5">
            U
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-white leading-[22px] whitespace-pre-wrap break-words">
              {message.content}
            </p>
          </div>
          <button className="text-neutral-600 hover:text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" title="Opcoes">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
          </button>
        </div>
      ) : (
        /* ── Assistant message: Warp output block ── */
        <div className="flex items-start gap-2.5">
          <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-0.5">
            AI
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            {/* Thinking indicator */}
            {message.isStreaming && !message.content && (
              <div className="text-[13px] text-neutral-500 flex items-center gap-1.5">
                <svg className="animate-spin w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11z" opacity="0.2" />
                  <path d="M8 1a7 7 0 017 7h-1.5A5.5 5.5 0 008 2.5V1z" />
                </svg>
                Pensando...
              </div>
            )}

            {/* Markdown content in a Warp-style output block */}
            {message.content && (
              <div className="text-[13px] leading-[20px] text-neutral-300 font-mono">
                <ReactMarkdown
                  components={{
                    p({ children }) {
                      return <p className="mb-2 last:mb-0">{children}</p>;
                    },
                    strong({ children }) {
                      return <strong className="text-white font-semibold">{children}</strong>;
                    },
                    em({ children }) {
                      return <em className="text-neutral-200">{children}</em>;
                    },
                    ul({ children }) {
                      return <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>;
                    },
                    ol({ children }) {
                      return <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>;
                    },
                    li({ children }) {
                      return <li className="text-neutral-300">{children}</li>;
                    },
                    h1({ children }) {
                      return <h1 className="text-white font-bold text-[15px] mb-1 mt-2">{children}</h1>;
                    },
                    h2({ children }) {
                      return <h2 className="text-white font-bold text-[14px] mb-1 mt-2">{children}</h2>;
                    },
                    h3({ children }) {
                      return <h3 className="text-white font-semibold text-[13px] mb-1 mt-1.5">{children}</h3>;
                    },
                    a({ children, href }) {
                      return <a href={href} className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>;
                    },
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      const isBlock = match || String(children).includes('\n');
                      if (isBlock) {
                        return (
                          <div className="my-2 rounded-md border border-[#333]/60 bg-[#111] overflow-hidden">
                            {match && (
                              <div className="px-3 py-1 text-[11px] text-neutral-500 bg-[#1a1a1a] border-b border-[#333]/40">
                                {match[1]}
                              </div>
                            )}
                            <pre className="px-3 py-2 overflow-x-auto">
                              <code className="text-[12px] leading-[18px] text-green-300" {...props}>
                                {children}
                              </code>
                            </pre>
                          </div>
                        );
                      }
                      return (
                        <code className="bg-[#2a2a2a] text-green-300 px-1 py-0.5 rounded text-[12px]" {...props}>
                          {children}
                        </code>
                      );
                    },
                    blockquote({ children }) {
                      return <blockquote className="border-l-2 border-neutral-600 pl-3 text-neutral-400 my-2">{children}</blockquote>;
                    },
                    hr() {
                      return <hr className="border-[#333] my-3" />;
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>
                {message.isStreaming && (
                  <span className="inline-block w-[6px] h-[14px] bg-green-400 animate-pulse ml-0.5 align-middle" />
                )}
              </div>
            )}

            {/* ── Operation cards ── */}
            {message.fileChanges && message.fileChanges.length > 0 && (
              <div className="space-y-1.5">{message.fileChanges.map((c, i) => <FileChangeCard key={i} change={c} />)}</div>
            )}
            {message.renames && message.renames.length > 0 && (
              <div className="space-y-1.5">{message.renames.map((r, i) => <RenameCard key={i} rename={r} />)}</div>
            )}
            {message.deletes && message.deletes.length > 0 && (
              <div className="space-y-1.5">{message.deletes.map((d, i) => <DeleteCard key={i} del={d} />)}</div>
            )}
            {message.createDirs && message.createDirs.length > 0 && (
              <div className="space-y-1.5">{message.createDirs.map((d, i) => <CreateDirCard key={i} item={d} />)}</div>
            )}
            {message.deleteDirs && message.deleteDirs.length > 0 && (
              <div className="space-y-1.5">{message.deleteDirs.map((d, i) => <DeleteDirCard key={i} item={d} />)}</div>
            )}
            {message.listDirs && message.listDirs.length > 0 && (
              <div className="space-y-1.5">{message.listDirs.map((d, i) => <ListDirCard key={i} item={d} />)}</div>
            )}
            {message.listSubdirs && message.listSubdirs.length > 0 && (
              <div className="space-y-1.5">{message.listSubdirs.map((d, i) => <ListSubdirsCard key={i} item={d} />)}</div>
            )}
            {message.listTrees && message.listTrees.length > 0 && (
              <div className="space-y-1.5">{message.listTrees.map((d, i) => <ListTreeCard key={i} item={d} />)}</div>
            )}
            {message.searchFiles && message.searchFiles.length > 0 && (
              <div className="space-y-1.5">{message.searchFiles.map((d, i) => <SearchFilesCard key={i} item={d} />)}</div>
            )}
            {message.commands && message.commands.length > 0 && (
              <div className="space-y-1.5">{message.commands.map((c, i) => <CommandCard key={i} cmd={c} />)}</div>
            )}

            {/* Sources */}
            {message.sources && message.sources.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {message.sources.slice(0, 3).map((s, i) => (
                  <span key={i} className="text-[11px] px-1.5 py-0.5 bg-[#1a1a1a] text-neutral-500 rounded border border-[#333]/40" title={`${s.repo}/${s.filePath}`}>
                    {s.language} {'\u00B7'} {Math.round(s.score * 100)}%
                  </span>
                ))}
              </div>
            )}

            {/* Model indicator */}
            {message.model && (
              <div className="text-[11px] text-neutral-600 pt-0.5">
                via {message.model === 'claude' ? 'Claude API' : 'Ollama local'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
