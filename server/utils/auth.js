import crypto from 'crypto';
import { promisify } from 'util';
import { config } from '../config.js';

const scrypt = promisify(crypto.scrypt);

export const ROLES = ['Super Administrator', 'IT Administrator', 'Content Manager', 'Monitoring User'];

export const ALL_MENUS = [
  'dashboard',
  'media',
  'playlists',
  'campaigns',
  'screens',
  'groups',
  'publishing',
  'monitoring',
  'reports',
  'users',
  'settings',
];

export const DEFAULT_MENUS_BY_ROLE = {
  'Super Administrator': ALL_MENUS,
  'IT Administrator': ['dashboard', 'screens', 'groups', 'publishing', 'monitoring', 'reports', 'settings'],
  'Content Manager': ['dashboard', 'media', 'playlists', 'campaigns', 'publishing'],
  'Monitoring User': ['dashboard', 'monitoring', 'reports'],
};

export const MIN_PASSWORD_LENGTH = 8;

export function parseAllowedMenus(rawMenus, role) {
  let menus = null;
  if (Array.isArray(rawMenus) && rawMenus.length > 0) {
    menus = rawMenus;
  } else if (typeof rawMenus === 'string' && rawMenus.trim()) {
    try {
      const parsed = JSON.parse(rawMenus);
      if (Array.isArray(parsed) && parsed.length > 0) menus = parsed;
    } catch {
      /* fall back to role defaults */
    }
  }
  if (menus) {
    // Only keep known menu keys so a crafted value can never grant unknown access.
    const clean = menus.filter((m) => ALL_MENUS.includes(m));
    if (clean.length > 0) return clean;
  }
  return DEFAULT_MENUS_BY_ROLE[role] || ['dashboard'];
}

/** Hash format: scrypt:<salt-hex>:<derived-hex> (async, does not block the event loop). */
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(String(password), salt, 64);
  return `scrypt:${salt}:${derived.toString('hex')}`;
}

export function isScryptHash(h) {
  return typeof h === 'string' && /^scrypt:[0-9a-f]+:[0-9a-f]+$/.test(h);
}

// Pre-computed hash used to keep response time similar for unknown e-mail addresses.
const DUMMY_HASH = `scrypt:${'00'.repeat(16)}:${'00'.repeat(64)}`;

export async function verifyPassword(password, storedHash) {
  const hash = isScryptHash(storedHash) ? storedHash : DUMMY_HASH;
  const [, salt, originalHex] = hash.split(':');
  const derived = await scrypt(String(password || ''), salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  const ok = derived.length === original.length && crypto.timingSafeEqual(derived, original);
  return ok && hash !== DUMMY_HASH;
}

export function signSessionToken(payload, ttlHours = config.sessionHours) {
  const now = Date.now();
  const body = { ...payload, iat: now, exp: now + ttlHours * 3600 * 1000 };
  const data = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = crypto.createHmac('sha256', config.authSecret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

/** Returns the payload for a valid, unexpired token; otherwise null. */
export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = crypto.createHmac('sha256', config.authSecret).update(data).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Deterministic per-screen device key (HMAC of the id) — no extra storage needed. */
export function deviceKeyFor(screenId) {
  return crypto
    .createHmac('sha256', config.authSecret)
    .update(`device:${screenId}`)
    .digest('base64url')
    .slice(0, 24);
}

export function verifyDeviceKey(screenId, key) {
  if (!key || typeof key !== 'string') return false;
  const a = Buffer.from(deviceKeyFor(screenId));
  const b = Buffer.from(key);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function formatLoginTimestamp() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t)?.value || '00';
  const hour = g('hour') === '24' ? '00' : g('hour');
  return `${g('year')}-${g('month')}-${g('day')} ${hour}:${g('minute')}`;
}
