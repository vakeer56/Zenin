import { Router } from 'express';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  reorderTasks,
} from '../controllers/tasks.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getTasks);
router.post('/', createTask);
router.patch('/reorder', reorderTasks);
router.patch('/:id', updateTask);
router.patch('/:id/complete', completeTask);
router.delete('/:id', deleteTask);

export default router;
