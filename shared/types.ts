// Shared types between client and server

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Settings {
  id: string;
  userId: string;
  workDuration: number;      // minutes
  shortBreak: number;        // minutes
  longBreak: number;         // minutes
  sessionsBeforeLong: number;
  autoStartBreaks: boolean;
  autoStartPomodoros: boolean;
  soundEnabled: boolean;
  theme: 'dark' | 'light';
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  estimatedPomodoros: number;
  completedPomodoros: number;
  isCompleted: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export type SessionType = 'work' | 'short_break' | 'long_break';

export interface PomodoroSession {
  id: string;
  userId: string;
  taskId?: string;
  type: SessionType;
  durationSeconds: number;
  startedAt: string;
  endedAt?: string;
  completed: boolean;
}

export interface AnalyticsSummary {
  totalPomodoros: number;
  totalFocusMinutes: number;
  todayPomodoros: number;
  todayFocusMinutes: number;
  currentStreak: number;
  longestStreak: number;
}

export interface DailyAnalytics {
  date: string;
  pomodoros: number;
  focusMinutes: number;
}

// API Response wrappers
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  details?: unknown;
}

// Auth
export interface AuthTokens {
  accessToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
}
