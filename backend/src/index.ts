import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createRoutes } from './api/routes';
import { errorHandler } from './api/middleware/error';
import { logger } from './utils/logger';
import { initDatabase, getVectorsDb } from './db/sqlite-client';
import { autoStartLlamaServer } from './api/controllers/llama.controller';
import { getService } from './api/controllers/collection.controller';
import { CollectionIndexer } from './rag/collection-indexer';
import { generateEmbedding } from './llm/ollama-client';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3002',
      'http://localhost:3001',
    ];
    // Allow Electron renderer: file:// sends origin as null/undefined
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

app.use('/api', createRoutes());
app.use(errorHandler);

async function start() {
  try {
    await initDatabase();

    // Initialize CollectionIndexer and set it in CollectionService
    const db = getVectorsDb();
    const indexer = new CollectionIndexer({
      db,
      generateEmbedding,
    });
    getService().setIndexer(indexer);

    autoStartLlamaServer();
    app.listen(PORT, () => {
      logger.info({ port: PORT }, 'Code LLM Backend started');
    });
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }
}

start();
