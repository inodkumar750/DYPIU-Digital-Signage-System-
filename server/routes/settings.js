import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

// GET settings
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT settings_json FROM university_settings WHERE id=1');
    if (rows.length > 0) {
      const data = typeof rows[0].settings_json === 'string' ? JSON.parse(rows[0].settings_json) : rows[0].settings_json;
      res.json({ success: true, data });
    } else {
      res.status(404).json({ success: false, message: 'Settings not found' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update settings
router.put('/', async (req, res) => {
  try {
    const settings = req.body;
    await pool.query(
      'INSERT INTO university_settings (id, settings_json) VALUES (1, ?) ON DUPLICATE KEY UPDATE settings_json=VALUES(settings_json)',
      [JSON.stringify(settings)]
    );
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH update only showTvTicker cleanly without overwriting other settings
router.patch('/ticker', async (req, res) => {
  try {
    const showTvTicker = Boolean(req.body?.showTvTicker);
    const [rows] = await pool.query('SELECT settings_json FROM university_settings WHERE id=1');
    const existing =
      rows.length > 0
        ? typeof rows[0].settings_json === 'string'
          ? JSON.parse(rows[0].settings_json)
          : rows[0].settings_json
        : {};
    const updated = { ...existing, showTvTicker };
    await pool.query(
      'INSERT INTO university_settings (id, settings_json) VALUES (1, ?) ON DUPLICATE KEY UPDATE settings_json=VALUES(settings_json)',
      [JSON.stringify(updated)]
    );
    res.json({ success: true, showTvTicker });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
