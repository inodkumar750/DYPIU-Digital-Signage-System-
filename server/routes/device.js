import { Router } from 'express';
import QRCode from 'qrcode';
import { pool } from '../db.js';

const router = Router();

/**
 * ANDROID TV OTA VERSION METADATA
 * GET /api/v1/device/app-version
 */
router.get('/app-version', (req, res) => {
  const host = req.protocol + '://' + req.get('host');
  res.json({
    success: true,
    versionCode: 5,
    versionName: '1.0.4',
    apkUrl: `${host}/CampusCast-TV.apk`,
  });
});

/**
 * BACKGROUND SERVICE WAKE-UP CHECK
 * GET /api/v1/device/:screenId/wake-status
 * Checked silently by AutoLaunchService so admin "Reconnect / Wake" can reopen closed player
 */
router.get('/:screenId/wake-status', async (req, res) => {
  try {
    const { screenId } = req.params;
    const [rows] = await pool.query('SELECT is_active, wake_requested FROM screens WHERE id=?', [screenId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Screen not registered' });
    }
    res.json({
      success: true,
      isActive: Boolean(rows[0].is_active),
      wakeRequested: Boolean(rows[0].wake_requested),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ANDROID TV PLAYER SYNC MANIFEST
 * GET /api/v1/device/:screenId/manifest
 * Any Android TV calls this endpoint on boot or upon sync notification.
 * Returns: TV details, active playlist, list of media files, durations, and download URLs.
 */
router.get('/:screenId/manifest', async (req, res) => {
  try {
    const { screenId } = req.params;

    // 1. Get screen info
    const [screens] = await pool.query('SELECT * FROM screens WHERE id=?', [screenId]);
    if (screens.length === 0) {
      return res.status(404).json({ success: false, error: 'Screen not registered' });
    }
    const screen = screens[0];

    // If screen is marked inactive / standby
    if (!screen.is_active) {
      return res.json({
        success: true,
        screenId,
        isActive: false,
        standbyMessage: 'Screen in scheduled standby mode',
        playlist: null,
      });
    }

    // Keep live heartbeat updated while screen is actively polling manifest & clear wake flag
    await pool.query(
      "UPDATE screens SET connection_status='Online', last_seen='Just now', last_heartbeat=?, wake_requested=0 WHERE id=?",
      [new Date().toISOString(), screenId]
    );

    // 2. Check if an Active/Scheduled campaign is currently inside its date + daily time window for this screen
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const [campaignRows] = await pool.query(
      `SELECT DISTINCT c.* FROM campaigns c
       JOIN campaign_targets ct ON ct.campaign_id = c.id
       LEFT JOIN screen_group_items sgi ON ct.target_type = 'group' AND sgi.group_id = ct.target_id
       WHERE c.status IN ('Active', 'Scheduled')
         AND c.start_date <= ? AND c.end_date >= ?
         AND ((ct.target_type = 'screen' AND ct.target_id = ?) OR sgi.screen_id = ?)`,
      [todayStr, todayStr, screenId, screenId]
    );

    const priorityRank = { Urgent: 3, High: 2, Normal: 1 };
    const liveCampaigns = campaignRows
      .filter((c) => {
        const s = c.start_time || '00:00';
        const e = c.end_time || '23:59';
        if (s === e) return true;
        if (s < e) return e === '23:59' ? timeStr >= s && timeStr <= e : timeStr >= s && timeStr < e;
        return timeStr >= s || timeStr < e;
      })
      .sort((a, b) => (priorityRank[b.priority] || 1) - (priorityRank[a.priority] || 1));

    const activeCampaign = liveCampaigns[0] || null;
    let groupPlaylistId = null;
    if (!activeCampaign && !screen.assigned_playlist_id) {
      const [groupRows] = await pool.query(
        `SELECT sg.assigned_playlist_id
         FROM screen_groups sg
         JOIN screen_group_items sgi ON sgi.group_id = sg.id
         WHERE sgi.screen_id = ? AND sg.assigned_playlist_id IS NOT NULL
         LIMIT 1`,
        [screenId]
      );
      groupPlaylistId = groupRows[0]?.assigned_playlist_id || null;
    }
    const playlistId =
      activeCampaign?.playlist_id || screen.assigned_playlist_id || groupPlaylistId;
    if (!playlistId) {
      return res.json({
        success: true,
        screenId,
        screenName: screen.name,
        isActive: true,
        playlist: null,
      });
    }
    const [playlists] = await pool.query('SELECT * FROM playlists WHERE id=?', [playlistId]);
    const playlist = playlists[0] || { id: playlistId, name: 'Default Loop', default_image_duration: 10 };

    // 3. Get ordered playlist items and media details
    const [items] = await pool.query(
      `SELECT pi.id as item_id, pi.order_index, pi.display_duration_seconds, pi.mute_audio, pi.loop_video,
              ma.id as media_id, ma.file_name, ma.title, ma.type, ma.duration_seconds, ma.file_size, ma.file_url, ma.thumbnail_url
       FROM playlist_items pi
       JOIN media_assets ma ON pi.media_id = ma.id
       WHERE pi.playlist_id = ?
       ORDER BY pi.order_index ASC`,
      [playlistId]
    );

    const host = req.protocol + '://' + req.get('host');

    const slides = items.map((it) => ({
      slideId: it.item_id,
      mediaId: it.media_id,
      title: it.title,
      type: it.type, // 'Image' or 'Video'
      order: it.order_index,
      durationSeconds: it.type === 'Video' ? (it.duration_seconds || 30) : it.display_duration_seconds,
      muteAudio: Boolean(it.mute_audio),
      loopVideo: Boolean(it.loop_video),
      // Full download URL for Android TV caching engine
      downloadUrl: it.file_url?.startsWith('http') ? it.file_url : `${host}${it.file_url || it.thumbnail_url}`,
    }));

    let campaignQr = null;
    if (activeCampaign?.qr_url && String(activeCampaign.qr_url).trim()) {
      const qrText = String(activeCampaign.qr_url).trim();
      try {
        const dataUrl = await QRCode.toDataURL(qrText, {
          width: 240,
          margin: 1,
          color: { dark: '#111827', light: '#FFFFFF' },
        });
        campaignQr = {
          url: qrText,
          label: (activeCampaign.qr_label && String(activeCampaign.qr_label).trim()) || 'Scan QR Code',
          dataUrl,
        };
      } catch {
        campaignQr = null;
      }
    }

    res.json({
      success: true,
      screenId,
      screenName: screen.name,
      building: screen.building,
      floor: screen.floor,
      isActive: true,
      syncTimestamp: new Date().toISOString(),
      campaignQr,
      playlist: {
        id: playlist.id,
        name: playlist.name,
        totalSlides: slides.length,
        slides,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ANDROID TV PLAYER HEARTBEAT INGESTION
 * POST /api/v1/device/:screenId/heartbeat
 * Android TV calls this every 30-60 seconds.
 */
router.post('/:screenId/heartbeat', async (req, res) => {
  try {
    const { screenId } = req.params;
    const { currentMediaId, storageUsedPct, playerAppVersion, playbackError, ipAddress } = req.body;
    const now = new Date().toISOString();

    await pool.query(
      `UPDATE screens 
       SET connection_status=IF(is_active=1, 'Online', 'Offline'), 
           last_seen=IF(is_active=1, 'Just now', 'Turned Off (Standby)'), 
           last_heartbeat=?, 
           wake_requested=0,
           current_media_id=?, 
           storage_used_pct=COALESCE(?, storage_used_pct), 
           player_app_version=COALESCE(?, player_app_version),
           playback_error=?,
           ip_address=COALESCE(?, ip_address)
       WHERE id=?`,
      [now, currentMediaId || null, storageUsedPct || 40, playerAppVersion || 'v1.4.2', playbackError || null, ipAddress || null, screenId]
    );

    res.json({ success: true, timestamp: now, ack: 'heartbeat_received' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
