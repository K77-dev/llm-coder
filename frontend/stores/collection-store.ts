import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  Collection,
  IndexingStatus,
  fetchCollections as apiFetchCollections,
} from '../lib/api';

interface CollectionStore {
  collections: Collection[];
  selectedIds: Set<number>;
  indexingStatus: Record<number, IndexingStatus>;
  indexingProgress: Record<number, number>;
  loading: boolean;
  error: string | null;
  fetchCollections: (projectDir?: string) => Promise<void>;
  toggleSelection: (id: number) => void;
  selectAll: () => void;
  deselectAll: () => void;
  setIndexingStatus: (id: number, status: IndexingStatus, progress?: number) => void;
}

interface PersistedState {
  selectedIds: number[];
}

const useCollectionStore = create<CollectionStore>()(
  persist(
    (set, get) => ({
      collections: [],
      selectedIds: new Set<number>(),
      indexingStatus: {},
      indexingProgress: {},
      loading: false,
      error: null,

      fetchCollections: async (projectDir?: string) => {
        set({ loading: true, error: null });
        try {
          const collections = await apiFetchCollections(projectDir);
          const validIds = new Set(collections.map((c) => c.id));
          const currentSelected = get().selectedIds;
          const cleanedSelected = new Set([...currentSelected].filter((id) => validIds.has(id)));
          set({ collections, selectedIds: cleanedSelected, loading: false });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to fetch collections';
          set({ loading: false, error: message });
        }
      },

      toggleSelection: (id: number) => {
        const current = get().selectedIds;
        const next = new Set(current);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        set({ selectedIds: next });
      },

      selectAll: () => {
        const ids = get().collections.map((c) => c.id);
        set({ selectedIds: new Set(ids) });
      },

      deselectAll: () => {
        set({ selectedIds: new Set<number>() });
      },

      setIndexingStatus: (id: number, status: IndexingStatus, progress?: number) => {
        set((state) => ({
          indexingStatus: { ...state.indexingStatus, [id]: status },
          indexingProgress: { ...state.indexingProgress, [id]: progress ?? 0 },
        }));
      },
    }),
    {
      name: 'collection-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedState => ({
        selectedIds: Array.from(state.selectedIds),
      }),
      merge: (persisted, currentState) => {
        const persistedState = persisted as PersistedState | undefined;
        const restoredIds = persistedState?.selectedIds ?? [];
        return {
          ...currentState,
          selectedIds: new Set(restoredIds),
        };
      },
    }
  )
);

export default useCollectionStore;
