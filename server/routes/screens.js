import { Router } from 'express';
import { pool, withTx } from '../db.js';
import { requireMenu } from '../middleware/auth.js';
import { asyncHandler, badRequest, conflict, notFound, SCREEN_ID_RE, str } from '../utils/http.js';
import { listScreens } from '../services/serializers.js';
import { deviceKeyFor } from '../utils/auth.js';
import { claimPairingCode } from '../services/pairing.js';

const router = Router();
const canEdit = requireMenu('screens');

async function assertPlaylistExists(conn, id) {
  if (!id) return null;
  const [rows] = await conn.query('SELECT id FROM playlists WHERE id=?', [String(id)]);
  if (rows.length === 0) throw badRequest('The selected playlist does not exist.');
  return String(id);
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listScreens({ includeKeys: true }) });
  })
);

// Register / upsert a screen manually
router.post(
  '/',
  canEdit,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const id = str(b.id, { field: 'Screen id', max: 50, required: true });
    if (!SCREEN_ID_RE.test(id)) throw badRequest('Screen id may only contain letters, numbers, "-" and "_" (3–50 chars).');
    const name = str(b.name, { field: 'Name', max: 255, required: true });
    await withTx(async (conn) => {
      const playlistId = await assertPlaylistExists(conn, b.assignedPlaylistId);
      await conn.query(
        `INSERT INTO screens (id, name, building, floor, location, device_type, assigned_playlist_id, ip_address, connection_status, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Offline', 1)
         ON DUPLICATE KEY UPDATE name=VALUES(name), building=VALUES(building), floor=VALUES(floor),
           location=VALUES(location), assigned_playlist_id=VALUES(assigned_playlist_id)`,
        [
          id,
          name,
          str(b.building, { max: 100, fallback: 'Building A' }),
          str(b.floor, { max: 100, fallback: 'Ground Floor' }),
          str(b.location, { max: 255 }),
          str(b.deviceType, { max: 100, fallback: 'Smart TV' }),
          playlistId,
          str(b.ipAddress, { max: 50, fallback: '0.0.0.0' }),
        ]
      );
    });
    res.json({ success: true, message: 'Screen registered successfully', deviceKey: deviceKeyFor(id) });
  })
);

// Update only the fields that were actually sent (the old code reset omitted fields to defaults).
router.put(
  '/:id',
  canEdit,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const b = req.body || {};
    const sets = [];
    const vals = [];
    const text = (key, col, max, required) => {
      if (b[key] === undefined) return;
      sets.push(`${col}=?`);
      vals.push(str(b[key], { field: key, max, required }));
    };
    text('name', 'name', 255, true);
    text('building', 'building', 100, true);
    text('floor', 'floor', 100, true);
    text('location', 'location', 255, false);
    text('deviceType', 'device_type', 100, true);
    await withTx(async (conn) => {
      if (b.assignedPlaylistId !== undefined) {
        sets.push('assigned_playlist_id=?');
        vals.push(await assertPlaylistExists(conn, b.assignedPlaylistId));
      }
      if (sets.length === 0) throw badRequest('No fields to update.');
      const [r] = await conn.query(`UPDATE screens SET ${sets.join(', ')} WHERE id=?`, [...vals, id]);
      if (r.affectedRows === 0) throw notFound('Screen not found');
    });
    res.json({ success: true, message: 'Screen updated successfully' });
  })
);

router.patch(
  '/:id/assign-playlist',
  canEdit,
  asyncHandler(async (req, res) => {
    await withTx(async (conn) => {
      const playlistId = await assertPlaylistExists(conn, req.body?.assignedPlaylistId);
      const [r] = await conn.query('UPDATE screens SET assigned_playlist_id=? WHERE id=?', [playlistId, req.params.id]);
      if (r.affectedRows === 0) throw notFound('Screen not found');
    });
    res.json({ success: true, message: 'Screen playlist assigned successfully' });
  })
);

router.delete(
  '/:id',
  canEdit,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await withTx(async (conn) => {
      await conn.query('DELETE FROM screen_group_items WHERE screen_id=?', [id]);
      await conn.query("DELETE FROM campaign_targets WHERE target_type='screen' AND target_id=?", [id]);
      await conn.query('DELETE FROM playback_logs WHERE screen_id=?', [id]);
      const [r] = await conn.query('DELETE FROM screens WHERE id=?', [id]);
      if (r.affectedRows === 0) throw notFound('Screen not found');
    });
    res.json({ success: true, message: 'Screen deleted successfully' });
  })
);

router.patch(
  '/:id/toggle-active',
  canEdit,
  asyncHandler(async (req, res) => {
    // MySQL evaluates SET assignments left-to-right, so `is_active` in the IF()s below is the NEW value.
    const [r] = await pool.query(
      `UPDATE screens SET is_active = NOT is_active,
         connection_status = IF(is_active = 0, 'Offline', connection_status),
         last_seen = IF(is_active = 0, 'Turned Off (Standby)', last_seen)
       WHERE id=?`,
      [req.params.id]
    );
    if (r.affectedRows === 0) throw notFound('Screen not found');
    res.json({ success: true, message: 'Screen active state toggled' });
  })
);

// Queue a remote wake; the TV reports Online itself once it really reconnects.
router.patch(
  '/:id/reconnect',
  canEdit,
  asyncHandler(async (req, res) => {
    const [r] = await pool.query('UPDATE screens SET is_active=1, wake_requested=1, playback_error=NULL WHERE id=?', [
      req.params.id,
    ]);
    if (r.affectedRows === 0) throw notFound('Screen not found');
    res.json({ success: true, message: 'Wake signal queued. Display will show Online once the physical TV connects.' });
  })
);

/**
 * Pair a TV. If `pairingCode` matches a code a TV generated via POST /device/pair/start, that TV is bound to the
 * new screen record and receives its id + device key. Unknown codes fall back to manual registration so admins can
 * still pre-create screens.
 */
router.post(
  '/pair-verify',
  canEdit,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const pairingCode = str(b.pairingCode, { field: 'Pairing code', max: 10, required: true }).toUpperCase();

    let screenId = null;
    for (let i = 0; i < 20 && !screenId; i++) {
      const candidate = `DYPIU-TV-${Math.floor(1000 + Math.random() * 9000)}`;
      const [rows] = await pool.query('SELECT id FROM screens WHERE id=?', [candidate]);
      if (rows.length === 0) screenId = candidate;
    }
    if (!screenId) throw conflict('Could not allocate a free screen id. Try again.');

    await pool.query(
      `INSERT INTO screens (id, name, building, floor, location, device_type, connection_status, last_seen, ip_address, pairing_code, is_active)
       VALUES (?, ?, ?, ?, ?, 'Android TV 4K', 'Offline', 'Never', '0.0.0.0', ?, 1)`,
      [
        screenId,
        str(b.screenName, { max: 255, fallback: `TV Display ${screenId}` }),
        str(b.building, { max: 100, fallback: 'Building A' }),
        str(b.floor, { max: 100, fallback: 'Ground Floor' }),
        str(b.location, { max: 255, fallback: 'Corridor' }),
        pairingCode,
      ]
    );
    const boundToTv = await claimPairingCode(pairingCode, screenId);
    res.json({
      success: true,
      screenId,
      deviceKey: deviceKeyFor(screenId),
      boundToTv,
      message: boundToTv
        ? 'TV paired and activated.'
        : 'Screen registered. Enter this screen id on the TV (no pending pairing code matched).',
    });
  })
);

export default router;
