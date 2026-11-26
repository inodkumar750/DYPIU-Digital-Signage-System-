import { Router } from 'express';
import { pool } from '../db.js';
import { hashPassword, parseAllowedMenus } from '../utils/auth.js';

const router = Router();

// GET all users
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, department, role, allowed_menus, status, last_login, avatar_url FROM users ORDER BY created_at ASC'
    );
    const users = rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      department: r.department,
      role: r.role,
      allowedMenus: parseAllowedMenus(r.allowed_menus, r.role),
      status: r.status,
      lastLogin: r.last_login,
      avatarUrl: r.avatar_url,
    }));
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create or update user (with password hashing & role-based menu access)
router.post('/', async (req, res) => {
  try {
    const { id, name, email, password, department, role, status, allowedMenus } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(name || '').trim();
    const cleanRole = role || 'Content Manager';
    const cleanStatus = status || 'Active';
    const cleanDept = String(department || '').trim() || 'University IT';
    const effectiveMenus = parseAllowedMenus(allowedMenus, cleanRole);
    const menusJson = JSON.stringify(effectiveMenus);

    if (!cleanName || !cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'Valid full name and university email are required.',
      });
    }

    const userId = id || `usr-${Date.now().toString().slice(-4)}`;
    const [existingRows] = await pool.query('SELECT id FROM users WHERE id = ? LIMIT 1', [userId]);
    const isExisting = existingRows.length > 0;

    if (!isExisting && (!password || String(password).length < 4)) {
      return res.status(400).json({
        success: false,
        error: 'Password of at least 4 characters is required for new users.',
      });
    }

    // Check duplicate email belonging to another user
    const [emailRows] = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = ? AND id != ? LIMIT 1',
      [cleanEmail, userId]
    );
    if (emailRows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Another user account is already registered with this email address.',
      });
    }

    if (isExisting) {
      if (password && String(password).trim()) {
        const hashed = hashPassword(String(password));
        await pool.query(
          'UPDATE users SET name=?, email=?, password_hash=?, department=?, role=?, allowed_menus=?, status=? WHERE id=?',
          [cleanName, cleanEmail, hashed, cleanDept, cleanRole, menusJson, cleanStatus, userId]
        );
      } else {
        await pool.query(
          'UPDATE users SET name=?, email=?, department=?, role=?, allowed_menus=?, status=? WHERE id=?',
          [cleanName, cleanEmail, cleanDept, cleanRole, menusJson, cleanStatus, userId]
        );
      }
    } else {
      const hashed = hashPassword(String(password));
      await pool.query(
        `INSERT INTO users (id, name, email, password_hash, department, role, allowed_menus, status, last_login)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending first login')`,
        [userId, cleanName, cleanEmail, hashed, cleanDept, cleanRole, menusJson, cleanStatus]
      );
    }

    res.json({
      success: true,
      id: userId,
      data: {
        id: userId,
        name: cleanName,
        email: cleanEmail,
        department: cleanDept,
        role: cleanRole,
        allowedMenus: effectiveMenus,
        status: cleanStatus,
      },
      message: 'User account saved successfully',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH toggle user status
router.patch('/:id/toggle-status', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      "UPDATE users SET status = IF(status='Active', 'Suspended', 'Active') WHERE id=?",
      [id]
    );
    res.json({ success: true, message: 'User account status toggled' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE user account
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM users WHERE id=?', [id]);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
