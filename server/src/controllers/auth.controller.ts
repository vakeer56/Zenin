import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import passport from 'passport';
import { db } from '../db';
import { users, settings } from '../db/schema';
import { eq } from 'drizzle-orm';
import {
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
} from '../services/token.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { env } from '../config/env';
import { z } from 'zod';

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const COOKIE_OPTIONS = {
  httpOnly: true,
  // `none` is required for iOS PWA: Safari treats the home-screen app as a
  // separate browsing context, so `lax` cookies are not sent on cross-context
  // requests. `none` + `secure` ensures the refresh cookie always travels.
  secure: true, // must be true when sameSite is 'none'
  sameSite: 'none' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/auth',
};

const issueTokens = async (userId: string, email: string, res: Response) => {
  const accessToken = generateAccessToken({ userId, email });
  const refreshToken = generateRefreshToken();
  await storeRefreshToken(userId, refreshToken);
  res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
  return { accessToken };
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, password } = registerSchema.parse(req.body);

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existing) {
      res.status(409).json({ success: false, error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db
      .insert(users)
      .values({ name, email: email.toLowerCase(), passwordHash })
      .returning();

    await db.insert(settings).values({ userId: user.id });

    const { accessToken } = await issueTokens(user.id, user.email, res);

    res.status(201).json({
      success: true,
      data: {
        accessToken,
        user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const login = (req: Request, res: Response, next: NextFunction): void => {
  loginSchema.parse(req.body); // validate early

  passport.authenticate(
    'local',
    { session: false },
    async (err: Error, user: typeof users.$inferSelect) => {
      if (err) return next(err);
      if (!user) {
        res.status(401).json({ success: false, error: 'Invalid credentials' });
        return;
      }

      try {
        const { accessToken } = await issueTokens(user.id, user.email, res);
        res.json({
          success: true,
          data: {
            accessToken,
            user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
          },
        });
      } catch (e) {
        next(e);
      }
    }
  )(req, res, next);
};

export const logout = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies?.refreshToken;
    if (token && req.userId) {
      await revokeRefreshToken(req.userId, token);
    }
    res.clearCookie('refreshToken', { path: '/api/auth', secure: true, sameSite: 'none' });
    res.json({ success: true, data: null, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      res.status(401).json({ success: false, error: 'No refresh token' });
      return;
    }

    // We need user info to validate - get userId from body or decode without verify
    const { userId } = req.body as { userId: string };
    if (!userId) {
      res.status(401).json({ success: false, error: 'Missing userId' });
      return;
    }

    const isValid = await validateRefreshToken(userId, token);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Invalid refresh token' });
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }

    // Rotate refresh token
    await revokeRefreshToken(userId, token);
    const { accessToken } = await issueTokens(user.id, user.email, res);

    res.json({ success: true, data: { accessToken } });
  } catch (err) {
    next(err);
  }
};

export const googleCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as typeof users.$inferSelect;
    if (!user) {
      res.redirect(`${env.CLIENT_URL}/auth?error=oauth_failed`);
      return;
    }

    const accessToken = generateAccessToken({ userId: user.id, email: user.email });
    const refreshToken = generateRefreshToken();
    await storeRefreshToken(user.id, refreshToken);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    // Redirect to client with token in query (client reads it once then discards)
    res.redirect(`${env.CLIENT_URL}/auth/callback?token=${accessToken}&userId=${user.id}`);
  } catch (err) {
    next(err);
  }
};

export const getMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, req.userId!))
      .limit(1);

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};
