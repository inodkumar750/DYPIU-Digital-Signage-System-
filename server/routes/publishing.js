import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

// GET all publish jobs (supports both / and /jobs)
const handleGetJobs = async (req, res) => {
  try {
    const [jobs] = await pool.query('SELECT * FROM publish_jobs ORDER BY created_at DESC');
    const result = jobs.map((j) => ({
      id: j.id,
      campaignId: j.campaign_id,
      campaignName: j.campaign_name,
      playlistId: j.playlist_id,
      playlistName: j.playlist_name,
      targetScreenIds: JSON.parse(j.target_screen_ids || '[]'),
      publicationDate: j.publication_date,
      status: j.status,
      successCount: j.success_count,
      failedCount: j.failed_count,
      progressPct: j.progress_pct,
      initiatedBy: j.initiated_by,
      errorMessage: j.error_message,
    }));
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

router.get('/jobs', handleGetJobs);
router.get('/', handleGetJobs);

// POST dispatch content bundle
router.post('/dispatch', async (req, res) => {
  try {
    const { campaignId, campaignName, playlistId, playlistName, targetScreenIds, initiatedBy } = req.body;
    const jobId = `pub-${Date.now().toString().slice(-4)}`;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);

    // Check which screens are online vs offline
    const [screens] = await pool.query('SELECT id, connection_status FROM screens');
    const screenMap = new Map(screens.map((s) => [s.id, s.connection_status]));

    let onlineCount = 0;
    let offlineCount = 0;
    const targets = Array.isArray(targetScreenIds) ? targetScreenIds : [];

    targets.forEach((sid) => {
      if (screenMap.get(sid) === 'Online') {
        onlineCount++;
      } else {
        offlineCount++;
      }
    });

    const status = offlineCount > 0 ? 'Failed' : 'Published';
    const errorMsg = offlineCount > 0 ? `${offlineCount} target screen(s) currently offline` : null;

    await pool.query(
      `INSERT INTO publish_jobs (id, campaign_id, campaign_name, playlist_id, playlist_name, target_screen_ids, publication_date, status, success_count, failed_count, progress_pct, initiated_by, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 100, ?, ?)`,
      [jobId, campaignId, campaignName, playlistId, playlistName, JSON.stringify(targets), now, status, onlineCount, offlineCount, initiatedBy || 'Vinod Kumar Jain', errorMsg]
    );

    // Update assigned playlist on targeted online screens
    if (targets.length > 0 && playlistId) {
      await pool.query(
        `UPDATE screens SET assigned_playlist_id=? WHERE id IN (?)`,
        [playlistId, targets]
      );
    }

    res.json({
      success: true,
      jobId,
      status,
      onlineCount,
      offlineCount,
      message: `Content dispatched: ${onlineCount} screens updated, ${offlineCount} offline`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
