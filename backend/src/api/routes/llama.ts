import { Router } from 'express';
import {
  getModels,
  selectModel,
  getStatus,
  getSettingsHandler,
  updateSettingsHandler,
  restartServerHandler,
} from '../controllers/llama.controller';

const router = Router();

router.get('/models', getModels);
router.post('/select', selectModel);
router.get('/status', getStatus);
router.get('/settings', getSettingsHandler);
router.put('/settings', updateSettingsHandler);
router.post('/restart', restartServerHandler);

export default router;
