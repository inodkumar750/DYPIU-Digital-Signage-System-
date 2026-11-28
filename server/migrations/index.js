import { pool } from '../db.js';

async function hasColumn(conn, table, column) {
  const [rows] = await conn.query(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
    [table, column]
  );
  return rows.length > 0;
}

async function hasIndex(conn, table, index) {
  const [rows] = await conn.query(
    'SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
    [table, index]
  );
  return rows.length > 0;
}

async function addColumn(conn, table, column, ddl) {
  if (!(await hasColumn(conn, table, column))) {
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${ddl}`);
  }
}

async function addIndex(conn, table, index, columns) {
  if (!(await hasIndex(conn, table, index))) {
    await conn.query(`ALTER TABLE \`${table}\` ADD INDEX \`${index}\` (${columns})`);
  }
}

/**
 * Ordered, idempotent migrations. Each one checks the live schema first, so they are safe
 * on a fresh install AND on a database that was patched by hand in the past.
 */
const MIGRATIONS = [
  {
    id: '001_columns_used_by_code',
    async up(conn) {
      await addColumn(conn, 'users', 'allowed_menus', 'TEXT NULL');
      await addColumn(conn, 'screens', 'wake_requested', 'TINYINT(1) NOT NULL DEFAULT 0');
      await addColumn(conn, 'media_assets', 'aspect_ratio', "VARCHAR(10) NOT NULL DEFAULT '16:9'");
      await addColumn(conn, 'campaigns', 'qr_url', 'VARCHAR(500) DEFAULT NULL');
      await addColumn(conn, 'campaigns', 'qr_label', 'VARCHAR(120) DEFAULT NULL');
    },
  },
  {
    id: '002_audit_and_playback_tables',
    async up(conn) {
      // Allow every module to be audited (was a 5-value ENUM).
      await conn.query('ALTER TABLE `activity_events` MODIFY `action_type` VARCHAR(30) NOT NULL');
      await conn.query(`CREATE TABLE IF NOT EXISTS \`playback_logs\` (
        \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
        \`screen_id\` VARCHAR(50) NOT NULL,
        \`media_id\` VARCHAR(50) NOT NULL,
        \`started_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_playback_screen_time\` (\`screen_id\`, \`started_at\`),
        INDEX \`idx_playback_media\` (\`media_id\`, \`started_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    },
  },
  {
    id: '003_performance_indexes',
    async up(conn) {
      await addIndex(conn, 'playlist_items', 'idx_pi_playlist_order', '`playlist_id`, `order_index`');
      await addIndex(conn, 'campaign_targets', 'idx_ct_campaign', '`campaign_id`');
      await addIndex(conn, 'campaign_targets', 'idx_ct_target', '`target_type`, `target_id`');
      await addIndex(conn, 'campaigns', 'idx_campaign_active', '`status`, `start_date`, `end_date`');
      await addIndex(conn, 'screens', 'idx_screens_playlist', '`assigned_playlist_id`');
      await addIndex(conn, 'activity_events', 'idx_activity_created', '`created_at`');
    },
  },
  {
    id: '004_device_pairing_requests',
    async up(conn) {
      await conn.query(`CREATE TABLE IF NOT EXISTS \`pairing_requests\` (
        \`code\` VARCHAR(10) NOT NULL PRIMARY KEY,
        \`screen_id\` VARCHAR(50) DEFAULT NULL,
        \`expires_at\` DATETIME NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    },
  },
  {
    id: '005_remote_control_commands',
    async up(conn) {
      await conn.query(`CREATE TABLE IF NOT EXISTS \`device_commands\` (
        \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
        \`screen_id\` VARCHAR(50) NOT NULL,
        \`command\` VARCHAR(30) NOT NULL,
        \`payload\` TEXT NULL,
        \`status\` VARCHAR(10) NOT NULL DEFAULT 'pending',
        \`created_by\` VARCHAR(100) NOT NULL DEFAULT '',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`sent_at\` DATETIME NULL,
        \`done_at\` DATETIME NULL,
        \`expires_at\` DATETIME NOT NULL,
        INDEX \`idx_cmd_screen_status\` (\`screen_id\`, \`status\`),
        INDEX \`idx_cmd_created\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await addColumn(conn, 'pairing_requests', 'ip_address', 'VARCHAR(45) NULL');
      await addColumn(conn, 'pairing_requests', 'user_agent', 'VARCHAR(255) NULL');
    },
  },
  {
    id: '006_dypiu_os_config',
    async up(conn) {
      await conn.query(`CREATE TABLE IF NOT EXISTS \`os_config\` (
        \`id\` TINYINT NOT NULL PRIMARY KEY,
        \`config\` MEDIUMTEXT NOT NULL,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    },
  },
];

export async function runMigrations() {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id VARCHAR(100) NOT NULL PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const [done] = await pool.query('SELECT id FROM schema_migrations');
  const applied = new Set(done.map((r) => r.id));

  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;
    const conn = await pool.getConnection();
    try {
      await m.up(conn);
      await conn.query('INSERT INTO schema_migrations (id) VALUES (?)', [m.id]);
      console.log(`🗄️  Applied migration ${m.id}`);
    } finally {
      conn.release();
    }
  }
}
