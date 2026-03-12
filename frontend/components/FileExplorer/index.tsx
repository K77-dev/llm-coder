'use client';

import { useState, useEffect, useCallback } from 'react';
import { listDir } from '../../lib/api';

interface FileExplorerProps {
  rootPath: string;
  onFileSelect: (path: string) => void;
  selectedFile?: string;
}

interface DirNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
}

const HIDDEN = new Set([
  'node_modules', '.git', '.next', '.DS_Store', '__pycache__',
  '.cache', '.turbo', 'dist', '.nuxt', '.output', '.swc',
]);

function sortNodes(a: DirNode, b: DirNode): number {
  if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
  return a.name.localeCompare(b.name);
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
    sh: 'text-green-300', env: 'text-yellow-500',
    lock: 'text-neutral-500', txt: 'text-neutral-400',
    gitignore: 'text-neutral-500',
  };
  return colors[ext] || 'text-neutral-500';
}

function FileIcon({ name }: { name: string }) {
  const color = getFileIconColor(name);
  return (
    <svg className={`w-4 h-4 shrink-0 ${color}`} viewBox="0 0 16 16" fill="currentColor">
      <path d="M13 4H8.414L6.414 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V5a1 1 0 00-1-1z" opacity="0" />
      <path d="M4 2h5l2 2h2a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" opacity="0" />
      <path d="M3.5 2A1.5 1.5 0 002 3.5v9A1.5 1.5 0 003.5 14h9a1.5 1.5 0 001.5-1.5V6h-4.5L7.5 4H3.5z" opacity="0" />
      <rect x="3" y="3" width="10" height="10" rx="1" opacity="0.15" />
      <path d="M4 1.5A1.5 1.5 0 002.5 3v10A1.5 1.5 0 004 14.5h8a1.5 1.5 0 001.5-1.5V6L9.5 1.5H4zm0 1h5v3.25c0 .138.112.25.25.25H13v7a.5.5 0 01-.5.5H4a.5.5 0 01-.5-.5V3a.5.5 0 01.5-.5z" />
    </svg>
  );
}

function FolderIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="w-4 h-4 shrink-0 text-yellow-500/80" viewBox="0 0 16 16" fill="currentColor">
        <path d="M1.5 14h11l2-6H6L4.5 4H1.5v10zM1 3.5A1.5 1.5 0 012.5 2h3l2 2h5A1.5 1.5 0 0114 5.5V7h.5a1 1 0 01.962 1.275l-2 6A1 1 0 0112.5 15h-11A1.5 1.5 0 010 13.5v-10A1.5 1.5 0 011 3z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 shrink-0 text-yellow-500/80" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1 3.5A1.5 1.5 0 012.5 2h3.879a1.5 1.5 0 011.06.44l1.122 1.12A1.5 1.5 0 009.62 4H13.5A1.5 1.5 0 0115 5.5v8a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 13.5v-10zM2.5 3a.5.5 0 00-.5.5v10a.5.5 0 00.5.5h11a.5.5 0 00.5-.5v-8a.5.5 0 00-.5-.5H9.621a2.5 2.5 0 01-1.768-.732L6.732 3.146A.5.5 0 006.38 3H2.5z" />
    </svg>
  );
}

function TreeItem({ node, depth, expandedDirs, dirContents, loadingDirs, onToggle, onSelect, selectedFile }: {
  node: DirNode;
  depth: number;
  expandedDirs: Set<string>;
  dirContents: Map<string, DirNode[]>;
  loadingDirs: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  selectedFile?: string;
}) {
  const isSelected = node.path === selectedFile;
  const paddingLeft = 8 + depth * 16;

  if (node.type === 'dir') {
    const isExpanded = expandedDirs.has(node.path);
    const children = dirContents.get(node.path) || [];
    const isLoading = loadingDirs.has(node.path);

    return (
      <>
        <button
          onClick={() => onToggle(node.path)}
          className={`w-full flex items-center gap-1 py-[2px] text-[13px] leading-[22px] hover:bg-[#2a2d2e] ${
            isSelected ? 'bg-[#37373d]' : ''
          }`}
          style={{ paddingLeft }}
        >
          <span className="text-[11px] w-4 text-center text-neutral-500 shrink-0">
            {isExpanded ? '\u25BE' : '\u25B8'}
          </span>
          <FolderIcon open={isExpanded} />
          <span className="truncate text-neutral-300">{node.name}</span>
        </button>
        {isExpanded && (
          <>
            {isLoading && children.length === 0 && (
              <div
                className="text-[12px] text-neutral-500 animate-pulse py-[2px]"
                style={{ paddingLeft: paddingLeft + 20 }}
              >
                ...
              </div>
            )}
            {children.map(child => (
              <TreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                expandedDirs={expandedDirs}
                dirContents={dirContents}
                loadingDirs={loadingDirs}
                onToggle={onToggle}
                onSelect={onSelect}
                selectedFile={selectedFile}
              />
            ))}
          </>
        )}
      </>
    );
  }

  return (
    <button
      onClick={() => onSelect(node.path)}
      className={`w-full flex items-center gap-1 py-[2px] text-[13px] leading-[22px] hover:bg-[#2a2d2e] ${
        isSelected ? 'bg-[#094771] text-white' : 'text-neutral-400'
      }`}
      style={{ paddingLeft: paddingLeft + 20 }}
    >
      <FileIcon name={node.name} />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function FileExplorer({ rootPath, onFileSelect, selectedFile }: FileExplorerProps) {
  const [dirContents, setDirContents] = useState<Map<string, DirNode[]>>(new Map());
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set());
  const [rootExpanded, setRootExpanded] = useState(true);

  const loadDir = useCallback(async (path: string) => {
    setLoadingDirs(prev => new Set(prev).add(path));
    try {
      const result = await listDir(path);
      const nodes: DirNode[] = result.entries
        .filter(e => !HIDDEN.has(e.name))
        .map(e => ({
          name: e.name,
          path: `${path}/${e.name}`,
          type: e.type,
          size: e.size,
        }))
        .sort(sortNodes);
      setDirContents(prev => new Map(prev).set(path, nodes));
    } catch {
      setDirContents(prev => new Map(prev).set(path, []));
    } finally {
      setLoadingDirs(prev => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    if (rootPath) {
      loadDir(rootPath);
      setExpandedDirs(new Set());
      setDirContents(new Map());
    }
  }, [rootPath, loadDir]);

  const toggleDir = useCallback(async (path: string) => {
    if (expandedDirs.has(path)) {
      setExpandedDirs(prev => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    } else {
      if (!dirContents.has(path)) {
        await loadDir(path);
      }
      setExpandedDirs(prev => new Set(prev).add(path));
    }
  }, [expandedDirs, dirContents, loadDir]);

  const rootName = rootPath.split('/').pop() || rootPath;
  const rootChildren = dirContents.get(rootPath) || [];
  const rootLoading = loadingDirs.has(rootPath);

  return (
    <div className="h-full flex flex-col bg-[#252526] text-[13px] select-none">
      <div className="px-5 py-[6px] text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
        Explorer
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <button
          onClick={() => setRootExpanded(v => !v)}
          className="w-full flex items-center gap-1 px-2 py-[3px] text-[11px] font-bold uppercase tracking-wide text-neutral-200 hover:bg-[#2a2d2e]"
        >
          <span className="text-[10px] w-4 text-center">
            {rootExpanded ? '\u25BE' : '\u25B8'}
          </span>
          {rootName}
        </button>

        {rootExpanded && (
          <div className="pb-4">
            {rootLoading && rootChildren.length === 0 && (
              <div className="text-[12px] text-neutral-500 animate-pulse px-6 py-1">
                Carregando...
              </div>
            )}
            {rootChildren.map(node => (
              <TreeItem
                key={node.path}
                node={node}
                depth={0}
                expandedDirs={expandedDirs}
                dirContents={dirContents}
                loadingDirs={loadingDirs}
                onToggle={toggleDir}
                onSelect={onFileSelect}
                selectedFile={selectedFile}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
