import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// Create SQLite database
const dbPath = process.env.DATABASE_URL || path.join(process.cwd(), 'sqlite.db');
const sqlite = new Database(dbPath);

// Enable WAL mode for better concurrency
sqlite.pragma('journal_mode = WAL');

// ── Health probe ────────────────────────────────────────────────────────────
export const checkDbHealth = async (): Promise<{ ok: boolean; latencyMs: number }> => {
  const t0 = Date.now();
  try {
    // Simple query to verify connection
    sqlite.prepare('SELECT 1').get();
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - t0 };
  }
};

export const db = drizzle(sqlite, { schema });
