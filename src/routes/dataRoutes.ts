import { Router } from 'express';
import { DataController } from '../controllers/DataController.js';

const router = Router();

router.get('/:projectId/:table/lookup', DataController.lookup);
router.get('/:projectId/:table', DataController.list);
router.post('/:projectId/query', DataController.executeQuery);
router.post('/:projectId/:table', DataController.create);
router.put('/:projectId/:table/:id', DataController.update);
router.delete('/:projectId/:table/:id', DataController.delete);

export default router;
