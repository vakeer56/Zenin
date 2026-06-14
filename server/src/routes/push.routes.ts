import { Router } from 'express';
import {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
  testNotification,
} from '../controllers/push.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Public — client needs the key before subscribing
router.get('/vapid-public-key', getVapidPublicKey);

// Authenticated — manage subscriptions
router.post('/subscribe', authenticate, subscribe);
router.delete('/subscribe', authenticate, unsubscribe);

// Dev/admin — trigger test push
router.post('/test', authenticate, testNotification);

export default router;
