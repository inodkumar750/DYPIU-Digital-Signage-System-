import {
  Campaign,
  CampaignStatus,
  MediaAsset,
  Playlist,
  PublishJob,
  ScreenDevice,
  ScreenGroup,
  UniversitySettings,
  UserAccount,
} from '../types/signage';

/* ───────────────────────── Base URL ───────────────────────── */

const TOKEN_KEY = 'campuscast_auth_token';

function resolveApiOrigin(): string {
  const fromEnv = (import.meta as any).env?.VITE_API_BASE as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
  if (typeof window === 'undefined') return 'http://localhost:5000';
  const { protocol, hostname, port, origin } = window.location;
  // Served by the API itself (production build) or behind a reverse proxy → same origin.
  if (port === '5000' || port === '' || protocol === 'https:') return origin;
  // Vite dev server (port 3000) → API on the same host, port 5000.
  return `${protocol}//${hostname}:5000`;
}

export const API_ORIGIN = resolveApiOrigin();
export const API_BASE = `${API_ORIGIN}/api/v1`;

export function getAuthToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Device key used by kiosk/TV players (passed once as ?key=… and remembered). */
export function getDeviceKey(): string {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('key');
    if (fromUrl) {
      window.localStorage.setItem('nexora_device_key', fromUrl);
      return fromUrl;
    }
    return window.localStorage.getItem('nexora_device_key') || '';
  } catch {
    return '';
  }
}

/* ───────────────────────── Request core ───────────────────────── */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  form?: FormData;
  /** Dispatch a global "campuscast:api-error" event so the UI can toast + resync (for fire-and-forget callers). */
  notify?: boolean;
  headers?: Record<string, string>;
}

async function request<T = any>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { method: opts.method || 'GET', headers, body });
  } catch {
    const err = new ApiError('Cannot reach the server. Check your network connection.', 0);
    if (opts.notify) window.dispatchEvent(new CustomEvent('campuscast:api-error', { detail: err.message }));
    throw err;
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body */
  }

  if (!res.ok || (json && json.success === false)) {
    const message = json?.error || json?.message || res.statusText || `Request failed (${res.status})`;
    if (res.status === 401 && token) {
      window.dispatchEvent(new CustomEvent('campuscast:unauthorized', { detail: message }));
    } else if (opts.notify) {
      window.dispatchEvent(new CustomEvent('campuscast:api-error', { detail: message }));
    }
    throw new ApiError(message, res.status);
  }
  return json as T;
}

const NOTIFY = { notify: true } as const;

/* ───────────────────────── Media URLs ───────────────────────── */

export function formatMediaUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^(https?:|blob:|data:)/.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/uploads/')) return `${API_ORIGIN}${trimmed}`;
  return trimmed;
}

/* ───────────────────────── SCREENS ───────────────────────── */

export async function getScreens(): Promise<ScreenDevice[]> {
  return (await request('/screens')).data || [];
}

export async function createScreen(screen: ScreenDevice): Promise<void> {
  await request('/screens', { method: 'POST', body: screen });
}

export async function updateScreenApi(screen: ScreenDevice): Promise<void> {
  await request(`/screens/${encodeURIComponent(screen.id)}`, { method: 'PUT', body: screen });
}

export async function assignScreenPlaylistApi(screenId: string, assignedPlaylistId: string | null): Promise<void> {
  await request(`/screens/${encodeURIComponent(screenId)}/assign-playlist`, {
    method: 'PATCH',
    body: { assignedPlaylistId },
  });
}

export async function deleteScreenApi(id: string): Promise<void> {
  await request(`/screens/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function toggleScreenActiveApi(id: string): Promise<void> {
  await request(`/screens/${encodeURIComponent(id)}/toggle-active`, { method: 'PATCH', ...NOTIFY });
}

export async function reconnectScreenApi(id: string): Promise<void> {
  await request(`/screens/${encodeURIComponent(id)}/reconnect`, { method: 'PATCH', ...NOTIFY });
}

/* ───────────────────────── MEDIA ───────────────────────── */

export async function getMedia(): Promise<MediaAsset[]> {
  return (await request('/media')).data || [];
}

export async function uploadMediaFile(asset: MediaAsset, file?: File | null): Promise<MediaAsset> {
  const form = new FormData();
  if (file) form.append('file', file);
  form.append('title', asset.title);
  form.append('category', asset.category);
  form.append('type', asset.type);
  if (asset.durationSeconds) form.append('durationSeconds', String(asset.durationSeconds));
  if (asset.description) form.append('description', asset.description);
  if (asset.aspectRatio) form.append('aspectRatio', asset.aspectRatio);
  if (asset.dimensions) form.append('dimensions', asset.dimensions);
  // Metadata-only sample assets (no file) reference a built-in path.
  if (!file && asset.fileUrl) form.append('fileUrl', asset.fileUrl);
  const json = await request('/media/upload', { method: 'POST', form });
  return json.data || asset;
}

export async function updateMediaApi(asset: Pick<MediaAsset, 'id' | 'title' | 'category' | 'description'>): Promise<void> {
  await request(`/media/${encodeURIComponent(asset.id)}`, {
    method: 'PUT',
    body: { title: asset.title, category: asset.category, description: asset.description || '' },
    ...NOTIFY,
  });
}

export async function deleteMediaApi(id: string, force = false): Promise<void> {
  await request(`/media/${encodeURIComponent(id)}${force ? '?force=1' : ''}`, { method: 'DELETE', ...NOTIFY });
}

/* ───────────────────────── PLAYLISTS ───────────────────────── */

export async function getPlaylists(): Promise<Playlist[]> {
  return (await request('/playlists')).data || [];
}

export async function savePlaylistApi(playlist: Playlist): Promise<void> {
  await request('/playlists', { method: 'POST', body: playlist, ...NOTIFY });
}

export async function deletePlaylistApi(id: string): Promise<void> {
  await request(`/playlists/${encodeURIComponent(id)}`, { method: 'DELETE', ...NOTIFY });
}

export async function addMediaToPlaylistApi(playlistId: string, mediaId: string, displayDurationSeconds?: number): Promise<void> {
  await request(`/playlists/${encodeURIComponent(playlistId)}/add-media`, {
    method: 'POST',
    body: { mediaId, displayDurationSeconds },
    ...NOTIFY,
  });
}

/* ───────────────────────── CAMPAIGNS ───────────────────────── */

export async function getCampaigns(): Promise<Campaign[]> {
  return (await request('/campaigns')).data || [];
}

export async function saveCampaignApi(campaign: Campaign): Promise<void> {
  await request('/campaigns', { method: 'POST', body: campaign, ...NOTIFY });
}

export async function updateCampaignStatusApi(id: string, status: CampaignStatus): Promise<void> {
  await request(`/campaigns/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status }, ...NOTIFY });
}

export async function deleteCampaignApi(id: string): Promise<void> {
  await request(`/campaigns/${encodeURIComponent(id)}`, { method: 'DELETE', ...NOTIFY });
}

/* ───────────────────────── GROUPS ───────────────────────── */

export async function getGroups(): Promise<ScreenGroup[]> {
  return (await request('/groups')).data || [];
}

export async function saveGroupApi(group: ScreenGroup): Promise<void> {
  await request('/groups', { method: 'POST', body: group, ...NOTIFY });
}

export async function deleteGroupApi(id: string): Promise<void> {
  await request(`/groups/${encodeURIComponent(id)}`, { method: 'DELETE', ...NOTIFY });
}

/* ───────────────────────── PUBLISHING ───────────────────────── */

export async function getPublishJobs(): Promise<PublishJob[]> {
  return (await request('/publishing/jobs')).data || [];
}

export async function dispatchPublishApi(campaign: Campaign, _playlistName: string): Promise<void> {
  // The server resolves names / targets from the database; only the campaign id (+ optional screen override) is sent.
  await request('/publishing/dispatch', {
    method: 'POST',
    body: { campaignId: campaign.id, targetScreenIds: campaign.targetScreenIds },
    ...NOTIFY,
  });
}

/* ───────────────────────── USERS & AUTH ───────────────────────── */

export async function getUsers(): Promise<UserAccount[]> {
  return (await request('/users')).data || [];
}

export async function saveUserApi(
  user: UserAccount
): Promise<{ success: boolean; error?: string; data?: UserAccount }> {
  try {
    return await request('/users', { method: 'POST', body: user });
  } catch (err: any) {
    return { success: false, error: err?.message || 'Could not save user.' };
  }
}

export async function toggleUserStatusApi(id: string): Promise<void> {
  await request(`/users/${encodeURIComponent(id)}/toggle-status`, { method: 'PATCH', ...NOTIFY });
}

export async function deleteUserApi(id: string): Promise<void> {
  await request(`/users/${encodeURIComponent(id)}`, { method: 'DELETE', ...NOTIFY });
}

export async function loginApi(
  email: string,
  password: string
): Promise<{ success: boolean; token?: string; user?: UserAccount; error?: string }> {
  try {
    return await request('/auth/login', { method: 'POST', body: { email, password } });
  } catch (err: any) {
    return { success: false, error: err?.message || 'Sign-in failed.' };
  }
}

export async function verifySessionApi(
  token: string
): Promise<{ success: boolean; user?: UserAccount; error?: string; status?: number }> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json().catch(() => ({}));
    return { ...json, success: res.ok && json.success !== false, status: res.status };
  } catch {
    throw new Error('Server unreachable');
  }
}

/* ───────────────────────── SETTINGS ───────────────────────── */

export async function getSettings(): Promise<UniversitySettings | null> {
  try {
    return (await request('/settings')).data || null;
  } catch {
    return null;
  }
}

export async function saveSettingsApi(settings: UniversitySettings): Promise<void> {
  await request('/settings', { method: 'PUT', body: settings, ...NOTIFY });
}

/* ───────────────────────── Audit / reports ───────────────────────── */

export interface AuditEntry {
  id: string;
  actionType: string;
  title: string;
  detail: string;
  actor: string;
  timestamp: string;
}

export async function getAuditLog(limit = 100): Promise<AuditEntry[]> {
  return (await request(`/audit?limit=${limit}`)).data || [];
}
