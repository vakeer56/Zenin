import { Router } from 'express';
import { startSession, endSession, getSessions } from '../controllers/sessions.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getSessions);
router.post('/', startSession);
router.patch('/:id/end', endSession);

export default router;
