import { Router } from 'express';
import { chat } from '../controllers/chat.controller';
import { optionalAuth } from '../middleware/auth';

const router = Router();

router.post('/', optionalAuth, chat);

export default router;
