'use client';

import { useState, useRef, useEffect } from 'react';
import useChatTabStore from '../../stores/chat-tab-store';
import useCollectionStore from '../../stores/collection-store';

export function ChatTabs() {
  const tabs = useChatTabStore((s) => s.tabs);
  const activeTabId = useChatTabStore((s) => s.activeTabId);
  const createTab = useChatTabStore((s) => s.createTab);
  const removeTab = useChatTabStore((s) => s.removeTab);
  const setActiveTab = useChatTabStore((s) => s.setActiveTab);
  const renameTab = useChatTabStore((s) => s.renameTab);
  const setTabCollectionIds = useChatTabStore((s) => s.setTabCollectionIds);

  const collections = useCollectionStore((s) => s.collections);
  const selectedIds = useCollectionStore((s) => s.selectedIds);

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const switchingTabRef = useRef(false);

  useEffect(() => {
    if (editingTabId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTabId]);

  const handleCreateTab = () => {
    const collectionIds = Array.from(selectedIds);
    const collectionNames = collections
      .filter((c) => collectionIds.includes(c.id))
      .map((c) => c.name);
    const name = collectionNames.length > 0
      ? collectionNames.join(', ')
      : `Chat ${tabs.length + 1}`;
    createTab(name, collectionIds);
  };

  const handleTabClick = (tabId: string) => {
    if (tabId === activeTabId) return;
    switchingTabRef.current = true;
    setActiveTab(tabId);
    const tab = useChatTabStore.getState().tabs.find((t) => t.id === tabId);
    if (tab) {
      useCollectionStore.getState().setSelectedIds(tab.collectionIds);
    }
    setTimeout(() => { switchingTabRef.current = false; }, 0);
  };

  const handleDoubleClick = (tabId: string, currentName: string) => {
    setEditingTabId(tabId);
    setEditValue(currentName);
  };

  const commitRename = () => {
    if (editingTabId && editValue.trim()) {
      renameTab(editingTabId, editValue.trim());
    }
    setEditingTabId(null);
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    if (tabs.length <= 1) return;
    removeTab(tabId);
    const newActiveId = useChatTabStore.getState().activeTabId;
    const newTab = useChatTabStore.getState().tabs.find((t) => t.id === newActiveId);
    if (newTab) {
      useCollectionStore.getState().setSelectedIds(newTab.collectionIds);
    }
  };

  // Sync collection store changes → active tab (only when user changes collections, not tab switching)
  useEffect(() => {
    if (switchingTabRef.current) return;
    const collectionIds = Array.from(selectedIds);
    setTabCollectionIds(activeTabId, collectionIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  return (
    <div className="flex items-center bg-[#252526] border-b border-[#1e1e1e] shrink-0 min-h-[35px]">
      <div
        ref={tabsContainerRef}
        className="flex-1 flex items-center overflow-x-auto scrollbar-none"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const hasMessages = tab.messages.length > 0;

          return (
            <div
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              onDoubleClick={() => handleDoubleClick(tab.id, tab.name)}
              className={`group flex items-center gap-1.5 px-3 py-1.5 cursor-pointer border-r border-[#1e1e1e] min-w-0 max-w-[180px] select-none transition-colors ${
                isActive
                  ? 'bg-[#1e1e1e] text-white border-t-2 border-t-[#007acc]'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#2d2d2d] border-t-2 border-t-transparent'
              }`}
              title={tab.name}
            >
              {/* Chat icon */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 opacity-60"
              >
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>

              {editingTabId === tab.id ? (
                <input
                  ref={editInputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingTabId(null);
                  }}
                  className="bg-[#3c3c3c] text-white text-[12px] px-1 py-0 border border-[#007acc] rounded outline-none w-full min-w-[40px]"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-[12px] truncate">
                  {tab.name}
                </span>
              )}

              {/* Message count badge */}
              {hasMessages && !isActive && (
                <span className="text-[10px] text-neutral-500 shrink-0">
                  {tab.messages.filter((m) => m.role === 'user').length}
                </span>
              )}

              {/* Collection indicator */}
              {tab.collectionIds.length > 0 && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"
                  title={`${tab.collectionIds.length} colecao(oes) vinculada(s)`}
                />
              )}

              {/* Close button */}
              {tabs.length > 1 && (
                <button
                  onClick={(e) => handleCloseTab(e, tab.id)}
                  className={`shrink-0 w-4 h-4 flex items-center justify-center rounded-sm text-[14px] leading-none transition-colors ${
                    isActive
                      ? 'text-neutral-500 hover:text-white hover:bg-[#333]'
                      : 'text-transparent group-hover:text-neutral-500 hover:!text-white hover:bg-[#333]'
                  }`}
                  title="Fechar tab"
                >
                  {'\u00D7'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* New tab button */}
      <button
        onClick={handleCreateTab}
        className="shrink-0 w-8 h-[35px] flex items-center justify-center text-neutral-500 hover:text-white hover:bg-[#2d2d2d] transition-colors"
        title="Nova tab de chat"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}
