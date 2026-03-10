import pino from 'pino';
import path from 'path';
import fs from 'fs';

const logPath = process.env.LOG_PATH || './logs';

if (!fs.existsSync(logPath)) {
  fs.mkdirSync(logPath, { recursive: true });
}

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true },
  } : undefined,
});

export const fileLogger = pino(
  { level: 'info' },
  pino.destination(path.join(logPath, 'app.log'))
);
