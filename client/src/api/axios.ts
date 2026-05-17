import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { useTimerStore } from '../store/timerStore';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000, // 15 s — catches slow network / DB unavailable
});

// ── Attach access token ────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: refresh on 401, 503 toast ───────────────────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
};

/**
 * Gracefully stop the timer and clear auth before redirecting to /auth.
 * Prevents the interval from ticking on an unmounted component.
 */
const gracefulLogout = () => {
  // Stop the timer so the setInterval callback stops writing state
  useTimerStore.getState().setIsRunning(false);
  useTimerStore.getState().clearRunStart();
  useTimerStore.getState().setCurrentSessionId(null);
  // Clear auth state
  useAuthStore.getState().logout();
  // Hard navigate so React state is fully torn down
  window.location.href = '/auth?reason=session_expired';
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // ── 503 / network timeout ────────────────────────────────────────────
    if (!error.response || error.response.status === 503) {
      // DB or server unavailable — surface to user but don't logout
      const { toast } = await import('react-hot-toast');
      toast.error('Server unavailable — retrying…', { id: 'server-down', duration: 4000 });
      return Promise.reject(error);
    }

    // ── 401 refresh flow ─────────────────────────────────────────────────
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { userId } = useAuthStore.getState();
        if (!userId) {
          // No userId — can't refresh; force logout cleanly
          gracefulLogout();
          return Promise.reject(error);
        }

        const res = await axios.post(
          '/api/auth/refresh',
          { userId },
          { withCredentials: true, timeout: 10_000 }
        );
        const { accessToken } = res.data.data;
        useAuthStore.getState().setAccessToken(accessToken);
        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        // Refresh failed — session truly expired; stop timer & redirect
        gracefulLogout();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
