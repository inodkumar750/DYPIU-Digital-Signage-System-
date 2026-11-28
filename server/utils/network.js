import os from 'os';
import { config } from '../config.js';

function isLoopback(host) {
  return /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?)$/i.test(host);
}

/** First non-internal IPv4 address of this machine (what a TV on the LAN can reach). */
export function lanIp() {
  const nets = os.networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const n of list || []) {
      if (n.family === 'IPv4' && !n.internal) return n.address;
    }
  }
  return '127.0.0.1';
}

/**
 * Public base URL that TVs must use to fetch media.
 * Order: CAMPUSCAST_PUBLIC_URL -> forwarded/Host header -> LAN IP (when the request came via localhost).
 */
export function publicBaseUrl(req) {
  if (config.publicUrl) return config.publicUrl;
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const hostHeader = String(req.headers['x-forwarded-host'] || req.get('host') || '').split(',')[0].trim();
  if (!hostHeader) return `${proto}://${lanIp()}:${config.port}`;
  const hostname = hostHeader.replace(/:\d+$/, '');
  if (isLoopback(hostname)) return `${proto}://${lanIp()}:${config.port}`;
  return `${proto}://${hostHeader}`;
}

/** Turns a stored media path / URL into a URL reachable from a TV. */
export function toDeviceUrl(raw, baseUrl) {
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) {
    return raw.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, baseUrl);
  }
  return `${baseUrl}${raw.startsWith('/') ? '' : '/'}${raw}`;
}
