import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import axios from 'axios';

/**
 * ProtectedRoute with silent token refresh.
 *
 * iOS PWA runs in a separate browser context from Safari, so the refreshToken
 * cookie is NOT shared when the user first opens the home screen icon. However,
 * after the first successful refresh inside the PWA context the cookie is set
 * there too, so subsequent opens work fine.
 *
 * Flow:
 *  1. If we have an accessToken in memory → authenticated, render immediately.
 *  2. If we have a persisted userId but no accessToken → try a silent refresh
 *     before deciding to redirect (covers the iOS PWA cold-start case).
 *  3. If neither → redirect to /auth.
 */
export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, accessToken, userId, setAccessToken, logout } = useAuthStore();

  // We only need to attempt a refresh when we have identity (userId/isAuthenticated)
  // but no in-memory access token (cold start / PWA launch).
  const needsRefresh = (isAuthenticated || !!userId) && !accessToken;

  const [checking, setChecking] = useState(needsRefresh);
  const [refreshFailed, setRefreshFailed] = useState(false);

  useEffect(() => {
    if (!needsRefresh) return;

    let cancelled = false;

    const tryRefresh = async () => {
      try {
        const res = await axios.post(
          '/api/auth/refresh',
          { userId },
          { withCredentials: true, timeout: 10_000 }
        );
        if (!cancelled) {
          setAccessToken(res.data.data.accessToken);
        }
      } catch {
        if (!cancelled) {
          // Refresh truly failed (cookie gone / server error) — clear stale state
          logout();
          setRefreshFailed(true);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    void tryRefresh();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checking) {
    // Show a minimal splash while we silently refresh — avoids flash to /auth
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
          background: 'var(--bg-primary, #0d0d14)',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            border: '3px solid rgba(255,255,255,0.1)',
            borderTopColor: 'var(--accent, #7c6af7)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (refreshFailed || (!isAuthenticated && !accessToken)) {
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
};
