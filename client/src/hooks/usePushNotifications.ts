import { useState, useEffect, useCallback, useRef } from 'react';
import { pushApi } from '../api/push';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export interface PushNotificationState {
  /** Whether the browser/device supports push notifications at all */
  isSupported: boolean;
  /** Whether the PWA is running in iOS */
  isIOS: boolean;
  /** Whether the PWA is installed and running in standalone (Home Screen) mode */
  isStandalone: boolean;
  /** Current notification permission status */
  permission: NotificationPermission;
  /** Whether the user has an active push subscription */
  isSubscribed: boolean;
  /** Whether a subscribe/unsubscribe operation is in progress */
  isLoading: boolean;
  /** Request permission and subscribe to push notifications */
  subscribe: () => Promise<void>;
  /** Unsubscribe from push notifications */
  unsubscribe: () => Promise<void>;
  /** Error message if last operation failed */
  error: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a base64url VAPID public key to a Uint8Array */
const urlBase64ToUint8Array = (base64String: string): Uint8Array<ArrayBuffer> => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const detectIOS = (): boolean => {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPad on iOS 13+ reports as MacIntel with touch support
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
};

const detectStandalone = (): boolean => {
  // navigator.standalone is an Apple-specific property (true when PWA is on Home Screen)
  if (typeof (navigator as Navigator & { standalone?: boolean }).standalone === 'boolean') {
    return (navigator as Navigator & { standalone?: boolean }).standalone === true;
  }
  // Fallback: check CSS media query
  return window.matchMedia('(display-mode: standalone)').matches;
};

const isPushSupported = (): boolean => {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const usePushNotifications = (): PushNotificationState => {
  const isIOS = detectIOS();
  const isStandalone = detectStandalone();
  const isSupported = isPushSupported();

  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (!isSupported) return 'unsupported';
    return (Notification.permission as NotificationPermission) ?? 'default';
  });
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // ── Register Service Worker & check existing subscription ──────────────────
  useEffect(() => {
    if (!isSupported) return;

    const init = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        swRegistrationRef.current = reg;

        // Check if already subscribed
        const existing = await reg.pushManager.getSubscription();
        setIsSubscribed(!!existing);
        setPermission(Notification.permission as NotificationPermission);
      } catch (err) {
        console.error('SW registration failed:', err);
      }
    };

    void init();
  }, [isSupported]);

  // ── Subscribe ──────────────────────────────────────────────────────────────
  const subscribe = useCallback(async () => {
    setError(null);
    if (!isSupported) {
      setError('Push notifications are not supported on this browser.');
      return;
    }
    if (isIOS && !isStandalone) {
      setError('Please install Zenin to your Home Screen first, then enable notifications.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Request notification permission (must be called from a user gesture)
      const perm = await Notification.requestPermission();
      setPermission(perm as NotificationPermission);

      if (perm !== 'granted') {
        setError(
          perm === 'denied'
            ? 'Notifications blocked. Please enable them in your device Settings → Zenin.'
            : 'Notification permission was not granted.'
        );
        return;
      }

      // 2. Ensure SW is registered
      let reg = swRegistrationRef.current;
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        swRegistrationRef.current = reg;
      }

      // 3. Fetch VAPID public key from server
      const { data: vapidRes } = await pushApi.getVapidKey();
      const applicationServerKey = urlBase64ToUint8Array(vapidRes.data.publicKey);

      // 4. Create push subscription
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true, // Required by iOS and Chrome
        applicationServerKey,
      });

      // 5. Send subscription to backend
      await pushApi.subscribe(subscription.toJSON());
      setIsSubscribed(true);
    } catch (err: unknown) {
      console.error('Push subscribe error:', err);
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Permission denied. Check your device notification settings.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to enable push notifications.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, isIOS, isStandalone]);

  // ── Unsubscribe ────────────────────────────────────────────────────────────
  const unsubscribe = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const reg = swRegistrationRef.current
        ?? (await navigator.serviceWorker.getRegistration('/sw.js'));

      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await pushApi.unsubscribe(sub.endpoint);
          await sub.unsubscribe();
        }
      }
      setIsSubscribed(false);
    } catch (err: unknown) {
      console.error('Push unsubscribe error:', err);
      setError('Failed to disable push notifications.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isSupported,
    isIOS,
    isStandalone,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    error,
  };
};
