import crypto from 'crypto';
import { pool } from '../db.js';
import { config } from '../config.js';
import { hashPassword, isScryptHash, DEFAULT_MENUS_BY_ROLE } from '../utils/auth.js';

function tempPassword() {
  // 12 chars, no ambiguous characters
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(12), (b) => alphabet[b % alphabet.length]).join('');
}

/**
 * Makes sure every account can actually sign in.
 *  - Accounts whose stored hash is not a valid scrypt hash (e.g. the placeholder bcrypt strings in the old seed SQL)
 *    receive a temporary password. It is printed ONCE in the server console unless
 *    CAMPUSCAST_BOOTSTRAP_PASSWORD is set.
 *  - If the users table is empty a Super Administrator is created.
 */
export async function bootstrapUsers() {
  const [rows] = await pool.query('SELECT id, email, password_hash FROM users');

  if (rows.length === 0) {
    const pw = config.bootstrapPassword || tempPassword();
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, department, role, allowed_menus, status, last_login)
       VALUES ('usr-admin', 'System Administrator', ?, ?, 'University IT', 'Super Administrator', ?, 'Active', 'Pending first login')`,
      [config.bootstrapAdminEmail, await hashPassword(pw), JSON.stringify(DEFAULT_MENUS_BY_ROLE['Super Administrator'])]
    );
    console.log('────────────────────────────────────────────────────────');
    console.log(`👤 Created first administrator: ${config.bootstrapAdminEmail}`);
    if (!config.bootstrapPassword) console.log(`   Temporary password: ${pw}   (change it after signing in)`);
    console.log('────────────────────────────────────────────────────────');
    return;
  }

  const broken = rows.filter((r) => !isScryptHash(r.password_hash));
  if (broken.length === 0) return;

  console.log('────────────────────────────────────────────────────────');
  console.log(`🔑 ${broken.length} account(s) had an unusable password hash — assigning temporary passwords:`);
  for (const r of broken) {
    const pw = config.bootstrapPassword || tempPassword();
    await pool.query('UPDATE users SET password_hash=? WHERE id=?', [await hashPassword(pw), r.id]);
    console.log(`   ${r.email}${config.bootstrapPassword ? '' : `  →  ${pw}`}`);
  }
  console.log('   Ask each user to change it after the first sign-in.');
  console.log('────────────────────────────────────────────────────────');
}
