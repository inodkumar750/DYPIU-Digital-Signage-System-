import { pool } from '../db.js';
import { newId } from '../utils/http.js';
import { formatTimestamp } from '../utils/heartbeat.js';

export async function logActivity(actionType, title, detail, actor = 'system') {
  try {
    await pool.query(
      'INSERT INTO activity_events (id, action_type, title, detail, actor, `timestamp`) VALUES (?, ?, ?, ?, ?, ?)',
      [newId('act'), String(actionType).slice(0, 30), String(title).slice(0, 255), String(detail || ''), String(actor).slice(0, 150), formatTimestamp(Date.now())]
    );
  } catch (err) {
    console.warn('Audit log write failed:', err.message);
  }
}

const MODULE_BY_SEGMENT = {
  screens: 'screen',
  media: 'upload',
  playlists: 'playlist',
  campaigns: 'campaign',
  groups: 'group',
  publishing: 'publish',
  users: 'user',
  settings: 'settings',
};

/** Express middleware: records every successful mutating request made by a signed-in user. */
export function auditMutations(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
      const segment = req.baseUrl.split('/').filter(Boolean).pop() || 'api';
      logActivity(
        MODULE_BY_SEGMENT[segment] || segment,
        `${req.method} ${req.baseUrl}${req.path}`.replace('/api/v1', ''),
        `status ${res.statusCode}`,
        req.user.name
      );
    }
  });
  next();
}
