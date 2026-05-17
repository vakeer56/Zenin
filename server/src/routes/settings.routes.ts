import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settings.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getSettings);
router.patch('/', updateSettings);

export default router;
