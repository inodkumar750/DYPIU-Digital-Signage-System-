export type PageRoute =
  | 'dashboard'
  | 'media'
  | 'playlists'
  | 'campaigns'
  | 'screens'
  | 'groups'
  | 'publishing'
  | 'monitoring'
  | 'reports'
  | 'users'
  | 'settings'
  | 'player';

export type MediaCategory =
  | 'University Admissions'
  | 'Events'
  | 'Workshops'
  | 'Placements'
  | 'Student Activities'
  | 'Announcements';

export type MediaType = 'Image' | 'Video';
export type MediaAspectRatio = '16:9' | '9:16';

export interface MediaAsset {
  id: string;
  fileName: string;
  title: string;
  type: MediaType;
  category: MediaCategory;
  uploadDate: string; // YYYY-MM-DD
  durationSeconds?: number; // for videos or default slide duration
  fileSize: string;
  dimensions: string;
  aspectRatio?: MediaAspectRatio;
  thumbnailUrl?: string;
  fileUrl?: string;
  accentTone?: 'primary' | 'secondary' | 'accent' | 'cream';
  uploadedBy: string;
  description?: string;
}

export interface PlaylistItem {
  id: string;
  mediaId: string;
  order: number;
  displayDurationSeconds: number;
  muteAudio: boolean;
  loopVideo: boolean;
}

export type PlaylistStatus = 'Active' | 'Draft' | 'Archived';

export interface Playlist {
  id: string;
  name: string;
  description: string;
  items: PlaylistItem[];
  assignedScreenIds: string[];
  lastUpdated: string;
  status: PlaylistStatus;
  defaultImageDuration: number;
  autoAdvanceVideo: boolean;
  loopPlaylist: boolean;
}

export type CampaignStatus = 'Draft' | 'Scheduled' | 'Active' | 'Paused' | 'Completed';

export interface Campaign {
  id: string;
  name: string;
  description: string;
  playlistId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  targetScreenIds: string[];
  targetGroupIds: string[];
  status: CampaignStatus;
  priority: 'Normal' | 'High' | 'Urgent';
  createdBy: string;
}

export type ConnectionStatus = 'Online' | 'Offline';

export interface ScreenDevice {
  id: string; // e.g., DYPIU-TV-001
  name: string;
  building: string;
  floor: string;
  location: string;
  deviceType: string;
  resolution: string;
  osVersion: string;
  playerAppVersion: string;
  connectionStatus: ConnectionStatus;
  lastSeen: string;
  lastHeartbeat: string;
  assignedPlaylistId: string | null;
  currentMediaId: string | null;
  ipAddress: string;
  storageUsedPct: number;
  playbackError?: string | null;
  isActive: boolean;
}

export interface ScreenGroup {
  id: string;
  name: string;
  building: string;
  floor: string;
  description: string;
  screenIds: string[];
  assignedPlaylistId: string | null;
}

export type PublishingStatus = 'Pending' | 'Publishing' | 'Published' | 'Failed';

export interface PublishJob {
  id: string;
  campaignId: string;
  campaignName: string;
  playlistId: string;
  playlistName: string;
  targetScreenIds: string[];
  publicationDate: string;
  status: PublishingStatus;
  successCount: number;
  failedCount: number;
  progressPct: number;
  initiatedBy: string;
  errorMessage?: string;
}

export type UserRole =
  | 'Super Administrator'
  | 'IT Administrator'
  | 'Content Manager'
  | 'Monitoring User';

export type UserStatus = 'Active' | 'Invited' | 'Suspended';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  department: string;
  role: UserRole;
  allowedMenus?: PageRoute[];
  password?: string;
  status: UserStatus;
  lastLogin: string;
  avatarUrl?: string;
}

export interface ActivityEvent {
  id: string;
  actionType: 'upload' | 'playlist' | 'campaign' | 'screen' | 'publish';
  title: string;
  detail: string;
  actor: string;
  timestamp: string;
}

export interface UniversitySettings {
  universityName: string;
  campusLocation: string;
  itDepartmentEmail: string;
  supportPhone: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  creamColor: string;
  timezone: string;
  dateFormat: string;
  defaultImageDurationSeconds: number;
  defaultTransition: 'Fade' | 'Slide' | 'Cut';
  showTvTicker?: boolean;
  maxUploadSizeMb: number;
  autoTranscodeVideo: boolean;
  notifyOfflineMinutes: number;
  emailAlertsEnabled: boolean;
  playbackFailureAlerts: boolean;
  sessionTimeoutMinutes: number;
  require2FAForAdmins: boolean;
  keycloakRealm: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  unread: boolean;
  category: 'alert' | 'publish' | 'system';
}
