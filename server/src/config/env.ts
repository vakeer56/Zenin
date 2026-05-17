import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { z } from 'zod';

dotenv.config();

const defaultDatabaseUrl = `file:${path.join(process.cwd(), 'sqlite.db')}`;
const generatedAccessSecret = process.env.JWT_ACCESS_SECRET || crypto.randomBytes(32).toString('hex');
const generatedRefreshSecret = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(32).toString('hex');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  DATABASE_URL: z.string().default(defaultDatabaseUrl),
  JWT_ACCESS_SECRET: z.string().default(generatedAccessSecret),
  JWT_REFRESH_SECRET: z.string().default(generatedRefreshSecret),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:5000/api/auth/google/callback'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  COOKIE_SECRET: z.string().default('default-cookie-secret'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const defaultedVars: string[] = [];

if (!process.env.DATABASE_URL) defaultedVars.push('DATABASE_URL');
if (!process.env.JWT_ACCESS_SECRET) defaultedVars.push('JWT_ACCESS_SECRET');
if (!process.env.JWT_REFRESH_SECRET) defaultedVars.push('JWT_REFRESH_SECRET');

if (defaultedVars.length > 0) {
  console.warn(`⚠️ Using default values for: ${defaultedVars.join(', ')}`);
}

export const env = parsed.data;
