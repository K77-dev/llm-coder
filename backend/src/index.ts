import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createRoutes } from './api/routes';
import { errorHandler } from './api/middleware/error';
import { logger } from './utils/logger';
import { initDatabase } from './db/sqlite-client';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3002',
    'http://localhost:3001',
  ],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

app.use('/api', createRoutes());
app.use(errorHandler);

async function start() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      logger.info({ port: PORT }, 'Code LLM Backend started');
    });
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }
}

start();
