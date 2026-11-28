import crypto from 'crypto';
import { pool } from '../db.js';
import { deviceKeyFor } from '../utils/auth.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeCode() {
  return Array.from(crypto.randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** TV side: request a short-lived pairing code to show on screen. */
export async function startPairing(ip = '', userAgent = '') {
  await pool.query('DELETE FROM pairing_requests WHERE expires_at < NOW()');
  for (let i = 0; i < 10; i++) {
    const code = makeCode();
    try {
      await pool.query(
        'INSERT INTO pairing_requests (code, expires_at, ip_address, user_agent) VALUES (?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), ?, ?)',
        [code, String(ip || '').slice(0, 45) || null, String(userAgent || '').slice(0, 255) || null]
      );
      return { code, expiresInSeconds: 600 };
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY') throw err;
    }
  }
  throw new Error('Could not allocate pairing code');
}

/** Admin side: bind a pending code to a screen. Returns true when a matching, unexpired request existed. */
export async function claimPairingCode(code, screenId) {
  const [r] = await pool.query(
    'UPDATE pairing_requests SET screen_id=? WHERE code=? AND screen_id IS NULL AND expires_at >= NOW()',
    [screenId, code]
  );
  return r.affectedRows > 0;
}

/** TV side: poll until an admin has claimed the code. */
export async function pairingStatus(code) {
  const [rows] = await pool.query('SELECT screen_id, expires_at < NOW() AS expired FROM pairing_requests WHERE code=?', [code]);
  if (rows.length === 0 || rows[0].expired) return { state: 'expired' };
  if (!rows[0].screen_id) return { state: 'waiting' };
  const screenId = rows[0].screen_id;
  await pool.query('DELETE FROM pairing_requests WHERE code=?', [code]);
  return { state: 'paired', screenId, deviceKey: deviceKeyFor(screenId) };
}

/** Admin side: TVs on the network that are showing a pairing code and waiting to be adopted. */
export async function listPendingPairings() {
  await pool.query('DELETE FROM pairing_requests WHERE expires_at < NOW()');
  const [rows] = await pool.query(
    'SELECT code, ip_address, user_agent, created_at, TIMESTAMPDIFF(SECOND, NOW(), expires_at) AS seconds_left FROM pairing_requests WHERE screen_id IS NULL ORDER BY created_at DESC LIMIT 50'
  );
  return rows.map((r) => ({
    code: r.code,
    ipAddress: r.ip_address || '',
    userAgent: r.user_agent || '',
    createdAt: r.created_at,
    secondsLeft: Math.max(0, Number(r.seconds_left) || 0),
  }));
}
