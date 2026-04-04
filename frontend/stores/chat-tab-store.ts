import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ChatMessage, ChatSource, FileChange, RenameChange, DeleteChange, CreateDir, DeleteDir, ListDir, ListSubdirs, ListTree, SearchFiles, CommandSuggestion } from '../lib/api';

export interface ChatTabMessage extends ChatMessage {
  id: string;
  sources?: ChatSource[];
  model?: 'local' | 'claude';
  isStreaming?: boolean;
  fileChanges?: FileChange[];
  renames?: RenameChange[];
  deletes?: DeleteChange[];
  createDirs?: CreateDir[];
  deleteDirs?: DeleteDir[];
  listDirs?: ListDir[];
  listSubdirs?: ListSubdirs[];
  listTrees?: ListTree[];
  searchFiles?: SearchFiles[];
  commands?: CommandSuggestion[];
}

export interface ChatTab {
  id: string;
  name: string;
  collectionIds: number[];
  messages: ChatTabMessage[];
}

interface PersistedTabState {
  tabs: ChatTab[];
  activeTabId: string;
}

interface ChatTabStore {
  tabs: ChatTab[];
  activeTabId: string;
  loadingTabId: string | null;
  createTab: (name?: string, collectionIds?: number[]) => string;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  renameTab: (id: string, name: string) => void;
  setLoadingTab: (id: string | null) => void;
  setTabMessages: (id: string, messages: ChatTabMessage[]) => void;
  updateTabMessage: (tabId: string, messageId: string, updater: (msg: ChatTabMessage) => ChatTabMessage) => void;
  addTabMessage: (tabId: string, message: ChatTabMessage) => void;
  clearTabMessages: (id: string) => void;
  removeLastTabMessage: (id: string) => void;
  setTabCollectionIds: (id: string, collectionIds: number[]) => void;
  getActiveTab: () => ChatTab | undefined;
}

function createDefaultTab(): ChatTab {
  return {
    id: crypto.randomUUID(),
    name: 'Chat',
    collectionIds: [],
    messages: [],
  };
}

const useChatTabStore = create<ChatTabStore>()(
  persist(
    (set, get) => {
      const defaultTab = createDefaultTab();

      return {
        tabs: [defaultTab],
        activeTabId: defaultTab.id,
        loadingTabId: null,

        setLoadingTab: (id: string | null) => {
          set({ loadingTabId: id });
        },

        createTab: (name?: string, collectionIds?: number[]) => {
          const tab: ChatTab = {
            id: crypto.randomUUID(),
            name: name || `Chat ${get().tabs.length + 1}`,
            collectionIds: collectionIds || [],
            messages: [],
          };
          set((state) => ({
            tabs: [...state.tabs, tab],
            activeTabId: tab.id,
          }));
          return tab.id;
        },

        removeTab: (id: string) => {
          const { tabs, activeTabId } = get();
          if (tabs.length <= 1) return;
          const filtered = tabs.filter((t) => t.id !== id);
          const newActiveId = activeTabId === id
            ? filtered[filtered.length - 1].id
            : activeTabId;
          set({ tabs: filtered, activeTabId: newActiveId });
        },

        setActiveTab: (id: string) => {
          set({ activeTabId: id });
        },

        renameTab: (id: string, name: string) => {
          set((state) => ({
            tabs: state.tabs.map((t) => (t.id === id ? { ...t, name } : t)),
          }));
        },

        setTabMessages: (id: string, messages: ChatTabMessage[]) => {
          set((state) => ({
            tabs: state.tabs.map((t) => (t.id === id ? { ...t, messages } : t)),
          }));
        },

        updateTabMessage: (tabId: string, messageId: string, updater: (msg: ChatTabMessage) => ChatTabMessage) => {
          set((state) => ({
            tabs: state.tabs.map((t) =>
              t.id === tabId
                ? { ...t, messages: t.messages.map((m) => (m.id === messageId ? updater(m) : m)) }
                : t
            ),
          }));
        },

        addTabMessage: (tabId: string, message: ChatTabMessage) => {
          set((state) => ({
            tabs: state.tabs.map((t) =>
              t.id === tabId ? { ...t, messages: [...t.messages, message] } : t
            ),
          }));
        },

        clearTabMessages: (id: string) => {
          set((state) => ({
            tabs: state.tabs.map((t) => (t.id === id ? { ...t, messages: [] } : t)),
          }));
        },

        removeLastTabMessage: (id: string) => {
          set((state) => ({
            tabs: state.tabs.map((t) =>
              t.id === id ? { ...t, messages: t.messages.slice(0, -1) } : t
            ),
          }));
        },

        setTabCollectionIds: (id: string, collectionIds: number[]) => {
          set((state) => ({
            tabs: state.tabs.map((t) => (t.id === id ? { ...t, collectionIds } : t)),
          }));
        },

        getActiveTab: () => {
          const { tabs, activeTabId } = get();
          return tabs.find((t) => t.id === activeTabId);
        },
      };
    },
    {
      name: 'chat-tab-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedTabState => ({
        tabs: state.tabs.map((t) => ({
          id: t.id,
          name: t.name,
          collectionIds: t.collectionIds,
          messages: t.messages.filter((m) => !m.isStreaming),
        })),
        activeTabId: state.activeTabId,
      }),
    }
  )
);

export default useChatTabStore;
