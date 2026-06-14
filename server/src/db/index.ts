import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const defaultDbUrl = `file:${path.join(process.cwd(), 'sqlite.db')}`;

const normalizeDatabaseUrl = (value?: string): string => {
  const raw = value?.trim();
  if (!raw) return defaultDbUrl;

  const parts = raw
    .split('||')
    .map((part) => part.trim())
    .filter(Boolean);
  const candidate = parts[0];

  if (!candidate) return defaultDbUrl;

  if (parts.length > 1) {
    console.warn('⚠️ DATABASE_URL contained "||". Using the first value only.');
  }

  const tursoHost = candidate
    .replace(/^file:(\/\/)?/i, '')
    .replace(/^https?:\/\//i, '')
    .replace(/^libsql:\/\//i, '');

  if (/\.turso\.io(?:\/.*)?$/i.test(tursoHost)) {
    return `libsql://${tursoHost}`;
  }

  if (/^(file|libsql|https?):/i.test(candidate)) {
    if (candidate.startsWith('https://')) {
      return `libsql://${candidate.slice('https://'.length)}`;
    }

    return candidate;
  }

  if (candidate.endsWith('.db')) {
    const localPath = path.isAbsolute(candidate)
      ? candidate
      : path.join(process.cwd(), candidate);
    return `file:${localPath}`;
  }

  return candidate;
};

const dbUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient({
  url: dbUrl,
  authToken,
});

const schemaStatements = [
  'PRAGMA foreign_keys = ON',
  `CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "password_hash" TEXT,
    "google_id" TEXT UNIQUE,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "settings" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "user_id" TEXT NOT NULL UNIQUE,
    "work_duration" INTEGER NOT NULL DEFAULT 25,
    "short_break" INTEGER NOT NULL DEFAULT 5,
    "long_break" INTEGER NOT NULL DEFAULT 15,
    "sessions_before_long" INTEGER NOT NULL DEFAULT 4,
    "auto_start_breaks" INTEGER NOT NULL DEFAULT 0,
    "auto_start_pomodoros" INTEGER NOT NULL DEFAULT 0,
    "sound_enabled" INTEGER NOT NULL DEFAULT 1,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "tasks" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "estimated_pomodoros" INTEGER NOT NULL DEFAULT 1,
    "completed_pomodoros" INTEGER NOT NULL DEFAULT 0,
    "is_completed" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "pomodoro_sessions" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "user_id" TEXT NOT NULL,
    "task_id" TEXT,
    "type" TEXT NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "started_at" INTEGER NOT NULL,
    "ended_at" INTEGER,
    "completed" INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
    FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "refresh_tokens" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" INTEGER NOT NULL,
    "created_at" INTEGER NOT NULL,
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
  )`,
  'CREATE INDEX IF NOT EXISTS "tasks_user_id_idx" ON "tasks" ("user_id")',
  'CREATE INDEX IF NOT EXISTS "pomodoro_sessions_user_id_idx" ON "pomodoro_sessions" ("user_id")',
  'CREATE INDEX IF NOT EXISTS "pomodoro_sessions_task_id_idx" ON "pomodoro_sessions" ("task_id")',
  'CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx" ON "refresh_tokens" ("user_id")',
  'CREATE INDEX IF NOT EXISTS "refresh_tokens_token_hash_idx" ON "refresh_tokens" ("token_hash")',
  `CREATE TABLE IF NOT EXISTS "push_subscriptions" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL UNIQUE,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
  )`,
  'CREATE INDEX IF NOT EXISTS "push_subscriptions_user_id_idx" ON "push_subscriptions" ("user_id")',
];

let schemaReady: Promise<void> | null = null;

export const ensureSchema = async (): Promise<void> => {
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const statement of schemaStatements) {
        await client.execute(statement);
      }
    })();
  }

  return schemaReady;
};

// ── Health probe ────────────────────────────────────────────────────────────
export const checkDbHealth = async (): Promise<{ ok: boolean; latencyMs: number }> => {
  const t0 = Date.now();
  try {
    // Simple query to verify connection
    await client.execute('SELECT 1');
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - t0 };
  }
};

export const db = drizzle(client, { schema });
