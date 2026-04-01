import {
  fetchCollections,
  createCollection,
  renameCollection,
  deleteCollection,
  fetchCollectionFiles,
  addCollectionFiles,
  removeCollectionFile,
  fetchIndexingStatus,
  api,
} from '../api';
import type {
  Collection,
  CollectionFile,
  IndexingStatus,
} from '../api';

jest.mock('axios', () => {
  const mockAxiosInstance = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => mockAxiosInstance),
    },
  };
});

const mockCollection: Collection = {
  id: 1,
  name: 'Backend API',
  scope: 'local',
  projectDir: '/projects/app',
  fileCount: 5,
  createdAt: '2026-01-01T00:00:00Z',
};

const mockFiles: CollectionFile[] = [
  {
    id: 10,
    collectionId: 1,
    filePath: 'src/index.ts',
    repo: 'my-repo',
    indexedAt: '2026-01-01T00:00:00Z',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Collection API functions', () => {
  describe('fetchCollections', () => {
    it('should call GET /collections without params', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: [mockCollection] });
      const result = await fetchCollections();
      expect(api.get).toHaveBeenCalledWith('/collections', { params: {} });
      expect(result).toEqual([mockCollection]);
    });

    it('should pass projectDir as query param', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: [] });
      await fetchCollections('/projects/app');
      expect(api.get).toHaveBeenCalledWith('/collections', {
        params: { projectDir: '/projects/app' },
      });
    });
  });

  describe('createCollection', () => {
    it('should call POST /collections with params', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockCollection });
      const params = { name: 'Backend API', scope: 'local' as const, projectDir: '/projects/app' };
      const result = await createCollection(params);
      expect(api.post).toHaveBeenCalledWith('/collections', params);
      expect(result).toEqual(mockCollection);
    });
  });

  describe('renameCollection', () => {
    it('should call PUT /collections/:id with new name', async () => {
      const renamed = { ...mockCollection, name: 'New Name' };
      (api.put as jest.Mock).mockResolvedValue({ data: renamed });
      const result = await renameCollection(1, 'New Name');
      expect(api.put).toHaveBeenCalledWith('/collections/1', { name: 'New Name' });
      expect(result.name).toBe('New Name');
    });
  });

  describe('deleteCollection', () => {
    it('should call DELETE /collections/:id', async () => {
      (api.delete as jest.Mock).mockResolvedValue({ data: undefined });
      await deleteCollection(1);
      expect(api.delete).toHaveBeenCalledWith('/collections/1');
    });
  });

  describe('fetchCollectionFiles', () => {
    it('should call GET /collections/:id/files', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockFiles });
      const result = await fetchCollectionFiles(1);
      expect(api.get).toHaveBeenCalledWith('/collections/1/files');
      expect(result).toEqual(mockFiles);
    });
  });

  describe('addCollectionFiles', () => {
    it('should call POST /collections/:id/files with files array', async () => {
      const files = [{ filePath: 'src/index.ts', repo: 'my-repo' }];
      (api.post as jest.Mock).mockResolvedValue({ data: { message: 'Files added' } });
      const result = await addCollectionFiles(1, files);
      expect(api.post).toHaveBeenCalledWith('/collections/1/files', { files });
      expect(result.message).toBe('Files added');
    });
  });

  describe('removeCollectionFile', () => {
    it('should call DELETE /collections/:id/files/:fileId', async () => {
      (api.delete as jest.Mock).mockResolvedValue({ data: undefined });
      await removeCollectionFile(1, 10);
      expect(api.delete).toHaveBeenCalledWith('/collections/1/files/10');
    });
  });

  describe('error handling', () => {
    it('should propagate error when fetchCollections fails with 500', async () => {
      const serverError = new Error('Request failed with status code 500');
      (api.get as jest.Mock).mockRejectedValue(serverError);
      await expect(fetchCollections()).rejects.toThrow('Request failed with status code 500');
    });

    it('should propagate error when createCollection fails with 422', async () => {
      const validationError = new Error('Request failed with status code 422');
      (api.post as jest.Mock).mockRejectedValue(validationError);
      const params = { name: '', scope: 'local' as const, projectDir: '/projects/app' };
      await expect(createCollection(params)).rejects.toThrow('Request failed with status code 422');
    });

    it('should propagate error when deleteCollection fails', async () => {
      const notFoundError = new Error('Request failed with status code 404');
      (api.delete as jest.Mock).mockRejectedValue(notFoundError);
      await expect(deleteCollection(999)).rejects.toThrow('Request failed with status code 404');
    });

    it('should propagate error when addCollectionFiles fails with 500', async () => {
      const serverError = new Error('Request failed with status code 500');
      (api.post as jest.Mock).mockRejectedValue(serverError);
      const files = [{ filePath: 'src/index.ts', repo: 'my-repo' }];
      await expect(addCollectionFiles(1, files)).rejects.toThrow('Request failed with status code 500');
    });
  });

  describe('fetchIndexingStatus', () => {
    it('should call GET /collections/:id/status and return status with progress', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: { status: 'done', progress: 100 } });
      const result = await fetchIndexingStatus(1);
      expect(api.get).toHaveBeenCalledWith('/collections/1/status');
      expect(result).toEqual({ status: 'done', progress: 100 });
    });

    it('should return idle status with zero progress', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: { status: 'idle', progress: 0 } });
      const result = await fetchIndexingStatus(2);
      expect(result).toEqual({ status: 'idle', progress: 0 });
    });

    it('should return indexing status with progress', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: { status: 'indexing', progress: 45 } });
      const result = await fetchIndexingStatus(3);
      expect(result).toEqual({ status: 'indexing', progress: 45 });
    });
  });
});
