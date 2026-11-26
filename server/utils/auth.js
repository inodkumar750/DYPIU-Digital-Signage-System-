import crypto from 'crypto';

const AUTH_SECRET = process.env.CAMPUSCAST_AUTH_SECRET || 'dypiu-campuscast-local-session-secret-2026';

export const DEFAULT_MENUS_BY_ROLE = {
  'Super Administrator': [
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
  ],
  'IT Administrator': [
    'dashboard',
    'screens',
    'groups',
    'publishing',
    'monitoring',
    'reports',
    'settings',
  ],
  'Content Manager': ['dashboard', 'media', 'playlists', 'campaigns', 'publishing'],
  'Monitoring User': ['dashboard', 'monitoring', 'reports'],
};

export function parseAllowedMenus(rawMenus, role) {
  if (Array.isArray(rawMenus) && rawMenus.length > 0) {
    return rawMenus;
  }
  if (typeof rawMenus === 'string' && rawMenus.trim()) {
    try {
      const parsed = JSON.parse(rawMenus);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // fallback to role defaults
    }
  }
  return DEFAULT_MENUS_BY_ROLE[role] || ['dashboard'];
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !password) return false;
  if (storedHash.startsWith('scrypt:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) return false;
    const [, salt, originalHex] = parts;
    const derived = crypto.scryptSync(String(password), salt, 64);
    const original = Buffer.from(originalHex, 'hex');
    if (derived.length !== original.length) return false;
    return crypto.timingSafeEqual(derived, original);
  }
  return false;
}

export function signSessionToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function formatLoginTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
