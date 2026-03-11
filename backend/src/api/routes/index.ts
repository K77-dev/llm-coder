import { Router } from 'express';
import chatRouter from './chat';
import healthRouter from './health';
import indexRouter from './index-route';
import browseRouter from './browse';
import filesRouter from './files';
import execRouter from './exec';

export function createRoutes(): Router {
  const router = Router();

  router.use('/health', healthRouter);
  router.use('/chat', chatRouter);
  router.use('/index', indexRouter);
  router.use('/browse', browseRouter);
  router.use('/files', filesRouter);
  router.use('/exec', execRouter);

  return router;
}
