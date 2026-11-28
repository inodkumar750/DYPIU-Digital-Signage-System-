import { pool } from '../db.js';
import { config } from '../config.js';
import { deriveConnection } from '../utils/heartbeat.js';
import { zonedNow } from '../utils/schedule.js';
import { getSettings } from './serializers.js';
import { logActivity } from './audit.js';

const offlineSince = new Map(); // screenId -> ms when first seen offline
const alerted = new Set(); // screenIds already alerted

async function sendAlert(text) {
  console.warn(`🚨 ${text}`);
  if (!config.alertWebhookUrl) return;
  try {
    await fetch(config.alertWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }), // Slack / Teams / Discord-compatible "text" payload
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.warn('Alert webhook failed:', err.message);
  }
}

/** Persists connection state (only rows that changed) and raises offline / recovery alerts. */
export async function sweepScreens() {
  const [rows] = await pool.query('SELECT id, name, is_active, last_heartbeat, connection_status, last_seen FROM screens');
  const settings = (await getSettings()) || {};
  const notifyMs = Math.max(1, Number(settings.notifyOfflineMinutes) || 10) * 60_000;
  const nowMs = Date.now();

  for (const r of rows) {
    const live = deriveConnection(r, nowMs);
    if (r.connection_status !== live.connectionStatus || r.last_seen !== live.lastSeen) {
      await pool.query('UPDATE screens SET connection_status=?, last_seen=? WHERE id=?', [live.connectionStatus, live.lastSeen, r.id]);
    }
    const expectedOnline = Boolean(r.is_active);
    if (expectedOnline && live.connectionStatus === 'Offline') {
      if (!offlineSince.has(r.id)) offlineSince.set(r.id, nowMs);
      if (nowMs - offlineSince.get(r.id) >= notifyMs && !alerted.has(r.id) && settings.emailAlertsEnabled !== false) {
        alerted.add(r.id);
        const msg = `Screen "${r.name}" (${r.id}) has been offline for more than ${Math.round(notifyMs / 60000)} minutes.`;
        await logActivity('alert', 'Screen offline', msg);
        await sendAlert(msg);
      }
    } else {
      if (alerted.has(r.id)) {
        const msg = `Screen "${r.name}" (${r.id}) is back online.`;
        await logActivity('alert', 'Screen recovered', msg);
        await sendAlert(msg);
      }
      offlineSince.delete(r.id);
      alerted.delete(r.id);
    }
  }
}

/** Marks expired campaigns Completed and promotes Scheduled campaigns that have started to Active. */
export async function refreshCampaignStatuses() {
  const today = zonedNow(config.timezone).date;
  await pool.query("UPDATE campaigns SET status='Completed' WHERE status IN ('Active','Scheduled') AND end_date < ?", [today]);
  await pool.query("UPDATE campaigns SET status='Active' WHERE status='Scheduled' AND start_date <= ? AND end_date >= ?", [today, today]);
}

export async function pruneOldData() {
  await pool.query('DELETE FROM playback_logs WHERE started_at < DATE_SUB(NOW(), INTERVAL 180 DAY)');
  await pool.query('DELETE FROM activity_events WHERE created_at < DATE_SUB(NOW(), INTERVAL 365 DAY)');
  await pool.query('DELETE FROM pairing_requests WHERE expires_at < NOW()');
  await pool.query('DELETE FROM device_commands WHERE created_at < DATE_SUB(NOW(), INTERVAL 14 DAY)');
}

export function startBackgroundJobs() {
  const safe = (name, fn) => () => fn().catch((err) => console.warn(`[${name}]`, err.message));
  const timers = [
    setInterval(safe('sweepScreens', sweepScreens), 15_000),
    setInterval(safe('campaignStatus', refreshCampaignStatuses), 60_000),
    setInterval(safe('prune', pruneOldData), 6 * 3600_000),
  ];
  timers.forEach((t) => t.unref?.());
  safe('campaignStatus', refreshCampaignStatuses)();
  safe('sweepScreens', sweepScreens)();
  return () => timers.forEach(clearInterval);
}
