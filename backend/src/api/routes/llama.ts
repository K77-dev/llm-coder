import { Router } from 'express';
import { getModels, selectModel, getStatus } from '../controllers/llama.controller';

const router = Router();

router.get('/models', getModels);
router.post('/select', selectModel);
router.get('/status', getStatus);

export default router;
