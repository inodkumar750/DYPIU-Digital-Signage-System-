import { Router } from 'express';
import { pool } from '../db.js';
import { formatLoginTimestamp, signSessionToken, verifyPassword } from '../utils/auth.js';
import { authRequired } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/http.js';
import { createLimiter } from '../utils/rateLimit.js';
import { serializeUser } from '../services/serializers.js';
import { logActivity } from '../services/audit.js';

const router = Router();

// 8 failed attempts per IP+email per 15 minutes, 40 per IP.
const perAccount = createLimiter({ windowMs: 15 * 60 * 1000, max: 8 });
const perIp = createLimiter({ windowMs: 15 * 60 * 1000, max: 40 });

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) throw new HttpError(400, 'Email and password are required.');
    if (email.length > 150 || password.length > 200) throw new HttpError(400, 'Invalid credentials.');

    const accountKey = `${req.ip}|${email}`;
    const wait = Math.max(perAccount.peek(accountKey), perIp.peek(req.ip));
    if (wait > 0) {
      res.set('Retry-After', String(wait));
      throw new HttpError(429, `Too many failed attempts. Try again in ${Math.ceil(wait / 60)} minute(s).`);
    }

    const [rows] = await pool.query(
      'SELECT id, name, email, password_hash, department, role, allowed_menus, status, last_login, avatar_url FROM users WHERE LOWER(email) = ? LIMIT 1',
      [email]
    );
    const userRow = rows[0];
    // Always run the hash comparison (even for unknown e-mails) so timing does not reveal valid accounts.
    const ok = await verifyPassword(password, userRow?.password_hash);
    if (!userRow || !ok) {
      perAccount.hit(accountKey);
      perIp.hit(req.ip);
      throw new HttpError(401, 'Invalid email or password.');
    }
    if (userRow.status === 'Suspended') {
      throw new HttpError(403, 'This account is suspended. Contact your Super Administrator.');
    }

    perAccount.clear(accountKey);
    const loginTime = formatLoginTimestamp();
    const nextStatus = userRow.status === 'Invited' ? 'Active' : userRow.status;
    await pool.query('UPDATE users SET last_login = ?, status = ? WHERE id = ?', [loginTime, nextStatus, userRow.id]);
    userRow.last_login = loginTime;
    userRow.status = nextStatus;

    const user = serializeUser(userRow);
    const token = signSessionToken({ userId: user.id, email: user.email });
    logActivity('auth', 'User signed in', user.email, user.name);
    res.json({ success: true, token, user });
  })
);

// Live validation of the session + current permissions (roles are re-read from MySQL each call).
router.get(
  '/me',
  authRequired,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      'SELECT id, name, email, department, role, allowed_menus, status, last_login, avatar_url FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );
    res.json({ success: true, user: serializeUser(rows[0]) });
  })
);

export default router;
