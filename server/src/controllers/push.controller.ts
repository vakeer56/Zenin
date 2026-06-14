import { Request, Response } from 'express';
import { db } from '../db';
import { pushSubscriptions } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { AuthRequest } from '../middleware/auth.middleware';
import { env } from '../config/env';
import { sendPushToUser, isVapidConfigured } from '../services/push.service';

// ─── GET /api/push/vapid-public-key ──────────────────────────────────────────
// Public endpoint — returns the VAPID public key so the client can subscribe.

export const getVapidPublicKey = (_req: Request, res: Response): void => {
  if (!env.VAPID_PUBLIC_KEY) {
    res.status(503).json({ success: false, error: 'Push notifications not configured on this server.' });
    return;
  }
  res.json({ success: true, data: { publicKey: env.VAPID_PUBLIC_KEY } });
};

// ─── POST /api/push/subscribe ─────────────────────────────────────────────────
// Authenticated — registers (or updates) a push subscription for the current user.

export const subscribe = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { endpoint, keys } = req.body as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ success: false, error: 'Invalid push subscription object.' });
    return;
  }

  const userAgent = req.headers['user-agent'] ?? null;
  const now = new Date();

  // Upsert: if same endpoint exists update it, otherwise insert
  const existing = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(pushSubscriptions)
      .set({ p256dh: keys.p256dh, auth: keys.auth, userAgent, updatedAt: now })
      .where(eq(pushSubscriptions.id, existing[0].id));
  } else {
    await db.insert(pushSubscriptions).values({
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent,
    });
  }

  res.status(201).json({ success: true, data: { subscribed: true } });
};

// ─── DELETE /api/push/subscribe ───────────────────────────────────────────────
// Authenticated — removes a specific push subscription.

export const unsubscribe = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { endpoint } = req.body as { endpoint?: string };

  if (!endpoint) {
    res.status(400).json({ success: false, error: 'endpoint is required.' });
    return;
  }

  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint)
      )
    );

  res.json({ success: true, data: { unsubscribed: true } });
};

// ─── POST /api/push/test ──────────────────────────────────────────────────────
// Authenticated, development-only — sends a test push to the current user.

export const testNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!isVapidConfigured()) {
    res.status(503).json({ success: false, error: 'Push notifications not configured.' });
    return;
  }

  const userId = req.userId!;

  await sendPushToUser(userId, {
    title: '🍅 Zenin Test',
    body: 'Push notifications are working!',
    url: '/timer',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'test',
  });

  res.json({ success: true, data: { sent: true } });
};
