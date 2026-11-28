import test from 'node:test';
import assert from 'node:assert/strict';

process.env.CAMPUSCAST_AUTH_SECRET = 'unit-test-secret-0123456789abcdef';

const auth = await import('../utils/auth.js');
const sched = await import('../utils/schedule.js');
const http = await import('../utils/http.js');
const net = await import('../utils/network.js');
const hb = await import('../utils/heartbeat.js');

test('password hashing: verify ok / wrong / invalid hash', async () => {
  const h = await auth.hashPassword('S3cure-pass');
  assert.ok(auth.isScryptHash(h));
  assert.equal(await auth.verifyPassword('S3cure-pass', h), true);
  assert.equal(await auth.verifyPassword('nope', h), false);
  // The old bcrypt-looking seed strings must never authenticate.
  assert.equal(await auth.verifyPassword('anything', '$2a$10$w8T4N1yF07rD4J8.O2xSbeuK8D'), false);
  assert.equal(await auth.verifyPassword('anything', undefined), false);
});

test('session tokens: valid, tampered, expired', () => {
  const t = auth.signSessionToken({ userId: 'u1' });
  assert.equal(auth.verifySessionToken(t).userId, 'u1');
  assert.equal(auth.verifySessionToken(t.slice(0, -2) + 'xx'), null);
  assert.equal(auth.verifySessionToken('garbage'), null);
  const expired = auth.signSessionToken({ userId: 'u1' }, -1);
  assert.equal(auth.verifySessionToken(expired), null);
});

test('allowed menus: unknown keys are dropped, role defaults apply', () => {
  assert.deepEqual(auth.parseAllowedMenus(['media', 'hack'], 'Monitoring User'), ['media']);
  assert.deepEqual(auth.parseAllowedMenus(null, 'Monitoring User'), ['dashboard', 'monitoring', 'reports']);
  assert.deepEqual(auth.parseAllowedMenus('["screens"]', 'Content Manager'), ['screens']);
});

test('device keys are stable per screen and not interchangeable', () => {
  const k = auth.deviceKeyFor('DYPIU-TV-001');
  assert.equal(auth.verifyDeviceKey('DYPIU-TV-001', k), true);
  assert.equal(auth.verifyDeviceKey('DYPIU-TV-002', k), false);
  assert.equal(auth.verifyDeviceKey('DYPIU-TV-001', ''), false);
});

test('schedule: date range, daily window, all-day and overnight', () => {
  const c = { start_date: '2026-11-20', end_date: '2026-12-15', start_time: '08:00', end_time: '20:00' };
  assert.equal(sched.isCampaignInWindow(c, { date: '2026-11-25', time: '09:00' }), true);
  assert.equal(sched.isCampaignInWindow(c, { date: '2026-11-25', time: '20:00' }), false); // end exclusive
  assert.equal(sched.isCampaignInWindow(c, { date: '2026-11-19', time: '09:00' }), false);
  assert.equal(sched.isCampaignInWindow(c, { date: '2026-12-16', time: '09:00' }), false);
  const night = { ...c, start_time: '22:00', end_time: '06:00' };
  assert.equal(sched.isCampaignInWindow(night, { date: '2026-11-25', time: '23:30' }), true);
  assert.equal(sched.isCampaignInWindow(night, { date: '2026-11-25', time: '05:59' }), true);
  assert.equal(sched.isCampaignInWindow(night, { date: '2026-11-25', time: '12:00' }), false);
  const allDay = { ...c, start_time: '00:00', end_time: '00:00' };
  assert.equal(sched.isCampaignInWindow(allDay, { date: '2026-11-25', time: '03:00' }), true);
});

test('schedule: highest priority wins; paused/draft ignored', () => {
  const now = { date: '2026-11-25', time: '10:00' };
  const base = { start_date: '2026-11-01', end_date: '2026-12-31', start_time: '00:00', end_time: '23:59' };
  const list = [
    { ...base, id: 'a', priority: 'Normal', status: 'Active' },
    { ...base, id: 'b', priority: 'Urgent', status: 'Active' },
    { ...base, id: 'c', priority: 'Urgent', status: 'Paused' },
    { ...base, id: 'd', priority: 'High', status: 'Draft' },
  ];
  assert.equal(sched.pickLiveCampaign(list, now).id, 'b');
  assert.equal(sched.pickLiveCampaign(list.slice(2), now), null);
});

test('zonedNow returns IST wall-clock for a known instant', () => {
  const r = sched.zonedNow('Asia/Kolkata', new Date('2026-11-28T00:00:00Z'));
  assert.deepEqual(r, { date: '2026-11-28', time: '05:30' });
});

test('validators', () => {
  assert.throws(() => http.str('', { field: 'Name', required: true }), /Name is required/);
  assert.throws(() => http.str('x'.repeat(10), { max: 5 }), /at most 5/);
  assert.equal(http.oneOf('High', ['Normal', 'High']), 'High');
  assert.throws(() => http.oneOf('x', ['a']), /must be one of/);
  assert.throws(() => http.intIn('abc', { min: 1, max: 5 }), /whole number/);
  assert.deepEqual(http.idList(['a', 'a', 'b'], 'x'), ['a', 'b']);
  assert.ok(http.TIME_RE.test('23:59') && !http.TIME_RE.test('24:00'));
  assert.ok(http.DATE_RE.test('2026-11-28') && !http.DATE_RE.test('28-11-2026'));
  assert.notEqual(http.newId('med'), http.newId('med'));
});

test('media URLs: localhost is rewritten to a TV-reachable base', () => {
  assert.equal(net.toDeviceUrl('/uploads/a.jpg', 'http://10.0.0.5:5000'), 'http://10.0.0.5:5000/uploads/a.jpg');
  assert.equal(net.toDeviceUrl('http://localhost:5000/uploads/a.jpg', 'http://10.0.0.5:5000'), 'http://10.0.0.5:5000/uploads/a.jpg');
  assert.equal(net.toDeviceUrl('https://cdn.example.com/a.jpg', 'http://10.0.0.5:5000'), 'https://cdn.example.com/a.jpg');
});

test('heartbeat liveness uses the configured threshold', () => {
  const now = Date.now();
  const fresh = hb.deriveConnection({ is_active: 1, last_heartbeat: new Date(now - 20_000).toISOString() }, now);
  const stale = hb.deriveConnection({ is_active: 1, last_heartbeat: new Date(now - 120_000).toISOString() }, now);
  const off = hb.deriveConnection({ is_active: 0, last_heartbeat: new Date(now).toISOString() }, now);
  assert.equal(fresh.connectionStatus, 'Online');
  assert.equal(stale.connectionStatus, 'Offline');
  assert.equal(stale.lastSeen, '2m ago');
  assert.equal(off.lastSeen, 'Turned Off (Standby)');
});

const cmd = await import('../utils/commands.js');

test('remote commands: validation, expiry and targets', () => {
  const m = cmd.buildCommand({ command: 'message', text: '  Fire drill at 11:00  ', durationSec: 60, style: 'urgent' }, 1_000_000);
  assert.equal(m.payload.text, 'Fire drill at 11:00');
  assert.equal(m.payload.style, 'urgent');
  assert.equal(m.payload.until, 1_000_000 + 60_000);
  assert.equal(m.ttlSec, 60);
  assert.throws(() => cmd.buildCommand({ command: 'message', text: '' }), /required/);
  assert.throws(() => cmd.buildCommand({ command: 'message', text: 'x', durationSec: 1 }), /duration/);
  assert.throws(() => cmd.buildCommand({ command: 'format-disk' }), /Unknown command/);
  assert.equal(cmd.buildCommand({ command: 'reload' }).payload, null);
  assert.deepEqual(cmd.normalizeTargets(['a', ' a ', 'b', '']), ['a', 'b']);
  assert.throws(() => cmd.normalizeTargets([]), /at least one/);
  assert.throws(() => cmd.normalizeTargets('a'), /list/);
});

test('network helpers: ip cleanup and subnet grouping', () => {
  assert.equal(cmd.cleanIp('::ffff:10.100.5.23'), '10.100.5.23');
  assert.equal(cmd.subnetOf('10.100.5.23'), '10.100.5.0/24');
  assert.equal(cmd.subnetOf('999.1.1.1'), '');
  assert.equal(cmd.subnetOf('fe80::1'), '');
});
