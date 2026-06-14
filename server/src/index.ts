import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import fs from 'fs';
import path from 'path';
import './config/passport';
import passport from 'passport';
import authRoutes from './routes/auth.routes';
import settingsRoutes from './routes/settings.routes';
import tasksRoutes from './routes/tasks.routes';
import sessionsRoutes from './routes/sessions.routes';
import analyticsRoutes from './routes/analytics.routes';
import pushRoutes from './routes/push.routes';
import { errorHandler, notFound } from './middleware/error.middleware';
import { checkDbHealth, ensureSchema } from './db';

const app = express();

// ─── Security & Parsing ───────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(env.COOKIE_SECRET));
app.use(passport.initialize());

// ─── Logging ──────────────────────────────────────────────────────────────────
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const db = await checkDbHealth();
  const status = db.ok ? 200 : 503;
  res.status(status).json({
    status: db.ok ? 'ok' : 'degraded',
    db: { ok: db.ok, latencyMs: db.latencyMs },
    timestamp: new Date().toISOString(),
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/push', pushRoutes);

// ─── Serve Frontend When Available ────────────────────────────────────────────
const clientDist = path.join(__dirname, '../../client/dist');
const clientIndexPath = path.join(clientDist, 'index.html');

if (!fs.existsSync(clientIndexPath)) {
  console.warn(`⚠️ Frontend build not found at ${clientIndexPath}`);
} else {
  app.use(express.static(clientDist));

  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.sendFile(clientIndexPath);
  });
}

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = parseInt(env.PORT, 10);

const startServer = async (): Promise<void> => {
  await ensureSchema();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT} [${env.NODE_ENV}]`);
  });
};

void startServer().catch((error) => {
  console.error('❌ Failed to initialize server:', error);
  process.exit(1);
});

export default app;
