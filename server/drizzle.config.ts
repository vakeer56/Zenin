import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config();

const defaultDbUrl = 'file:sqlite.db';

const normalizeDatabaseUrl = (value?: string): string => {
  const raw = value?.trim();
  if (!raw) return defaultDbUrl;

  const parts = raw
    .split('||')
    .map((part) => part.trim())
    .filter(Boolean);
  const candidate = parts[0];

  if (!candidate) return defaultDbUrl;

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
    return `file:${path.isAbsolute(candidate) ? candidate : path.join(process.cwd(), candidate)}`;
  }

  return candidate;
};

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url: normalizeDatabaseUrl(process.env.DATABASE_URL),
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
  verbose: true,
  strict: false,
});
