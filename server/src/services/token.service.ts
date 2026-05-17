import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { db } from '../db';
import { refreshTokens } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';

export interface JwtPayload {
  userId: string;
  email: string;
}

export const generateAccessToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
  });
};

export const generateRefreshToken = (): string => {
  return crypto.randomBytes(64).toString('hex');
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
};

export const storeRefreshToken = async (
  userId: string,
  token: string
): Promise<void> => {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(refreshTokens).values({ userId, tokenHash, expiresAt });
};

export const validateRefreshToken = async (
  userId: string,
  token: string
): Promise<boolean> => {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const now = new Date();

  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.tokenHash, tokenHash),
        gt(refreshTokens.expiresAt, now)
      )
    )
    .limit(1);

  return !!stored;
};

export const revokeRefreshToken = async (
  userId: string,
  token: string
): Promise<void> => {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await db
    .delete(refreshTokens)
    .where(
      and(
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.tokenHash, tokenHash)
      )
    );
};
