import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SettingsModal } from '../index';
import { ToastProvider } from '../../Toast';
import * as api from '../../../lib/api';

jest.mock('../../../lib/api', () => ({
  getLlamaSettings: jest.fn(),
  updateLlamaSettings: jest.fn(),
  restartLlamaServer: jest.fn(),
}));

const mockGetSettings = api.getLlamaSettings as jest.MockedFunction<typeof api.getLlamaSettings>;
const mockUpdateSettings = api.updateLlamaSettings as jest.MockedFunction<typeof api.updateLlamaSettings>;

const DEFAULT_SETTINGS: api.LlamaSettings = {
  llamaModelsDir: '~/models',
  llamaServerPort: 8080,
  llamaServerPath: 'llama-server',
  embeddingModel: 'nomic-embed-text',
  maxMemoryMb: 13000,
  cacheTtl: 3600,
  lruCacheSize: 500,
};

function renderModal(isOpen = true) {
  const onClose = jest.fn();
  const result = render(
    <ToastProvider>
      <SettingsModal isOpen={isOpen} onClose={onClose} />
    </ToastProvider>,
  );
  return { ...result, onClose };
}

describe('SettingsModal', () => {
  beforeEach(() => {
    mockGetSettings.mockResolvedValue(DEFAULT_SETTINGS);
    delete (window as unknown as Record<string, unknown>).electronAPI;
  });

  it('should render with 3 sections and 7 fields', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByTestId('section-llm-server')).toBeInTheDocument();
      expect(screen.getByTestId('section-embedding')).toBeInTheDocument();
      expect(screen.getByTestId('section-cache')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Models Directory')).toBeInTheDocument();
    expect(screen.getByLabelText('Server Port')).toBeInTheDocument();
    expect(screen.getByLabelText('Server Executable Path')).toBeInTheDocument();
    expect(screen.getByLabelText('Model Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Max Memory (MB)')).toBeInTheDocument();
    expect(screen.getByLabelText('Cache TTL (seconds)')).toBeInTheDocument();
    expect(screen.getByLabelText('LRU Cache Size')).toBeInTheDocument();
  });

  it('should close when clicking Cancel', async () => {
    const { onClose } = renderModal();
    await waitFor(() => {
      expect(screen.getByTestId('section-llm-server')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('settings-cancel-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should close when pressing ESC', async () => {
    const { onClose } = renderModal();
    await waitFor(() => {
      expect(screen.getByTestId('section-llm-server')).toBeInTheDocument();
    });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should show validation error for port out of range', async () => {
    mockUpdateSettings.mockResolvedValue({
      settings: DEFAULT_SETTINGS,
      restartRequired: false,
    });
    renderModal();
    await waitFor(() => {
      expect(screen.getByLabelText('Server Port')).toBeInTheDocument();
    });
    const portInput = screen.getByLabelText('Server Port');
    fireEvent.change(portInput, { target: { value: '80' } });
    fireEvent.click(screen.getByTestId('settings-save-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('error-llamaServerPort')).toBeInTheDocument();
      expect(screen.getByTestId('error-llamaServerPort').textContent).toContain('1024');
    });
  });

  it('should show validation error for negative number', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByLabelText('Max Memory (MB)')).toBeInTheDocument();
    });
    const memoryInput = screen.getByLabelText('Max Memory (MB)');
    fireEvent.change(memoryInput, { target: { value: '-100' } });
    fireEvent.click(screen.getByTestId('settings-save-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('error-maxMemoryMb')).toBeInTheDocument();
      expect(screen.getByTestId('error-maxMemoryMb').textContent).toContain('greater than 0');
    });
  });

  it('should hide file picker buttons when electronAPI is not available', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByTestId('section-llm-server')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('picker-llamaModelsDir')).not.toBeInTheDocument();
    expect(screen.queryByTestId('picker-llamaServerPath')).not.toBeInTheDocument();
  });

  it('should call PUT /api/llama/settings with form data when saving', async () => {
    mockUpdateSettings.mockResolvedValue({
      settings: DEFAULT_SETTINGS,
      restartRequired: false,
    });
    const { onClose } = renderModal();
    await waitFor(() => {
      expect(screen.getByLabelText('Server Port')).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('settings-save-btn'));
    });
    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledTimes(1);
      expect(mockUpdateSettings).toHaveBeenCalledWith(DEFAULT_SETTINGS);
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('should not render when isOpen is false', () => {
    renderModal(false);
    expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();
  });

  it('should load settings from API on open', async () => {
    const customSettings = { ...DEFAULT_SETTINGS, llamaServerPort: 9090 };
    mockGetSettings.mockResolvedValue(customSettings);
    renderModal();
    await waitFor(() => {
      const portInput = screen.getByLabelText('Server Port') as HTMLInputElement;
      expect(portInput.value).toBe('9090');
    });
  });

  it('should close the modal on overlay click', async () => {
    const { onClose } = renderModal();
    await waitFor(() => {
      expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('settings-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsModal Accessibility (BUG-01 regression)', () => {
  beforeEach(() => {
    mockGetSettings.mockResolvedValue(DEFAULT_SETTINGS);
    delete (window as unknown as Record<string, unknown>).electronAPI;
  });

  it('should render error messages with role="alert" and aria-live="assertive"', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByLabelText('Server Port')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('Server Port'), { target: { value: '80' } });
    fireEvent.click(screen.getByTestId('settings-save-btn'));
    await waitFor(() => {
      const errorEl = screen.getByTestId('error-llamaServerPort');
      expect(errorEl).toHaveAttribute('role', 'alert');
      expect(errorEl).toHaveAttribute('aria-live', 'assertive');
    });
  });

  it('should link error messages to inputs via aria-describedby', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByLabelText('Server Port')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('Server Port'), { target: { value: '80' } });
    fireEvent.click(screen.getByTestId('settings-save-btn'));
    await waitFor(() => {
      const portInput = screen.getByLabelText('Server Port');
      const errorEl = screen.getByTestId('error-llamaServerPort');
      expect(portInput).toHaveAttribute('aria-describedby', errorEl.id);
      expect(portInput).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('should set aria-describedby on all numeric fields with errors', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByLabelText('Max Memory (MB)')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('Max Memory (MB)'), { target: { value: '-1' } });
    fireEvent.change(screen.getByLabelText('Cache TTL (seconds)'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('LRU Cache Size'), { target: { value: '-5' } });
    fireEvent.click(screen.getByTestId('settings-save-btn'));
    await waitFor(() => {
      const memoryInput = screen.getByLabelText('Max Memory (MB)');
      const ttlInput = screen.getByLabelText('Cache TTL (seconds)');
      const lruInput = screen.getByLabelText('LRU Cache Size');
      expect(memoryInput).toHaveAttribute('aria-describedby', 'maxMemoryMb-error');
      expect(memoryInput).toHaveAttribute('aria-invalid', 'true');
      expect(ttlInput).toHaveAttribute('aria-describedby', 'cacheTtl-error');
      expect(ttlInput).toHaveAttribute('aria-invalid', 'true');
      expect(lruInput).toHaveAttribute('aria-describedby', 'lruCacheSize-error');
      expect(lruInput).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('should not set aria-describedby when there are no errors', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByLabelText('Server Port')).toBeInTheDocument();
    });
    const portInput = screen.getByLabelText('Server Port');
    expect(portInput).not.toHaveAttribute('aria-describedby');
    expect(portInput).toHaveAttribute('aria-invalid', 'false');
  });
});

describe('SettingsModal Overlay (BUG-02 regression)', () => {
  beforeEach(() => {
    mockGetSettings.mockResolvedValue(DEFAULT_SETTINGS);
    delete (window as unknown as Record<string, unknown>).electronAPI;
  });

  it('should render overlay with aria-hidden="true"', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
    });
    const overlay = screen.getByTestId('settings-overlay');
    expect(overlay).toHaveAttribute('aria-hidden', 'true');
  });

  it('should have role="dialog" and aria-modal on the modal container', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
    });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'LLM Settings');
  });
});
