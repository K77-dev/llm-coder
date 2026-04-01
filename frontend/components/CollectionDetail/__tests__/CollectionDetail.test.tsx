import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CollectionDetail } from '../index';
import * as api from '../../../lib/api';
import useCollectionStore from '../../../stores/collection-store';

jest.mock('../../../lib/api', () => ({
  fetchCollectionFiles: jest.fn(),
  addCollectionFiles: jest.fn(),
  removeCollectionFile: jest.fn(),
  fetchIndexingStatus: jest.fn(),
  fetchCollections: jest.fn(),
  api: { get: jest.fn() },
}));

const mockFetchCollectionFiles = api.fetchCollectionFiles as jest.MockedFunction<typeof api.fetchCollectionFiles>;
const mockRemoveCollectionFile = api.removeCollectionFile as jest.MockedFunction<typeof api.removeCollectionFile>;
const mockFetchIndexingStatus = api.fetchIndexingStatus as jest.MockedFunction<typeof api.fetchIndexingStatus>;
const mockFetchCollections = api.fetchCollections as jest.MockedFunction<typeof api.fetchCollections>;

const MOCK_COLLECTION: api.Collection = {
  id: 1,
  name: 'Backend API',
  scope: 'local',
  projectDir: '/project',
  fileCount: 3,
  createdAt: '2025-01-01',
};

const MOCK_FILES: api.CollectionFile[] = [
  { id: 10, collectionId: 1, filePath: '/project/src/index.ts', repo: 'Backend API', indexedAt: '2025-01-01' },
  { id: 11, collectionId: 1, filePath: '/project/src/app.ts', repo: 'Backend API', indexedAt: '2025-01-01' },
  { id: 12, collectionId: 1, filePath: '/project/src/server.ts', repo: 'Backend API', indexedAt: null },
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

async function renderAndWaitForFiles(collection = MOCK_COLLECTION, onBack = jest.fn()) {
  render(<CollectionDetail collection={collection} onBack={onBack} />);
  await waitFor(() => {
    expect(mockFetchCollectionFiles).toHaveBeenCalled();
  });
  return onBack;
}

describe('CollectionDetail', () => {
  const mockOnBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    mockFetchCollectionFiles.mockResolvedValue(MOCK_FILES);
    mockFetchCollections.mockResolvedValue([]);
    mockFetchIndexingStatus.mockResolvedValue({ status: 'done', progress: 100 });
  });

  it('should render collection name in header', async () => {
    await renderAndWaitForFiles();
    expect(screen.getByText('Backend API')).toBeInTheDocument();
  });

  it('should display file list after loading', async () => {
    await renderAndWaitForFiles();
    await waitFor(() => {
      expect(screen.getByTestId('file-list')).toBeInTheDocument();
    });
    expect(screen.getByTestId('file-item-10')).toBeInTheDocument();
    expect(screen.getByTestId('file-item-11')).toBeInTheDocument();
    expect(screen.getByTestId('file-item-12')).toBeInTheDocument();
  });

  it('should display file count', async () => {
    await renderAndWaitForFiles();
    await waitFor(() => {
      expect(screen.getByText('3 files')).toBeInTheDocument();
    });
  });

  it('should show file names from path', async () => {
    await renderAndWaitForFiles();
    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument();
    });
    expect(screen.getByText('app.ts')).toBeInTheDocument();
    expect(screen.getByText('server.ts')).toBeInTheDocument();
  });

  it('should show indexing status per file', async () => {
    await renderAndWaitForFiles();
    await waitFor(() => {
      expect(screen.getByTestId('file-status-10')).toHaveTextContent('Indexed');
    });
    expect(screen.getByTestId('file-status-12')).toHaveTextContent('Pending');
  });

  it('should call onBack when back button is clicked', async () => {
    const onBack = await renderAndWaitForFiles();
    await waitFor(() => {
      expect(screen.getByTestId('file-list')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('back-btn'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('should show loading state while fetching files', async () => {
    mockFetchCollectionFiles.mockImplementation(() => new Promise(() => {}));
    render(<CollectionDetail collection={MOCK_COLLECTION} onBack={mockOnBack} />);
    expect(screen.getByTestId('loading-files')).toBeInTheDocument();
  });

  it('should show error when loading files fails', async () => {
    mockFetchCollectionFiles.mockRejectedValue(new Error('Network error'));
    render(<CollectionDetail collection={MOCK_COLLECTION} onBack={mockOnBack} />);
    await waitFor(() => {
      expect(screen.getByTestId('detail-error')).toHaveTextContent('Network error');
    });
  });

  it('should show empty state when collection has no files', async () => {
    mockFetchCollectionFiles.mockResolvedValue([]);
    render(<CollectionDetail collection={MOCK_COLLECTION} onBack={mockOnBack} />);
    await waitFor(() => {
      expect(screen.getByTestId('empty-files')).toBeInTheDocument();
    });
  });

  it('should have add files button', async () => {
    await renderAndWaitForFiles();
    await waitFor(() => {
      expect(screen.getByTestId('file-list')).toBeInTheDocument();
    });
    expect(screen.getByTestId('add-files-btn')).toBeInTheDocument();
    expect(screen.getByTestId('add-files-btn')).toHaveTextContent('+ Add files or folder');
  });

  it('should open DirectoryPicker when add button is clicked', async () => {
    await renderAndWaitForFiles();
    await waitFor(() => {
      expect(screen.getByTestId('file-list')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('add-files-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('directory-picker')).toBeInTheDocument();
    });
  });

  it('should call removeCollectionFile when remove button is clicked', async () => {
    mockRemoveCollectionFile.mockResolvedValue(undefined);
    await renderAndWaitForFiles();
    await waitFor(() => {
      expect(screen.getByTestId('file-item-10')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('remove-file-10'));
    await waitFor(() => {
      expect(mockRemoveCollectionFile).toHaveBeenCalledWith(1, 10);
    });
  });

  it('should remove file from list after successful removal', async () => {
    mockRemoveCollectionFile.mockResolvedValue(undefined);
    await renderAndWaitForFiles();
    await waitFor(() => {
      expect(screen.getByTestId('file-item-10')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('remove-file-10'));
    await waitFor(() => {
      expect(screen.queryByTestId('file-item-10')).not.toBeInTheDocument();
    });
  });

  it('should show error when file removal fails', async () => {
    mockRemoveCollectionFile.mockRejectedValue(new Error('Remove failed'));
    await renderAndWaitForFiles();
    await waitFor(() => {
      expect(screen.getByTestId('file-item-10')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('remove-file-10'));
    await waitFor(() => {
      expect(screen.getByTestId('detail-error')).toHaveTextContent('Remove failed');
    });
  });

  it('should show indexing banner when collection is indexing', async () => {
    useCollectionStore.setState({ indexingStatus: { 1: 'indexing' } });
    mockFetchIndexingStatus.mockResolvedValue({ status: 'indexing', progress: 50 });
    await renderAndWaitForFiles();
    await waitFor(() => {
      expect(screen.getByTestId('indexing-banner')).toBeInTheDocument();
    });
  });

  it('should show error banner when indexing has failed', async () => {
    useCollectionStore.setState({ indexingStatus: { 1: 'error' } });
    await renderAndWaitForFiles();
    await waitFor(() => {
      expect(screen.getByTestId('error-banner')).toBeInTheDocument();
    });
  });

  it('should have accessible labels on remove buttons', async () => {
    await renderAndWaitForFiles();
    await waitFor(() => {
      expect(screen.getByTestId('remove-file-10')).toBeInTheDocument();
    });
    expect(screen.getByTestId('remove-file-10')).toHaveAttribute('aria-label', 'Remove index.ts from collection');
  });

  it('should have accessible label on back button', async () => {
    await renderAndWaitForFiles();
    await waitFor(() => {
      expect(screen.getByTestId('file-list')).toBeInTheDocument();
    });
    expect(screen.getByTestId('back-btn')).toHaveAttribute('aria-label', 'Back to collections list');
  });

  it('should have accessible label on add button', async () => {
    await renderAndWaitForFiles();
    await waitFor(() => {
      expect(screen.getByTestId('file-list')).toBeInTheDocument();
    });
    expect(screen.getByTestId('add-files-btn')).toHaveAttribute('aria-label', 'Add files to collection');
  });

  it('should display singular "file" when only one file exists', async () => {
    mockFetchCollectionFiles.mockResolvedValue([MOCK_FILES[0]]);
    render(<CollectionDetail collection={MOCK_COLLECTION} onBack={mockOnBack} />);
    await waitFor(() => {
      expect(screen.getByText('1 file')).toBeInTheDocument();
    });
  });

  it('should show fallback error message for non-Error exceptions on load', async () => {
    mockFetchCollectionFiles.mockRejectedValue('string error');
    render(<CollectionDetail collection={MOCK_COLLECTION} onBack={mockOnBack} />);
    await waitFor(() => {
      expect(screen.getByTestId('detail-error')).toHaveTextContent('Failed to load files');
    });
  });

  it('should show fallback error message for non-Error exceptions on remove', async () => {
    mockRemoveCollectionFile.mockRejectedValue(42);
    await renderAndWaitForFiles();
    await waitFor(() => {
      expect(screen.getByTestId('file-item-10')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('remove-file-10'));
    await waitFor(() => {
      expect(screen.getByTestId('detail-error')).toHaveTextContent('Failed to remove file');
    });
  });

  it('should have file list with proper role', async () => {
    await renderAndWaitForFiles();
    await waitFor(() => {
      expect(screen.getByRole('list', { name: 'Collection files' })).toBeInTheDocument();
    });
  });

  it('should show file status with accessible aria-label', async () => {
    await renderAndWaitForFiles();
    await waitFor(() => {
      expect(screen.getByTestId('file-status-10')).toBeInTheDocument();
    });
    expect(screen.getByTestId('file-status-10')).toHaveAttribute('aria-label', 'Indexing status: Indexed');
    expect(screen.getByTestId('file-status-12')).toHaveAttribute('aria-label', 'Indexing status: Pending');
  });

  describe('polling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should poll indexing status and stop when status changes from indexing', async () => {
      useCollectionStore.setState({ indexingStatus: { 1: 'indexing' } });

      render(<CollectionDetail collection={MOCK_COLLECTION} onBack={mockOnBack} />);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });

      await waitFor(() => {
        expect(screen.getByTestId('indexing-banner')).toBeInTheDocument();
      });

      mockFetchIndexingStatus.mockClear();
      mockFetchIndexingStatus.mockResolvedValueOnce({ status: 'indexing', progress: 50 });
      mockFetchCollectionFiles.mockClear();

      await act(async () => {
        await jest.advanceTimersByTimeAsync(3000);
      });

      expect(mockFetchIndexingStatus).toHaveBeenCalledWith(1);

      mockFetchIndexingStatus.mockClear();
      mockFetchIndexingStatus.mockResolvedValueOnce({ status: 'done', progress: 100 });
      mockFetchCollectionFiles.mockResolvedValue(MOCK_FILES);

      await act(async () => {
        await jest.advanceTimersByTimeAsync(3000);
      });

      expect(mockFetchIndexingStatus).toHaveBeenCalledWith(1);
      const state = useCollectionStore.getState();
      expect(state.indexingStatus[1]).toBe('done');
      expect(mockFetchCollectionFiles).toHaveBeenCalled();
    });

    it('should set error status when polling fails', async () => {
      useCollectionStore.setState({ indexingStatus: { 1: 'indexing' } });

      render(<CollectionDetail collection={MOCK_COLLECTION} onBack={mockOnBack} />);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });

      await waitFor(() => {
        expect(screen.getByTestId('indexing-banner')).toBeInTheDocument();
      });

      mockFetchIndexingStatus.mockClear();
      mockFetchIndexingStatus.mockRejectedValueOnce(new Error('Poll failed'));

      await act(async () => {
        await jest.advanceTimersByTimeAsync(3000);
      });

      const state = useCollectionStore.getState();
      expect(state.indexingStatus[1]).toBe('error');
    });

    it('should not poll when status is not indexing', async () => {
      useCollectionStore.setState({ indexingStatus: { 1: 'done' } });

      render(<CollectionDetail collection={MOCK_COLLECTION} onBack={mockOnBack} />);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });

      await waitFor(() => {
        expect(screen.getByTestId('file-list')).toBeInTheDocument();
      });

      mockFetchIndexingStatus.mockClear();

      await act(async () => {
        await jest.advanceTimersByTimeAsync(6000);
      });

      expect(mockFetchIndexingStatus).not.toHaveBeenCalled();
    });
  });
});
