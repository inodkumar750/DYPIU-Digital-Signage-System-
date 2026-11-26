import { Router } from 'express';
import { pool } from '../db.js';
import {
  formatLoginTimestamp,
  parseAllowedMenus,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from '../utils/auth.js';

const router = Router();

function serializeUser(r) {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    department: r.department,
    role: r.role,
    allowedMenus: parseAllowedMenus(r.allowed_menus, r.role),
    status: r.status,
    lastLogin: r.last_login,
    avatarUrl: r.avatar_url,
  };
}

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required.',
      });
    }

    const [rows] = await pool.query(
      'SELECT id, name, email, password_hash, department, role, allowed_menus, status, last_login, avatar_url FROM users WHERE LOWER(email) = ? LIMIT 1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    const userRow = rows[0];
    if (!verifyPassword(password, userRow.password_hash)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    if (userRow.status === 'Suspended') {
      return res.status(403).json({
        success: false,
        error: 'This account is suspended. Contact your Super Administrator.',
      });
    }

    const loginTime = formatLoginTimestamp();
    const nextStatus = userRow.status === 'Invited' ? 'Active' : userRow.status;

    await pool.query('UPDATE users SET last_login = ?, status = ? WHERE id = ?', [
      loginTime,
      nextStatus,
      userRow.id,
    ]);

    userRow.last_login = loginTime;
    userRow.status = nextStatus;

    const user = serializeUser(userRow);
    const token = signSessionToken({
      userId: user.id,
      email: user.email,
      issuedAt: Date.now(),
    });

    res.json({ success: true, token, user });
  } catch (err) {
    console.error('Auth login error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/auth/me (validates live MySQL status & permissions in real time)
router.get('/me', async (req, res) => {
  try {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : String(req.query.token || '').trim();

    const payload = verifySessionToken(token);
    if (!payload?.userId) {
      return res.status(401).json({ success: false, error: 'Invalid or expired session.' });
    }

    const [rows] = await pool.query(
      'SELECT id, name, email, department, role, allowed_menus, status, last_login, avatar_url FROM users WHERE id = ? LIMIT 1',
      [payload.userId]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'User account no longer exists.' });
    }

    const userRow = rows[0];
    if (userRow.status === 'Suspended') {
      return res.status(403).json({
        success: false,
        error: 'Account has been suspended by an administrator.',
      });
    }

    res.json({ success: true, user: serializeUser(userRow) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
