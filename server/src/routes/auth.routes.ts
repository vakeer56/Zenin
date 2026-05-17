import { Router } from 'express';
import passport from 'passport';
import rateLimit from 'express-rate-limit';
import {
  register,
  login,
  logout,
  refresh,
  googleCallback,
  getMe,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { success: false, error: 'Too many requests, please try again later' },
});

// Email/Password
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', authenticate, logout);
router.post('/refresh', authLimiter, refresh);

// Current user
router.get('/me', authenticate, getMe);

// Google OAuth
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/api/auth/google/failure' }),
  googleCallback
);
router.get('/google/failure', (_req, res) => {
  res.redirect(`${process.env.CLIENT_URL}/auth?error=google_failed`);
});

export default router;
