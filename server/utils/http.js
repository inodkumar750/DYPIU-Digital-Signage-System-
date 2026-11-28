import crypto from 'crypto';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

export const badRequest = (msg) => new HttpError(400, msg);
export const forbidden = (msg = 'You do not have permission to do this.') => new HttpError(403, msg);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);
export const conflict = (msg) => new HttpError(409, msg);

/** Wraps async route handlers so rejected promises reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Collision-resistant id such as `med-9f2c41ab12`. */
export function newId(prefix) {
  return `${prefix}-${crypto.randomBytes(5).toString('hex')}`;
}

export function str(value, { field = 'value', max = 255, required = false, fallback = '' } = {}) {
  const s = value === undefined || value === null ? '' : String(value).trim();
  if (!s) {
    if (required) throw badRequest(`${field} is required.`);
    return fallback;
  }
  if (s.length > max) throw badRequest(`${field} must be at most ${max} characters.`);
  return s;
}

export function oneOf(value, allowed, { field = 'value', fallback } = {}) {
  if (value === undefined || value === null || value === '') {
    if (fallback !== undefined) return fallback;
    throw badRequest(`${field} is required.`);
  }
  if (!allowed.includes(value)) throw badRequest(`${field} must be one of: ${allowed.join(', ')}.`);
  return value;
}

export function intIn(value, { field = 'value', min = 0, max = 86400, fallback } = {}) {
  if (value === undefined || value === null || value === '') {
    if (fallback !== undefined) return fallback;
    throw badRequest(`${field} is required.`);
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw badRequest(`${field} must be a whole number between ${min} and ${max}.`);
  }
  return n;
}

export function idList(value, field) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw badRequest(`${field} must be a list.`);
  const out = [...new Set(value.map((v) => String(v)))];
  if (out.length > 1000) throw badRequest(`${field} has too many entries.`);
  if (out.some((v) => !v || v.length > 50)) throw badRequest(`${field} contains an invalid id.`);
  return out;
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const SCREEN_ID_RE = /^[A-Za-z0-9_-]{3,50}$/;

export function errorHandler(err, req, res, _next) {
  if (res.headersSent) return;
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: 'File is larger than the allowed upload size.' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'Request body is too large.' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Malformed JSON body.' });
  }
  const status = err?.status && Number.isInteger(err.status) ? err.status : 500;
  if (status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    return res.status(500).json({ success: false, error: 'Internal server error. Please try again.' });
  }
  res.status(status).json({ success: false, error: err.expose ? err.message : 'Request failed.' });
}
