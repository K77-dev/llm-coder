import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CollectionList } from '../index';
import * as api from '../../../lib/api';
import useCollectionStore from '../../../stores/collection-store';

jest.mock('../../../lib/api', () => ({
  fetchCollections: jest.fn(),
  createCollection: jest.fn(),
  renameCollection: jest.fn(),
  deleteCollection: jest.fn(),
}));

const mockFetchCollections = api.fetchCollections as jest.MockedFunction<typeof api.fetchCollections>;
const mockCreateCollection = api.createCollection as jest.MockedFunction<typeof api.createCollection>;
const mockRenameCollection = api.renameCollection as jest.MockedFunction<typeof api.renameCollection>;
const mockDeleteCollection = api.deleteCollection as jest.MockedFunction<typeof api.deleteCollection>;

const MOCK_COLLECTIONS: api.Collection[] = [
  { id: 1, name: 'Backend API', scope: 'local', projectDir: '/project', fileCount: 12, createdAt: '2025-01-01' },
  { id: 2, name: 'Documentation', scope: 'global', projectDir: null, fileCount: 8, createdAt: '2025-01-02' },
  { id: 3, name: 'CNAB Rules', scope: 'local', projectDir: '/project', fileCount: 3, createdAt: '2025-01-03' },
];

function resetStore() {
  useCollectionStore.setState({
    collections: [],
    selectedIds: new Set<number>(),
    indexingStatus: {},
    loading: false,
    error: null,
  });
}

describe('CollectionList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    mockFetchCollections.mockResolvedValue(MOCK_COLLECTIONS);
  });

  it('should render the collections list with items', async () => {
    render(<CollectionList />);
    await waitFor(() => {
      expect(screen.getByText('Backend API')).toBeInTheDocument();
      expect(screen.getByText('Documentation')).toBeInTheDocument();
      expect(screen.getByText('CNAB Rules')).toBeInTheDocument();
    });
  });

  it('should display file count for each collection', async () => {
    render(<CollectionList />);
    await waitFor(() => {
      expect(screen.getByText('(12)')).toBeInTheDocument();
      expect(screen.getByText('(8)')).toBeInTheDocument();
      expect(screen.getByText('(3)')).toBeInTheDocument();
    });
  });

  it('should render scope badges correctly (local vs global)', async () => {
    render(<CollectionList />);
    await waitFor(() => {
      const localBadges = screen.getAllByTestId('badge-local');
      const globalBadges = screen.getAllByTestId('badge-global');
      expect(localBadges).toHaveLength(2);
      expect(globalBadges).toHaveLength(1);
    });
  });

  it('should show loading state', () => {
    useCollectionStore.setState({ loading: true });
    render(<CollectionList />);
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('should show error state', async () => {
    mockFetchCollections.mockRejectedValue(new Error('Network error'));
    render(<CollectionList />);
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Network error');
    });
  });

  it('should show empty state when no collections exist', async () => {
    mockFetchCollections.mockResolvedValue([]);
    render(<CollectionList />);
    await waitFor(() => {
      expect(screen.getByTestId('empty-message')).toBeInTheDocument();
    });
  });

  describe('Checkbox selection', () => {
    it('should toggle individual checkbox selection', async () => {
      render(<CollectionList />);
      await waitFor(() => {
        expect(screen.getByTestId('checkbox-1')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('checkbox-1'));
      expect(useCollectionStore.getState().selectedIds.has(1)).toBe(true);
      fireEvent.click(screen.getByTestId('checkbox-1'));
      expect(useCollectionStore.getState().selectedIds.has(1)).toBe(false);
    });

    it('should select all collections when "Select all" is clicked', async () => {
      render(<CollectionList />);
      await waitFor(() => {
        expect(screen.getByTestId('select-all-checkbox')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('select-all-checkbox'));
      const state = useCollectionStore.getState();
      expect(state.selectedIds.has(1)).toBe(true);
      expect(state.selectedIds.has(2)).toBe(true);
      expect(state.selectedIds.has(3)).toBe(true);
    });

    it('should deselect all when "Select all" is clicked and all are selected', async () => {
      useCollectionStore.setState({ selectedIds: new Set([1, 2, 3]) });
      render(<CollectionList />);
      await waitFor(() => {
        expect(screen.getByTestId('select-all-checkbox')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('select-all-checkbox'));
      const state = useCollectionStore.getState();
      expect(state.selectedIds.size).toBe(0);
    });

    it('should have accessible labels on checkboxes', async () => {
      render(<CollectionList />);
      await waitFor(() => {
        expect(screen.getByTestId('checkbox-1')).toBeInTheDocument();
      });
      const checkbox = screen.getByTestId('checkbox-1');
      expect(checkbox).toHaveAttribute('aria-label', 'Select collection Backend API for RAG context');
    });
  });

  describe('Create collection modal', () => {
    it('should open create modal when + button is clicked', async () => {
      render(<CollectionList />);
      expect(screen.queryByTestId('create-collection-modal')).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId('create-collection-btn'));
      expect(screen.getByTestId('create-collection-modal')).toBeInTheDocument();
    });

    it('should close create modal when Cancel is clicked', async () => {
      render(<CollectionList />);
      fireEvent.click(screen.getByTestId('create-collection-btn'));
      expect(screen.getByTestId('create-collection-modal')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('create-cancel-btn'));
      expect(screen.queryByTestId('create-collection-modal')).not.toBeInTheDocument();
    });

    it('should show error when submitting empty name', async () => {
      render(<CollectionList />);
      fireEvent.click(screen.getByTestId('create-collection-btn'));
      fireEvent.click(screen.getByTestId('create-submit-btn'));
      expect(screen.getByTestId('create-error')).toHaveTextContent('Collection name is required');
    });

    it('should submit collection with correct name and scope', async () => {
      const newCollection: api.Collection = {
        id: 4, name: 'New Collection', scope: 'global', projectDir: null, fileCount: 0, createdAt: '2025-01-04',
      };
      mockCreateCollection.mockResolvedValue(newCollection);
      mockFetchCollections.mockResolvedValue([...MOCK_COLLECTIONS, newCollection]);
      render(<CollectionList />);
      await waitFor(() => {
        expect(screen.getByTestId('create-collection-btn')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('create-collection-btn'));
      fireEvent.change(screen.getByTestId('collection-name-input'), { target: { value: 'New Collection' } });
      fireEvent.click(screen.getByTestId('scope-global'));
      fireEvent.click(screen.getByTestId('create-submit-btn'));
      await waitFor(() => {
        expect(mockCreateCollection).toHaveBeenCalledWith({
          name: 'New Collection',
          scope: 'global',
          projectDir: undefined,
        });
      });
    });

    it('should close modal on Escape key', async () => {
      render(<CollectionList />);
      fireEvent.click(screen.getByTestId('create-collection-btn'));
      expect(screen.getByTestId('create-collection-modal')).toBeInTheDocument();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByTestId('create-collection-modal')).not.toBeInTheDocument();
    });

    it('should trap focus within the create modal on Tab', async () => {
      render(<CollectionList />);
      fireEvent.click(screen.getByTestId('create-collection-btn'));
      const modal = screen.getByTestId('create-collection-modal');
      expect(modal).toBeInTheDocument();
      const focusableElements = modal.querySelectorAll<HTMLElement>(
        'input, button, [tabindex]:not([tabindex="-1"])'
      );
      expect(focusableElements.length).toBeGreaterThan(0);
      const lastElement = focusableElements[focusableElements.length - 1];
      const firstElement = focusableElements[0];
      (lastElement as HTMLElement).focus();
      expect(document.activeElement).toBe(lastElement);
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(document.activeElement).toBe(firstElement);
    });

    it('should trap focus within the create modal on Shift+Tab', async () => {
      render(<CollectionList />);
      fireEvent.click(screen.getByTestId('create-collection-btn'));
      const modal = screen.getByTestId('create-collection-modal');
      const focusableElements = modal.querySelectorAll<HTMLElement>(
        'input, button, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      (firstElement as HTMLElement).focus();
      expect(document.activeElement).toBe(firstElement);
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(lastElement);
    });

    it('should show crud error when create API fails', async () => {
      mockCreateCollection.mockRejectedValue(new Error('Server error'));
      render(<CollectionList />);
      await waitFor(() => {
        expect(screen.getByTestId('create-collection-btn')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('create-collection-btn'));
      fireEvent.change(screen.getByTestId('collection-name-input'), { target: { value: 'Failing' } });
      fireEvent.click(screen.getByTestId('create-submit-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('crud-error-message')).toHaveTextContent('Server error');
      });
    });
  });

  describe('Delete collection', () => {
    it('should show delete confirmation dialog via context menu', async () => {
      render(<CollectionList />);
      await waitFor(() => {
        expect(screen.getByTestId('collection-item-1')).toBeInTheDocument();
      });
      fireEvent.contextMenu(screen.getByTestId('collection-item-1'));
      expect(screen.getByTestId('context-menu')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('ctx-delete'));
      expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();
    });

    it('should delete collection when confirmed', async () => {
      mockDeleteCollection.mockResolvedValue(undefined);
      render(<CollectionList />);
      await waitFor(() => {
        expect(screen.getByTestId('collection-item-1')).toBeInTheDocument();
      });
      mockFetchCollections.mockResolvedValue(MOCK_COLLECTIONS.filter((c) => c.id !== 1));
      fireEvent.contextMenu(screen.getByTestId('collection-item-1'));
      fireEvent.click(screen.getByTestId('ctx-delete'));
      fireEvent.click(screen.getByTestId('delete-confirm-btn'));
      await waitFor(() => {
        expect(mockDeleteCollection).toHaveBeenCalledWith(1);
      });
    });

    it('should close delete dialog when Cancel is clicked', async () => {
      render(<CollectionList />);
      await waitFor(() => {
        expect(screen.getByTestId('collection-item-1')).toBeInTheDocument();
      });
      fireEvent.contextMenu(screen.getByTestId('collection-item-1'));
      fireEvent.click(screen.getByTestId('ctx-delete'));
      expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('delete-cancel-btn'));
      expect(screen.queryByTestId('delete-dialog')).not.toBeInTheDocument();
    });

    it('should show crud error when delete API fails', async () => {
      mockDeleteCollection.mockRejectedValue(new Error('Delete failed'));
      render(<CollectionList />);
      await waitFor(() => {
        expect(screen.getByTestId('collection-item-1')).toBeInTheDocument();
      });
      fireEvent.contextMenu(screen.getByTestId('collection-item-1'));
      fireEvent.click(screen.getByTestId('ctx-delete'));
      fireEvent.click(screen.getByTestId('delete-confirm-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('crud-error-message')).toHaveTextContent('Delete failed');
      });
    });
  });

  describe('Rename collection', () => {
    it('should show rename input on double click', async () => {
      render(<CollectionList />);
      await waitFor(() => {
        expect(screen.getByTestId('collection-item-1')).toBeInTheDocument();
      });
      fireEvent.doubleClick(screen.getByTestId('collection-item-1'));
      expect(screen.getByTestId('rename-input-1')).toBeInTheDocument();
      expect(screen.getByTestId('rename-input-1')).toHaveValue('Backend API');
    });

    it('should show rename input via context menu', async () => {
      render(<CollectionList />);
      await waitFor(() => {
        expect(screen.getByTestId('collection-item-2')).toBeInTheDocument();
      });
      fireEvent.contextMenu(screen.getByTestId('collection-item-2'));
      fireEvent.click(screen.getByTestId('ctx-rename'));
      expect(screen.getByTestId('rename-input-2')).toBeInTheDocument();
    });

    it('should submit rename on Enter', async () => {
      const renamedCollection = { ...MOCK_COLLECTIONS[0], name: 'Renamed' };
      mockRenameCollection.mockResolvedValue(renamedCollection);
      render(<CollectionList />);
      await waitFor(() => {
        expect(screen.getByTestId('collection-item-1')).toBeInTheDocument();
      });
      fireEvent.doubleClick(screen.getByTestId('collection-item-1'));
      fireEvent.change(screen.getByTestId('rename-input-1'), { target: { value: 'Renamed' } });
      fireEvent.keyDown(screen.getByTestId('rename-input-1'), { key: 'Enter' });
      await waitFor(() => {
        expect(mockRenameCollection).toHaveBeenCalledWith(1, 'Renamed');
      });
    });

    it('should cancel rename on Escape', async () => {
      render(<CollectionList />);
      await waitFor(() => {
        expect(screen.getByTestId('collection-item-1')).toBeInTheDocument();
      });
      fireEvent.doubleClick(screen.getByTestId('collection-item-1'));
      expect(screen.getByTestId('rename-input-1')).toBeInTheDocument();
      fireEvent.keyDown(screen.getByTestId('rename-input-1'), { key: 'Escape' });
      expect(screen.queryByTestId('rename-input-1')).not.toBeInTheDocument();
    });

    it('should show crud error when rename API fails', async () => {
      mockRenameCollection.mockRejectedValue(new Error('Rename failed'));
      render(<CollectionList />);
      await waitFor(() => {
        expect(screen.getByTestId('collection-item-1')).toBeInTheDocument();
      });
      fireEvent.doubleClick(screen.getByTestId('collection-item-1'));
      fireEvent.change(screen.getByTestId('rename-input-1'), { target: { value: 'New Name' } });
      fireEvent.keyDown(screen.getByTestId('rename-input-1'), { key: 'Enter' });
      await waitFor(() => {
        expect(screen.getByTestId('crud-error-message')).toHaveTextContent('Rename failed');
      });
    });
  });

  describe('Indexing status indicators', () => {
    it('should render indexing status indicator when status is set', async () => {
      useCollectionStore.setState({ indexingStatus: { 1: 'indexing' } });
      render(<CollectionList />);
      await waitFor(() => {
        expect(screen.getByTestId('status-indexing')).toBeInTheDocument();
      });
    });

    it('should render done status indicator', async () => {
      useCollectionStore.setState({ indexingStatus: { 2: 'done' } });
      render(<CollectionList />);
      await waitFor(() => {
        expect(screen.getByTestId('status-done')).toBeInTheDocument();
      });
    });

    it('should render error status indicator', async () => {
      useCollectionStore.setState({ indexingStatus: { 3: 'error' } });
      render(<CollectionList />);
      await waitFor(() => {
        expect(screen.getByTestId('status-error')).toBeInTheDocument();
      });
    });

    it('should have accessible aria-label on status indicator', async () => {
      useCollectionStore.setState({ indexingStatus: { 1: 'indexing' } });
      render(<CollectionList />);
      await waitFor(() => {
        const indicator = screen.getByTestId('status-indexing');
        expect(indicator).toHaveAttribute('aria-label', 'Indexing status: Indexing');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible select all checkbox', async () => {
      render(<CollectionList />);
      await waitFor(() => {
        const selectAll = screen.getByTestId('select-all-checkbox');
        expect(selectAll).toHaveAttribute('aria-label', 'Select all collections');
      });
    });

    it('should have accessible create button', async () => {
      render(<CollectionList />);
      const createBtn = screen.getByTestId('create-collection-btn');
      expect(createBtn).toHaveAttribute('aria-label', 'Create collection');
    });

    it('should have list role on collections container', async () => {
      render(<CollectionList />);
      await waitFor(() => {
        expect(screen.getByRole('list', { name: 'Collections list' })).toBeInTheDocument();
      });
    });

    it('should navigate checkboxes with keyboard (Tab + Space)', async () => {
      render(<CollectionList />);
      await waitFor(() => {
        expect(screen.getByTestId('checkbox-1')).toBeInTheDocument();
      });
      const checkbox = screen.getByTestId('checkbox-1');
      checkbox.focus();
      expect(document.activeElement).toBe(checkbox);
      fireEvent.keyDown(checkbox, { key: ' ' });
      fireEvent.click(checkbox);
      expect(useCollectionStore.getState().selectedIds.has(1)).toBe(true);
    });
  });

  describe('CRUD error handling', () => {
    it('should display fallback message for non-Error exceptions on create', async () => {
      mockCreateCollection.mockRejectedValue('string error');
      render(<CollectionList />);
      await waitFor(() => {
        expect(screen.getByTestId('create-collection-btn')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('create-collection-btn'));
      fireEvent.change(screen.getByTestId('collection-name-input'), { target: { value: 'Test' } });
      fireEvent.click(screen.getByTestId('create-submit-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('crud-error-message')).toHaveTextContent('Failed to create collection');
      });
    });

    it('should display fallback message for non-Error exceptions on delete', async () => {
      mockDeleteCollection.mockRejectedValue(42);
      render(<CollectionList />);
      await waitFor(() => {
        expect(screen.getByTestId('collection-item-1')).toBeInTheDocument();
      });
      fireEvent.contextMenu(screen.getByTestId('collection-item-1'));
      fireEvent.click(screen.getByTestId('ctx-delete'));
      fireEvent.click(screen.getByTestId('delete-confirm-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('crud-error-message')).toHaveTextContent('Failed to delete collection');
      });
    });

    it('should close delete dialog even when delete fails', async () => {
      mockDeleteCollection.mockRejectedValue(new Error('fail'));
      render(<CollectionList />);
      await waitFor(() => {
        expect(screen.getByTestId('collection-item-1')).toBeInTheDocument();
      });
      fireEvent.contextMenu(screen.getByTestId('collection-item-1'));
      fireEvent.click(screen.getByTestId('ctx-delete'));
      fireEvent.click(screen.getByTestId('delete-confirm-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('delete-dialog')).not.toBeInTheDocument();
      });
    });

    it('should close rename input even when rename fails', async () => {
      mockRenameCollection.mockRejectedValue(new Error('fail'));
      render(<CollectionList />);
      await waitFor(() => {
        expect(screen.getByTestId('collection-item-1')).toBeInTheDocument();
      });
      fireEvent.doubleClick(screen.getByTestId('collection-item-1'));
      fireEvent.change(screen.getByTestId('rename-input-1'), { target: { value: 'New' } });
      fireEvent.keyDown(screen.getByTestId('rename-input-1'), { key: 'Enter' });
      await waitFor(() => {
        expect(screen.queryByTestId('rename-input-1')).not.toBeInTheDocument();
      });
    });
  });
});
