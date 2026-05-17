import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// Create SQLite database
const dbUrl = process.env.DATABASE_URL || `file:${path.join(process.cwd(), 'sqlite.db')}`;
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
