import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

// GET all playlists with their slides
router.get('/', async (req, res) => {
  try {
    const [playlists] = await pool.query('SELECT * FROM playlists ORDER BY created_at DESC');
    const [items] = await pool.query('SELECT * FROM playlist_items ORDER BY order_index ASC');
    const [screens] = await pool.query('SELECT id, assigned_playlist_id FROM screens');

    const result = playlists.map((pl) => {
      const plItems = items
        .filter((it) => it.playlist_id === pl.id)
        .map((it) => ({
          id: it.id,
          mediaId: it.media_id,
          order: it.order_index,
          displayDurationSeconds: it.display_duration_seconds,
          muteAudio: Boolean(it.mute_audio),
          loopVideo: Boolean(it.loop_video),
        }));

      const assignedScreenIds = screens
        .filter((s) => s.assigned_playlist_id === pl.id)
        .map((s) => s.id);

      return {
        id: pl.id,
        name: pl.name,
        description: pl.description || '',
        items: plItems,
        assignedScreenIds,
        lastUpdated: pl.last_updated || '',
        status: pl.status,
        defaultImageDuration: pl.default_image_duration,
        autoAdvanceVideo: Boolean(pl.auto_advance_video),
        loopPlaylist: Boolean(pl.loop_playlist),
      };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create or update playlist
router.post('/', async (req, res) => {
  try {
    const { id, name, description, status, defaultImageDuration, autoAdvanceVideo, loopPlaylist, items } = req.body;
    const plId = id || `pl-${Date.now().toString().slice(-4)}`;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);

    await pool.query(
      `INSERT INTO playlists (id, name, description, status, default_image_duration, auto_advance_video, loop_playlist, last_updated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), status=VALUES(status),
       default_image_duration=VALUES(default_image_duration), auto_advance_video=VALUES(auto_advance_video),
       loop_playlist=VALUES(loop_playlist), last_updated=VALUES(last_updated)`,
      [plId, name, description || '', status || 'Active', defaultImageDuration || 10, autoAdvanceVideo ? 1 : 0, loopPlaylist ? 1 : 0, now]
    );

    // Replace items
    if (Array.isArray(items)) {
      await pool.query('DELETE FROM playlist_items WHERE playlist_id=?', [plId]);
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await pool.query(
          `INSERT INTO playlist_items (id, playlist_id, media_id, order_index, display_duration_seconds, mute_audio, loop_video)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id || `pi-${Date.now()}-${i}`,
            plId,
            item.mediaId,
            i + 1,
            item.displayDurationSeconds || defaultImageDuration || 10,
            item.muteAudio ? 1 : 0,
            item.loopVideo ? 1 : 0,
          ]
        );
      }
    }

    res.json({ success: true, id: plId, message: 'Playlist saved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE playlist
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM playlists WHERE id=?', [id]);
    res.json({ success: true, message: 'Playlist deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST add media to playlist
router.post('/:id/add-media', async (req, res) => {
  try {
    const { id } = req.params;
    const { mediaId, displayDurationSeconds } = req.body;
    const [existing] = await pool.query('SELECT count(*) as count FROM playlist_items WHERE playlist_id=?', [id]);
    const nextOrder = (existing[0]?.count || 0) + 1;
    const itemId = `pi-${Date.now()}`;

    await pool.query(
      `INSERT INTO playlist_items (id, playlist_id, media_id, order_index, display_duration_seconds, mute_audio, loop_video)
       VALUES (?, ?, ?, ?, ?, 1, 0)`,
      [itemId, id, mediaId, nextOrder, displayDurationSeconds || 10]
    );

    res.json({ success: true, itemId, message: 'Media added to playlist' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
