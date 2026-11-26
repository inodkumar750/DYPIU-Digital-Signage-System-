import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

// GET all screen groups
router.get('/', async (req, res) => {
  try {
    const [groups] = await pool.query('SELECT * FROM screen_groups ORDER BY created_at DESC');
    const [items] = await pool.query('SELECT * FROM screen_group_items');

    const result = groups.map((g) => ({
      id: g.id,
      name: g.name,
      building: g.building,
      floor: g.floor,
      description: g.description || '',
      screenIds: items.filter((it) => it.group_id === g.id).map((it) => it.screen_id),
      assignedPlaylistId: g.assigned_playlist_id,
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create or update screen group
router.post('/', async (req, res) => {
  try {
    const { id, name, building, floor, description, screenIds, assignedPlaylistId } = req.body;
    const grpId = id || `grp-${Date.now().toString().slice(-4)}`;

    await pool.query(
      `INSERT INTO screen_groups (id, name, building, floor, description, assigned_playlist_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), building=VALUES(building), floor=VALUES(floor),
       description=VALUES(description), assigned_playlist_id=VALUES(assigned_playlist_id)`,
      [grpId, name, building, floor, description || '', assignedPlaylistId || null]
    );

    await pool.query('DELETE FROM screen_group_items WHERE group_id=?', [grpId]);
    if (Array.isArray(screenIds)) {
      for (const sid of screenIds) {
        await pool.query('INSERT INTO screen_group_items (group_id, screen_id) VALUES (?, ?)', [grpId, sid]);
      }
    }

    res.json({ success: true, id: grpId, message: 'Screen group saved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE screen group
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM screen_groups WHERE id=?', [id]);
    res.json({ success: true, message: 'Screen group deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
