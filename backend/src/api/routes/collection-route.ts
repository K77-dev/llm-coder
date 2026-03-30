import { Router } from 'express';
import {
  listCollections,
  createCollection,
  renameCollection,
  deleteCollection,
  listFiles,
  addFiles,
  removeFile,
  reindexCollection,
  getIndexingStatus,
} from '../controllers/collection.controller';

const router = Router();

router.get('/', listCollections);
router.post('/', createCollection);
router.put('/:id', renameCollection);
router.delete('/:id', deleteCollection);
router.get('/:id/files', listFiles);
router.post('/:id/files', addFiles);
router.delete('/:id/files/:fileId', removeFile);
router.post('/:id/reindex', reindexCollection);
router.get('/:id/status', getIndexingStatus);

export default router;
