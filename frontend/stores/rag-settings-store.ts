import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface RagSettingsStore {
  minScore: number;
  topK: number;
  setMinScore: (value: number) => void;
  setTopK: (value: number) => void;
  reset: () => void;
}

const DEFAULTS = {
  minScore: 0.2,
  topK: 20,
};

const useRagSettingsStore = create<RagSettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setMinScore: (value: number) => set({ minScore: value }),
      setTopK: (value: number) => set({ topK: value }),
      reset: () => set(DEFAULTS),
    }),
    {
      name: 'rag-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        minScore: state.minScore,
        topK: state.topK,
      }),
    }
  )
);

export default useRagSettingsStore;
