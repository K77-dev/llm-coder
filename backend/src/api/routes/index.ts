import { Router } from 'express';
import chatRouter from './chat';
import healthRouter from './health';
import indexRouter from './index-route';
import browseRouter from './browse';
import filesRouter from './files';
import execRouter from './exec';
import llamaRouter from './llama';
import collectionRouter from './collection-route';

export function createRoutes(): Router {
  const router = Router();

  router.use('/health', healthRouter);
  router.use('/chat', chatRouter);
  router.use('/index', indexRouter);
  router.use('/browse', browseRouter);
  router.use('/files', filesRouter);
  router.use('/exec', execRouter);
  router.use('/llama', llamaRouter);
  router.use('/collections', collectionRouter);

  return router;
}
