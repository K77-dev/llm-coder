import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { ModelSelector } from '../ModelSelector';

interface MockLlamaAPI {
  getModels: jest.Mock;
  getState: jest.Mock;
  selectModel: jest.Mock;
  restart: jest.Mock;
  onStateChange: jest.Mock;
}

const MOCK_MODELS = [
  { fileName: 'llama-7b.gguf', displayName: 'llama-7b', sizeBytes: 3_435_973_837, path: '/models/llama-7b.gguf' },
  { fileName: 'codellama-13b.gguf', displayName: 'codellama-13b', sizeBytes: 7_516_192_768, path: '/models/codellama-13b.gguf' },
  { fileName: 'tiny-model.gguf', displayName: 'tiny-model', sizeBytes: 524_288, path: '/models/tiny-model.gguf' },
];

const MOCK_STATE_RUNNING = {
  status: 'running' as const,
  activeModel: 'llama-7b.gguf',
  port: 8080,
  pid: 1234,
  error: null,
};

const MOCK_STATE_STOPPED = {
  status: 'stopped' as const,
  activeModel: null,
  port: 8080,
  pid: null,
  error: null,
};

const MOCK_STATE_STARTING = {
  status: 'starting' as const,
  activeModel: 'codellama-13b.gguf',
  port: 8080,
  pid: 5678,
  error: null,
};

const MOCK_STATE_ERROR = {
  status: 'error' as const,
  activeModel: null,
  port: 8080,
  pid: null,
  error: 'llama-server not found in PATH',
};

function setupMockElectronAPI(overrides?: Partial<MockLlamaAPI>): MockLlamaAPI {
  const mockLlama: MockLlamaAPI = {
    getModels: jest.fn().mockResolvedValue(MOCK_MODELS),
    getState: jest.fn().mockResolvedValue(MOCK_STATE_RUNNING),
    selectModel: jest.fn().mockResolvedValue(undefined),
    restart: jest.fn().mockResolvedValue(undefined),
    onStateChange: jest.fn().mockReturnValue(() => {}),
    ...overrides,
  };
  const mockDialog = {
    selectDirectory: jest.fn().mockResolvedValue(null),
    selectFile: jest.fn().mockResolvedValue(null),
    showConfirm: jest.fn().mockResolvedValue(false),
  };
  window.electronAPI = { llama: mockLlama, dialog: mockDialog };
  return mockLlama;
}

function clearMockElectronAPI(): void {
  delete window.electronAPI;
}

describe('ModelSelector', () => {
  afterEach(() => {
    clearMockElectronAPI();
  });

  it('renders model list correctly', async () => {
    setupMockElectronAPI();
    await act(async () => {
      render(<ModelSelector />);
    });
    expect(screen.getByText('llama-7b')).toBeInTheDocument();
    expect(screen.getByText('codellama-13b')).toBeInTheDocument();
    expect(screen.getByText('tiny-model')).toBeInTheDocument();
    expect(screen.getByText('3.2 GB')).toBeInTheDocument();
    expect(screen.getByText('7.0 GB')).toBeInTheDocument();
    expect(screen.getByText('512.0 KB')).toBeInTheDocument();
  });

  it('highlights the active model', async () => {
    setupMockElectronAPI();
    await act(async () => {
      render(<ModelSelector />);
    });
    const activeItem = screen.getByText('llama-7b').closest('li');
    expect(activeItem).toHaveAttribute('aria-selected', 'true');
    const inactiveItem = screen.getByText('codellama-13b').closest('li');
    expect(inactiveItem).toHaveAttribute('aria-selected', 'false');
  });

  it('displays server status for each state', async () => {
    const statusTests = [
      { state: MOCK_STATE_RUNNING, label: 'Running' },
      { state: MOCK_STATE_STOPPED, label: 'Stopped' },
      { state: MOCK_STATE_STARTING, label: 'Starting...' },
      { state: MOCK_STATE_ERROR, label: 'Error' },
    ];
    for (const { state, label } of statusTests) {
      setupMockElectronAPI({
        getState: jest.fn().mockResolvedValue(state),
      });
      const { unmount } = await act(async () => {
        return render(<ModelSelector />);
      });
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
      clearMockElectronAPI();
    }
  });

  it('displays message when no models available', async () => {
    setupMockElectronAPI({
      getModels: jest.fn().mockResolvedValue([]),
      getState: jest.fn().mockResolvedValue(MOCK_STATE_STOPPED),
    });
    await act(async () => {
      render(<ModelSelector />);
    });
    expect(screen.getByText(/No models found/)).toBeInTheDocument();
    expect(screen.getByText(/LLAMA_MODELS_DIR/)).toBeInTheDocument();
  });

  it('displays loading indicator during model switch', async () => {
    let stateChangeCallback: ((state: Record<string, unknown>) => void) | null = null;
    setupMockElectronAPI({
      onStateChange: jest.fn().mockImplementation((cb: (state: Record<string, unknown>) => void) => {
        stateChangeCallback = cb;
        return () => {};
      }),
      selectModel: jest.fn().mockImplementation(() => {
        return new Promise((resolve) => setTimeout(resolve, 1000));
      }),
    });
    await act(async () => {
      render(<ModelSelector />);
    });
    await act(async () => {
      fireEvent.click(screen.getByText('codellama-13b'));
    });
    // Simulate state change to starting
    await act(async () => {
      if (stateChangeCallback) {
        stateChangeCallback(MOCK_STATE_STARTING);
      }
    });
    expect(screen.getByText('Starting...')).toBeInTheDocument();
  });

  it('calls getModels when refresh button is clicked', async () => {
    const mockLlama = setupMockElectronAPI();
    await act(async () => {
      render(<ModelSelector />);
    });
    // Initial call
    expect(mockLlama.getModels).toHaveBeenCalledTimes(1);
    await act(async () => {
      fireEvent.click(screen.getByTitle('Refresh model list'));
    });
    expect(mockLlama.getModels).toHaveBeenCalledTimes(2);
  });

  it('renders with HTTP fallback when window.electronAPI is not available', async () => {
    clearMockElectronAPI();
    await act(async () => {
      render(<ModelSelector />);
    });
    expect(screen.getByText('Local Models')).toBeInTheDocument();
    expect(screen.getByText(/No models found/)).toBeInTheDocument();
  });

  it('calls selectModel when a different model is clicked', async () => {
    const mockLlama = setupMockElectronAPI();
    await act(async () => {
      render(<ModelSelector />);
    });
    await act(async () => {
      fireEvent.click(screen.getByText('codellama-13b'));
    });
    expect(mockLlama.selectModel).toHaveBeenCalledWith('codellama-13b.gguf');
  });

  it('does not call selectModel when clicking the already active model', async () => {
    const mockLlama = setupMockElectronAPI();
    await act(async () => {
      render(<ModelSelector />);
    });
    await act(async () => {
      fireEvent.click(screen.getByText('llama-7b'));
    });
    expect(mockLlama.selectModel).not.toHaveBeenCalled();
  });

  it('displays error message for llama-server not found', async () => {
    setupMockElectronAPI({
      getModels: jest.fn().mockResolvedValue([]),
      getState: jest.fn().mockResolvedValue(MOCK_STATE_ERROR),
    });
    await act(async () => {
      render(<ModelSelector />);
    });
    expect(screen.getByText(/llama-server not found/)).toBeInTheDocument();
    expect(screen.getByText(/LLAMA_SERVER_PATH/)).toBeInTheDocument();
  });

  it('cleans up onStateChange subscription on unmount', async () => {
    const unsubscribe = jest.fn();
    setupMockElectronAPI({
      onStateChange: jest.fn().mockReturnValue(unsubscribe),
    });
    let unmount: () => void;
    await act(async () => {
      const result = render(<ModelSelector />);
      unmount = result.unmount;
    });
    act(() => {
      unmount!();
    });
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('supports keyboard navigation with Enter key', async () => {
    const mockLlama = setupMockElectronAPI();
    await act(async () => {
      render(<ModelSelector />);
    });
    const modelItem = screen.getByText('codellama-13b').closest('li')!;
    await act(async () => {
      fireEvent.keyDown(modelItem, { key: 'Enter' });
    });
    expect(mockLlama.selectModel).toHaveBeenCalledWith('codellama-13b.gguf');
  });

  it('supports keyboard navigation with Space key', async () => {
    const mockLlama = setupMockElectronAPI();
    await act(async () => {
      render(<ModelSelector />);
    });
    const modelItem = screen.getByText('codellama-13b').closest('li')!;
    await act(async () => {
      fireEvent.keyDown(modelItem, { key: ' ' });
    });
    expect(mockLlama.selectModel).toHaveBeenCalledWith('codellama-13b.gguf');
  });

  it('has proper accessibility attributes', async () => {
    setupMockElectronAPI();
    await act(async () => {
      render(<ModelSelector />);
    });
    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveAttribute('aria-label', 'Available models');
    const statusArea = screen.getByText('Running').parentElement?.parentElement;
    expect(statusArea).toHaveAttribute('aria-live', 'polite');
  });

  it('highlights active model when activeModel is filename only (BUG-01 regression)', async () => {
    setupMockElectronAPI({
      getState: jest.fn().mockResolvedValue({
        ...MOCK_STATE_RUNNING,
        activeModel: 'llama-7b.gguf',
      }),
    });
    await act(async () => {
      render(<ModelSelector />);
    });
    const activeItem = screen.getByText('llama-7b').closest('li');
    expect(activeItem).toHaveAttribute('aria-selected', 'true');
    const inactiveItem = screen.getByText('codellama-13b').closest('li');
    expect(inactiveItem).toHaveAttribute('aria-selected', 'false');
  });

  it('does not call selectModel when clicking the active model with filename match (BUG-01 regression)', async () => {
    const mockLlama = setupMockElectronAPI({
      getState: jest.fn().mockResolvedValue({
        ...MOCK_STATE_RUNNING,
        activeModel: 'llama-7b.gguf',
      }),
    });
    await act(async () => {
      render(<ModelSelector />);
    });
    await act(async () => {
      fireEvent.click(screen.getByText('llama-7b'));
    });
    expect(mockLlama.selectModel).not.toHaveBeenCalled();
  });

  it('toggles collapse when header is clicked', async () => {
    setupMockElectronAPI();
    await act(async () => {
      render(<ModelSelector />);
    });
    expect(screen.getByText('llama-7b')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByText('Local Models'));
    });
    expect(screen.queryByText('llama-7b')).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByText('Local Models'));
    });
    expect(screen.getByText('llama-7b')).toBeInTheDocument();
  });
});
