'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message as MessageType } from '../../lib/hooks/useChat';
import { writeFile, FileChange, CommandSuggestion, execCommand } from '../../lib/api';

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
      status === 'applied' ? 'border-green-600/40 bg-green-950/20' :
      status === 'error'   ? 'border-red-600/40 bg-red-950/20' :
                             'border-slate-600/40 bg-slate-900/60'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-yellow-500">📄</span>
          <span className="font-mono text-slate-200 truncate">{change.path}</span>
          <span className="text-slate-500 shrink-0">{lines} linhas</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
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
        <p className="px-3 py-1.5 text-red-400 text-xs bg-red-950/30">{errorMsg}</p>
      )}

      {/* Code preview */}
      {expanded && (
        <pre className="px-3 py-3 overflow-x-auto text-slate-300 font-mono text-xs leading-relaxed max-h-80 overflow-y-auto">
          {change.content}
        </pre>
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
      status === 'done'  ? 'border-green-600/40 bg-green-950/20' :
      status === 'error' ? 'border-red-600/40 bg-red-950/20' :
                           'border-slate-600/40 bg-slate-900/60'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-green-500">$</span>
          <code className="font-mono text-slate-200 truncate">{cmd.command}</code>
          {cmd.cwd && <span className="text-slate-500 shrink-0 truncate max-w-[120px]" title={cmd.cwd}>{cmd.cwd}</span>}
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
          {status === 'running' && <span className="px-2 py-1 text-slate-400 animate-pulse">Rodando...</span>}
          {status === 'done'  && <span className="px-2 py-1 text-green-400 font-medium">✓ Concluído ({exitCode})</span>}
          {status === 'error' && <span className="px-2 py-1 text-red-400">✗ Erro ({exitCode})</span>}
        </div>
      </div>

      {cmd.description && (
        <p className="px-3 py-1 text-slate-500 border-b border-slate-700/50">{cmd.description}</p>
      )}

      {/* Output */}
      {output && (
        <pre className="px-3 py-3 font-mono text-xs leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap text-slate-300">
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
              : 'bg-slate-800 text-slate-100 rounded-tl-sm'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const isBlock = match || String(children).includes('\n');
                    if (isBlock) {
                      return (
                        <pre className="bg-slate-900 rounded-lg p-3 overflow-x-auto my-2">
                          <code className={`text-slate-300 text-xs font-mono ${className || ''}`} {...props}>
                            {children}
                          </code>
                        </pre>
                      );
                    }
                    return (
                      <code className="bg-slate-900 text-blue-300 px-1 py-0.5 rounded text-xs font-mono" {...props}>
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
            <p className="text-xs text-slate-500 px-1">
              {message.fileChanges.length === 1
                ? '1 arquivo para aplicar:'
                : `${message.fileChanges.length} arquivos para aplicar:`}
            </p>
            {message.fileChanges.map((change, i) => (
              <FileChangeCard key={i} change={change} />
            ))}
          </div>
        )}

        {/* Commands */}
        {message.commands && message.commands.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <p className="text-xs text-slate-500 px-1">
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
                className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full border border-slate-700"
                title={`${s.repo}/${s.filePath}`}
              >
                {s.language} · {Math.round(s.score * 100)}%
              </span>
            ))}
          </div>
        )}

        {/* Model indicator */}
        {message.model && (
          <div className="mt-1 text-xs text-slate-500">
            via {message.model === 'claude' ? 'Claude API' : 'Ollama local'}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-1">
          U
        </div>
      )}
    </div>
  );
}
