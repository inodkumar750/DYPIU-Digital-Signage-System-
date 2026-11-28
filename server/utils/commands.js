import { badRequest } from './http.js';

/** Commands a screen can receive (delivered through its heartbeat response). */
export const PLAYER_COMMANDS = ['reload', 'identify', 'message', 'clear_message'];
/** Commands the server applies itself (no player involvement). */
export const SERVER_COMMANDS = ['standby', 'resume'];
export const ALL_COMMANDS = [...PLAYER_COMMANDS, ...SERVER_COMMANDS];

/** Reload happens before an ack can be sent, so it is marked done as soon as it is delivered. */
export const DONE_ON_DELIVERY = new Set(['reload', 'clear_message']);

const MAX_MESSAGE = 240;
const MAX_TARGETS = 500;

/**
 * Validates a command request and returns the normalized form stored in the queue.
 * `nowMs` is injectable so the expiry maths can be unit-tested.
 */
export function buildCommand(body, nowMs = Date.now()) {
  const command = String(body?.command || '');
  if (!ALL_COMMANDS.includes(command)) {
    throw badRequest(`Unknown command. Use one of: ${ALL_COMMANDS.join(', ')}.`);
  }

  let payload = null;
  let ttlSec = 600; // how long a screen may stay unreachable and still receive it

  if (command === 'message') {
    const text = String(body?.text || '').trim();
    if (!text) throw badRequest('Message text is required.');
    if (text.length > MAX_MESSAGE) throw badRequest(`Message must be at most ${MAX_MESSAGE} characters.`);
    const dur = body?.durationSec === undefined || body?.durationSec === '' ? 300 : Number(body.durationSec);
    if (!Number.isInteger(dur) || dur < 5 || dur > 12 * 3600) {
      throw badRequest('Message duration must be between 5 seconds and 12 hours.');
    }
    const style = body?.style === 'urgent' ? 'urgent' : 'info';
    ttlSec = dur;
    payload = { text, style, until: nowMs + dur * 1000 };
  } else if (command === 'identify') {
    ttlSec = 120;
    payload = { until: nowMs + 20_000 };
  }

  return { command, payload, ttlSec };
}

/** Normalizes the target list: unique, trimmed, bounded. */
export function normalizeTargets(ids) {
  if (!Array.isArray(ids)) throw badRequest('screenIds must be a list.');
  const clean = [...new Set(ids.map((v) => String(v || '').trim()).filter(Boolean))];
  if (clean.length === 0) throw badRequest('Select at least one screen.');
  if (clean.length > MAX_TARGETS) throw badRequest(`At most ${MAX_TARGETS} screens per command.`);
  return clean;
}

/** `::ffff:10.1.2.3` → `10.1.2.3`; anything unusable → ''. */
export function cleanIp(raw) {
  const s = String(raw || '').trim().replace(/^::ffff:/i, '');
  return s.length > 0 && s.length <= 45 ? s : '';
}

/** `10.100.5.23` → `10.100.5.0/24` (the usual Wi-Fi / VLAN size); non-IPv4 → '' . */
export function subnetOf(ip) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(ip || ''));
  if (!m || m.slice(1).some((n) => Number(n) > 255)) return '';
  return `${m[1]}.${m[2]}.${m[3]}.0/24`;
}
