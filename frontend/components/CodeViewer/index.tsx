'use client';

import { useState, useEffect } from 'react';
import { readFile } from '../../lib/api';

interface OpenFile {
  path: string;
  name: string;
}

interface CodeViewerProps {
  openFiles: OpenFile[];
  activeFile?: string;
  onTabSelect: (path: string) => void;
  onTabClose: (path: string) => void;
}

function getLanguage(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript React', js: 'JavaScript', jsx: 'JavaScript React',
    json: 'JSON', css: 'CSS', html: 'HTML', md: 'Markdown',
    py: 'Python', java: 'Java', yml: 'YAML', yaml: 'YAML',
    sh: 'Shell Script', env: 'Environment', xml: 'XML',
    sql: 'SQL', rs: 'Rust', go: 'Go', rb: 'Ruby',
    txt: 'Plain Text', gitignore: 'Git Ignore',
  };
  return map[ext] || 'Plain Text';
}

function getFileIconColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const colors: Record<string, string> = {
    ts: 'text-blue-400', tsx: 'text-blue-400',
    js: 'text-yellow-400', jsx: 'text-yellow-400',
    json: 'text-yellow-300', css: 'text-sky-300',
    html: 'text-orange-400', md: 'text-blue-200',
    py: 'text-green-400', java: 'text-red-400',
  };
  return colors[ext] || 'text-neutral-500';
}

const BINARY_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'woff', 'woff2', 'ttf', 'eot', 'mp3', 'mp4', 'zip', 'tar', 'gz']);

export function CodeViewer({ openFiles, activeFile, onTabSelect, onTabClose }: CodeViewerProps) {
  const [fileContents, setFileContents] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!activeFile || fileContents.has(activeFile) || loading.has(activeFile) || errors.has(activeFile)) return;

    const ext = activeFile.split('.').pop()?.toLowerCase() || '';
    if (BINARY_EXTS.has(ext)) {
      setErrors(prev => new Map(prev).set(activeFile, 'Arquivo binario - visualizacao nao suportada'));
      return;
    }

    setLoading(prev => new Set(prev).add(activeFile));
    readFile(activeFile)
      .then(result => {
        setFileContents(prev => new Map(prev).set(activeFile, result.content));
      })
      .catch(() => {
        setErrors(prev => new Map(prev).set(activeFile, 'Falha ao carregar arquivo'));
      })
      .finally(() => {
        setLoading(prev => {
          const next = new Set(prev);
          next.delete(activeFile);
          return next;
        });
      });
  }, [activeFile, fileContents, loading, errors]);

  const content = activeFile ? fileContents.get(activeFile) : undefined;
  const isLoading = activeFile ? loading.has(activeFile) : false;
  const error = activeFile ? errors.get(activeFile) : undefined;
  const activeFileObj = openFiles.find(f => f.path === activeFile);

  if (openFiles.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1e1e1e]">
        <div className="text-center text-neutral-500">
          <div className="text-6xl mb-6 opacity-20">{ }</div>
          <p className="text-lg mb-1">Code LLM</p>
          <p className="text-sm">Selecione um arquivo no explorer para visualizar</p>
          <div className="mt-6 text-xs text-neutral-600 space-y-1">
            <p>Ctrl+Shift+P para abrir projeto</p>
          </div>
        </div>
      </div>
    );
  }

  const lines = content?.split('\n') || [];
  const lineNumWidth = Math.max(3, String(lines.length).length);

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      {/* Tab bar */}
      <div className="flex bg-[#252526] overflow-x-auto scrollbar-none shrink-0">
        {openFiles.map(file => {
          const isActive = file.path === activeFile;
          const iconColor = getFileIconColor(file.name);
          return (
            <div
              key={file.path}
              className={`flex items-center gap-1.5 pl-3 pr-2 py-[6px] text-[13px] cursor-pointer group shrink-0 border-r border-[#1e1e1e] ${
                isActive
                  ? 'bg-[#1e1e1e] text-white'
                  : 'bg-[#2d2d2d] text-neutral-400 hover:bg-[#2d2d2d]/80'
              }`}
              onClick={() => onTabSelect(file.path)}
              style={{ borderTop: isActive ? '1px solid #007acc' : '1px solid transparent' }}
            >
              <span className={`text-xs ${iconColor}`}>{'\u25CF'}</span>
              <span className="truncate max-w-[140px]">{file.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onTabClose(file.path); }}
                className="ml-1 w-5 h-5 flex items-center justify-center rounded hover:bg-[#3d3d3d] text-neutral-500 hover:text-white opacity-0 group-hover:opacity-100 text-[16px] leading-none transition-opacity"
              >
                {'\u00D7'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Breadcrumb */}
      {activeFile && (
        <div className="flex items-center px-4 py-[2px] bg-[#1e1e1e] border-b border-[#252526] text-[12px] text-neutral-500 overflow-hidden">
          {activeFile.split('/').filter(Boolean).map((segment, i, arr) => (
            <span key={i} className="flex items-center shrink-0">
              {i > 0 && <span className="mx-1 text-neutral-600">/</span>}
              <span className={i === arr.length - 1 ? 'text-neutral-300' : ''}>{segment}</span>
            </span>
          ))}
        </div>
      )}

      {/* Code content */}
      <div className="flex-1 overflow-auto font-mono text-[13px] leading-[20px]">
        {isLoading && (
          <div className="p-4 text-neutral-500 animate-pulse">Carregando...</div>
        )}
        {error && (
          <div className="p-4 text-neutral-500">{error}</div>
        )}
        {content !== undefined && (
          <div className="min-w-fit">
            {lines.map((line, i) => (
              <div
                key={i}
                className="flex hover:bg-[#2a2d2e] group"
              >
                <span
                  className="text-right pr-4 pl-4 text-[#858585] select-none shrink-0"
                  style={{ minWidth: `${lineNumWidth + 3}ch` }}
                >
                  {i + 1}
                </span>
                <span className="pr-8 text-[#d4d4d4] whitespace-pre">
                  {line || ' '}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status info */}
      {activeFileObj && (
        <div className="flex items-center justify-end px-4 py-[2px] bg-[#252526] border-t border-[#1e1e1e] text-[12px] text-neutral-500 shrink-0 gap-4">
          {content && (
            <>
              <span>Ln {lines.length}, Col 1</span>
              <span>{getLanguage(activeFileObj.name)}</span>
              <span>UTF-8</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
