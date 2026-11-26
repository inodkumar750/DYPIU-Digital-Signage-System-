import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

// GET all campaigns
router.get('/', async (req, res) => {
  try {
    const [campaigns] = await pool.query('SELECT * FROM campaigns ORDER BY created_at DESC');
    const [targets] = await pool.query('SELECT * FROM campaign_targets');

    const result = campaigns.map((c) => {
      const cTargets = targets.filter((t) => t.campaign_id === c.id);
      const targetScreenIds = cTargets.filter((t) => t.target_type === 'screen').map((t) => t.target_id);
      const targetGroupIds = cTargets.filter((t) => t.target_type === 'group').map((t) => t.target_id);

      return {
        id: c.id,
        name: c.name,
        description: c.description || '',
        playlistId: c.playlist_id,
        startDate: c.start_date,
        endDate: c.end_date,
        startTime: c.start_time,
        endTime: c.end_time,
        targetScreenIds,
        targetGroupIds,
        status: c.status,
        priority: c.priority,
        createdBy: c.created_by,
      };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create or update campaign
router.post('/', async (req, res) => {
  try {
    const { id, name, description, playlistId, startDate, endDate, startTime, endTime, targetScreenIds, targetGroupIds, status, priority, createdBy } = req.body;
    const cmpId = id || `cmp-${Date.now().toString().slice(-4)}`;

    await pool.query(
      `INSERT INTO campaigns (id, name, description, playlist_id, start_date, end_date, start_time, end_time, status, priority, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), playlist_id=VALUES(playlist_id),
       start_date=VALUES(start_date), end_date=VALUES(end_date), start_time=VALUES(start_time), end_time=VALUES(end_time),
       status=VALUES(status), priority=VALUES(priority)`,
      [cmpId, name, description || '', playlistId, startDate, endDate, startTime, endTime, status || 'Scheduled', priority || 'Normal', createdBy || 'Vinod Kumar Jain']
    );

    // Update targets
    await pool.query('DELETE FROM campaign_targets WHERE campaign_id=?', [cmpId]);
    if (Array.isArray(targetScreenIds)) {
      for (const sid of targetScreenIds) {
        await pool.query('INSERT INTO campaign_targets (campaign_id, target_type, target_id) VALUES (?, "screen", ?)', [cmpId, sid]);
      }
    }
    if (Array.isArray(targetGroupIds)) {
      for (const gid of targetGroupIds) {
        await pool.query('INSERT INTO campaign_targets (campaign_id, target_type, target_id) VALUES (?, "group", ?)', [cmpId, gid]);
      }
    }

    res.json({ success: true, id: cmpId, message: 'Campaign saved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH update campaign status
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await pool.query('UPDATE campaigns SET status=? WHERE id=?', [status, id]);
    res.json({ success: true, message: `Campaign status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE campaign
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM campaigns WHERE id=?', [id]);
    res.json({ success: true, message: 'Campaign deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
