import { Page } from '@playwright/test';

export interface MockCollection {
  id: number;
  name: string;
  scope: 'local' | 'global';
  projectDir: string | null;
  fileCount: number;
  createdAt: string;
}

export interface MockCollectionFile {
  id: number;
  collectionId: number;
  filePath: string;
  repo: string;
  indexedAt: string | null;
}

const DEFAULT_COLLECTIONS: MockCollection[] = [
  {
    id: 1,
    name: 'Backend API',
    scope: 'local',
    projectDir: '/projects/my-app',
    fileCount: 12,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: 'Documentation',
    scope: 'global',
    projectDir: null,
    fileCount: 8,
    createdAt: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 3,
    name: 'CNAB Rules',
    scope: 'local',
    projectDir: '/projects/my-app',
    fileCount: 3,
    createdAt: '2026-01-03T00:00:00.000Z',
  },
];

const DEFAULT_FILES: Record<number, MockCollectionFile[]> = {
  1: [
    { id: 1, collectionId: 1, filePath: '/src/api/routes.ts', repo: 'Backend API', indexedAt: '2026-01-01T00:00:00.000Z' },
    { id: 2, collectionId: 1, filePath: '/src/api/controllers.ts', repo: 'Backend API', indexedAt: '2026-01-01T00:00:00.000Z' },
  ],
  2: [
    { id: 3, collectionId: 2, filePath: '/docs/readme.md', repo: 'Documentation', indexedAt: '2026-01-02T00:00:00.000Z' },
  ],
  3: [],
};

export async function setupApiMocks(
  page: Page,
  options: {
    collections?: MockCollection[];
    files?: Record<number, MockCollectionFile[]>;
  } = {}
): Promise<{
  collections: MockCollection[];
  getCreatedCollections: () => MockCollection[];
}> {
  const collections = [...(options.collections ?? DEFAULT_COLLECTIONS)];
  const files: Record<number, MockCollectionFile[]> = { ...(options.files ?? DEFAULT_FILES) };
  const createdCollections: MockCollection[] = [];
  let nextCollectionId = Math.max(...collections.map((c) => c.id), 0) + 1;
  let nextFileId = 100;

  await page.route(/\/api\/collections(\/.*)?(\?.*)?$/, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const pathname = url.pathname;

    // GET /api/collections
    if (method === 'GET' && pathname === '/api/collections') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(collections),
      });
      return;
    }

    // POST /api/collections
    if (method === 'POST' && pathname === '/api/collections') {
      const body = request.postDataJSON();
      const duplicate = collections.find(
        (c) => c.name === body.name && c.scope === body.scope
      );
      if (duplicate) {
        await route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({ error: `Collection "${body.name}" already exists` }),
        });
        return;
      }
      const newCollection: MockCollection = {
        id: nextCollectionId++,
        name: body.name,
        scope: body.scope,
        projectDir: body.projectDir ?? null,
        fileCount: 0,
        createdAt: new Date().toISOString(),
      };
      collections.push(newCollection);
      createdCollections.push(newCollection);
      files[newCollection.id] = [];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(newCollection),
      });
      return;
    }

    // Match /api/collections/:id patterns
    const idMatch = pathname.match(/^\/api\/collections\/(\d+)$/);
    if (idMatch) {
      const id = Number(idMatch[1]);

      // PUT /api/collections/:id
      if (method === 'PUT') {
        const body = request.postDataJSON();
        const idx = collections.findIndex((c) => c.id === id);
        if (idx === -1) {
          await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not found' }) });
          return;
        }
        collections[idx] = { ...collections[idx], name: body.name };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(collections[idx]),
        });
        return;
      }

      // DELETE /api/collections/:id
      if (method === 'DELETE') {
        const idx = collections.findIndex((c) => c.id === id);
        if (idx === -1) {
          await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not found' }) });
          return;
        }
        collections.splice(idx, 1);
        delete files[id];
        await route.fulfill({ status: 204 });
        return;
      }
    }

    // GET /api/collections/:id/files
    const filesMatch = pathname.match(/^\/api\/collections\/(\d+)\/files$/);
    if (filesMatch && method === 'GET') {
      const id = Number(filesMatch[1]);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(files[id] ?? []),
      });
      return;
    }

    // POST /api/collections/:id/files
    if (filesMatch && method === 'POST') {
      const id = Number(filesMatch[1]);
      const body = request.postDataJSON();
      const newFiles: MockCollectionFile[] = (body.files ?? []).map((f: { filePath: string; repo: string }) => ({
        id: nextFileId++,
        collectionId: id,
        filePath: f.filePath,
        repo: f.repo,
        indexedAt: new Date().toISOString(),
      }));
      if (!files[id]) files[id] = [];
      files[id].push(...newFiles);
      const colIdx = collections.findIndex((c) => c.id === id);
      if (colIdx !== -1) {
        collections[colIdx] = { ...collections[colIdx], fileCount: files[id].length };
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Files added, indexing started' }),
      });
      return;
    }

    // DELETE /api/collections/:id/files/:fileId
    const removeFileMatch = pathname.match(/^\/api\/collections\/(\d+)\/files\/(\d+)$/);
    if (removeFileMatch && method === 'DELETE') {
      const id = Number(removeFileMatch[1]);
      const fileId = Number(removeFileMatch[2]);
      if (files[id]) {
        files[id] = files[id].filter((f) => f.id !== fileId);
        const colIdx = collections.findIndex((c) => c.id === id);
        if (colIdx !== -1) {
          collections[colIdx] = { ...collections[colIdx], fileCount: files[id].length };
        }
      }
      await route.fulfill({ status: 204 });
      return;
    }

    // GET /api/collections/:id/status
    const statusMatch = pathname.match(/^\/api\/collections\/(\d+)\/status$/);
    if (statusMatch && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'done' }),
      });
      return;
    }

    await route.continue();
  });

  // Mock chat endpoint (handles both streaming and non-streaming)
  await page.route('**/api/chat', async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') {
      await route.continue();
      return;
    }
    const body = request.postDataJSON();
    const isStream = body.stream === true;
    const collectionIds: number[] = body.collectionIds ?? [];
    const sources: Array<{ file_path: string; repo: string; collection_id: number }> = [];
    for (const cid of collectionIds) {
      const collectionFiles = files[cid] ?? [];
      for (const f of collectionFiles) {
        sources.push({ file_path: f.filePath, repo: f.repo, collection_id: cid });
      }
    }
    const sourceInfo = sources.length > 0
      ? `Sources: ${sources.map((s) => s.file_path).join(', ')}`
      : 'No sources (no collections selected)';
    const responseText = `Here is the answer based on the selected collections. ${sourceInfo}`;
    if (isStream) {
      const sseBody = `data: ${JSON.stringify({ text: responseText })}\n\ndata: [DONE]\n\n`;
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sseBody,
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: responseText,
          model: 'mock',
          sources: sources.map((s) => ({
            file_path: s.file_path,
            repo: s.repo,
            content: 'mock content',
            score: 0.95,
          })),
        }),
      });
    }
  });

  // Mock other API endpoints that might be called on page load
  await page.route('**/api/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        ollama: { available: true, models: ['mock-model'] },
        database: { indexed_chunks: 100 },
        indexing: { running: false },
        config: { llmModel: 'mock-model', embeddingModel: 'mock-embed' },
      }),
    });
  });

  await page.route('**/api/models', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ models: [{ name: 'mock-model', size: '1B' }] }),
    });
  });

  await page.route('**/api/llama/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        activeModel: 'mock-model.gguf',
        status: 'running',
        pid: 12345,
      }),
    });
  });

  await page.route('**/api/llama/models', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        models: [
          { fileName: 'mock-model.gguf', displayName: 'Mock Model', sizeBytes: 1000000000, path: '/models/mock-model.gguf' },
        ],
        status: 'available',
      }),
    });
  });

  await page.route('**/api/llama/select', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, activeModel: 'mock-model.gguf' }),
    });
  });

  await page.route('**/api/files**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/llama/settings', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        llamaModelsDir: '/models',
        llamaServerPort: 8080,
        llamaServerPath: '/usr/local/bin/llama-server',
        embeddingModel: 'mock-embed',
      }),
    });
  });

  await page.route('**/api/index/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ isIndexing: false }),
    });
  });

  return {
    collections,
    getCreatedCollections: () => createdCollections,
  };
}
