import webpush from 'web-push';
import { db } from '../db';
import { pushSubscriptions } from '../db/schema';
import { eq } from 'drizzle-orm';
import { env } from '../config/env';

// ─── VAPID Initialization ─────────────────────────────────────────────────────

let vapidInitialized = false;

const initVapid = (): void => {
  if (vapidInitialized) return;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    console.warn('⚠️  VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — push notifications disabled.');
    return;
  }
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  vapidInitialized = true;
};

initVapid();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  /** Deep-link URL opened when the user taps the notification */
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
}

// ─── Core sender ──────────────────────────────────────────────────────────────

/**
 * Send a push notification to a single subscription.
 * Returns false if the subscription is stale (410/404) and should be deleted.
 */
export const sendPushNotification = async (
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<boolean> => {
  if (!vapidInitialized) return false;

  const pushSubscription: webpush.PushSubscription = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  };

  try {
    await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
    return true;
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 410 || status === 404) {
      // Subscription expired — clean up
      return false;
    }
    console.error('Push send error:', err);
    return true; // keep subscription for transient errors
  }
};

// ─── User-scoped sender ───────────────────────────────────────────────────────

/**
 * Send a push notification to ALL subscriptions belonging to a user.
 * Stale subscriptions (gone/not found) are automatically removed from the DB.
 */
export const sendPushToUser = async (userId: string, payload: PushPayload): Promise<void> => {
  if (!vapidInitialized) return;

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subs.length === 0) return;

  await Promise.allSettled(
    subs.map(async (sub) => {
      const ok = await sendPushNotification(sub, payload);
      if (!ok) {
        // Remove stale subscription
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        console.log(`🗑️  Removed stale push subscription for user ${userId}`);
      }
    })
  );
};

export const isVapidConfigured = (): boolean => vapidInitialized;
