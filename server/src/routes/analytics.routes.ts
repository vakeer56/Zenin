import { Router } from 'express';
import { getSummary, getDaily } from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/summary', getSummary);
router.get('/daily', getDaily);

export default router;
