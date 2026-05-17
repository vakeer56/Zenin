import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../../../shared/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      userId: null,
      isAuthenticated: false,
      setAuth: (user, accessToken) =>
        set({ user, accessToken, userId: user.id, isAuthenticated: true }),
      setAccessToken: (accessToken) => set({ accessToken }),
      logout: () =>
        set({ user: null, accessToken: null, userId: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        userId: state.userId,
        isAuthenticated: state.isAuthenticated,
        // Don't persist accessToken (short-lived, use refresh cookie)
      }),
    }
  )
);
