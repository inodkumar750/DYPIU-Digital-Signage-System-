import { PageRoute, UserRole } from '../types/signage';

export const ALL_ADMIN_MENUS: { id: PageRoute; label: string; description: string }[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'KPI overview & quick actions' },
  { id: 'media', label: 'Media Library', description: 'Upload, edit & delete images/videos' },
  { id: 'playlists', label: 'Playlists', description: 'Build & preview TV / Standy loops' },
  { id: 'campaigns', label: 'Campaigns', description: 'Schedule & manage signage campaigns' },
  { id: 'screens', label: 'Screen Management', description: 'Register displays & launch player' },
  { id: 'groups', label: 'Screen Groups', description: 'Manage floor & building groups' },
  { id: 'publishing', label: 'Publishing', description: 'Push sync jobs & retry queue' },
  { id: 'monitoring', label: 'Monitoring', description: 'Live screen health & heartbeats' },
  { id: 'reports', label: 'Reports', description: 'Uptime, impressions & audit exports' },
  { id: 'users', label: 'User Management', description: 'Manage accounts, passwords & menus' },
  { id: 'settings', label: 'Settings', description: 'Platform defaults & TV bar config' },
];

export const DEFAULT_MENUS_BY_ROLE: Record<UserRole, PageRoute[]> = {
  'Super Administrator': ALL_ADMIN_MENUS.map((m) => m.id),
  'IT Administrator': ['dashboard', 'screens', 'groups', 'publishing', 'monitoring', 'reports', 'settings'],
  'Content Manager': ['dashboard', 'media', 'playlists', 'campaigns', 'publishing'],
  'Monitoring User': ['dashboard', 'monitoring', 'reports'],
};

export function getEffectiveMenus(role: UserRole, allowedMenus?: PageRoute[]): PageRoute[] {
  if (role === 'Super Administrator' && (!allowedMenus || allowedMenus.length === 0)) {
    return DEFAULT_MENUS_BY_ROLE['Super Administrator'];
  }
  if (Array.isArray(allowedMenus) && allowedMenus.length > 0) {
    return allowedMenus.filter((m) => m !== 'player');
  }
  return DEFAULT_MENUS_BY_ROLE[role] || ['dashboard'];
}
