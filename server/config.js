import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function intEnv(name, fallback) {
  const n = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Session signing secret.
 * Priority: CAMPUSCAST_AUTH_SECRET env var -> persisted random secret in server/.auth-secret.
 * There is intentionally NO hard-coded fallback (the old default was public in the repo).
 */
function loadAuthSecret() {
  const fromEnv = (process.env.CAMPUSCAST_AUTH_SECRET || '').trim();
  if (fromEnv.length >= 16) return fromEnv;
  if (fromEnv) {
    console.warn('⚠️  CAMPUSCAST_AUTH_SECRET is shorter than 16 chars — ignoring it.');
  }
  const file = path.join(__dirname, '.auth-secret');
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch {
    /* generate below */
  }
  const generated = crypto.randomBytes(48).toString('hex');
  try {
    fs.writeFileSync(file, generated, { mode: 0o600 });
    console.log('🔐 Generated a new random session secret (server/.auth-secret).');
  } catch (err) {
    console.warn('⚠️  Could not persist session secret; sessions reset on restart:', err.message);
  }
  return generated;
}

export const config = {
  port: intEnv('PORT', 5000),
  isProd: process.env.NODE_ENV === 'production',
  authSecret: loadAuthSecret(),
  sessionHours: intEnv('CAMPUSCAST_SESSION_HOURS', 12),
  timezone: process.env.CAMPUSCAST_TIMEZONE || 'Asia/Kolkata',
  publicUrl: (process.env.CAMPUSCAST_PUBLIC_URL || '').replace(/\/+$/, ''),
  corsOrigins: (process.env.CAMPUSCAST_CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  requireDeviceKey: process.env.CAMPUSCAST_REQUIRE_DEVICE_KEY === '1',
  heartbeatOfflineSeconds: intEnv('CAMPUSCAST_HEARTBEAT_OFFLINE_SECONDS', 60),
  maxImageMb: intEnv('CAMPUSCAST_MAX_IMAGE_MB', 20),
  maxVideoMb: intEnv('CAMPUSCAST_MAX_VIDEO_MB', 100),
  alertWebhookUrl: (process.env.CAMPUSCAST_ALERT_WEBHOOK_URL || '').trim(),
  bootstrapPassword: process.env.CAMPUSCAST_BOOTSTRAP_PASSWORD || '',
  bootstrapAdminEmail: (process.env.CAMPUSCAST_ADMIN_EMAIL || 'admin@dypiu.ac.in').toLowerCase(),
};
