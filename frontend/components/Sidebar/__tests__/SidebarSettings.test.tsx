import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Sidebar } from '../index';
import * as api from '../../../lib/api';

jest.mock('../../../lib/api', () => ({
  checkHealth: jest.fn(),
  indexDirectory: jest.fn(),
  getIndexStatus: jest.fn(),
  clearIndex: jest.fn(),
  getLlamaSettings: jest.fn(),
  updateLlamaSettings: jest.fn(),
  restartLlamaServer: jest.fn(),
}));

jest.mock('../../ThemeProvider', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: jest.fn() }),
}));

jest.mock('../ModelSelector', () => ({
  ModelSelector: () => <div data-testid="model-selector">ModelSelector</div>,
}));

jest.mock('../../DirectoryPicker', () => ({
  DirectoryPicker: () => <div data-testid="directory-picker">DirectoryPicker</div>,
}));

const mockShowToast = jest.fn();

jest.mock('../../../lib/hooks/useToast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const mockCheckHealth = api.checkHealth as jest.MockedFunction<typeof api.checkHealth>;
const mockGetSettings = api.getLlamaSettings as jest.MockedFunction<typeof api.getLlamaSettings>;
const mockUpdateSettings = api.updateLlamaSettings as jest.MockedFunction<typeof api.updateLlamaSettings>;

const DEFAULT_SETTINGS: api.LlamaSettings = {
  llamaModelsDir: '~/models',
  llamaServerPort: 8080,
  llamaServerPath: 'llama-server',
  embeddingModel: 'nomic-embed-text',
  contextSize: 8192,
  batchSize: 8192,
  maxMemoryMb: 13000,
  cacheTtl: 3600,
  lruCacheSize: 500,
};

const HEALTH_RESPONSE = {
  status: 'ok',
  ollama: { available: true, models: ['llama3:latest'] },
  database: { indexed_chunks: 100 },
  indexing: { running: false },
};

describe('Sidebar Settings Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckHealth.mockResolvedValue(HEALTH_RESPONSE as never);
    mockGetSettings.mockResolvedValue(DEFAULT_SETTINGS);
    mockUpdateSettings.mockResolvedValue({
      settings: DEFAULT_SETTINGS,
      restartRequired: false,
    });
    delete (window as unknown as Record<string, unknown>).electronAPI;
  });

  it('should render gear icon button in expanded sidebar', () => {
    render(<Sidebar />);
    const gearBtn = screen.getByTestId('gear-icon-btn');
    expect(gearBtn).toBeInTheDocument();
    expect(gearBtn).toHaveAttribute('aria-label', 'Open settings');
  });

  it('should open SettingsModal when clicking gear icon', async () => {
    render(<Sidebar />);
    expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('gear-icon-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
    });
  });

  it('should load settings from API when modal opens', async () => {
    const customSettings = { ...DEFAULT_SETTINGS, llamaServerPort: 9090 };
    mockGetSettings.mockResolvedValue(customSettings);
    render(<Sidebar />);
    fireEvent.click(screen.getByTestId('gear-icon-btn'));
    await waitFor(() => {
      const portInput = screen.getByLabelText('Server Port') as HTMLInputElement;
      expect(portInput.value).toBe('9090');
    });
    expect(mockGetSettings).toHaveBeenCalled();
  });

  it('should close SettingsModal when clicking Cancel', async () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByTestId('gear-icon-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('settings-cancel-btn'));
    expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();
  });

  it('should close SettingsModal when pressing ESC', async () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByTestId('gear-icon-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
    });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();
  });

  it('should close SettingsModal when clicking overlay', async () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByTestId('gear-icon-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('settings-overlay'));
    expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();
  });

  it('should show validation error for invalid port and prevent save', async () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByTestId('gear-icon-btn'));
    await waitFor(() => {
      expect(screen.getByLabelText('Server Port')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('Server Port'), { target: { value: '999' } });
    fireEvent.click(screen.getByTestId('settings-save-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('error-llamaServerPort')).toBeInTheDocument();
      expect(screen.getByTestId('error-llamaServerPort').textContent).toContain('1024');
    });
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });

  it('should discard changes on cancel and show original values on reopen', async () => {
    mockGetSettings.mockResolvedValue(DEFAULT_SETTINGS);
    render(<Sidebar />);
    fireEvent.click(screen.getByTestId('gear-icon-btn'));
    await waitFor(() => {
      expect(screen.getByLabelText('Model Name')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('Model Name'), { target: { value: 'custom-model' } });
    const modelInput = screen.getByLabelText('Model Name') as HTMLInputElement;
    expect(modelInput.value).toBe('custom-model');
    fireEvent.click(screen.getByTestId('settings-cancel-btn'));
    expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('gear-icon-btn'));
    await waitFor(() => {
      const reopenedInput = screen.getByLabelText('Model Name') as HTMLInputElement;
      expect(reopenedInput.value).toBe('nomic-embed-text');
    });
  });

  it('should save settings and close modal on successful save', async () => {
    mockUpdateSettings.mockResolvedValue({
      settings: DEFAULT_SETTINGS,
      restartRequired: false,
    });
    render(<Sidebar />);
    fireEvent.click(screen.getByTestId('gear-icon-btn'));
    await waitFor(() => {
      expect(screen.getByLabelText('Server Port')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('settings-save-btn'));
    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(DEFAULT_SETTINGS);
    });
    await waitFor(() => {
      expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();
    });
  });

  it('should display all three sections when modal is open', async () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByTestId('gear-icon-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('section-llm-server')).toBeInTheDocument();
      expect(screen.getByTestId('section-embedding')).toBeInTheDocument();
      expect(screen.getByTestId('section-cache')).toBeInTheDocument();
    });
  });
});
