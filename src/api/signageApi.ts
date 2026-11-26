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

const API_HOST = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const API_BASE = `http://${API_HOST}:5000/api/v1`;

// SCREENS
export async function getScreens(): Promise<ScreenDevice[]> {
  const res = await fetch(`${API_BASE}/screens`);
  const json = await res.json();
  return json.data || [];
}

export async function createScreen(screen: ScreenDevice): Promise<void> {
  const res = await fetch(`${API_BASE}/screens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(screen),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Failed to create screen: ${res.statusText}`);
  }
}

export async function updateScreenApi(screen: ScreenDevice): Promise<void> {
  const res = await fetch(`${API_BASE}/screens/${screen.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(screen),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Failed to update screen: ${res.statusText}`);
  }
}

export async function assignScreenPlaylistApi(screenId: string, assignedPlaylistId: string | null): Promise<void> {
  const res = await fetch(`${API_BASE}/screens/${screenId}/assign-playlist`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignedPlaylistId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Failed to assign playlist: ${res.statusText}`);
  }
}

export async function deleteScreenApi(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/screens/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Failed to delete screen: ${res.statusText}`);
  }
}

export async function toggleScreenActiveApi(id: string): Promise<void> {
  await fetch(`${API_BASE}/screens/${id}/toggle-active`, { method: 'PATCH' });
}

export async function reconnectScreenApi(id: string): Promise<void> {
  await fetch(`${API_BASE}/screens/${id}/reconnect`, { method: 'PATCH' });
}

export function formatMediaUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/uploads/')) {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `http://${host}:5000${trimmed}`;
  }
  return trimmed;
}

// MEDIA
export async function getMedia(): Promise<MediaAsset[]> {
  const res = await fetch(`${API_BASE}/media`);
  const json = await res.json();
  return json.data || [];
}

export async function uploadMediaFile(asset: MediaAsset, file?: File | null): Promise<MediaAsset> {
  const formData = new FormData();
  if (file) {
    formData.append('file', file);
  }
  formData.append('title', asset.title);
  formData.append('category', asset.category);
  formData.append('type', asset.type);
  if (asset.durationSeconds) {
    formData.append('durationSeconds', String(asset.durationSeconds));
  }
  if (asset.description) {
    formData.append('description', asset.description);
  }
  if (asset.aspectRatio) {
    formData.append('aspectRatio', asset.aspectRatio);
  }
  if (asset.dimensions) {
    formData.append('dimensions', asset.dimensions);
  }
  formData.append('uploadedBy', asset.uploadedBy || 'Vinod Kumar Jain');

  const res = await fetch(`${API_BASE}/media/upload`, {
    method: 'POST',
    body: formData,
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Upload failed');
  }
  return json.data || asset;
}

export async function deleteMediaApi(id: string): Promise<void> {
  await fetch(`${API_BASE}/media/${id}`, { method: 'DELETE' });
}

// PLAYLISTS
export async function getPlaylists(): Promise<Playlist[]> {
  const res = await fetch(`${API_BASE}/playlists`);
  const json = await res.json();
  return json.data || [];
}

export async function savePlaylistApi(playlist: Playlist): Promise<void> {
  await fetch(`${API_BASE}/playlists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(playlist),
  });
}

export async function deletePlaylistApi(id: string): Promise<void> {
  await fetch(`${API_BASE}/playlists/${id}`, { method: 'DELETE' });
}

export async function addMediaToPlaylistApi(playlistId: string, mediaId: string): Promise<void> {
  await fetch(`${API_BASE}/playlists/${playlistId}/add-media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mediaId }),
  });
}

// CAMPAIGNS
export async function getCampaigns(): Promise<Campaign[]> {
  const res = await fetch(`${API_BASE}/campaigns`);
  const json = await res.json();
  return json.data || [];
}

export async function saveCampaignApi(campaign: Campaign): Promise<void> {
  await fetch(`${API_BASE}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(campaign),
  });
}

export async function updateCampaignStatusApi(id: string, status: CampaignStatus): Promise<void> {
  await fetch(`${API_BASE}/campaigns/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

export async function deleteCampaignApi(id: string): Promise<void> {
  await fetch(`${API_BASE}/campaigns/${id}`, { method: 'DELETE' });
}

// GROUPS
export async function getGroups(): Promise<ScreenGroup[]> {
  const res = await fetch(`${API_BASE}/groups`);
  const json = await res.json();
  return json.data || [];
}

export async function saveGroupApi(group: ScreenGroup): Promise<void> {
  await fetch(`${API_BASE}/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(group),
  });
}

export async function deleteGroupApi(id: string): Promise<void> {
  await fetch(`${API_BASE}/groups/${id}`, { method: 'DELETE' });
}

// PUBLISHING
export async function getPublishJobs(): Promise<PublishJob[]> {
  const res = await fetch(`${API_BASE}/publishing/jobs`);
  const json = await res.json();
  return json.data || [];
}

export async function dispatchPublishApi(campaign: Campaign, playlistName: string): Promise<void> {
  await fetch(`${API_BASE}/publishing/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      campaignId: campaign.id,
      campaignName: campaign.name,
      playlistId: campaign.playlistId,
      playlistName,
      targetScreenIds: campaign.targetScreenIds,
    }),
  });
}

// USERS & AUTH
export async function getUsers(): Promise<UserAccount[]> {
  const res = await fetch(`${API_BASE}/users`);
  const json = await res.json();
  return json.data || [];
}

export async function saveUserApi(
  user: UserAccount
): Promise<{ success: boolean; error?: string; data?: UserAccount }> {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  });
  return res.json();
}

export async function toggleUserStatusApi(id: string): Promise<void> {
  await fetch(`${API_BASE}/users/${id}/toggle-status`, { method: 'PATCH' });
}

export async function deleteUserApi(id: string): Promise<void> {
  await fetch(`${API_BASE}/users/${id}`, { method: 'DELETE' });
}

export async function loginApi(
  email: string,
  password: string
): Promise<{ success: boolean; token?: string; user?: UserAccount; error?: string }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export async function verifySessionApi(
  token: string
): Promise<{ success: boolean; user?: UserAccount; error?: string; status?: number }> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  return { ...json, status: res.status };
}

// SETTINGS
export async function getSettings(): Promise<UniversitySettings | null> {
  const res = await fetch(`${API_BASE}/settings`);
  const json = await res.json();
  return json.data || null;
}

export async function saveSettingsApi(settings: UniversitySettings): Promise<void> {
  await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
}
