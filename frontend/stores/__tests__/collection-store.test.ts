import { act } from '@testing-library/react';
import useCollectionStore from '../collection-store';
import * as api from '../../lib/api';

jest.mock('../../lib/api', () => ({
  ...jest.requireActual('../../lib/api'),
  fetchCollections: jest.fn(),
}));

const mockCollections: api.Collection[] = [
  {
    id: 1,
    name: 'Backend API',
    scope: 'local',
    projectDir: '/projects/myapp',
    fileCount: 12,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'Documentation',
    scope: 'global',
    projectDir: null,
    fileCount: 8,
    createdAt: '2026-01-02T00:00:00Z',
  },
  {
    id: 3,
    name: 'CNAB Rules',
    scope: 'local',
    projectDir: '/projects/myapp',
    fileCount: 3,
    createdAt: '2026-01-03T00:00:00Z',
  },
];

function resetStore(): void {
  const { setState } = useCollectionStore;
  setState({
    collections: [],
    selectedIds: new Set<number>(),
    indexingStatus: {},
    loading: false,
    error: null,
  });
}

beforeEach(() => {
  resetStore();
  jest.clearAllMocks();
  localStorage.clear();
});

describe('useCollectionStore', () => {
  describe('fetchCollections', () => {
    it('should update collections in the store', async () => {
      (api.fetchCollections as jest.Mock).mockResolvedValue(mockCollections);
      await act(async () => {
        await useCollectionStore.getState().fetchCollections();
      });
      const { collections } = useCollectionStore.getState();
      expect(collections).toEqual(mockCollections);
      expect(collections).toHaveLength(3);
    });

    it('should pass projectDir to the API function', async () => {
      (api.fetchCollections as jest.Mock).mockResolvedValue([]);
      await act(async () => {
        await useCollectionStore.getState().fetchCollections('/projects/myapp');
      });
      expect(api.fetchCollections).toHaveBeenCalledWith('/projects/myapp');
    });

    it('should set loading to true while fetching', async () => {
      let resolvePromise: (value: api.Collection[]) => void;
      const pendingPromise = new Promise<api.Collection[]>((resolve) => {
        resolvePromise = resolve;
      });
      (api.fetchCollections as jest.Mock).mockReturnValue(pendingPromise);
      const fetchPromise = useCollectionStore.getState().fetchCollections();
      expect(useCollectionStore.getState().loading).toBe(true);
      expect(useCollectionStore.getState().error).toBeNull();
      await act(async () => {
        resolvePromise!([]);
        await fetchPromise;
      });
      expect(useCollectionStore.getState().loading).toBe(false);
    });

    it('should set error state when API rejects', async () => {
      (api.fetchCollections as jest.Mock).mockRejectedValue(new Error('Network error'));
      await act(async () => {
        await useCollectionStore.getState().fetchCollections();
      });
      const state = useCollectionStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.loading).toBe(false);
      expect(state.collections).toEqual([]);
    });

    it('should clear error on successful fetch after failure', async () => {
      (api.fetchCollections as jest.Mock).mockRejectedValue(new Error('Network error'));
      await act(async () => {
        await useCollectionStore.getState().fetchCollections();
      });
      expect(useCollectionStore.getState().error).toBe('Network error');
      (api.fetchCollections as jest.Mock).mockResolvedValue(mockCollections);
      await act(async () => {
        await useCollectionStore.getState().fetchCollections();
      });
      const state = useCollectionStore.getState();
      expect(state.error).toBeNull();
      expect(state.collections).toEqual(mockCollections);
    });

    it('should handle non-Error rejection with fallback message', async () => {
      (api.fetchCollections as jest.Mock).mockRejectedValue('unexpected');
      await act(async () => {
        await useCollectionStore.getState().fetchCollections();
      });
      expect(useCollectionStore.getState().error).toBe('Failed to fetch collections');
    });

    it('should not update collections when API fails', async () => {
      (api.fetchCollections as jest.Mock).mockResolvedValue(mockCollections);
      await act(async () => {
        await useCollectionStore.getState().fetchCollections();
      });
      expect(useCollectionStore.getState().collections).toEqual(mockCollections);
      (api.fetchCollections as jest.Mock).mockRejectedValue(new Error('Server error'));
      await act(async () => {
        await useCollectionStore.getState().fetchCollections();
      });
      expect(useCollectionStore.getState().collections).toEqual(mockCollections);
    });

    it('should replace existing collections with fresh data', async () => {
      (api.fetchCollections as jest.Mock).mockResolvedValue(mockCollections);
      await act(async () => {
        await useCollectionStore.getState().fetchCollections();
      });
      const updatedList = [mockCollections[0]];
      (api.fetchCollections as jest.Mock).mockResolvedValue(updatedList);
      await act(async () => {
        await useCollectionStore.getState().fetchCollections();
      });
      expect(useCollectionStore.getState().collections).toEqual(updatedList);
    });
  });

  describe('toggleSelection', () => {
    it('should add an ID to selectedIds when not present', () => {
      act(() => {
        useCollectionStore.getState().toggleSelection(1);
      });
      expect(useCollectionStore.getState().selectedIds.has(1)).toBe(true);
    });

    it('should remove an ID from selectedIds when already present', () => {
      act(() => {
        useCollectionStore.getState().toggleSelection(1);
      });
      expect(useCollectionStore.getState().selectedIds.has(1)).toBe(true);
      act(() => {
        useCollectionStore.getState().toggleSelection(1);
      });
      expect(useCollectionStore.getState().selectedIds.has(1)).toBe(false);
    });

    it('should handle multiple toggles independently', () => {
      act(() => {
        useCollectionStore.getState().toggleSelection(1);
        useCollectionStore.getState().toggleSelection(2);
      });
      const { selectedIds } = useCollectionStore.getState();
      expect(selectedIds.has(1)).toBe(true);
      expect(selectedIds.has(2)).toBe(true);
      expect(selectedIds.size).toBe(2);
    });
  });

  describe('selectAll', () => {
    it('should select all collection IDs', async () => {
      (api.fetchCollections as jest.Mock).mockResolvedValue(mockCollections);
      await act(async () => {
        await useCollectionStore.getState().fetchCollections();
      });
      act(() => {
        useCollectionStore.getState().selectAll();
      });
      const { selectedIds } = useCollectionStore.getState();
      expect(selectedIds.size).toBe(3);
      expect(selectedIds.has(1)).toBe(true);
      expect(selectedIds.has(2)).toBe(true);
      expect(selectedIds.has(3)).toBe(true);
    });

    it('should result in empty set when collections are empty', () => {
      act(() => {
        useCollectionStore.getState().selectAll();
      });
      expect(useCollectionStore.getState().selectedIds.size).toBe(0);
    });
  });

  describe('deselectAll', () => {
    it('should clear all selected IDs', () => {
      act(() => {
        useCollectionStore.getState().toggleSelection(1);
        useCollectionStore.getState().toggleSelection(2);
      });
      expect(useCollectionStore.getState().selectedIds.size).toBe(2);
      act(() => {
        useCollectionStore.getState().deselectAll();
      });
      expect(useCollectionStore.getState().selectedIds.size).toBe(0);
    });

    it('should be safe to call when nothing is selected', () => {
      act(() => {
        useCollectionStore.getState().deselectAll();
      });
      expect(useCollectionStore.getState().selectedIds.size).toBe(0);
    });
  });

  describe('setIndexingStatus', () => {
    it('should update indexing status for a collection', () => {
      act(() => {
        useCollectionStore.getState().setIndexingStatus(1, 'indexing');
      });
      expect(useCollectionStore.getState().indexingStatus[1]).toBe('indexing');
    });

    it('should preserve existing statuses when updating one', () => {
      act(() => {
        useCollectionStore.getState().setIndexingStatus(1, 'done');
        useCollectionStore.getState().setIndexingStatus(2, 'indexing');
      });
      const { indexingStatus } = useCollectionStore.getState();
      expect(indexingStatus[1]).toBe('done');
      expect(indexingStatus[2]).toBe('indexing');
    });
  });

  describe('persistence', () => {
    it('should persist selectedIds to localStorage as array', () => {
      act(() => {
        useCollectionStore.getState().toggleSelection(1);
        useCollectionStore.getState().toggleSelection(3);
      });
      const stored = JSON.parse(localStorage.getItem('collection-store') ?? '{}');
      expect(stored.state.selectedIds).toEqual(expect.arrayContaining([1, 3]));
      expect(stored.state.selectedIds).toHaveLength(2);
    });

    it('should not persist collections, indexingStatus, loading, or error', () => {
      useCollectionStore.setState({
        collections: mockCollections,
        indexingStatus: { 1: 'done' },
      });
      act(() => {
        useCollectionStore.getState().toggleSelection(1);
      });
      const stored = JSON.parse(localStorage.getItem('collection-store') ?? '{}');
      expect(stored.state.collections).toBeUndefined();
      expect(stored.state.indexingStatus).toBeUndefined();
      expect(stored.state.loading).toBeUndefined();
      expect(stored.state.error).toBeUndefined();
    });

    it('should restore selectedIds from localStorage on rehydration', () => {
      const persistedData = {
        state: { selectedIds: [2, 3] },
        version: 0,
      };
      localStorage.setItem('collection-store', JSON.stringify(persistedData));
      useCollectionStore.persist.rehydrate();
      const { selectedIds } = useCollectionStore.getState();
      expect(selectedIds).toBeInstanceOf(Set);
      expect(selectedIds.has(2)).toBe(true);
      expect(selectedIds.has(3)).toBe(true);
      expect(selectedIds.size).toBe(2);
    });

    it('should handle missing localStorage data gracefully', () => {
      localStorage.removeItem('collection-store');
      useCollectionStore.persist.rehydrate();
      const { selectedIds } = useCollectionStore.getState();
      expect(selectedIds).toBeInstanceOf(Set);
      expect(selectedIds.size).toBe(0);
    });
  });
});
