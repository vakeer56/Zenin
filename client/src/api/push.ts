import api from './axios';

// ─── Push Notifications ───────────────────────────────────────────────────────

export const pushApi = {
  /**
   * Fetch the server's VAPID public key (needed to subscribe).
   */
  getVapidKey: () =>
    api.get<{ success: true; data: { publicKey: string } }>('/push/vapid-public-key'),

  /**
   * Register a PushSubscription with the backend.
   */
  subscribe: (subscription: PushSubscriptionJSON) =>
    api.post<{ success: true; data: { subscribed: boolean } }>('/push/subscribe', subscription),

  /**
   * Remove a PushSubscription from the backend.
   */
  unsubscribe: (endpoint: string) =>
    api.delete<{ success: true; data: { unsubscribed: boolean } }>('/push/subscribe', {
      data: { endpoint },
    }),

  /**
   * Trigger a test push notification (dev/debugging).
   */
  test: () =>
    api.post<{ success: true; data: { sent: boolean } }>('/push/test'),
};
