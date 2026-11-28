import { Router } from 'express';
import { pool, withTx } from '../db.js';
import { requireMenu } from '../middleware/auth.js';
import {
  asyncHandler,
  badRequest,
  DATE_RE,
  idList,
  newId,
  notFound,
  oneOf,
  str,
  TIME_RE,
} from '../utils/http.js';
import { listCampaigns } from '../services/serializers.js';

const router = Router();
const canEdit = requireMenu('campaigns');

const STATUSES = ['Draft', 'Scheduled', 'Active', 'Paused', 'Completed'];
const PRIORITIES = ['Normal', 'High', 'Urgent'];

function cleanQrUrl(raw) {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (!v) return null;
  if (v.length > 500) throw badRequest('QR link must be at most 500 characters.');
  if (!/^https?:\/\//i.test(v)) throw badRequest('QR link must start with http:// or https://');
  return v;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listCampaigns() });
  })
);

router.post(
  '/',
  canEdit,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const name = str(b.name, { field: 'Campaign name', max: 255, required: true });
    const description = str(b.description, { max: 2000 });
    const playlistId = str(b.playlistId, { field: 'Playlist', max: 50, required: true });
    const startDate = str(b.startDate, { field: 'Start date', required: true });
    const endDate = str(b.endDate, { field: 'End date', required: true });
    const startTime = str(b.startTime, { field: 'Start time', fallback: '00:00' });
    const endTime = str(b.endTime, { field: 'End time', fallback: '23:59' });
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) throw badRequest('Dates must use the YYYY-MM-DD format.');
    if (endDate < startDate) throw badRequest('End date cannot be before the start date.');
    if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) throw badRequest('Times must use the HH:mm 24-hour format.');
    const status = oneOf(b.status, STATUSES, { field: 'Status', fallback: 'Scheduled' });
    const priority = oneOf(b.priority, PRIORITIES, { field: 'Priority', fallback: 'Normal' });
    const screenIds = idList(b.targetScreenIds, 'targetScreenIds');
    const groupIds = idList(b.targetGroupIds, 'targetGroupIds');
    const qrUrl = cleanQrUrl(b.qrUrl);
    const qrLabel = str(b.qrLabel, { max: 120 }) || null;

    const id = await withTx(async (conn) => {
      const [pl] = await conn.query('SELECT id FROM playlists WHERE id=?', [playlistId]);
      if (pl.length === 0) throw badRequest('The selected playlist does not exist.');
      if (screenIds.length > 0) {
        const [f] = await conn.query('SELECT id FROM screens WHERE id IN (?)', [screenIds]);
        if (f.length !== screenIds.length) throw badRequest('One or more target screens no longer exist.');
      }
      if (groupIds.length > 0) {
        const [f] = await conn.query('SELECT id FROM screen_groups WHERE id IN (?)', [groupIds]);
        if (f.length !== groupIds.length) throw badRequest('One or more target groups no longer exist.');
      }
      const cmpId = b.id ? String(b.id).slice(0, 50) : newId('cmp');
      await conn.query(
        `INSERT INTO campaigns (id, name, description, playlist_id, start_date, end_date, start_time, end_time, status, priority, created_by, qr_url, qr_label)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), playlist_id=VALUES(playlist_id),
           start_date=VALUES(start_date), end_date=VALUES(end_date), start_time=VALUES(start_time), end_time=VALUES(end_time),
           status=VALUES(status), priority=VALUES(priority), qr_url=VALUES(qr_url), qr_label=VALUES(qr_label)`,
        [cmpId, name, description, playlistId, startDate, endDate, startTime, endTime, status, priority, req.user.name, qrUrl, qrLabel]
      );
      await conn.query('DELETE FROM campaign_targets WHERE campaign_id=?', [cmpId]);
      const rows = [...screenIds.map((s) => [cmpId, 'screen', s]), ...groupIds.map((g) => [cmpId, 'group', g])];
      if (rows.length > 0) {
        await conn.query('INSERT INTO campaign_targets (campaign_id, target_type, target_id) VALUES ?', [rows]);
      }
      return cmpId;
    });
    res.json({ success: true, id, message: 'Campaign saved successfully' });
  })
);

router.patch(
  '/:id/status',
  canEdit,
  asyncHandler(async (req, res) => {
    const status = oneOf(req.body?.status, STATUSES, { field: 'Status' });
    const [r] = await pool.query('UPDATE campaigns SET status=? WHERE id=?', [status, req.params.id]);
    if (r.affectedRows === 0) throw notFound('Campaign not found');
    res.json({ success: true, message: `Campaign status updated to ${status}` });
  })
);

router.delete(
  '/:id',
  canEdit,
  asyncHandler(async (req, res) => {
    const [r] = await pool.query('DELETE FROM campaigns WHERE id=?', [req.params.id]);
    if (r.affectedRows === 0) throw notFound('Campaign not found');
    res.json({ success: true, message: 'Campaign deleted successfully' });
  })
);

export default router;
