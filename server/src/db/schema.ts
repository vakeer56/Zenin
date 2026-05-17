import {
  sqliteTable,
  text,
  integer,
} from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import crypto from 'crypto';

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash'),
  googleId: text('google_id').unique(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ─── Settings ─────────────────────────────────────────────────────────────────
export const settings = sqliteTable('settings', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .unique()
    .notNull(),
  workDuration: integer('work_duration').default(25).notNull(),
  shortBreak: integer('short_break').default(5).notNull(),
  longBreak: integer('long_break').default(15).notNull(),
  sessionsBeforeLong: integer('sessions_before_long').default(4).notNull(),
  autoStartBreaks: integer('auto_start_breaks', { mode: 'boolean' }).default(false).notNull(),
  autoStartPomodoros: integer('auto_start_pomodoros', { mode: 'boolean' }).default(false).notNull(),
  soundEnabled: integer('sound_enabled', { mode: 'boolean' }).default(true).notNull(),
  theme: text('theme', { enum: ['dark', 'light'] }).default('dark').notNull(),
});

// ─── Tasks ────────────────────────────────────────────────────────────────────
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  description: text('description'),
  estimatedPomodoros: integer('estimated_pomodoros').default(1).notNull(),
  completedPomodoros: integer('completed_pomodoros').default(0).notNull(),
  isCompleted: integer('is_completed', { mode: 'boolean' }).default(false).notNull(),
  order: integer('order').default(0).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ─── Pomodoro Sessions ────────────────────────────────────────────────────────
export const pomodoroSessions = sqliteTable('pomodoro_sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  type: text('type', { enum: ['work', 'short_break', 'long_break'] }).notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  completed: integer('completed', { mode: 'boolean' }).default(false).notNull(),
});

// ─── Refresh Tokens ───────────────────────────────────────────────────────────
export const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ one, many }) => ({
  settings: one(settings),
  tasks: many(tasks),
  sessions: many(pomodoroSessions),
  refreshTokens: many(refreshTokens),
}));

export const settingsRelations = relations(settings, ({ one }) => ({
  user: one(users, { fields: [settings.userId], references: [users.id] }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  user: one(users, { fields: [tasks.userId], references: [users.id] }),
  sessions: many(pomodoroSessions),
}));

export const pomodoroSessionsRelations = relations(pomodoroSessions, ({ one }) => ({
  user: one(users, { fields: [pomodoroSessions.userId], references: [users.id] }),
  task: one(tasks, { fields: [pomodoroSessions.taskId], references: [tasks.id] }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));
