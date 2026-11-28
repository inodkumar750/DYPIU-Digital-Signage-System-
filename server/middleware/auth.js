import { pool } from '../db.js';
import {
  parseAllowedMenus,
  verifyDeviceKey,
  verifySessionToken,
} from '../utils/auth.js';
import { config } from '../config.js';
import { HttpError, forbidden } from '../utils/http.js';

const USER_CACHE_MS = 3000;
const userCache = new Map();

export function invalidateUserCache(id) {
  if (id) userCache.delete(id);
  else userCache.clear();
}

async function loadUser(id) {
  const hit = userCache.get(id);
  if (hit && hit.exp > Date.now()) return hit.user;
  const [rows] = await pool.query(
    'SELECT id, name, email, role, allowed_menus, status FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  const user = rows[0] || null;
  userCache.set(id, { user, exp: Date.now() + USER_CACHE_MS });
  return user;
}

function bearerToken(req) {
  const h = String(req.headers.authorization || '');
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

/** Requires a valid signed session AND a live, non-suspended account. Roles are read from the DB every time. */
export async function authRequired(req, res, next) {
  try {
    const payload = verifySessionToken(bearerToken(req));
    if (!payload?.userId) throw new HttpError(401, 'Please sign in to continue.');
    const row = await loadUser(payload.userId);
    if (!row) throw new HttpError(401, 'User account no longer exists.');
    if (row.status === 'Suspended') throw new HttpError(403, 'Account has been suspended by an administrator.');
    req.user = {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      menus: parseAllowedMenus(row.allowed_menus, row.role),
    };
    next();
  } catch (err) {
    next(err);
  }
}

/** Server-side RBAC: the caller must hold at least one of the given menu permissions. */
export const requireMenu =
  (...menus) =>
  (req, res, next) => {
    if (!req.user) return next(new HttpError(401, 'Please sign in to continue.'));
    if (req.user.role === 'Super Administrator' || menus.some((m) => req.user.menus.includes(m))) {
      return next();
    }
    next(forbidden());
  };

export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(new HttpError(401, 'Please sign in to continue.'));
    if (roles.includes(req.user.role)) return next();
    next(forbidden());
  };

function deviceKeyFromReq(req) {
  return String(req.headers['x-device-key'] || req.query.key || '').trim();
}

/**
 * Validates a TV/player calling a /device/:screenId/* route.
 * The screen must exist; when CAMPUSCAST_REQUIRE_DEVICE_KEY=1 a valid device key is mandatory.
 */
export async function deviceAuth(req, res, next) {
  try {
    const screenId = req.params.screenId;
    if (config.requireDeviceKey && !verifyDeviceKey(screenId, deviceKeyFromReq(req))) {
      throw new HttpError(401, 'Invalid or missing device key.');
    }
    next();
  } catch (err) {
    next(err);
  }
}

/** Accepts either a signed-in admin (with one of `menus`) or a TV identified by screen id + device key. */
export const userOrDevice =
  (...menus) =>
  async (req, res, next) => {
    try {
      const token = bearerToken(req);
      if (token) {
        return authRequired(req, res, (err) => {
          if (err) return next(err);
          requireMenu(...menus)(req, res, next);
        });
      }
      const screenId = String(req.headers['x-screen-id'] || '').trim();
      if (!screenId) throw new HttpError(401, 'Please sign in to continue.');
      if (config.requireDeviceKey && !verifyDeviceKey(screenId, deviceKeyFromReq(req))) {
        throw new HttpError(401, 'Invalid or missing device key.');
      }
      const [rows] = await pool.query('SELECT id FROM screens WHERE id=? LIMIT 1', [screenId]);
      if (rows.length === 0) throw new HttpError(401, 'Unknown device.');
      req.device = { screenId };
      next();
    } catch (err) {
      next(err);
    }
  };
