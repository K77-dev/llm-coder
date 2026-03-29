'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useChat } from '../../lib/hooks/useChat';
import { listTree, readFile, getLlamaStatus, TreeEntry } from '../../lib/api';
import { Message } from './Message';

interface ChatInterfaceProps {
  compact?: boolean;
}

interface FlatFile {
  path: string;
  name: string;
  relativePath: string;
  type: 'file' | 'dir';
}

const HIDDEN_DIRS = new Set([
  'node_modules', '.git', '.next', '.DS_Store', '__pycache__',
  '.cache', '.turbo', 'dist', '.nuxt', '.output', '.swc',
]);

function flattenTree(entries: TreeEntry[], parentPath: string, rootPath: string): FlatFile[] {
  const result: FlatFile[] = [];
  for (const entry of entries) {
    if (HIDDEN_DIRS.has(entry.name)) continue;
    const fullPath = `${parentPath}/${entry.name}`;
    const relativePath = fullPath.slice(rootPath.length + 1);
    result.push({ path: fullPath, name: entry.name, relativePath, type: entry.type });
    if (entry.children) {
      result.push(...flattenTree(entry.children, fullPath, rootPath));
    }
  }
  return result;
}

function getAtMention(text: string, cursorPos: number): { query: string; start: number } | null {
  let i = cursorPos - 1;
  while (i >= 0 && text[i] !== '@' && text[i] !== '\n') {
    i--;
  }
  if (i >= 0 && text[i] === '@' && (i === 0 || text[i - 1] === ' ' || text[i - 1] === '\n')) {
    const query = text.slice(i + 1, cursorPos);
    return { query, start: i };
  }
  return null;
}

function getFileIconColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const colors: Record<string, string> = {
    ts: 'text-blue-400', tsx: 'text-blue-400',
    js: 'text-yellow-400', jsx: 'text-yellow-400',
    json: 'text-yellow-300', css: 'text-sky-300',
    html: 'text-orange-400', md: 'text-blue-200',
    py: 'text-green-400', java: 'text-red-400',
    yml: 'text-purple-400', yaml: 'text-purple-400',
  };
  return colors[ext] || 'text-neutral-500';
}

export function ChatInterface({ compact }: ChatInterfaceProps) {
  const { messages, isLoading, error, sendMessage, clearMessages } = useChat();
  const [input, setInput] = useState('');
  const [llmRunning, setLlmRunning] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const checkStatus = () => {
      getLlamaStatus()
        .then((s) => setLlmRunning(s.status === 'running'))
        .catch(() => setLlmRunning(false));
    };
    checkStatus();
    const interval = setInterval(checkStatus, 2000);
    const handleModelChange = () => {
      setLlmRunning(false);
      checkStatus();
    };
    window.addEventListener('llm:model-changing', handleModelChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener('llm:model-changing', handleModelChange);
    };
  }, []);

  // @ mention state
  const [attachedFiles, setAttachedFiles] = useState<FlatFile[]>([]);
  const [showMention, setShowMention] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [flatFiles, setFlatFiles] = useState<FlatFile[]>([]);
  const [filesLoaded, setFilesLoaded] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load file tree lazily
  const loadFileTree = useCallback(async () => {
    const projectDir = localStorage.getItem('projectDir');
    if (!projectDir || filesLoaded || filesLoading) return;
    setFilesLoading(true);
    try {
      const result = await listTree(projectDir, 4);
      const flat = flattenTree(result.tree, projectDir, projectDir);
      setFlatFiles(flat);
      setFilesLoaded(true);
    } catch {
      // silent fail
    } finally {
      setFilesLoading(false);
    }
  }, [filesLoaded, filesLoading]);

  // Filtered files for dropdown
  const filteredFiles = showMention
    ? flatFiles
        .filter(f => {
          const q = mentionQuery.toLowerCase();
          if (!q) return true;
          return f.relativePath.toLowerCase().includes(q) || f.name.toLowerCase().includes(q);
        })
        .slice(0, 12)
    : [];

  // Clamp mention index
  useEffect(() => {
    if (mentionIndex >= filteredFiles.length) {
      setMentionIndex(Math.max(0, filteredFiles.length - 1));
    }
  }, [filteredFiles.length, mentionIndex]);

  // Scroll active item into view
  useEffect(() => {
    if (!showMention || !dropdownRef.current) return;
    const active = dropdownRef.current.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [mentionIndex, showMention]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!showMention) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowMention(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMention]);

  const selectFile = useCallback((file: FlatFile) => {
    // Remove @query from input
    const before = input.slice(0, mentionStart);
    const after = input.slice(mentionStart + mentionQuery.length + 1);
    setInput(before + after);

    // Add to attached files if not already there
    if (!attachedFiles.find(f => f.path === file.path)) {
      setAttachedFiles(prev => [...prev, file]);
    }

    setShowMention(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [input, mentionStart, mentionQuery, attachedFiles]);

  const removeFile = useCallback((path: string) => {
    setAttachedFiles(prev => prev.filter(f => f.path !== path));
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    const cursorPos = e.target.selectionStart || 0;
    const mention = getAtMention(value, cursorPos);
    if (mention) {
      setShowMention(true);
      setMentionQuery(mention.query);
      setMentionStart(mention.start);
      setMentionIndex(0);
      if (!filesLoaded && !filesLoading) loadFileTree();
    } else {
      setShowMention(false);
    }
  }, [filesLoaded, filesLoading, loadFileTree]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && attachedFiles.length === 0) return;
    if (isLoading || !llmRunning) return;

    let msg = input.trim();

    // Read attached files and prepend their content
    if (attachedFiles.length > 0) {
      const fileContents = await Promise.all(
        attachedFiles.map(async (file) => {
          if (file.type === 'dir') {
            return `=== Diretório referenciado ===\nCaminho absoluto: ${file.path}\nNome: ${file.name}\n===`;
          }
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          const BINARY_EXTS = new Set(['docx','xlsx','pptx','pdf','zip','tar','gz','rar','7z','exe','dll','so','dylib','png','jpg','jpeg','gif','bmp','ico','svg','mp3','mp4','avi','mov','woff','woff2','ttf','otf','eot','class','jar','war','ear','db','sqlite']);
          if (BINARY_EXTS.has(ext)) {
            return `=== Arquivo referenciado ===\nCaminho absoluto: ${file.path}\nNome: ${file.name}\nTipo: binário (${ext}) — conteúdo não exibido\n===`;
          }
          try {
            const result = await readFile(file.path);
            return `=== Arquivo referenciado ===\nCaminho absoluto: ${file.path}\nNome: ${file.name}\nConteúdo:\n\`\`\`${ext}\n${result.content}\n\`\`\`\n===`;
          } catch {
            return `=== Arquivo referenciado ===\nCaminho absoluto: ${file.path}\nNome: ${file.name}\n(falha ao ler conteúdo)\n===`;
          }
        })
      );
      msg = fileContents.join('\n\n') + '\n\n' + msg;
    }

    setInput('');
    setAttachedFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await sendMessage(msg, { useStream: true });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMention && filteredFiles.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => Math.min(prev + 1, filteredFiles.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectFile(filteredFiles[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMention(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && !showMention) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  // Mention dropdown component
  const MentionDropdown = () => {
    if (!showMention) return null;

    return (
      <div
        ref={dropdownRef}
        className="absolute bottom-full left-0 right-0 mb-1 bg-[#252526] border border-[#454545] rounded shadow-xl max-h-[240px] overflow-y-auto z-50"
      >
        {filesLoading && (
          <div className="px-3 py-2 text-[12px] text-neutral-500 animate-pulse">
            Carregando arquivos...
          </div>
        )}
        {!filesLoading && filteredFiles.length === 0 && (
          <div className="px-3 py-2 text-[12px] text-neutral-500">
            {mentionQuery ? 'Nenhum arquivo encontrado' : 'Digite para filtrar'}
          </div>
        )}
        {filteredFiles.map((file, i) => (
          <button
            key={file.path}
            data-active={i === mentionIndex}
            onClick={() => selectFile(file)}
            onMouseEnter={() => setMentionIndex(i)}
            className={`w-full flex items-center gap-2 px-3 py-[5px] text-[13px] text-left transition-colors ${
              i === mentionIndex ? 'bg-[#094771] text-white' : 'text-neutral-300 hover:bg-[#2a2d2e]'
            }`}
          >
            {file.type === 'dir' ? (
              <svg className="w-4 h-4 shrink-0 text-yellow-500/80" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1 3.5A1.5 1.5 0 012.5 2h3.879a1.5 1.5 0 011.06.44l1.122 1.12A1.5 1.5 0 009.62 4H13.5A1.5 1.5 0 0115 5.5v8a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 13.5v-10z" />
              </svg>
            ) : (
              <span className={`text-[10px] ${getFileIconColor(file.name)}`}>{'\u25CF'}</span>
            )}
            <span className="truncate flex-1">
              <span className="text-neutral-400">{file.relativePath.includes('/') ? file.relativePath.slice(0, file.relativePath.lastIndexOf('/') + 1) : ''}</span>
              <span className={i === mentionIndex ? 'text-white' : 'text-neutral-200'}>{file.name}</span>
            </span>
            <span className="text-[11px] text-neutral-600 shrink-0">
              {file.type === 'dir' ? 'pasta' : file.name.split('.').pop()}
            </span>
          </button>
        ))}
      </div>
    );
  };

  // Attached files chips
  const AttachedFilesChips = () => {
    if (attachedFiles.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1 px-1 pb-1.5">
        {attachedFiles.map((file) => (
          <span
            key={file.path}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#2d2d2d] border border-[#454545] rounded text-[12px] text-neutral-300 group"
            title={file.path}
          >
            {file.type === 'dir' ? (
              <svg className="w-3 h-3 text-yellow-500/80 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1 3.5A1.5 1.5 0 012.5 2h3.879a1.5 1.5 0 011.06.44l1.122 1.12A1.5 1.5 0 009.62 4H13.5A1.5 1.5 0 0115 5.5v8a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 13.5v-10z" />
              </svg>
            ) : (
              <span className={`text-[8px] ${getFileIconColor(file.name)} shrink-0`}>{'\u25CF'}</span>
            )}
            <span className="truncate max-w-[160px]">{file.relativePath}</span>
            <button
              onClick={() => removeFile(file.path)}
              className="ml-0.5 text-neutral-500 hover:text-white transition-colors leading-none"
              title="Remover"
            >
              {'\u00D7'}
            </button>
          </span>
        ))}
      </div>
    );
  };

  if (compact) {
    return (
      <div className="flex flex-col h-full bg-[#1e1e1e]">
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-1 bg-[#252526] border-b border-[#1e1e1e] shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-white">
              Chat
            </span>
            <span className="text-[11px] text-neutral-500 uppercase tracking-wide cursor-pointer hover:text-neutral-300">
              Terminal
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isLoading && (
              <span className="text-[11px] text-blue-400 animate-pulse">Gerando...</span>
            )}
            <button
              onClick={clearMessages}
              className="text-neutral-500 hover:text-white transition-colors p-1"
              title="Nova conversa"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {messages.map((msg) => (
            <Message key={msg.id} message={msg} />
          ))}

          {error && (
            <div className="px-3 py-2 bg-red-900/30 border border-red-800/50 rounded text-red-400 text-xs">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="px-4 py-2 border-t border-[#252526] shrink-0">
          <AttachedFilesChips />
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="flex-1 relative">
              <MentionDropdown />
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={llmRunning ? "Pergunte algo... (@ para referenciar arquivos)" : "Selecione um modelo para iniciar..."}
                rows={1}
                disabled={!llmRunning}
                className="w-full resize-none bg-[#3c3c3c] text-[#cccccc] placeholder-neutral-500 rounded px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#007acc] border border-[#3c3c3c] focus:border-[#007acc] min-h-[34px] max-h-24 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ height: 'auto' }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
                }}
              />
            </div>
            <button
              type="submit"
              disabled={!llmRunning || isLoading || (!input.trim() && attachedFiles.length === 0)}
              className="px-3 py-2 bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded text-[13px] font-medium transition-colors shrink-0"
            >
              {isLoading ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11z" opacity="0.25" />
                  <path d="M8 1a7 7 0 017 7h-1.5A5.5 5.5 0 008 2.5V1z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Full-page mode (fallback)
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-neutral-800">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Code LLM</h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400">Java {'\u00B7'} Node.js {'\u00B7'} React {'\u00B7'} Angular</p>
        </div>
        <button
          onClick={clearMessages}
          className="text-xs text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          Nova conversa
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg) => (
          <Message key={msg.id} message={msg} />
        ))}
        {error && (
          <div className="px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-6 py-4 border-t border-slate-200 dark:border-neutral-800">
        <AttachedFilesChips />
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <MentionDropdown />
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={llmRunning ? "Pergunte algo... (@ para referenciar arquivos)" : "Selecione um modelo para iniciar..."}
              rows={1}
              disabled={!llmRunning}
              className="w-full resize-none bg-slate-100 dark:bg-neutral-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] max-h-32 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ height: 'auto' }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!llmRunning || isLoading || (!input.trim() && attachedFiles.length === 0)}
            className="px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"
          >
            {isLoading ? '...' : 'Enviar'}
          </button>
        </form>
        <div className="mt-2">
          <span className="text-xs text-slate-400 dark:text-neutral-500">Enter para enviar {'\u00B7'} Shift+Enter para nova linha {'\u00B7'} @ para referenciar arquivos</span>
        </div>
      </div>
    </div>
  );
}
