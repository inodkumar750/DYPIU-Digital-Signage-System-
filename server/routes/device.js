import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';
import { config } from '../config.js';
import { deviceAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError, notFound } from '../utils/http.js';
import { pickLiveCampaign, zonedNow } from '../utils/schedule.js';
import { publicBaseUrl, toDeviceUrl } from '../utils/network.js';
import { rateLimitMiddleware } from '../utils/rateLimit.js';
import { pairingStatus, startPairing } from '../services/pairing.js';
import { ackCommands, takePending } from '../services/commands.js';
import { cleanIp } from '../utils/commands.js';
import { getOsConfig, publicOsConfig } from '../services/osConfig.js';
import { getSettings, listCampaigns, listGroups, listMedia, listPlaylists, listScreens } from '../services/serializers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

const sha1 = (v) => crypto.createHash('sha1').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex').slice(0, 16);

/* ───────────────────────── OTA ───────────────────────── */

const apkPath = path.join(__dirname, '..', '..', 'public', 'NEXORA-TV.apk');
const otaMetaPath = path.join(__dirname, '..', 'ota.json');
let apkHashCache = { mtimeMs: 0, sha256: '' };

function apkSha256() {
  try {
    const st = fs.statSync(apkPath);
    if (st.mtimeMs !== apkHashCache.mtimeMs) {
      apkHashCache = { mtimeMs: st.mtimeMs, sha256: crypto.createHash('sha256').update(fs.readFileSync(apkPath)).digest('hex') };
    }
    return apkHashCache.sha256;
  } catch {
    return '';
  }
}

function otaMeta() {
  try {
    const m = JSON.parse(fs.readFileSync(otaMetaPath, 'utf8'));
    return { versionCode: Number(m.versionCode) || 1, versionName: String(m.versionName || '1.0.0') };
  } catch {
    return { versionCode: 1, versionName: '1.0.0' };
  }
}

router.get('/app-version', (req, res) => {
  const sha256 = apkSha256();
  res.json({
    success: true,
    ...otaMeta(),
    apkUrl: sha256 ? `${publicBaseUrl(req)}/NEXORA-TV.apk` : '',
    sha256, // the Android app refuses to install an APK whose hash does not match
  });
});

/* ───────────────────────── Pairing (TV side) ───────────────────────── */

const pairLimiter = rateLimitMiddleware({ windowMs: 60_000, max: 30 });

router.post(
  '/pair/start',
  pairLimiter,
  asyncHandler(async (req, res) => {
    res.json({ success: true, ...(await startPairing(cleanIp(req.ip), req.headers['user-agent'])) });
  })
);

router.get(
  '/pair/status/:code',
  pairLimiter,
  asyncHandler(async (req, res) => {
    res.json({ success: true, ...(await pairingStatus(String(req.params.code).toUpperCase().slice(0, 10))) });
  })
);

/* ───────────────────────── DYPIU OS (home screen settings) ───────────────────────── */

router.get(
  '/os-config',
  asyncHandler(async (req, res) => {
    const platform = req.query.platform === 'android' ? 'android' : 'webos';
    res.json({ success: true, config: publicOsConfig(await getOsConfig(), platform) });
  })
);

const pinLimiter = rateLimitMiddleware({ windowMs: 60_000, max: 8 });
/** Staff menu on the TV: the PIN is checked here so it never has to be stored on the device. */
router.post(
  '/staff-pin',
  pinLimiter,
  asyncHandler(async (req, res) => {
    const cfg = await getOsConfig();
    const given = String(req.body?.pin || '');
    const ok = given.length === cfg.staffPin.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(cfg.staffPin));
    res.json({ success: true, ok });
  })
);

/* ───────────────────────── Per-screen endpoints ───────────────────────── */

router.get(
  '/:screenId/wake-status',
  deviceAuth,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT is_active, wake_requested FROM screens WHERE id=?', [req.params.screenId]);
    if (rows.length === 0) throw notFound('Screen not registered');
    res.json({ success: true, isActive: Boolean(rows[0].is_active), wakeRequested: Boolean(rows[0].wake_requested) });
  })
);

/** Decides what a screen must play right now and why. Shared by the manifest and the feed. */
async function resolvePlayback(screen) {
  const now = zonedNow(config.timezone);
  const [campaignRows] = await pool.query(
    `SELECT DISTINCT c.* FROM campaigns c
       JOIN campaign_targets ct ON ct.campaign_id = c.id
       LEFT JOIN screen_group_items sgi ON ct.target_type = 'group' AND sgi.group_id = ct.target_id
      WHERE c.status IN ('Active', 'Scheduled')
        AND c.start_date <= ? AND c.end_date >= ?
        AND ((ct.target_type = 'screen' AND ct.target_id = ?) OR sgi.screen_id = ?)`,
    [now.date, now.date, screen.id, screen.id]
  );
  const live = pickLiveCampaign(campaignRows, now);
  if (live) return { playlistId: live.playlist_id, source: 'campaign', campaign: live, now };
  if (screen.assigned_playlist_id) return { playlistId: screen.assigned_playlist_id, source: 'screen', campaign: null, now };
  const [groupRows] = await pool.query(
    `SELECT sg.assigned_playlist_id FROM screen_groups sg
       JOIN screen_group_items sgi ON sgi.group_id = sg.id
      WHERE sgi.screen_id = ? AND sg.assigned_playlist_id IS NOT NULL LIMIT 1`,
    [screen.id]
  );
  if (groupRows[0]) return { playlistId: groupRows[0].assigned_playlist_id, source: 'group', campaign: null, now };
  return { playlistId: null, source: 'none', campaign: null, now };
}

async function qrFor(screen, now) {
  const [rows] = await pool.query(
    `SELECT DISTINCT c.* FROM campaigns c
       JOIN campaign_targets ct ON ct.campaign_id = c.id
       LEFT JOIN screen_group_items sgi ON ct.target_type = 'group' AND sgi.group_id = ct.target_id
      WHERE c.status IN ('Active', 'Scheduled') AND c.start_date <= ? AND c.end_date >= ?
        AND c.qr_url IS NOT NULL AND c.qr_url != ''
        AND ((ct.target_type = 'screen' AND ct.target_id = ?) OR sgi.screen_id = ?)
      ORDER BY FIELD(c.priority,'Urgent','High','Normal') ASC LIMIT 1`,
    [now.date, now.date, screen.id, screen.id]
  );
  const c = rows[0];
  if (!c?.qr_url) return null;
  try {
    const dataUrl = await QRCode.toDataURL(String(c.qr_url).trim(), { width: 240, margin: 1, color: { dark: '#111827', light: '#FFFFFF' } });
    return { url: String(c.qr_url).trim(), label: (c.qr_label && String(c.qr_label).trim()) || 'Scan QR Code', dataUrl };
  } catch {
    return null;
  }
}

/**
 * Authoritative manifest for a TV. Supports ETag / If-None-Match so unchanged playlists cost a tiny 304.
 */
router.get(
  '/:screenId/manifest',
  deviceAuth,
  asyncHandler(async (req, res) => {
    const { screenId } = req.params;
    const [screens] = await pool.query('SELECT * FROM screens WHERE id=?', [screenId]);
    if (screens.length === 0) throw notFound('Screen not registered');
    const screen = screens[0];

    // A manifest fetch proves the TV is alive (clears the wake flag, refreshes liveness).
    if (screen.is_active) {
      await pool.query("UPDATE screens SET connection_status='Online', last_seen='Just now', last_heartbeat=?, wake_requested=0 WHERE id=?", [
        new Date().toISOString(),
        screenId,
      ]);
    }

    const showTvTicker = ((await getSettings()) || {}).showTvTicker !== false;
    let body;
    if (!screen.is_active) {
      body = { success: true, screenId, isActive: false, showTvTicker, standbyMessage: 'Screen in scheduled standby mode', playlist: null };
    } else {
      const play = await resolvePlayback(screen);
      const base = { success: true, screenId, screenName: screen.name, building: screen.building, floor: screen.floor, isActive: true, showTvTicker };
      if (!play.playlistId) {
        body = { ...base, source: 'none', playlist: null };
      } else {
        const [pls] = await pool.query('SELECT * FROM playlists WHERE id=?', [play.playlistId]);
        const playlist = pls[0] || { id: play.playlistId, name: 'Default Loop', default_image_duration: 10 };
        const [items] = await pool.query(
          `SELECT pi.id AS item_id, pi.order_index, pi.display_duration_seconds, pi.mute_audio, pi.loop_video,
                  ma.id AS media_id, ma.title, ma.type, ma.duration_seconds, ma.file_url, ma.thumbnail_url
             FROM playlist_items pi JOIN media_assets ma ON pi.media_id = ma.id
            WHERE pi.playlist_id = ? ORDER BY pi.order_index ASC`,
          [play.playlistId]
        );
        const baseUrl = publicBaseUrl(req);
        const slides = items.map((it) => ({
          slideId: it.item_id,
          mediaId: it.media_id,
          title: it.title,
          type: it.type,
          order: it.order_index,
          durationSeconds: it.type === 'Video' ? it.duration_seconds || 30 : it.display_duration_seconds,
          muteAudio: Boolean(it.mute_audio),
          loopVideo: Boolean(it.loop_video),
          downloadUrl: toDeviceUrl(it.file_url || it.thumbnail_url || '', baseUrl),
        }));
        body = {
          ...base,
          source: play.source, // 'campaign' | 'screen' | 'group' — tells admins WHY this is playing
          campaignId: play.campaign?.id || null,
          campaignName: play.campaign?.name || null,
          campaignQr: await qrFor(screen, play.now),
          playlist: { id: playlist.id, name: playlist.name, totalSlides: slides.length, slides },
        };
      }
    }

    const etag = `"${sha1(body)}"`;
    res.set('ETag', etag);
    res.set('Cache-Control', 'no-cache');
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    res.json({ ...body, syncTimestamp: new Date().toISOString(), version: etag.replace(/"/g, '') });
  })
);

/**
 * Lightweight data feed for the browser/kiosk player — replaces the old "poll 6 admin endpoints every 3 s".
 * `?v=<version>` returns {unchanged:true} when nothing relevant changed.
 */
router.get(
  '/:screenId/feed',
  deviceAuth,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT id FROM screens WHERE id=?', [req.params.screenId]);
    if (rows.length === 0) throw notFound('Screen not registered');

    const [screens, playlists, media, campaigns, groups, settings] = await Promise.all([
      listScreens(),
      listPlaylists(),
      listMedia(),
      listCampaigns(),
      listGroups(),
      getSettings(),
    ]);
    // Telemetry that changes every heartbeat must not invalidate the version.
    const stable = screens.map(({ lastSeen, lastHeartbeat, currentMediaId, storageUsedPct, ipAddress, connectionStatus, playbackError, ...rest }) => rest);
    const version = sha1({ stable, playlists, media, campaigns, groups, settings });
    if (req.query.v === version) return res.json({ success: true, unchanged: true, version });
    res.json({ success: true, version, data: { screens, playlists, media, campaigns, groups, settings } });
  })
);

/** Heartbeat from the player. Validated, and unknown screens are rejected instead of silently ignored. */
router.post(
  '/:screenId/heartbeat',
  deviceAuth,
  asyncHandler(async (req, res) => {
    const { screenId } = req.params;
    const b = req.body || {};
    const [rows] = await pool.query('SELECT id, is_active, current_media_id FROM screens WHERE id=?', [screenId]);
    if (rows.length === 0) throw notFound('Screen not registered');

    const num = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.min(100, Math.max(0, Math.round(Number(v)))) : null);
    const text = (v, max) => (v === undefined || v === null || v === '' ? null : String(v).slice(0, max));
    const mediaId = text(b.currentMediaId, 50);
    const now = new Date().toISOString();
    const active = Boolean(rows[0].is_active);

    await pool.query(
      `UPDATE screens SET
         connection_status = ?, last_seen = ?, last_heartbeat = ?, wake_requested = 0,
         current_media_id = ?, storage_used_pct = COALESCE(?, storage_used_pct),
         player_app_version = COALESCE(?, player_app_version), playback_error = ?, ip_address = COALESCE(?, ip_address)
       WHERE id = ?`,
      [
        active ? 'Online' : 'Offline',
        active ? 'Just now' : 'Turned Off (Standby)',
        now,
        mediaId,
        num(b.storageUsedPct),
        text(b.playerAppVersion, 50),
        text(b.playbackError, 1000),
        cleanIp(req.ip) || text(b.ipAddress, 50),
        screenId,
      ]
    );

    // Proof-of-play: one row each time the visible media changes.
    if (mediaId && mediaId !== rows[0].current_media_id) {
      pool.query('INSERT INTO playback_logs (screen_id, media_id) VALUES (?, ?)', [screenId, mediaId]).catch(() => {});
    }
    await ackCommands(screenId, b.ackCommands);
    const commands = active ? await takePending(screenId) : [];
    res.json({ success: true, timestamp: now, ack: 'heartbeat_received', commands });
  })
);

export default router;
