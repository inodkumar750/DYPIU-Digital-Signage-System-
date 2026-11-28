import { pool } from '../db.js';
import { deriveConnection, formatTimestamp } from '../utils/heartbeat.js';
import { deviceKeyFor, parseAllowedMenus } from '../utils/auth.js';

export async function listScreens({ includeKeys = false } = {}) {
  const [rows] = await pool.query('SELECT * FROM screens ORDER BY id ASC');
  const nowMs = Date.now();
  return rows.map((r) => {
    const live = deriveConnection(r, nowMs);
    return {
      id: r.id,
      name: r.name,
      building: r.building,
      floor: r.floor,
      location: r.location,
      deviceType: r.device_type,
      resolution: r.resolution,
      osVersion: r.os_version,
      playerAppVersion: r.player_app_version,
      connectionStatus: live.connectionStatus,
      lastSeen: live.lastSeen,
      lastHeartbeat: Number.isFinite(live.hbMs) ? formatTimestamp(live.hbMs) : r.last_heartbeat || '',
      assignedPlaylistId: r.assigned_playlist_id,
      currentMediaId: r.current_media_id,
      ipAddress: r.ip_address,
      storageUsedPct: r.storage_used_pct,
      playbackError: r.playback_error,
      isActive: Boolean(r.is_active),
      ...(includeKeys ? { deviceKey: deviceKeyFor(r.id) } : {}),
    };
  });
}

export async function listMedia() {
  const [rows] = await pool.query('SELECT * FROM media_assets ORDER BY created_at DESC');
  return rows.map((r) => ({
    id: r.id,
    fileName: r.file_name,
    title: r.title,
    type: r.type,
    category: r.category,
    uploadDate: r.upload_date,
    durationSeconds: r.duration_seconds,
    fileSize: r.file_size,
    dimensions: r.dimensions,
    aspectRatio: r.aspect_ratio || (r.dimensions && r.dimensions.includes('1080 × 1920') ? '9:16' : '16:9'),
    thumbnailUrl: r.thumbnail_url || r.file_url,
    fileUrl: r.file_url,
    accentTone: r.accent_tone,
    uploadedBy: r.uploaded_by,
    description: r.description,
  }));
}

export async function listPlaylists() {
  const [playlists] = await pool.query('SELECT * FROM playlists ORDER BY created_at DESC');
  const [items] = await pool.query('SELECT * FROM playlist_items ORDER BY order_index ASC');
  const [screens] = await pool.query('SELECT id, assigned_playlist_id FROM screens');
  const byPlaylist = new Map();
  for (const it of items) {
    if (!byPlaylist.has(it.playlist_id)) byPlaylist.set(it.playlist_id, []);
    byPlaylist.get(it.playlist_id).push({
      id: it.id,
      mediaId: it.media_id,
      order: it.order_index,
      displayDurationSeconds: it.display_duration_seconds,
      muteAudio: Boolean(it.mute_audio),
      loopVideo: Boolean(it.loop_video),
    });
  }
  return playlists.map((pl) => ({
    id: pl.id,
    name: pl.name,
    description: pl.description || '',
    items: byPlaylist.get(pl.id) || [],
    assignedScreenIds: screens.filter((s) => s.assigned_playlist_id === pl.id).map((s) => s.id),
    lastUpdated: pl.last_updated || '',
    status: pl.status,
    defaultImageDuration: pl.default_image_duration,
    autoAdvanceVideo: Boolean(pl.auto_advance_video),
    loopPlaylist: Boolean(pl.loop_playlist),
  }));
}

export async function listCampaigns() {
  const [campaigns] = await pool.query('SELECT * FROM campaigns ORDER BY created_at DESC');
  const [targets] = await pool.query('SELECT * FROM campaign_targets');
  return campaigns.map((c) => {
    const mine = targets.filter((t) => t.campaign_id === c.id);
    return {
      id: c.id,
      name: c.name,
      description: c.description || '',
      playlistId: c.playlist_id,
      startDate: c.start_date,
      endDate: c.end_date,
      startTime: c.start_time,
      endTime: c.end_time,
      targetScreenIds: mine.filter((t) => t.target_type === 'screen').map((t) => t.target_id),
      targetGroupIds: mine.filter((t) => t.target_type === 'group').map((t) => t.target_id),
      status: c.status,
      priority: c.priority,
      createdBy: c.created_by,
      qrUrl: c.qr_url || '',
      qrLabel: c.qr_label || '',
    };
  });
}

export async function listGroups() {
  const [groups] = await pool.query('SELECT * FROM screen_groups ORDER BY created_at DESC');
  const [items] = await pool.query('SELECT * FROM screen_group_items');
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    building: g.building,
    floor: g.floor,
    description: g.description || '',
    screenIds: items.filter((it) => it.group_id === g.id).map((it) => it.screen_id),
    assignedPlaylistId: g.assigned_playlist_id,
  }));
}

export async function getSettings() {
  const [rows] = await pool.query('SELECT settings_json FROM university_settings WHERE id=1');
  if (rows.length === 0) return null;
  const raw = rows[0].settings_json;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

export function serializeUser(r) {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    department: r.department,
    role: r.role,
    allowedMenus: parseAllowedMenus(r.allowed_menus, r.role),
    status: r.status,
    lastLogin: r.last_login,
    avatarUrl: r.avatar_url,
  };
}
