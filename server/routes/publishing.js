import { Router } from 'express';
import { pool, withTx } from '../db.js';
import { requireMenu } from '../middleware/auth.js';
import { asyncHandler, badRequest, idList, newId, notFound, str } from '../utils/http.js';
import { deriveConnection, formatTimestamp } from '../utils/heartbeat.js';

const router = Router();

function safeJson(raw) {
  try {
    const v = JSON.parse(raw || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

const handleGetJobs = asyncHandler(async (req, res) => {
  const [jobs] = await pool.query('SELECT * FROM publish_jobs ORDER BY created_at DESC LIMIT 500');
  res.json({
    success: true,
    data: jobs.map((j) => ({
      id: j.id,
      campaignId: j.campaign_id,
      campaignName: j.campaign_name,
      playlistId: j.playlist_id,
      playlistName: j.playlist_name,
      targetScreenIds: safeJson(j.target_screen_ids),
      publicationDate: j.publication_date,
      status: j.status,
      successCount: j.success_count,
      failedCount: j.failed_count,
      progressPct: j.progress_pct,
      initiatedBy: j.initiated_by,
      errorMessage: j.error_message,
    })),
  });
});

router.get('/jobs', handleGetJobs);
router.get('/', handleGetJobs);

/**
 * Dispatch a campaign:
 *  - validates the campaign/playlist/targets against the database (never trusts names from the browser),
 *  - expands group targets to screens,
 *  - activates the campaign so the server-side schedule resolver serves it to the TVs,
 *  - sets the playlist as the base playlist of the target screens,
 *  - counts OFFLINE screens as "queued" (they pick everything up on their next manifest fetch) — not as failures.
 */
router.post(
  '/dispatch',
  requireMenu('publishing'),
  asyncHandler(async (req, res) => {
    const campaignId = str(req.body?.campaignId, { field: 'campaignId', max: 50, required: true });
    const overrideScreens = idList(req.body?.targetScreenIds, 'targetScreenIds');

    const result = await withTx(async (conn) => {
      const [camps] = await conn.query('SELECT * FROM campaigns WHERE id=? FOR UPDATE', [campaignId]);
      if (camps.length === 0) throw notFound('Campaign not found');
      const camp = camps[0];
      const [pls] = await conn.query('SELECT id, name FROM playlists WHERE id=?', [camp.playlist_id]);
      if (pls.length === 0) throw badRequest('The campaign playlist no longer exists.');

      const [targets] = await conn.query('SELECT target_type, target_id FROM campaign_targets WHERE campaign_id=?', [campaignId]);
      const ids = new Set(overrideScreens);
      for (const t of targets) if (t.target_type === 'screen') ids.add(t.target_id);
      const groupIds = targets.filter((t) => t.target_type === 'group').map((t) => t.target_id);
      if (groupIds.length > 0) {
        const [members] = await conn.query('SELECT screen_id FROM screen_group_items WHERE group_id IN (?)', [groupIds]);
        members.forEach((m) => ids.add(m.screen_id));
      }
      const screenIds = [...ids];
      if (screenIds.length === 0) throw badRequest('This campaign has no target screens.');

      const [screens] = await conn.query('SELECT id, is_active, last_heartbeat FROM screens WHERE id IN (?)', [screenIds]);
      const known = new Set(screens.map((s) => s.id));
      const online = screens.filter((s) => deriveConnection(s).connectionStatus === 'Online').length;
      const queued = screens.length - online;
      const missing = screenIds.filter((s) => !known.has(s)).length;
      if (screens.length === 0) throw badRequest('None of the target screens exist anymore.');

      await conn.query('UPDATE screens SET assigned_playlist_id=? WHERE id IN (?)', [camp.playlist_id, [...known]]);
      if (camp.status === 'Scheduled' || camp.status === 'Draft') {
        await conn.query("UPDATE campaigns SET status='Active' WHERE id=?", [campaignId]);
      }

      const jobId = newId('pub');
      const notes = [];
      if (queued > 0) notes.push(`${queued} screen(s) offline — content will apply when they reconnect`);
      if (missing > 0) notes.push(`${missing} target screen(s) no longer exist and were skipped`);
      await conn.query(
        `INSERT INTO publish_jobs (id, campaign_id, campaign_name, playlist_id, playlist_name, target_screen_ids, publication_date,
           status, success_count, failed_count, progress_pct, initiated_by, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Published', ?, ?, 100, ?, ?)`,
        [
          jobId,
          camp.id,
          camp.name,
          pls[0].id,
          pls[0].name,
          JSON.stringify([...known]),
          formatTimestamp(Date.now()).slice(0, 16),
          online,
          missing,
          req.user.name,
          notes.length ? notes.join('; ') : null,
        ]
      );
      return { jobId, online, queued, missing };
    });

    res.json({
      success: true,
      jobId: result.jobId,
      status: 'Published',
      onlineCount: result.online,
      offlineCount: result.queued,
      message: `Content dispatched: ${result.online} screen(s) updated now, ${result.queued} queued for reconnect`,
    });
  })
);

export default router;
