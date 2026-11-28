import { config } from '../config.js';

/** Parses ISO strings and legacy 'YYYY-MM-DD HH:mm:ss' (treated as UTC) timestamps. */
export function parseHeartbeatMs(raw) {
  if (!raw || typeof raw !== 'string') return NaN;
  const trimmed = raw.trim();
  if (!trimmed) return NaN;
  if (trimmed.includes('T')) return Date.parse(trimmed);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return Date.parse(trimmed.replace(' ', 'T') + 'Z');
  }
  return Date.parse(trimmed);
}

export function formatTimestamp(ms) {
  if (!Number.isFinite(ms)) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ms));
  const g = (t) => parts.find((p) => p.type === t)?.value || '00';
  const hour = g('hour') === '24' ? '00' : g('hour');
  return `${g('year')}-${g('month')}-${g('day')} ${hour}:${g('minute')}:${g('second')}`;
}

export function formatRelativeSeen(ageSec) {
  if (!Number.isFinite(ageSec) || ageSec < 0) return 'Never';
  if (ageSec <= config.heartbeatOfflineSeconds) return 'Just now';
  if (ageSec < 60) return `${ageSec}s ago`;
  const mins = Math.floor(ageSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Derives live connection state purely from the stored row — no DB writes. */
export function deriveConnection(row, nowMs = Date.now()) {
  const isActive = Boolean(row.is_active);
  const hbMs = parseHeartbeatMs(row.last_heartbeat);
  const ageSec = Number.isFinite(hbMs) ? Math.max(0, Math.floor((nowMs - hbMs) / 1000)) : Infinity;
  if (!isActive) return { connectionStatus: 'Offline', lastSeen: 'Turned Off (Standby)', hbMs, ageSec };
  if (Number.isFinite(ageSec) && ageSec <= config.heartbeatOfflineSeconds) {
    return { connectionStatus: 'Online', lastSeen: 'Just now', hbMs, ageSec };
  }
  return { connectionStatus: 'Offline', lastSeen: formatRelativeSeen(ageSec), hbMs, ageSec };
}
