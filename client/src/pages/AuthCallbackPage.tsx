import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api';

// This page handles the Google OAuth redirect
export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setAuth, setAccessToken } = useAuthStore();

  useEffect(() => {
    const token = params.get('token');
    const userId = params.get('userId');

    if (!token || !userId) {
      navigate('/auth?error=callback_failed');
      return;
    }

    setAccessToken(token);

    authApi
      .getMe()
      .then((res) => {
        setAuth(res.data.data, token);
        navigate('/timer', { replace: true });
      })
      .catch(() => {
        navigate('/auth?error=callback_failed', { replace: true });
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-900">
      <div className="flex flex-col items-center gap-4 text-white/60">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <p>Signing you in…</p>
      </div>
    </div>
  );
};
