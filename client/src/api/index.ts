import api from './axios';
import type { User, Settings, Task, PomodoroSession, AnalyticsSummary, DailyAnalytics, LoginCredentials, RegisterCredentials, AuthTokens } from '../../../shared/types';

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: RegisterCredentials) =>
    api.post<{ success: true; data: { accessToken: string; user: User } }>('/auth/register', data),
  login: (data: LoginCredentials) =>
    api.post<{ success: true; data: { accessToken: string; user: User } }>('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get<{ success: true; data: User }>('/auth/me'),
  refresh: (userId: string) =>
    api.post<{ success: true; data: AuthTokens }>('/auth/refresh', { userId }),
};

// ─── Settings ─────────────────────────────────────────────────────────────────
export const settingsApi = {
  get: () => api.get<{ success: true; data: Settings }>('/settings'),
  update: (data: Partial<Settings>) =>
    api.patch<{ success: true; data: Settings }>('/settings', data),
};

// ─── Tasks ────────────────────────────────────────────────────────────────────
export const tasksApi = {
  list: () => api.get<{ success: true; data: Task[] }>('/tasks'),
  create: (data: { title: string; description?: string; estimatedPomodoros?: number }) =>
    api.post<{ success: true; data: Task }>('/tasks', data),
  update: (id: string, data: Partial<Task>) =>
    api.patch<{ success: true; data: Task }>(`/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
  complete: (id: string) => api.patch(`/tasks/${id}/complete`),
  reorder: (orderedIds: string[]) => api.patch('/tasks/reorder', { orderedIds }),
};

// ─── Sessions ─────────────────────────────────────────────────────────────────
export const sessionsApi = {
  list: (page = 1) => api.get<{ success: true; data: PomodoroSession[] }>(`/sessions?page=${page}`),
  start: (data: { taskId?: string; type: PomodoroSession['type']; durationSeconds: number }) =>
    api.post<{ success: true; data: PomodoroSession }>('/sessions', data),
  manual: (data: { durationMinutes: number; taskId?: string }) =>
    api.post<{ success: true; data: PomodoroSession }>('/sessions/manual', data),
  end: (id: string, completed = true) =>
    api.patch<{ success: true; data: PomodoroSession }>(`/sessions/${id}/end`, { completed }),
  delete: (id: string) => api.delete<{ success: true }>(`/sessions/${id}`),
};

// ─── Analytics ────────────────────────────────────────────────────────────────
export const analyticsApi = {
  summary: () => api.get<{ success: true; data: AnalyticsSummary }>(`/analytics/summary?utcOffset=${new Date().getTimezoneOffset()}`),
  daily: (days = 7) =>
    api.get<{ success: true; data: DailyAnalytics[] }>(`/analytics/daily?days=${days}&utcOffset=${new Date().getTimezoneOffset()}`),
};
