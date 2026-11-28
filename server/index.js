import { config } from './config.js';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import screensRouter from './routes/screens.js';
import mediaRouter from './routes/media.js';
import playlistsRouter from './routes/playlists.js';
import campaignsRouter from './routes/campaigns.js';
import groupsRouter from './routes/groups.js';
import publishingRouter from './routes/publishing.js';
import usersRouter from './routes/users.js';
import authRouter from './routes/auth.js';
import settingsRouter from './routes/settings.js';
import deviceRouter from './routes/device.js';
import adminRouter from './routes/admin.js';
import { pool, checkDb } from './db.js';
import { runMigrations } from './migrations/index.js';
import { bootstrapUsers } from './services/bootstrap.js';
import { startBackgroundJobs } from './services/monitor.js';
import { auditMutations } from './services/audit.js';
import { authRequired } from './middleware/auth.js';
import { errorHandler } from './utils/http.js';
import { lanIp } from './utils/network.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');
const publicDir = path.join(__dirname, '..', 'public');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback, linklocal, uniquelocal');

// ── Security headers ─────────────────────────────────────────────
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  next();
});

// ── CORS: same-host (any port) + explicit allow-list. No more "*" ──
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // native apps, curl, same-origin
      if (config.corsOrigins.includes(origin)) return cb(null, true);
      try {
        // The CMS (port 3000) and the API (port 5000) run on the same machine/host name.
        const u = new URL(origin);
        if (config.corsOrigins.length === 0 || config.corsOrigins.includes('*')) return cb(null, true);
        return cb(null, config.corsOrigins.some((o) => new URL(o).hostname === u.hostname));
      } catch {
        return cb(null, false);
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Key', 'X-Screen-Id', 'If-None-Match'],
    exposedHeaders: ['ETag'],
  })
);

app.use(express.json({ limit: '1mb' }));

// ── Static media ─────────────────────────────────────────────────
// Uploads: cached for TVs, but forced to download/sandbox so an uploaded file can never run script in the CMS origin.
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    maxAge: '30d',
    etag: true,
    lastModified: true,
    setHeaders(res) {
      res.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; sandbox");
      res.set('X-Content-Type-Options', 'nosniff');
    },
  })
);
app.use('/src/assets', express.static(path.join(__dirname, '..', 'src', 'assets'), { maxAge: '30d' }));

// APK / IPK / logos (the TV app + webOS reachability probe use these)
app.get('/CampusCast-TV.apk', (req, res) => res.redirect(301, '/NEXORA-TV.apk')); // legacy link
app.get('/NEXORA-TV.apk', (req, res) => {
  const file = path.join(publicDir, 'NEXORA-TV.apk');
  if (!fs.existsSync(file)) return res.status(404).json({ success: false, error: 'APK not found on server.' });
  res.download(file, 'NEXORA-TV.apk');
});
app.use(express.static(publicDir, { index: false }));

app.get('/api/health', async (req, res) => {
  let db = 'ok';
  try {
    await pool.query('SELECT 1');
  } catch {
    db = 'down';
  }
  res.status(db === 'ok' ? 200 : 503).json({
    status: db === 'ok' ? 'healthy' : 'degraded',
    database: db,
    system: 'NEXORA / CampusCast Digital Signage API',
    timestamp: new Date().toISOString(),
  });
});

// ── API ──────────────────────────────────────────────────────────
// Public: login + TV-facing device endpoints (authenticated by device key when enabled).
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/device', deviceRouter);
// Settings does its own mixed (admin OR device) auth for the ticker toggle.
app.use('/api/v1/settings', auditMutations, settingsRouter);
// Everything below requires a signed-in user; each router enforces its own RBAC for writes.
const guarded = [authRequired, auditMutations];
app.use('/api/v1/screens', ...guarded, screensRouter);
app.use('/api/v1/media', ...guarded, mediaRouter);
app.use('/api/v1/playlists', ...guarded, playlistsRouter);
app.use('/api/v1/campaigns', ...guarded, campaignsRouter);
app.use('/api/v1/groups', ...guarded, groupsRouter);
app.use('/api/v1/publishing', ...guarded, publishingRouter);
app.use('/api/v1/users', ...guarded, usersRouter);
app.use('/api/v1', authRequired, adminRouter);
app.use('/api', (req, res) => res.status(404).json({ success: false, error: 'Unknown API endpoint.' }));

// ── Built CMS (production: one port serves UI + API) ─────────────
if (fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.use(errorHandler);

async function start() {
  try {
    await checkDb();
    await runMigrations();
    await bootstrapUsers();
  } catch (err) {
    console.error('❌ Startup failed:', err.message);
    console.error('   Check that MySQL/MariaDB is running and DB_* settings in .env are correct.');
    process.exit(1);
  }

  const stopJobs = startBackgroundJobs();
  const server = app.listen(config.port, '0.0.0.0', () => {
    const ip = lanIp();
    console.log(`🚀 API running:        http://localhost:${config.port}  (LAN: http://${ip}:${config.port})`);
    console.log(`📺 TV manifest:        http://${ip}:${config.port}/api/v1/device/<screenId>/manifest`);
    console.log(`🔒 Device keys:        ${config.requireDeviceKey ? 'REQUIRED' : 'optional (set CAMPUSCAST_REQUIRE_DEVICE_KEY=1 to enforce)'}`);
    if (fs.existsSync(path.join(distDir, 'index.html'))) console.log(`🖥️  CMS + TV player:    http://${ip}:${config.port}`);
  });

  const shutdown = (sig) => {
    console.log(`\n${sig} received — shutting down…`);
    stopJobs();
    server.close(async () => {
      await pool.end().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));
start();
