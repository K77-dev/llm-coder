import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import useCollectionStore from '../../../stores/collection-store';

// Mock scrollIntoView which is not available in jsdom
Element.prototype.scrollIntoView = jest.fn();

const mockSendMessage = jest.fn();
const mockClearMessages = jest.fn();

jest.mock('../../../lib/hooks/useChat', () => ({
  useChat: () => ({
    messages: [],
    isLoading: false,
    error: null,
    sendMessage: mockSendMessage,
    clearMessages: mockClearMessages,
    abort: jest.fn(),
  }),
}));

jest.mock('../../../lib/api', () => ({
  getLlamaStatus: jest.fn().mockResolvedValue({ status: 'running' }),
  listTree: jest.fn().mockResolvedValue({ tree: [] }),
  readFile: jest.fn().mockResolvedValue({ content: '' }),
}));

jest.mock('../Message', () => ({
  Message: ({ message }: { message: { id: string; content: string } }) => (
    <div data-testid={`message-${message.id}`}>{message.content}</div>
  ),
}));

// Import after mocks are set up to avoid react-markdown ESM issue
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ChatInterface } = require('../index');

function resetStore() {
  useCollectionStore.setState({
    collections: [],
    selectedIds: new Set<number>(),
    indexingStatus: {},
    loading: false,
    error: null,
  });
}

describe('ChatInterface - Collection Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    mockSendMessage.mockResolvedValue(undefined);
  });

  describe('collectionIds in chat payload', () => {
    it('should send collectionIds from store when submitting a message', async () => {
      useCollectionStore.setState({
        selectedIds: new Set([1, 3, 5]),
        collections: [
          { id: 1, name: 'Backend', scope: 'local', projectDir: '/p', fileCount: 5, createdAt: '2025-01-01' },
          { id: 3, name: 'Docs', scope: 'global', projectDir: null, fileCount: 3, createdAt: '2025-01-02' },
          { id: 5, name: 'Tests', scope: 'local', projectDir: '/p', fileCount: 2, createdAt: '2025-01-03' },
        ],
      });

      render(<ChatInterface compact />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Pergunte algo/)).not.toBeDisabled();
      });

      const textarea = screen.getByPlaceholderText(/Pergunte algo/);
      fireEvent.change(textarea, { target: { value: 'Hello world' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledTimes(1);
      });

      const [message, options] = mockSendMessage.mock.calls[0];
      expect(message).toBe('Hello world');
      expect(options.collectionIds).toEqual(expect.arrayContaining([1, 3, 5]));
      expect(options.collectionIds).toHaveLength(3);
    });

    it('should send empty collectionIds array when no collections are selected', async () => {
      useCollectionStore.setState({
        selectedIds: new Set<number>(),
        collections: [],
      });

      render(<ChatInterface compact />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Pergunte algo/)).not.toBeDisabled();
      });

      const textarea = screen.getByPlaceholderText(/Pergunte algo/);
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledTimes(1);
      });

      const [, options] = mockSendMessage.mock.calls[0];
      expect(options.collectionIds).toEqual([]);
    });

    it('should convert Set<number> to number[] correctly', async () => {
      useCollectionStore.setState({
        selectedIds: new Set([42]),
        collections: [
          { id: 42, name: 'Single', scope: 'global', projectDir: null, fileCount: 1, createdAt: '2025-01-01' },
        ],
      });

      render(<ChatInterface compact />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Pergunte algo/)).not.toBeDisabled();
      });

      const textarea = screen.getByPlaceholderText(/Pergunte algo/);
      fireEvent.change(textarea, { target: { value: 'Query' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledTimes(1);
      });

      const [, options] = mockSendMessage.mock.calls[0];
      expect(Array.isArray(options.collectionIds)).toBe(true);
      expect(options.collectionIds).toEqual([42]);
    });
  });

  describe('ActiveCollectionsBadge', () => {
    it('should not render badge when no collections are selected', async () => {
      useCollectionStore.setState({
        selectedIds: new Set<number>(),
        collections: [],
      });

      render(<ChatInterface compact />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Pergunte algo|Selecione/)).toBeInTheDocument();
      });

      expect(screen.queryByTestId('active-collections-badge')).not.toBeInTheDocument();
    });

    it('should render badge with correct count when collections are selected', async () => {
      useCollectionStore.setState({
        selectedIds: new Set([1, 2, 3]),
        collections: [
          { id: 1, name: 'A', scope: 'local', projectDir: '/p', fileCount: 1, createdAt: '2025-01-01' },
          { id: 2, name: 'B', scope: 'global', projectDir: null, fileCount: 2, createdAt: '2025-01-02' },
          { id: 3, name: 'C', scope: 'local', projectDir: '/p', fileCount: 3, createdAt: '2025-01-03' },
        ],
      });

      render(<ChatInterface compact />);

      await waitFor(() => {
        const badge = screen.getByTestId('active-collections-badge');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveTextContent('3 colecoes');
      });
    });

    it('should render singular label when exactly one collection is selected', async () => {
      useCollectionStore.setState({
        selectedIds: new Set([1]),
        collections: [
          { id: 1, name: 'Only', scope: 'local', projectDir: '/p', fileCount: 1, createdAt: '2025-01-01' },
        ],
      });

      render(<ChatInterface compact />);

      await waitFor(() => {
        const badge = screen.getByTestId('active-collections-badge');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveTextContent('1 colecao');
      });
    });

    it('should have descriptive title attribute on badge', async () => {
      useCollectionStore.setState({
        selectedIds: new Set([1, 2]),
        collections: [
          { id: 1, name: 'A', scope: 'local', projectDir: '/p', fileCount: 1, createdAt: '2025-01-01' },
          { id: 2, name: 'B', scope: 'global', projectDir: null, fileCount: 2, createdAt: '2025-01-02' },
        ],
      });

      render(<ChatInterface compact />);

      await waitFor(() => {
        const badge = screen.getByTestId('active-collections-badge');
        expect(badge).toHaveAttribute('title', '2 colecoes ativas');
      });
    });

    it('should have singular title when one collection is selected', async () => {
      useCollectionStore.setState({
        selectedIds: new Set([5]),
        collections: [
          { id: 5, name: 'X', scope: 'global', projectDir: null, fileCount: 1, createdAt: '2025-01-01' },
        ],
      });

      render(<ChatInterface compact />);

      await waitFor(() => {
        const badge = screen.getByTestId('active-collections-badge');
        expect(badge).toHaveAttribute('title', '1 colecao ativa');
      });
    });
  });

  describe('Chat compatibility without collections', () => {
    it('should allow chat to function normally without any collections', async () => {
      useCollectionStore.setState({
        selectedIds: new Set<number>(),
        collections: [],
      });

      render(<ChatInterface compact />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Pergunte algo/)).not.toBeDisabled();
      });

      const textarea = screen.getByPlaceholderText(/Pergunte algo/);
      fireEvent.change(textarea, { target: { value: 'Normal chat without collections' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledTimes(1);
      });

      const [message, options] = mockSendMessage.mock.calls[0];
      expect(message).toBe('Normal chat without collections');
      expect(options.useStream).toBe(true);
      expect(options.collectionIds).toEqual([]);
    });

    it('should include useStream option alongside collectionIds', async () => {
      useCollectionStore.setState({
        selectedIds: new Set([10]),
        collections: [
          { id: 10, name: 'Stream Test', scope: 'global', projectDir: null, fileCount: 1, createdAt: '2025-01-01' },
        ],
      });

      render(<ChatInterface compact />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Pergunte algo/)).not.toBeDisabled();
      });

      const textarea = screen.getByPlaceholderText(/Pergunte algo/);
      fireEvent.change(textarea, { target: { value: 'Stream test' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledTimes(1);
      });

      const [, options] = mockSendMessage.mock.calls[0];
      expect(options).toEqual({
        useStream: true,
        collectionIds: [10],
      });
    });
  });

  describe('Full-page mode badge rendering', () => {
    it('should render badge in full-page mode when collections are selected', async () => {
      useCollectionStore.setState({
        selectedIds: new Set([1, 2]),
        collections: [
          { id: 1, name: 'A', scope: 'local', projectDir: '/p', fileCount: 1, createdAt: '2025-01-01' },
          { id: 2, name: 'B', scope: 'global', projectDir: null, fileCount: 2, createdAt: '2025-01-02' },
        ],
      });

      render(<ChatInterface />);

      await waitFor(() => {
        const badge = screen.getByTestId('active-collections-badge');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveTextContent('2 colecoes');
      });
    });

    it('should not render badge in full-page mode when no collections are selected', async () => {
      useCollectionStore.setState({
        selectedIds: new Set<number>(),
        collections: [],
      });

      render(<ChatInterface />);

      expect(screen.queryByTestId('active-collections-badge')).not.toBeInTheDocument();
    });
  });
});
