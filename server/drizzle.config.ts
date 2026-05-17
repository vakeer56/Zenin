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

  if (/^(file|libsql|https?):/i.test(candidate)) {
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
  dialect: 'sqlite',
  dbCredentials: {
    url: normalizeDatabaseUrl(process.env.DATABASE_URL),
    token: process.env.DATABASE_AUTH_TOKEN,
  },
  verbose: true,
  strict: false,
});
