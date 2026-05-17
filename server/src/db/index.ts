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

  if (/^(file|libsql|https?):/i.test(candidate)) {
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
