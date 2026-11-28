import { pool } from '../db.js';
import { DONE_ON_DELIVERY } from '../utils/commands.js';

/** Queues one command row per screen. Returns how many screens got it and the ids that do not exist. */
export async function enqueueCommand({ screenIds, command, payload, ttlSec, actor }) {
  const [known] = await pool.query('SELECT id FROM screens WHERE id IN (?)', [screenIds]);
  const knownIds = known.map((r) => r.id);
  const unknown = screenIds.filter((id) => !knownIds.includes(id));
  if (knownIds.length === 0) return { queued: 0, unknown };

  // A newer message / clear replaces any older message that has not been shown yet.
  if (command === 'message' || command === 'clear_message') {
    await pool.query(
      "UPDATE device_commands SET status='expired' WHERE status IN ('pending','sent') AND command IN ('message','clear_message') AND screen_id IN (?)",
      [knownIds]
    );
  }

  // Expiry is computed by the database so it always agrees with the NOW() used when delivering.
  const json = payload ? JSON.stringify(payload) : null;
  const tuple = '(?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))';
  const params = knownIds.flatMap((id) => [id, command, json, 'pending', String(actor || '').slice(0, 100), ttlSec]);
  await pool.query(
    `INSERT INTO device_commands (screen_id, command, payload, status, created_by, expires_at) VALUES ${knownIds.map(() => tuple).join(', ')}`,
    params
  );
  return { queued: knownIds.length, unknown };
}

/** Records a command the server executed itself (standby / resume) so it shows up in the history. */
export async function recordDone({ screenIds, command, actor }) {
  if (screenIds.length === 0) return;
  const tuple = "(?, ?, NULL, 'done', ?, NOW(), NOW())";
  const params = screenIds.flatMap((id) => [id, command, String(actor || '').slice(0, 100)]);
  await pool.query(
    `INSERT INTO device_commands (screen_id, command, payload, status, created_by, expires_at, done_at) VALUES ${screenIds.map(() => tuple).join(', ')}`,
    params
  );
}

/** Called from the heartbeat: hands the screen its pending commands exactly once. */
export async function takePending(screenId) {
  const [rows] = await pool.query(
    "SELECT id, command, payload FROM device_commands WHERE screen_id=? AND status='pending' AND expires_at >= NOW() ORDER BY id ASC LIMIT 20",
    [screenId]
  );
  if (rows.length === 0) return [];
  const done = rows.filter((r) => DONE_ON_DELIVERY.has(r.command)).map((r) => r.id);
  const sent = rows.filter((r) => !DONE_ON_DELIVERY.has(r.command)).map((r) => r.id);
  if (sent.length) await pool.query("UPDATE device_commands SET status='sent', sent_at=NOW() WHERE id IN (?)", [sent]);
  if (done.length) await pool.query("UPDATE device_commands SET status='done', sent_at=NOW(), done_at=NOW() WHERE id IN (?)", [done]);
  return rows.map((r) => {
    let payload = null;
    try {
      payload = r.payload ? JSON.parse(r.payload) : null;
    } catch {
      /* ignore malformed payload */
    }
    return { id: r.id, command: r.command, payload };
  });
}

export async function ackCommands(screenId, ids) {
  const clean = (Array.isArray(ids) ? ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 50);
  if (clean.length === 0) return;
  await pool.query("UPDATE device_commands SET status='done', done_at=NOW() WHERE screen_id=? AND status='sent' AND id IN (?)", [screenId, clean]);
}

export async function recentCommands(limit = 60) {
  await pool.query("UPDATE device_commands SET status='expired' WHERE status='pending' AND expires_at < NOW()");
  const [rows] = await pool.query(
    `SELECT dc.id, dc.screen_id, s.name AS screen_name, dc.command, dc.payload, dc.status, dc.created_by,
            dc.created_at, dc.sent_at, dc.done_at
       FROM device_commands dc LEFT JOIN screens s ON s.id = dc.screen_id
      ORDER BY dc.id DESC LIMIT ?`,
    [limit]
  );
  return rows.map((r) => {
    let text = '';
    try {
      text = r.payload ? JSON.parse(r.payload).text || '' : '';
    } catch {
      /* ignore */
    }
    return {
      id: r.id,
      screenId: r.screen_id,
      screenName: r.screen_name || r.screen_id,
      command: r.command,
      text,
      status: r.status,
      createdBy: r.created_by,
      createdAt: r.created_at,
      deliveredAt: r.sent_at,
      doneAt: r.done_at,
    };
  });
}
