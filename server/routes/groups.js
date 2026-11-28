import { Router } from 'express';
import { pool, withTx } from '../db.js';
import { requireMenu } from '../middleware/auth.js';
import { asyncHandler, badRequest, idList, newId, notFound, str } from '../utils/http.js';
import { listGroups } from '../services/serializers.js';

const router = Router();
const canEdit = requireMenu('groups');

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listGroups() });
  })
);

router.post(
  '/',
  canEdit,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const name = str(b.name, { field: 'Group name', max: 255, required: true });
    const building = str(b.building, { max: 100, fallback: 'Building A' });
    const floor = str(b.floor, { max: 100, fallback: 'Ground Floor' });
    const description = str(b.description, { max: 2000 });
    const screenIds = idList(b.screenIds, 'screenIds');

    const id = await withTx(async (conn) => {
      const grpId = b.id ? String(b.id).slice(0, 50) : newId('grp');
      let playlistId = null;
      if (b.assignedPlaylistId) {
        const [p] = await conn.query('SELECT id FROM playlists WHERE id=?', [String(b.assignedPlaylistId)]);
        if (p.length === 0) throw badRequest('The selected playlist does not exist.');
        playlistId = p[0].id;
      }
      if (screenIds.length > 0) {
        const [found] = await conn.query('SELECT id FROM screens WHERE id IN (?)', [screenIds]);
        if (found.length !== screenIds.length) throw badRequest('One or more selected screens no longer exist.');
      }
      await conn.query(
        `INSERT INTO screen_groups (id, name, building, floor, description, assigned_playlist_id)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), building=VALUES(building), floor=VALUES(floor),
           description=VALUES(description), assigned_playlist_id=VALUES(assigned_playlist_id)`,
        [grpId, name, building, floor, description, playlistId]
      );
      await conn.query('DELETE FROM screen_group_items WHERE group_id=?', [grpId]);
      if (screenIds.length > 0) {
        await conn.query('INSERT INTO screen_group_items (group_id, screen_id) VALUES ?', [screenIds.map((s) => [grpId, s])]);
      }
      return grpId;
    });
    res.json({ success: true, id, message: 'Screen group saved successfully' });
  })
);

router.delete(
  '/:id',
  canEdit,
  asyncHandler(async (req, res) => {
    await withTx(async (conn) => {
      await conn.query("DELETE FROM campaign_targets WHERE target_type='group' AND target_id=?", [req.params.id]);
      const [r] = await conn.query('DELETE FROM screen_groups WHERE id=?', [req.params.id]);
      if (r.affectedRows === 0) throw notFound('Group not found');
    });
    res.json({ success: true, message: 'Screen group deleted successfully' });
  })
);

export default router;
