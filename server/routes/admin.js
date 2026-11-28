import { Router } from 'express';
import { pool } from '../db.js';
import { requireMenu, requireRole } from '../middleware/auth.js';
import { asyncHandler, intIn } from '../utils/http.js';
import {
  getSettings,
  listCampaigns,
  listGroups,
  listMedia,
  listPlaylists,
  listScreens,
} from '../services/serializers.js';

const router = Router();

// Audit trail (who changed what)
router.get(
  '/audit',
  requireMenu('reports', 'settings', 'users'),
  asyncHandler(async (req, res) => {
    const limit = intIn(req.query.limit, { field: 'limit', min: 1, max: 500, fallback: 100 });
    const [rows] = await pool.query(
      'SELECT id, action_type, title, detail, actor, `timestamp` FROM activity_events ORDER BY created_at DESC, id DESC LIMIT ?',
      [limit]
    );
    res.json({
      success: true,
      data: rows.map((r) => ({ id: r.id, actionType: r.action_type, title: r.title, detail: r.detail, actor: r.actor, timestamp: r.timestamp })),
    });
  })
);

// Proof-of-play report: how often each media item played on each screen
router.get(
  '/reports/playback',
  requireMenu('reports', 'monitoring'),
  asyncHandler(async (req, res) => {
    const days = intIn(req.query.days, { field: 'days', min: 1, max: 365, fallback: 7 });
    const [byMedia] = await pool.query(
      `SELECT pl.media_id AS mediaId, COALESCE(ma.title, pl.media_id) AS title, COUNT(*) AS plays
         FROM playback_logs pl LEFT JOIN media_assets ma ON ma.id = pl.media_id
        WHERE pl.started_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY pl.media_id, ma.title ORDER BY plays DESC LIMIT 100`,
      [days]
    );
    const [byScreen] = await pool.query(
      `SELECT pl.screen_id AS screenId, COALESCE(s.name, pl.screen_id) AS name, COUNT(*) AS plays
         FROM playback_logs pl LEFT JOIN screens s ON s.id = pl.screen_id
        WHERE pl.started_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY pl.screen_id, s.name ORDER BY plays DESC LIMIT 100`,
      [days]
    );
    res.json({ success: true, days, byMedia, byScreen });
  })
);

// Full JSON backup of all content (no password hashes / device keys). Super Administrator only.
router.get(
  '/admin/backup',
  requireRole('Super Administrator'),
  asyncHandler(async (req, res) => {
    const [users] = await pool.query('SELECT id, name, email, department, role, allowed_menus, status FROM users');
    const backup = {
      exportedAt: new Date().toISOString(),
      users,
      screens: await listScreens(),
      media: await listMedia(),
      playlists: await listPlaylists(),
      campaigns: await listCampaigns(),
      groups: await listGroups(),
      settings: await getSettings(),
    };
    res.set('Content-Disposition', `attachment; filename="nexora-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(backup);
  })
);

export default router;
