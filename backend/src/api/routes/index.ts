import { Router } from 'express';
import chatRouter from './chat';
import healthRouter from './health';
import indexRouter from './index-route';

export function createRoutes(): Router {
  const router = Router();

  router.use('/health', healthRouter);
  router.use('/chat', chatRouter);
  router.use('/index', indexRouter);

  return router;
}
