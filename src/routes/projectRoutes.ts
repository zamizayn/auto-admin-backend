import { Router } from 'express';
import { ProjectController } from '../controllers/ProjectController.js';

const router = Router();

router.post('/', ProjectController.create);
router.get('/', ProjectController.list);
router.get('/:id', ProjectController.getById);
router.post('/:id/tables', ProjectController.createTable);
router.delete('/:id/tables/:tableName', ProjectController.dropTable);
router.patch('/:id/tables/:tableName', ProjectController.alterTable);
router.post('/:id/scan', ProjectController.scan);
router.get('/:id/schema', ProjectController.getSchema);
router.delete('/:id', ProjectController.delete);

export default router;

