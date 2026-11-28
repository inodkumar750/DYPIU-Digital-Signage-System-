import { Router } from 'express';
import { pool, withTx } from '../db.js';
import { requireMenu } from '../middleware/auth.js';
import { asyncHandler, badRequest, conflict, intIn, newId, notFound, oneOf, str } from '../utils/http.js';
import { listPlaylists } from '../services/serializers.js';
import { formatTimestamp } from '../utils/heartbeat.js';

const router = Router();
const canEdit = requireMenu('playlists');

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listPlaylists() });
  })
);

router.post(
  '/',
  canEdit,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const name = str(b.name, { field: 'Playlist name', max: 255, required: true });
    const description = str(b.description, { max: 2000 });
    const status = oneOf(b.status, ['Active', 'Draft', 'Archived'], { field: 'Status', fallback: 'Active' });
    const defaultDuration = intIn(b.defaultImageDuration, { field: 'Default image duration', min: 1, max: 3600, fallback: 10 });
    const items = b.items === undefined ? undefined : b.items;
    if (items !== undefined && (!Array.isArray(items) || items.length > 500)) {
      throw badRequest('Playlist items must be a list of at most 500 entries.');
    }
    const now = formatTimestamp(Date.now()).slice(0, 16);

    const id = await withTx(async (conn) => {
      const plId = b.id ? String(b.id).slice(0, 50) : newId('pl');
      await conn.query(
        `INSERT INTO playlists (id, name, description, status, default_image_duration, auto_advance_video, loop_playlist, last_updated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), status=VALUES(status),
           default_image_duration=VALUES(default_image_duration), auto_advance_video=VALUES(auto_advance_video),
           loop_playlist=VALUES(loop_playlist), last_updated=VALUES(last_updated)`,
        [plId, name, description, status, defaultDuration, b.autoAdvanceVideo === false ? 0 : 1, b.loopPlaylist === false ? 0 : 1, now]
      );

      if (items) {
        const mediaIds = [...new Set(items.map((it) => String(it?.mediaId || '')))];
        if (mediaIds.some((m) => !m)) throw badRequest('Every playlist item needs a mediaId.');
        if (mediaIds.length > 0) {
          const [found] = await conn.query('SELECT id FROM media_assets WHERE id IN (?)', [mediaIds]);
          if (found.length !== mediaIds.length) throw badRequest('One or more media files in this playlist no longer exist.');
        }
        await conn.query('DELETE FROM playlist_items WHERE playlist_id=?', [plId]);
        if (items.length > 0) {
          const rows = items.map((it, i) => [
            newId('pi'),
            plId,
            String(it.mediaId),
            i + 1,
            intIn(it.displayDurationSeconds, { field: 'Slide duration', min: 1, max: 3600, fallback: defaultDuration }),
            it.muteAudio === false ? 0 : 1,
            it.loopVideo ? 1 : 0,
          ]);
          await conn.query(
            'INSERT INTO playlist_items (id, playlist_id, media_id, order_index, display_duration_seconds, mute_audio, loop_video) VALUES ?',
            [rows]
          );
        }
      }
      return plId;
    });
    res.json({ success: true, id, message: 'Playlist saved successfully' });
  })
);

/** Deleting is blocked while campaigns still use the playlist; screens/groups are un-assigned automatically. */
router.delete(
  '/:id',
  canEdit,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await withTx(async (conn) => {
      const [exists] = await conn.query('SELECT id FROM playlists WHERE id=? FOR UPDATE', [id]);
      if (exists.length === 0) throw notFound('Playlist not found');
      const [camps] = await conn.query('SELECT name FROM campaigns WHERE playlist_id=? LIMIT 5', [id]);
      if (camps.length > 0) {
        throw conflict(
          `This playlist is used by campaign(s): ${camps.map((c) => `"${c.name}"`).join(', ')}. Delete or re-point those campaigns first.`
        );
      }
      await conn.query('UPDATE screens SET assigned_playlist_id=NULL WHERE assigned_playlist_id=?', [id]);
      await conn.query('UPDATE screen_groups SET assigned_playlist_id=NULL WHERE assigned_playlist_id=?', [id]);
      await conn.query('DELETE FROM playlists WHERE id=?', [id]);
    });
    res.json({ success: true, message: 'Playlist deleted successfully' });
  })
);

router.post(
  '/:id/add-media',
  canEdit,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const mediaId = str(req.body?.mediaId, { field: 'mediaId', max: 50, required: true });
    const itemId = newId('pi');
    await withTx(async (conn) => {
      const [pl] = await conn.query('SELECT default_image_duration FROM playlists WHERE id=? FOR UPDATE', [id]);
      if (pl.length === 0) throw notFound('Playlist not found');
      const [m] = await conn.query('SELECT id FROM media_assets WHERE id=?', [mediaId]);
      if (m.length === 0) throw notFound('Media not found');
      const [mx] = await conn.query('SELECT COALESCE(MAX(order_index),0) AS mx FROM playlist_items WHERE playlist_id=?', [id]);
      const duration = intIn(req.body?.displayDurationSeconds, {
        field: 'Slide duration',
        min: 1,
        max: 3600,
        fallback: pl[0].default_image_duration || 10,
      });
      await conn.query(
        `INSERT INTO playlist_items (id, playlist_id, media_id, order_index, display_duration_seconds, mute_audio, loop_video)
         VALUES (?, ?, ?, ?, ?, 1, 0)`,
        [itemId, id, mediaId, mx[0].mx + 1, duration]
      );
      await conn.query('UPDATE playlists SET last_updated=? WHERE id=?', [formatTimestamp(Date.now()).slice(0, 16), id]);
    });
    res.json({ success: true, itemId, message: 'Media added to playlist' });
  })
);

export default router;
