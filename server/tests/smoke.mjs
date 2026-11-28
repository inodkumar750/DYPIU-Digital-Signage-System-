/**
 * End-to-end smoke test against a RUNNING server + database.
 *   SMOKE_BASE=http://localhost:5000 SMOKE_EMAIL=... SMOKE_PASSWORD=... node server/tests/smoke.mjs
 * Creates temporary records and removes them again.
 */
const BASE = (process.env.SMOKE_BASE || 'http://localhost:5000').replace(/\/+$/, '');
const EMAIL = process.env.SMOKE_EMAIL;
const PASSWORD = process.env.SMOKE_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error('Set SMOKE_EMAIL and SMOKE_PASSWORD (a Super Administrator).');
  process.exit(2);
}

let failed = 0;
let token = '';
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? '✔' : '✖'} ${name}${!cond && extra ? '  → ' + extra : ''}`);
  if (!cond) failed++;
};

async function api(method, path, { body, auth = true, headers = {}, raw = false } = {}) {
  const h = { ...headers };
  if (auth && token) h.Authorization = `Bearer ${token}`;
  if (body !== undefined && !(body instanceof FormData)) h['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: h,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  if (raw) return res;
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty */
  }
  return { status: res.status, json };
}

const today = new Date().toISOString().slice(0, 10);
const sid = `SMOKE-TV-${Date.now().toString().slice(-6)}`;
let mediaId, playlistId, campaignId, groupId;

try {
  // ── auth & RBAC ──
  ok('health endpoint', (await fetch(`${BASE}/api/health`)).ok);
  ok('API requires a token (401)', (await api('GET', '/screens', { auth: false })).status === 401);
  ok('bad password rejected (401)', (await api('POST', '/auth/login', { auth: false, body: { email: EMAIL, password: 'wrong-password' } })).status === 401);
  const login = await api('POST', '/auth/login', { auth: false, body: { email: EMAIL, password: PASSWORD } });
  ok('login succeeds', login.status === 200 && login.json?.token, JSON.stringify(login.json));
  token = login.json?.token;
  ok('/auth/me works', (await api('GET', '/auth/me')).json?.user?.email === EMAIL.toLowerCase());
  ok('tampered token rejected', (await api('GET', '/screens', { headers: { Authorization: `Bearer ${token}x` }, auth: false })).status === 401);

  // ── screens ──
  const mk = await api('POST', '/screens', { body: { id: sid, name: 'Smoke TV', building: 'Building A', floor: 'Ground Floor' } });
  ok('register screen', mk.status === 200 && mk.json?.deviceKey, JSON.stringify(mk.json));
  const key = mk.json?.deviceKey;
  ok('invalid screen id rejected', (await api('POST', '/screens', { body: { id: 'a b', name: 'x' } })).status === 400);
  const put = await api('PUT', `/screens/${sid}`, { body: { name: 'Smoke TV renamed' } });
  ok('partial update keeps other fields', put.status === 200);
  const list = await api('GET', '/screens');
  const mine = list.json?.data?.find((s) => s.id === sid);
  ok('partial update did not reset building', mine?.name === 'Smoke TV renamed' && mine?.building === 'Building A', JSON.stringify(mine));

  // ── media / playlist ──
  const fd = new FormData();
  fd.append('title', 'Smoke image');
  fd.append('category', 'Events');
  fd.append('type', 'Image');
  fd.append('fileUrl', '/src/assets/images/smoke.jpg');
  const up = await api('POST', '/media/upload', { body: fd });
  ok('metadata-only media record', up.status === 200 && up.json?.data?.id, JSON.stringify(up.json));
  mediaId = up.json?.data?.id;
  const bad = new FormData();
  bad.append('file', new Blob(['<script>alert(1)</script>'], { type: 'text/html' }), 'evil.html');
  ok('HTML upload rejected', (await api('POST', '/media/upload', { body: bad })).status === 400);
  const ext = new FormData();
  ext.append('fileUrl', 'http://evil.example/x.jpg');
  ok('external fileUrl rejected', (await api('POST', '/media/upload', { body: ext })).status === 400);

  const pl = await api('POST', '/playlists', { body: { name: 'Smoke playlist', items: [{ mediaId, displayDurationSeconds: 7 }] } });
  ok('create playlist', pl.status === 200 && pl.json?.id, JSON.stringify(pl.json));
  playlistId = pl.json?.id;
  ok('playlist with unknown media rejected', (await api('POST', '/playlists', { body: { name: 'bad', items: [{ mediaId: 'nope' }] } })).status === 400);
  ok('media in use cannot be deleted (409)', (await api('DELETE', `/media/${mediaId}`)).status === 409);

  // ── group + campaign ──
  const gr = await api('POST', '/groups', { body: { name: 'Smoke group', building: 'Building A', floor: 'Ground Floor', screenIds: [sid] } });
  ok('create group', gr.status === 200, JSON.stringify(gr.json));
  groupId = gr.json?.id;
  ok('campaign end < start rejected', (await api('POST', '/campaigns', { body: { name: 'x', playlistId, startDate: '2026-12-10', endDate: '2026-12-01' } })).status === 400);
  const cm = await api('POST', '/campaigns', {
    body: {
      name: 'Smoke campaign',
      playlistId,
      startDate: today,
      endDate: '2099-12-31',
      startTime: '00:00',
      endTime: '23:59',
      status: 'Scheduled',
      priority: 'High',
      targetScreenIds: [],
      targetGroupIds: [groupId],
      qrUrl: 'https://example.com/apply',
      qrLabel: 'Apply',
    },
  });
  ok('create campaign', cm.status === 200 && cm.json?.id, JSON.stringify(cm.json));
  campaignId = cm.json?.id;
  ok('playlist used by campaign cannot be deleted (409)', (await api('DELETE', `/playlists/${playlistId}`)).status === 409);

  // ── TV side ──
  const hbUnknown = await api('POST', '/device/NOPE-TV/heartbeat', { auth: false, body: {} });
  ok('heartbeat from unknown screen → 404', hbUnknown.status === 404);
  const hb = await api('POST', `/device/${sid}/heartbeat`, { auth: false, headers: { 'X-Device-Key': key }, body: { currentMediaId: mediaId, playerAppVersion: 'smoke' } });
  ok('heartbeat accepted', hb.status === 200);
  const man = await api('GET', `/device/${sid}/manifest`, { auth: false, headers: { 'X-Device-Key': key } });
  ok('manifest resolves campaign via group', man.json?.source === 'campaign' && man.json?.playlist?.slides?.length === 1, JSON.stringify(man.json)?.slice(0, 300));
  ok('manifest carries QR', Boolean(man.json?.campaignQr?.dataUrl));
  ok('manifest slide duration from playlist item', man.json?.playlist?.slides?.[0]?.durationSeconds === 7);
  ok('manifest URL is TV-reachable (not localhost)', !/localhost|127\.0\.0\.1/.test(man.json?.playlist?.slides?.[0]?.downloadUrl || ''), man.json?.playlist?.slides?.[0]?.downloadUrl);
  const etag = (await api('GET', `/device/${sid}/manifest`, { auth: false, raw: true })).headers.get('etag');
  const again = await fetch(`${BASE}/api/v1/device/${sid}/manifest`, { headers: { 'If-None-Match': etag } });
  ok('manifest ETag → 304 when unchanged', again.status === 304, String(again.status));
  const feed = await api('GET', `/device/${sid}/feed`, { auth: false });
  ok('feed returns data + version', feed.json?.success && feed.json?.version && feed.json?.data?.playlists);
  const feed2 = await api('GET', `/device/${sid}/feed?v=${feed.json?.version}`, { auth: false });
  ok('feed unchanged shortcut', feed2.json?.unchanged === true);
  const scr = (await api('GET', '/screens')).json?.data?.find((s) => s.id === sid);
  ok('screen shows Online after heartbeat', scr?.connectionStatus === 'Online', scr?.connectionStatus);

  // ── publishing ──
  const pub = await api('POST', '/publishing/dispatch', { body: { campaignId } });
  ok('dispatch works and is not "Failed" for the data it can resolve', pub.status === 200 && pub.json?.status === 'Published', JSON.stringify(pub.json));
  ok('dispatch for unknown campaign → 404', (await api('POST', '/publishing/dispatch', { body: { campaignId: 'nope' } })).status === 404);

  // ── users / admin ──
  const users = await api('GET', '/users');
  const admins = users.json?.data?.filter((u) => u.role === 'Super Administrator' && u.status === 'Active') || [];
  ok('users list', users.status === 200 && admins.length >= 1);
  const me = admins.find((u) => u.email === EMAIL.toLowerCase());
  ok('cannot delete own account', (await api('DELETE', `/users/${me?.id}`)).status === 409);
  ok('short password rejected', (await api('POST', '/users', { body: { name: 'T', email: 'smoke.short@dypiu.ac.in', password: '123', role: 'Content Manager' } })).status === 400);
  const nu = await api('POST', '/users', { body: { name: 'Smoke CM', email: 'smoke.cm@dypiu.ac.in', password: 'Smoke-pass-1', role: 'Content Manager' } });
  ok('create content manager', nu.status === 200, JSON.stringify(nu.json));
  const cmLogin = await api('POST', '/auth/login', { auth: false, body: { email: 'smoke.cm@dypiu.ac.in', password: 'Smoke-pass-1' } });
  const saved = token;
  token = cmLogin.json?.token;
  ok('content manager can read screens', (await api('GET', '/screens')).status === 200);
  ok('content manager CANNOT create users (403)', (await api('POST', '/users', { body: { name: 'x', email: 'x@y.zz', password: 'Abcdefg1', role: 'Super Administrator' } })).status === 403);
  ok('content manager CANNOT delete screens (403)', (await api('DELETE', `/screens/${sid}`)).status === 403);
  ok('content manager CANNOT change settings (403)', (await api('PUT', '/settings', { body: { a: 1 } })).status === 403);
  token = saved;
  await api('DELETE', `/users/${nu.json?.id}`);
  ok('audit log has entries', ((await api('GET', '/audit?limit=5')).json?.data || []).length > 0);
  ok('backup is Super Admin only and works', (await api('GET', '/admin/backup')).status === 200);
} catch (err) {
  console.error('Unexpected error:', err);
  failed++;
} finally {
  // cleanup (campaign first because it pins the playlist)
  if (campaignId) await api('DELETE', `/campaigns/${campaignId}`);
  if (groupId) await api('DELETE', `/groups/${groupId}`);
  if (playlistId) await api('DELETE', `/playlists/${playlistId}`);
  if (mediaId) await api('DELETE', `/media/${mediaId}`);
  await api('DELETE', `/screens/${sid}`);
}

console.log(failed === 0 ? '\nALL SMOKE CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
