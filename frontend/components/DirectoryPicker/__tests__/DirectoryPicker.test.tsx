import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DirectoryPicker } from '../index';
import { api } from '../../../lib/api';

jest.mock('../../../lib/api', () => ({
  api: {
    get: jest.fn(),
  },
}));

const mockApiGet = api.get as jest.MockedFunction<typeof api.get>;

const MOCK_BROWSE_RESULT = {
  data: {
    path: '/Users/test/project',
    parent: '/Users/test',
    entries: [
      { name: 'src', path: '/Users/test/project/src', type: 'directory' as const },
      { name: 'index.ts', path: '/Users/test/project/index.ts', type: 'file' as const },
      { name: 'app.ts', path: '/Users/test/project/app.ts', type: 'file' as const },
      { name: 'README.md', path: '/Users/test/project/README.md', type: 'file' as const },
    ],
  },
};

describe('DirectoryPicker', () => {
  const mockOnSelect = jest.fn();
  const mockOnClose = jest.fn();
  const mockOnSelectFiles = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockResolvedValue(MOCK_BROWSE_RESULT);
  });

  describe('directory mode (default)', () => {
    it('should render with title "Select directory"', async () => {
      render(<DirectoryPicker onSelect={mockOnSelect} onClose={mockOnClose} />);
      await waitFor(() => {
        expect(screen.getByText('Select directory')).toBeInTheDocument();
      });
    });

    it('should show "Select this folder" button in directory mode', async () => {
      render(<DirectoryPicker onSelect={mockOnSelect} onClose={mockOnClose} />);
      await waitFor(() => {
        expect(screen.getByText('Select this folder')).toBeInTheDocument();
      });
    });

    it('should not show file entries in directory mode', async () => {
      render(<DirectoryPicker onSelect={mockOnSelect} onClose={mockOnClose} />);
      await waitFor(() => {
        expect(screen.getByTestId('dir-entry-src')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('file-entry-index.ts')).not.toBeInTheDocument();
    });

    it('should call onClose when Cancel is clicked', async () => {
      render(<DirectoryPicker onSelect={mockOnSelect} onClose={mockOnClose} />);
      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Cancel'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('files mode', () => {
    it('should render with title "Select files"', async () => {
      render(
        <DirectoryPicker
          mode="files"
          onSelect={mockOnSelect}
          onSelectFiles={mockOnSelectFiles}
          onClose={mockOnClose}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Select files')).toBeInTheDocument();
      });
    });

    it('should show file entries in files mode', async () => {
      render(
        <DirectoryPicker
          mode="files"
          onSelect={mockOnSelect}
          onSelectFiles={mockOnSelectFiles}
          onClose={mockOnClose}
        />
      );
      await waitFor(() => {
        expect(screen.getByTestId('file-entry-index.ts')).toBeInTheDocument();
        expect(screen.getByTestId('file-entry-app.ts')).toBeInTheDocument();
        expect(screen.getByTestId('file-entry-README.md')).toBeInTheDocument();
      });
    });

    it('should show directory entries in files mode too', async () => {
      render(
        <DirectoryPicker
          mode="files"
          onSelect={mockOnSelect}
          onSelectFiles={mockOnSelectFiles}
          onClose={mockOnClose}
        />
      );
      await waitFor(() => {
        expect(screen.getByTestId('dir-entry-src')).toBeInTheDocument();
      });
    });

    it('should show "Add entire folder" and "Add files" buttons in files mode', async () => {
      render(
        <DirectoryPicker
          mode="files"
          onSelect={mockOnSelect}
          onSelectFiles={mockOnSelectFiles}
          onClose={mockOnClose}
        />
      );
      await waitFor(() => {
        expect(screen.getByTestId('add-folder-btn')).toBeInTheDocument();
        expect(screen.getByTestId('add-files-btn')).toBeInTheDocument();
      });
    });

    it('should toggle file selection when clicked', async () => {
      render(
        <DirectoryPicker
          mode="files"
          onSelect={mockOnSelect}
          onSelectFiles={mockOnSelectFiles}
          onClose={mockOnClose}
        />
      );
      await waitFor(() => {
        expect(screen.getByTestId('file-entry-index.ts')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('file-entry-index.ts'));
      expect(screen.getByTestId('add-files-btn')).toHaveTextContent('Add 1 file');
      fireEvent.click(screen.getByTestId('file-entry-app.ts'));
      expect(screen.getByTestId('add-files-btn')).toHaveTextContent('Add 2 files');
      fireEvent.click(screen.getByTestId('file-entry-index.ts'));
      expect(screen.getByTestId('add-files-btn')).toHaveTextContent('Add 1 file');
    });

    it('should disable add files button when no files selected', async () => {
      render(
        <DirectoryPicker
          mode="files"
          onSelect={mockOnSelect}
          onSelectFiles={mockOnSelectFiles}
          onClose={mockOnClose}
        />
      );
      await waitFor(() => {
        expect(screen.getByTestId('add-files-btn')).toBeDisabled();
      });
    });

    it('should call onSelectFiles with selected file paths', async () => {
      render(
        <DirectoryPicker
          mode="files"
          onSelect={mockOnSelect}
          onSelectFiles={mockOnSelectFiles}
          onClose={mockOnClose}
        />
      );
      await waitFor(() => {
        expect(screen.getByTestId('file-entry-index.ts')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('file-entry-index.ts'));
      fireEvent.click(screen.getByTestId('file-entry-app.ts'));
      fireEvent.click(screen.getByTestId('add-files-btn'));
      expect(mockOnSelectFiles).toHaveBeenCalledWith(
        expect.arrayContaining(['/Users/test/project/index.ts', '/Users/test/project/app.ts'])
      );
    });

    it('should call onSelect with current path when "Add entire folder" is clicked', async () => {
      render(
        <DirectoryPicker
          mode="files"
          onSelect={mockOnSelect}
          onSelectFiles={mockOnSelectFiles}
          onClose={mockOnClose}
        />
      );
      await waitFor(() => {
        expect(screen.getByTestId('add-folder-btn')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('add-folder-btn'));
      expect(mockOnSelect).toHaveBeenCalledWith('/Users/test/project');
    });

    it('should indicate already-added files visually', async () => {
      const existingFiles = new Set(['/Users/test/project/index.ts']);
      render(
        <DirectoryPicker
          mode="files"
          onSelect={mockOnSelect}
          onSelectFiles={mockOnSelectFiles}
          onClose={mockOnClose}
          existingFiles={existingFiles}
        />
      );
      await waitFor(() => {
        expect(screen.getByTestId('already-added-index.ts')).toBeInTheDocument();
      });
      const fileEntry = screen.getByTestId('file-entry-index.ts');
      expect(fileEntry).toBeDisabled();
    });

    it('should not toggle selection on already-added files', async () => {
      const existingFiles = new Set(['/Users/test/project/index.ts']);
      render(
        <DirectoryPicker
          mode="files"
          onSelect={mockOnSelect}
          onSelectFiles={mockOnSelectFiles}
          onClose={mockOnClose}
          existingFiles={existingFiles}
        />
      );
      await waitFor(() => {
        expect(screen.getByTestId('file-entry-index.ts')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('file-entry-index.ts'));
      expect(screen.getByTestId('add-files-btn')).toHaveTextContent('Add 0 files');
    });

    it('should show "added" text on already-added files', async () => {
      const existingFiles = new Set(['/Users/test/project/app.ts']);
      render(
        <DirectoryPicker
          mode="files"
          onSelect={mockOnSelect}
          onSelectFiles={mockOnSelectFiles}
          onClose={mockOnClose}
          existingFiles={existingFiles}
        />
      );
      await waitFor(() => {
        const fileEntry = screen.getByTestId('file-entry-app.ts');
        expect(fileEntry).toHaveTextContent('added');
      });
    });

    it('should have accessible aria-label on already-added files', async () => {
      const existingFiles = new Set(['/Users/test/project/index.ts']);
      render(
        <DirectoryPicker
          mode="files"
          onSelect={mockOnSelect}
          onSelectFiles={mockOnSelectFiles}
          onClose={mockOnClose}
          existingFiles={existingFiles}
        />
      );
      await waitFor(() => {
        const fileEntry = screen.getByTestId('file-entry-index.ts');
        expect(fileEntry).toHaveAttribute('aria-label', 'index.ts (already added)');
      });
    });
  });

  describe('navigation', () => {
    it('should navigate to directory when directory entry is clicked', async () => {
      const nestedResult = {
        data: {
          path: '/Users/test/project/src',
          parent: '/Users/test/project',
          entries: [
            { name: 'main.ts', path: '/Users/test/project/src/main.ts', type: 'file' },
          ],
        },
      };
      mockApiGet
        .mockResolvedValueOnce(MOCK_BROWSE_RESULT)
        .mockResolvedValueOnce(nestedResult);
      render(
        <DirectoryPicker
          mode="files"
          onSelect={mockOnSelect}
          onSelectFiles={mockOnSelectFiles}
          onClose={mockOnClose}
        />
      );
      await waitFor(() => {
        expect(screen.getByTestId('dir-entry-src')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('dir-entry-src'));
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledTimes(2);
      });
    });

    it('should show close button with aria-label', async () => {
      render(<DirectoryPicker onSelect={mockOnSelect} onClose={mockOnClose} />);
      await waitFor(() => {
        expect(screen.getByLabelText('Close picker')).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('should show error when browse API fails', async () => {
      mockApiGet.mockRejectedValue(new Error('Network error'));
      render(<DirectoryPicker onSelect={mockOnSelect} onClose={mockOnClose} />);
      await waitFor(() => {
        expect(screen.getByText('Could not open this directory.')).toBeInTheDocument();
      });
    });
  });
});
