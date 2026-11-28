import { pool } from '../db.js';

/**
 * DYPIU OS settings shared by every TV: branding, idle behaviour and which apps appear on the home screen.
 * Stored as one JSON document so the CMS can edit it without schema changes.
 * `id` is the platform's own app id (webOS app id / Android package name).
 */
export const DEFAULT_OS_CONFIG = {
  brand: { name: 'DYPIU OS', tagline: 'D. Y. Patil International University' },
  bootSeconds: 10, // home screen shows this long after power-on, then NEXORA signage starts
  idleSeconds: 120, // no key press for this long -> back to NEXORA signage
  staffPin: '2580', // opens the staff menu on the TV; change it from the CMS API
  apps: {
    webos: [
      { id: 'youtube.leanback.v4', label: 'YouTube', icon: 'play', enabled: true },
      { id: 'com.webos.app.browser', label: 'Web Browser', icon: 'globe', enabled: true },
      { id: 'com.webos.app.hdmi1', label: 'HDMI 1', icon: 'hdmi', enabled: true },
      { id: 'com.webos.app.hdmi2', label: 'HDMI 2', icon: 'hdmi', enabled: true },
      { id: 'com.webos.app.hdmi3', label: 'HDMI 3', icon: 'hdmi', enabled: true },
      { id: 'com.webos.app.livetv', label: 'Live TV', icon: 'tv', enabled: true },
      { id: 'com.webos.app.miracast', label: 'Screen Share', icon: 'cast', enabled: true },
      { id: 'com.webos.app.mediadiscovery', label: 'Photos & Videos', icon: 'photo', enabled: false },
      { id: 'netflix', label: 'Netflix', icon: 'film', enabled: false },
      { id: 'amazon', label: 'Prime Video', icon: 'film', enabled: false },
      { id: 'hotstar', label: 'Hotstar', icon: 'film', enabled: false },
      { id: 'com.palm.app.settings', label: 'TV Settings', icon: 'gear', enabled: true },
    ],
    android: [],
  },
};

function clean(cfg) {
  const d = DEFAULT_OS_CONFIG;
  const num = (v, min, max, fb) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.round(Number(v)))) : fb);
  const text = (v, max, fb) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fb);
  const apps = (list) =>
    (Array.isArray(list) ? list : []).slice(0, 60).map((a) => ({
      id: text(a?.id, 120, ''),
      label: text(a?.label, 40, 'App'),
      icon: text(a?.icon, 20, 'app'),
      enabled: a?.enabled !== false,
    })).filter((a) => a.id);
  return {
    brand: { name: text(cfg?.brand?.name, 40, d.brand.name), tagline: text(cfg?.brand?.tagline, 80, d.brand.tagline) },
    bootSeconds: num(cfg?.bootSeconds, 0, 120, d.bootSeconds),
    idleSeconds: num(cfg?.idleSeconds, 15, 3600, d.idleSeconds),
    staffPin: /^\d{4,8}$/.test(String(cfg?.staffPin ?? '')) ? String(cfg.staffPin) : d.staffPin,
    apps: {
      webos: cfg?.apps?.webos ? apps(cfg.apps.webos) : d.apps.webos,
      android: cfg?.apps?.android ? apps(cfg.apps.android) : d.apps.android,
    },
  };
}

export async function getOsConfig() {
  const [rows] = await pool.query('SELECT config FROM os_config WHERE id = 1');
  if (!rows[0]) return clean(DEFAULT_OS_CONFIG);
  try {
    return clean(JSON.parse(rows[0].config));
  } catch {
    return clean(DEFAULT_OS_CONFIG);
  }
}

export async function saveOsConfig(next) {
  const merged = clean({ ...(await getOsConfig()), ...next });
  await pool.query('INSERT INTO os_config (id, config) VALUES (1, ?) ON DUPLICATE KEY UPDATE config = VALUES(config)', [JSON.stringify(merged)]);
  return merged;
}

/** What a TV may see: no PIN, only enabled apps of its own platform. */
export function publicOsConfig(cfg, platform) {
  const list = platform === 'android' ? cfg.apps.android : cfg.apps.webos;
  return {
    brand: cfg.brand,
    bootSeconds: cfg.bootSeconds,
    idleSeconds: cfg.idleSeconds,
    apps: list.filter((a) => a.enabled).map(({ id, label, icon }) => ({ id, label, icon })),
  };
}
