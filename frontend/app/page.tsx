'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FileExplorer } from '../components/FileExplorer';
import { ChatInterface } from '../components/ChatInterface';
import { DirectoryPicker } from '../components/DirectoryPicker';
import { SettingsModal } from '../components/SettingsModal';
import { ModelSelector } from '../components/Sidebar/ModelSelector';
import { CollectionList } from '../components/CollectionList';
import { CollectionDetail } from '../components/CollectionDetail';
import { useTheme } from '../components/ThemeProvider';
import { checkHealth, indexDirectory, clearIndex, Collection } from '../lib/api';

export default function Home() {
  const [projectDir, setProjectDir] = useState('');
  const [activeFile, setActiveFile] = useState<string | undefined>();
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const { theme, toggleTheme } = useTheme();

  const [health, setHealth] = useState<{ ollama?: { available: boolean; models: string[] }; config?: { llmModel: string; embeddingModel: string }; database?: { indexed_chunks: number }; indexing?: { running: boolean } } | null>(null);
  const [indexing, setIndexing] = useState(false);

  const resizingRef = useRef<'chat' | 'sidebar' | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('projectDir');
    if (saved) setProjectDir(saved);
  }, []);

  useEffect(() => {
    checkHealth().then(setHealth).catch(() => null);
    const interval = setInterval(() => checkHealth().then(setHealth).catch(() => null), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleFileSelect = useCallback((path: string) => {
    setActiveFile(path);
  }, []);

  const handlePickDirectory = async (path: string) => {
    setProjectDir(path);
    localStorage.setItem('projectDir', path);
    setShowPicker(false);
    setActiveFile(undefined);
    setIndexing(true);
    try {
      await clearIndex();
      await indexDirectory(path);
    } catch { /* ignore */ }
    setIndexing(false);
  };

  // Resize handlers
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (resizingRef.current === 'sidebar') {
        const activityBarW = 48;
        const newW = Math.max(160, Math.min(500, e.clientX - activityBarW));
        setSidebarWidth(newW);
      }
    };
    const handleUp = () => {
      resizingRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, []);

  const startResize = () => {
    resizingRef.current = 'sidebar';
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const chunks = health?.database?.indexed_chunks || 0;

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-white overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 flex min-h-0">

        {/* Activity Bar */}
        <div className="w-12 bg-[#333333] flex flex-col items-center py-1 shrink-0">
          <button
            onClick={() => setSidebarVisible(v => !v)}
            className={`w-12 h-12 flex items-center justify-center hover:text-white transition-colors ${
              sidebarVisible ? 'text-white border-l-2 border-blue-500' : 'text-neutral-500'
            }`}
            title="Explorer (Ctrl+B)"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3H4a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1V4a1 1 0 00-1-1z" />
              <path d="M20 3h-6a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1V4a1 1 0 00-1-1z" />
              <path d="M10 13H4a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1v-6a1 1 0 00-1-1z" />
              <path d="M20 13h-6a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1v-6a1 1 0 00-1-1z" />
            </svg>
          </button>

          <button
            onClick={() => {}}
            className="w-12 h-12 flex items-center justify-center text-neutral-500 hover:text-white transition-colors"
            title="Buscar (Ctrl+Shift+F)"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Open project */}
          <button
            onClick={() => setShowPicker(true)}
            className="w-12 h-12 flex items-center justify-center text-neutral-500 hover:text-white transition-colors"
            title="Abrir Projeto"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-12 h-12 flex items-center justify-center text-neutral-500 hover:text-white transition-colors text-[18px]"
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          >
            {theme === 'dark' ? '\u2600' : '\u263E'}
          </button>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(true)}
            className="w-12 h-12 flex items-center justify-center text-neutral-500 hover:text-white transition-colors"
            title="Configuracoes"
            data-testid="activity-settings-btn"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
        </div>

        {/* Sidebar: File Explorer */}
        {sidebarVisible && (
          <>
            <div style={{ width: sidebarWidth }} className="shrink-0 border-r border-[#1e1e1e] flex flex-col bg-[#252526]">
              {/* Model Selector */}
              <div className="px-3 py-3 border-b border-[#1e1e1e]">
                <ModelSelector collapsed={false} />
              </div>
              {/* Collections */}
              <div className="px-3 py-3 border-b border-[#1e1e1e]">
                {selectedCollection ? (
                  <CollectionDetail
                    collection={selectedCollection}
                    onBack={() => setSelectedCollection(null)}
                  />
                ) : (
                  <CollectionList onSelectCollection={setSelectedCollection} />
                )}
              </div>

              {/* File Explorer */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                {projectDir ? (
                  <FileExplorer
                    rootPath={projectDir}
                    onFileSelect={handleFileSelect}
                    selectedFile={activeFile}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center px-6 text-center">
                    <svg className="w-12 h-12 text-neutral-600 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                    </svg>
                    <p className="text-neutral-400 text-sm mb-4">Nenhum projeto aberto</p>
                    <button
                      onClick={() => setShowPicker(true)}
                      className="px-4 py-2 bg-[#0e639c] hover:bg-[#1177bb] text-white rounded text-sm transition-colors"
                    >
                      Abrir Pasta
                    </button>
                    <p className="text-neutral-600 text-xs mt-3">
                      Selecione um diretorio para explorar e indexar
                    </p>
                  </div>
                )}
              </div>
            </div>
            {/* Sidebar resize handle */}
            <div
              className="w-[3px] bg-transparent hover:bg-[#007acc] cursor-col-resize shrink-0 transition-colors"
              onMouseDown={() => startResize()}
            />
          </>
        )}

        {/* Main area: chat only */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <ChatInterface compact />
        </div>
      </div>

      {/* Status Bar */}
      <div className="h-6 bg-[#007acc] flex items-center justify-between px-3 text-[12px] text-white/90 shrink-0 select-none">
        <div className="flex items-center gap-4">
          {projectDir && (
            <button
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-1 hover:bg-white/10 px-1.5 rounded transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
              {projectDir.split('/').pop()}
            </button>
          )}
          {indexing && (
            <span className="flex items-center gap-1 animate-pulse">
              <svg className="animate-spin w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11z" opacity="0.25" />
                <path d="M8 1a7 7 0 017 7h-1.5A5.5 5.5 0 008 2.5V1z" />
              </svg>
              Indexando...
            </span>
          )}
          {chunks > 0 && <span>{chunks} chunks indexados</span>}
        </div>
        <div className="flex items-center gap-4">
          {activeFile && (
            <span className="text-white/60">
              {getLanguageForStatus(activeFile)}
            </span>
          )}
          <span className="text-white/40">Code LLM v1.0</span>
        </div>
      </div>

      {/* Directory picker modal */}
      {showPicker && (
        <DirectoryPicker
          onSelect={handlePickDirectory}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Settings modal */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}

function getLanguageForStatus(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript React', js: 'JavaScript', jsx: 'JavaScript React',
    json: 'JSON', css: 'CSS', html: 'HTML', md: 'Markdown',
    py: 'Python', java: 'Java', yml: 'YAML', yaml: 'YAML',
  };
  return map[ext] || 'Plain Text';
}
