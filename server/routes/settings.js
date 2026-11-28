import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired, requireMenu, userOrDevice } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound } from '../utils/http.js';
import { getSettings } from '../services/serializers.js';

const router = Router();

router.get(
  '/',
  authRequired,
  asyncHandler(async (req, res) => {
    const data = await getSettings();
    if (!data) throw notFound('Settings not found');
    res.json({ success: true, data });
  })
);

router.put(
  '/',
  authRequired,
  requireMenu('settings'),
  asyncHandler(async (req, res) => {
    const settings = req.body;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      throw badRequest('Settings must be a JSON object.');
    }
    const json = JSON.stringify(settings);
    if (json.length > 50_000) throw badRequest('Settings payload is too large.');
    await pool.query(
      'INSERT INTO university_settings (id, settings_json) VALUES (1, ?) ON DUPLICATE KEY UPDATE settings_json=VALUES(settings_json)',
      [json]
    );
    res.json({ success: true, message: 'Settings saved successfully' });
  })
);

// Toggle the on-screen ticker without touching other settings. Allowed for admins and for the TV itself.
router.patch(
  '/ticker',
  userOrDevice('settings', 'dashboard'),
  asyncHandler(async (req, res) => {
    const showTvTicker = Boolean(req.body?.showTvTicker);
    const existing = (await getSettings()) || {};
    await pool.query(
      'INSERT INTO university_settings (id, settings_json) VALUES (1, ?) ON DUPLICATE KEY UPDATE settings_json=VALUES(settings_json)',
      [JSON.stringify({ ...existing, showTvTicker })]
    );
    res.json({ success: true, showTvTicker });
  })
);

export default router;
