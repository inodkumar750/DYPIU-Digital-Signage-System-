import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

const HEARTBEAT_OFFLINE_SECONDS = 45;

function parseHeartbeatMs(raw) {
  if (!raw || typeof raw !== 'string') return NaN;
  const trimmed = raw.trim();
  if (!trimmed) return NaN;
  if (trimmed.includes('T')) return Date.parse(trimmed);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return Date.parse(trimmed.replace(' ', 'T') + 'Z');
  }
  return Date.parse(trimmed);
}

function formatLocalTimestamp(ms) {
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatRelativeSeen(ageSec) {
  if (!Number.isFinite(ageSec) || ageSec < 0) return 'Never';
  if (ageSec <= HEARTBEAT_OFFLINE_SECONDS) return 'Just now';
  if (ageSec < 60) return `${ageSec}s ago`;
  const mins = Math.floor(ageSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// GET all screens (auto-marks powered-off / disconnected TVs Offline after 45s without heartbeat)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM screens ORDER BY id ASC');
    const nowMs = Date.now();
    const screens = [];

    for (const r of rows) {
      const isActive = Boolean(r.is_active);
      const hbMs = parseHeartbeatMs(r.last_heartbeat);
      const ageSec = Number.isFinite(hbMs) ? Math.max(0, Math.floor((nowMs - hbMs) / 1000)) : Infinity;

      let connectionStatus = 'Offline';
      let lastSeen = 'Offline';

      if (!isActive) {
        connectionStatus = 'Offline';
        lastSeen = 'Turned Off (Standby)';
      } else if (Number.isFinite(ageSec) && ageSec <= HEARTBEAT_OFFLINE_SECONDS) {
        connectionStatus = 'Online';
        lastSeen = 'Just now';
      } else {
        connectionStatus = 'Offline';
        lastSeen = formatRelativeSeen(ageSec);
      }

      if (r.connection_status !== connectionStatus || r.last_seen !== lastSeen) {
        await pool.query('UPDATE screens SET connection_status=?, last_seen=? WHERE id=?', [
          connectionStatus,
          lastSeen,
          r.id,
        ]);
      }

      screens.push({
        id: r.id,
        name: r.name,
        building: r.building,
        floor: r.floor,
        location: r.location,
        deviceType: r.device_type,
        resolution: r.resolution,
        osVersion: r.os_version,
        playerAppVersion: r.player_app_version,
        connectionStatus,
        lastSeen,
        lastHeartbeat: Number.isFinite(hbMs) ? formatLocalTimestamp(hbMs) : (r.last_heartbeat || ''),
        assignedPlaylistId: r.assigned_playlist_id,
        currentMediaId: r.current_media_id,
        ipAddress: r.ip_address,
        storageUsedPct: r.storage_used_pct,
        playbackError: r.playback_error,
        isActive,
      });
    }

    res.json({ success: true, data: screens });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST register screen
router.post('/', async (req, res) => {
  try {
    const { id, name, building, floor, location, deviceType, assignedPlaylistId, ipAddress } = req.body;
    await pool.query(
      `INSERT INTO screens (id, name, building, floor, location, device_type, assigned_playlist_id, ip_address, connection_status, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Online', 1)
       ON DUPLICATE KEY UPDATE name=VALUES(name), building=VALUES(building), floor=VALUES(floor), location=VALUES(location), assigned_playlist_id=VALUES(assigned_playlist_id)`,
      [id, name, building, floor, location || '', deviceType || 'Smart TV', assignedPlaylistId || null, ipAddress || '10.40.1.50']
    );
    res.json({ success: true, message: 'Screen registered successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update screen
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, building, floor, location, assignedPlaylistId, deviceType } = req.body;
    await pool.query(
      `UPDATE screens SET name=?, building=?, floor=?, location=?, assigned_playlist_id=?, device_type=? WHERE id=?`,
      [name || '', building || 'Building A', floor || 'Ground Floor', location || '', assignedPlaylistId || null, deviceType || 'Smart TV', id]
    );
    res.json({ success: true, message: 'Screen updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH assign playlist to screen
router.patch('/:id/assign-playlist', async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedPlaylistId } = req.body;
    await pool.query('UPDATE screens SET assigned_playlist_id=? WHERE id=?', [assignedPlaylistId || null, id]);
    res.json({ success: true, message: 'Screen playlist assigned successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE screen
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM screen_group_items WHERE screen_id=?', [id]);
    await pool.query('DELETE FROM campaign_targets WHERE target_type=? AND target_id=?', ['screen', id]);
    await pool.query('DELETE FROM screens WHERE id=?', [id]);
    res.json({ success: true, message: 'Screen deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH toggle active standby
router.patch('/:id/toggle-active', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE screens SET is_active = NOT is_active WHERE id=?', [id]);
    const [rows] = await pool.query('SELECT is_active, last_heartbeat FROM screens WHERE id=?', [id]);
    if (rows.length > 0) {
      const isActive = Boolean(rows[0].is_active);
      if (!isActive) {
        await pool.query(
          "UPDATE screens SET connection_status='Offline', last_seen='Turned Off (Standby)' WHERE id=?",
          [id]
        );
      } else {
        const hbMs = parseHeartbeatMs(rows[0].last_heartbeat);
        const ageSec = Number.isFinite(hbMs) ? Math.floor((Date.now() - hbMs) / 1000) : Infinity;
        const isLive = ageSec <= HEARTBEAT_OFFLINE_SECONDS;
        await pool.query('UPDATE screens SET connection_status=?, last_seen=? WHERE id=?', [
          isLive ? 'Online' : 'Offline',
          isLive ? 'Just now' : formatRelativeSeen(ageSec),
          id,
        ]);
      }
    }
    res.json({ success: true, message: 'Screen active state toggled' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH request remote wake / reconnect without faking Online until real TV heartbeat arrives
router.patch('/:id/reconnect', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE screens SET is_active=1, wake_requested=1, playback_error=NULL WHERE id=?`,
      [id]
    );
    res.json({
      success: true,
      message: 'Wake signal queued. Display will show Online once physical TV connects.',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST TV device pairing code verification
router.post('/pair-verify', async (req, res) => {
  try {
    const { pairingCode, screenName, building, floor, location } = req.body;
    const screenId = `DYPIU-TV-${Math.floor(100 + Math.random() * 900)}`;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    await pool.query(
      `INSERT INTO screens (id, name, building, floor, location, device_type, connection_status, last_seen, last_heartbeat, ip_address, pairing_code, is_active)
       VALUES (?, ?, ?, ?, ?, 'Android TV 4K', 'Online', 'Just now', ?, '10.40.1.99', ?, 1)`,
      [screenId, screenName || `TV Display ${screenId}`, building || 'Building A', floor || 'Ground Floor', location || 'Corridor', now, pairingCode]
    );
    res.json({ success: true, screenId, message: 'Device successfully paired and activated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
