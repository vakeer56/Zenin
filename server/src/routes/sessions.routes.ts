import { Router } from 'express';
import { startSession, endSession, getSessions, addManualSession, deleteSession } from '../controllers/sessions.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getSessions);
router.post('/', startSession);
router.post('/manual', addManualSession);
router.patch('/:id/end', endSession);
router.delete('/:id', deleteSession);

export default router;
