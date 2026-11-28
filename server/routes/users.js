import { Router } from 'express';
import { pool, withTx } from '../db.js';
import { hashPassword, MIN_PASSWORD_LENGTH, parseAllowedMenus, ROLES } from '../utils/auth.js';
import { requireMenu, invalidateUserCache } from '../middleware/auth.js';
import { asyncHandler, badRequest, conflict, forbidden, newId, notFound, oneOf, str } from '../utils/http.js';
import { serializeUser } from '../services/serializers.js';

const router = Router();
const canManage = requireMenu('users');

const USER_COLS = 'id, name, email, department, role, allowed_menus, status, last_login, avatar_url';

/** Number of Active Super Administrators other than `exceptId`. */
async function otherActiveSuperAdmins(conn, exceptId) {
  const [rows] = await conn.query(
    "SELECT COUNT(*) AS n FROM users WHERE role='Super Administrator' AND status='Active' AND id <> ?",
    [exceptId]
  );
  return rows[0].n;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(`SELECT ${USER_COLS} FROM users ORDER BY created_at ASC`);
    res.json({ success: true, data: rows.map(serializeUser) });
  })
);

router.post(
  '/',
  canManage,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const cleanEmail = str(b.email, { field: 'Email', max: 150, required: true }).toLowerCase();
    const cleanName = str(b.name, { field: 'Name', max: 150, required: true });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) throw badRequest('A valid university e-mail is required.');
    const cleanRole = oneOf(b.role, ROLES, { field: 'Role', fallback: 'Content Manager' });
    const cleanStatus = oneOf(b.status, ['Active', 'Invited', 'Suspended'], { field: 'Status', fallback: 'Active' });
    const cleanDept = str(b.department, { field: 'Department', max: 150, fallback: 'University IT' });
    const menusJson = JSON.stringify(parseAllowedMenus(b.allowedMenus, cleanRole));
    const password = b.password ? String(b.password) : '';

    if (cleanRole === 'Super Administrator' && req.user.role !== 'Super Administrator') {
      throw forbidden('Only a Super Administrator can grant the Super Administrator role.');
    }

    const result = await withTx(async (conn) => {
      const requestedId = b.id ? String(b.id).slice(0, 50) : null;
      let existing = null;
      if (requestedId) {
        const [rows] = await conn.query('SELECT id, role, status FROM users WHERE id=? FOR UPDATE', [requestedId]);
        existing = rows[0] || null;
      }
      const userId = existing ? existing.id : requestedId || newId('usr');

      const [dupe] = await conn.query('SELECT id FROM users WHERE LOWER(email)=? AND id<>? LIMIT 1', [cleanEmail, userId]);
      if (dupe.length > 0) throw conflict('Another user account is already registered with this email address.');

      if (password && password.length < MIN_PASSWORD_LENGTH) {
        throw badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      }

      if (existing) {
        if (existing.role === 'Super Administrator' && req.user.role !== 'Super Administrator') {
          throw forbidden('Only a Super Administrator can modify a Super Administrator.');
        }
        const losesAdmin =
          existing.role === 'Super Administrator' &&
          existing.status === 'Active' &&
          (cleanRole !== 'Super Administrator' || cleanStatus !== 'Active');
        if (losesAdmin && (await otherActiveSuperAdmins(conn, existing.id)) === 0) {
          throw conflict('At least one active Super Administrator must remain.');
        }
        if (password) {
          await conn.query(
            'UPDATE users SET name=?, email=?, password_hash=?, department=?, role=?, allowed_menus=?, status=? WHERE id=?',
            [cleanName, cleanEmail, await hashPassword(password), cleanDept, cleanRole, menusJson, cleanStatus, userId]
          );
        } else {
          await conn.query(
            'UPDATE users SET name=?, email=?, department=?, role=?, allowed_menus=?, status=? WHERE id=?',
            [cleanName, cleanEmail, cleanDept, cleanRole, menusJson, cleanStatus, userId]
          );
        }
      } else {
        if (!password) throw badRequest(`A password of at least ${MIN_PASSWORD_LENGTH} characters is required for new users.`);
        await conn.query(
          `INSERT INTO users (id, name, email, password_hash, department, role, allowed_menus, status, last_login)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending first login')`,
          [userId, cleanName, cleanEmail, await hashPassword(password), cleanDept, cleanRole, menusJson, cleanStatus]
        );
      }
      return userId;
    });

    invalidateUserCache(result);
    const [rows] = await pool.query(`SELECT ${USER_COLS} FROM users WHERE id=?`, [result]);
    res.json({ success: true, id: result, data: serializeUser(rows[0]), message: 'User account saved successfully' });
  })
);

router.patch(
  '/:id/toggle-status',
  canManage,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (id === req.user.id) throw conflict('You cannot suspend your own account.');
    await withTx(async (conn) => {
      const [rows] = await conn.query('SELECT role, status FROM users WHERE id=? FOR UPDATE', [id]);
      if (rows.length === 0) throw notFound('User not found');
      const u = rows[0];
      if (u.role === 'Super Administrator' && req.user.role !== 'Super Administrator') {
        throw forbidden('Only a Super Administrator can modify a Super Administrator.');
      }
      const next = u.status === 'Suspended' ? 'Active' : 'Suspended';
      if (next === 'Suspended' && u.role === 'Super Administrator' && (await otherActiveSuperAdmins(conn, id)) === 0) {
        throw conflict('At least one active Super Administrator must remain.');
      }
      await conn.query('UPDATE users SET status=? WHERE id=?', [next, id]);
    });
    invalidateUserCache(id);
    res.json({ success: true, message: 'User account status toggled' });
  })
);

router.delete(
  '/:id',
  canManage,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (id === req.user.id) throw conflict('You cannot delete your own account.');
    await withTx(async (conn) => {
      const [rows] = await conn.query('SELECT role, status FROM users WHERE id=? FOR UPDATE', [id]);
      if (rows.length === 0) throw notFound('User not found');
      if (rows[0].role === 'Super Administrator') {
        if (req.user.role !== 'Super Administrator') throw forbidden('Only a Super Administrator can delete a Super Administrator.');
        if (rows[0].status === 'Active' && (await otherActiveSuperAdmins(conn, id)) === 0) {
          throw conflict('At least one active Super Administrator must remain.');
        }
      }
      await conn.query('DELETE FROM users WHERE id=?', [id]);
    });
    invalidateUserCache(id);
    res.json({ success: true, message: 'User deleted successfully' });
  })
);

export default router;
