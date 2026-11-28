import './config.js';
import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'campuscast_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

/** Runs `fn(conn)` inside a transaction; commits on success, rolls back on any error. */
export async function withTx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      /* ignore rollback failure */
    }
    throw err;
  } finally {
    conn.release();
  }
}

export async function checkDb(retries = 5, delayMs = 2000) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await pool.getConnection();
      conn.release();
      return;
    } catch (err) {
      lastErr = err;
      console.warn(`⏳ MySQL not reachable (${err.code || err.message}) — retry ${i + 1}/${retries}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}
