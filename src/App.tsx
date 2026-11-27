import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityEvent,
  Campaign,
  CampaignStatus,
  MediaAsset,
  NotificationItem,
  PageRoute,
  Playlist,
  PublishJob,
  ScreenDevice,
  ScreenGroup,
  UniversitySettings,
  UserAccount,
} from './types/signage';
import {
  ARCHIVED_LIBRARY_OFFSET,
  INITIAL_ACTIVITIES,
  INITIAL_CAMPAIGNS,
  INITIAL_MEDIA_ASSETS,
  INITIAL_NOTIFICATIONS,
  INITIAL_PLAYLISTS,
  INITIAL_PUBLISH_JOBS,
  INITIAL_SCREENS,
  INITIAL_SCREEN_GROUPS,
  INITIAL_SETTINGS,
  INITIAL_USERS,
} from './data/mockSignageData';
import { NAV_ITEMS, Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { ToastContainer, ToastMessage } from './components/ui/Toast';
import { Modal } from './components/ui/Modal';
import {
  getScreens,
  createScreen,
  updateScreenApi,
  assignScreenPlaylistApi,
  toggleScreenActiveApi,
  reconnectScreenApi,
  deleteScreenApi,
  getMedia,
  uploadMediaFile,
  deleteMediaApi,
  getPlaylists,
  savePlaylistApi,
  deletePlaylistApi,
  addMediaToPlaylistApi,
  getCampaigns,
  saveCampaignApi,
  updateCampaignStatusApi,
  deleteCampaignApi,
  getGroups,
  saveGroupApi,
  deleteGroupApi,
  getPublishJobs,
  dispatchPublishApi,
  getUsers,
  saveUserApi,
  toggleUserStatusApi,
  deleteUserApi,
  verifySessionApi,
  getSettings,
  saveSettingsApi,
} from './api/signageApi';
import { getEffectiveMenus } from './utils/rbac';

import { DashboardPage } from './pages/DashboardPage';
import { MediaLibraryPage } from './pages/MediaLibraryPage';
import { PlaylistsPage } from './pages/PlaylistsPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { ScreenManagementPage } from './pages/ScreenManagementPage';
import { ScreenGroupsPage } from './pages/ScreenGroupsPage';
import { PublishingPage } from './pages/PublishingPage';
import { MonitoringPage } from './pages/MonitoringPage';
import { ReportsPage } from './pages/ReportsPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { SettingsPage } from './pages/SettingsPage';
import { TvPlayerPage } from './pages/TvPlayerPage';
import { LoginPage } from './pages/LoginPage';

export default function App() {
  const urlParams =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const tvParam = urlParams?.get('tv') || urlParams?.get('screen') || '';
  const isKioskParam = urlParams?.get('kiosk') === '1' || urlParams?.get('kiosk') === 'true';
  const isCastParam = urlParams?.get('cast') === '1' || urlParams?.get('cast') === 'true';
  const isPlayerUrl =
    typeof window !== 'undefined' &&
    (Boolean(tvParam) ||
      window.location.search.includes('tv') ||
      window.location.search.includes('player') ||
      window.location.search.includes('kiosk') ||
      window.location.search.includes('cast') ||
      window.location.pathname.includes('player'));
  const [activeRoute, setActiveRoute] = useState<PageRoute>(isPlayerUrl ? 'player' : 'dashboard');
  const [launchScreenId, setLaunchScreenId] = useState<string>(tvParam || 'DYPIU-TV-001');
  const [launchKioskMode, setLaunchKioskMode] = useState<boolean>(isKioskParam);
  const [launchCastMode, setLaunchCastMode] = useState<boolean>(isCastParam);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Authenticated Admin Session (TV ?player URLs bypass login)
  const [authToken, setAuthToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem('campuscast_auth_token');
  });
  const [authUser, setAuthUser] = useState<UserAccount | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem('campuscast_auth_user');
      return raw ? (JSON.parse(raw) as UserAccount) : null;
    } catch {
      return null;
    }
  });

  // Domain State (Phase 1 Local Prototype State)
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>(INITIAL_MEDIA_ASSETS);
  const [playlists, setPlaylists] = useState<Playlist[]>(INITIAL_PLAYLISTS);
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);
  const [screens, setScreens] = useState<ScreenDevice[]>(INITIAL_SCREENS);
  const [groups, setGroups] = useState<ScreenGroup[]>(INITIAL_SCREEN_GROUPS);
  const [publishJobs, setPublishJobs] = useState<PublishJob[]>([]);
  const [users, setUsers] = useState<UserAccount[]>(INITIAL_USERS);
  const [activities, setActivities] = useState<ActivityEvent[]>(INITIAL_ACTIVITIES);
  const [notifications, setNotifications] =
    useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [settings, setSettings] = useState<UniversitySettings>(INITIAL_SETTINGS);

  // Signals to trigger creation modals when coming from Dashboard Quick Actions
  const [uploadMediaSignal, setUploadMediaSignal] = useState(0);
  const [createPlaylistSignal, setCreatePlaylistSignal] = useState(0);
  const [addScreenSignal, setAddScreenSignal] = useState(0);
  const [createCampaignSignal, setCreateCampaignSignal] = useState(0);

  // Toasts & timers
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  // Phase 2: Load live records directly from MySQL backend
  useEffect(() => {
    async function loadBackendData() {
      try {
        const [
          dbScreens,
          dbMedia,
          dbPlaylists,
          dbCampaigns,
          dbGroups,
          dbJobs,
          dbUsers,
          dbSettings,
        ] = await Promise.allSettled([
          getScreens(),
          getMedia(),
          getPlaylists(),
          getCampaigns(),
          getGroups(),
          getPublishJobs(),
          getUsers(),
          getSettings(),
        ]);

        if (dbScreens.status === 'fulfilled') setScreens(dbScreens.value);
        if (dbMedia.status === 'fulfilled') setMediaAssets(dbMedia.value);
        if (dbPlaylists.status === 'fulfilled') setPlaylists(dbPlaylists.value);
        if (dbCampaigns.status === 'fulfilled') setCampaigns(dbCampaigns.value);
        if (dbGroups.status === 'fulfilled') setGroups(dbGroups.value);
        if (dbJobs.status === 'fulfilled') setPublishJobs(dbJobs.value);
        if (dbUsers.status === 'fulfilled') setUsers(dbUsers.value);
        if (dbSettings.status === 'fulfilled' && dbSettings.value) setSettings(dbSettings.value);
      } catch (err) {
        console.warn('Backend connection notice (using local data fallback):', err);
      }
    }
    loadBackendData();
  }, []);

  const pushToast = useCallback((text: string, tone: 'info' | 'success' = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
    timersRef.current.push(timer);
  }, []);

  const appendActivity = useCallback(
    (
      actionType: ActivityEvent['actionType'],
      title: string,
      detail: string,
      actor = 'Vinod Kumar Jain'
    ) => {
      setActivities((prev) => [
        {
          id: `act-${Date.now()}`,
          actionType,
          title,
          detail,
          actor,
          timestamp: 'Just now',
        },
        ...prev,
      ]);
    },
    []
  );

  const handleQuickAction = (
    action: 'upload-media' | 'create-playlist' | 'add-screen' | 'create-campaign'
  ) => {
    if (action === 'upload-media') {
      setActiveRoute('media');
      setUploadMediaSignal((n) => n + 1);
    } else if (action === 'create-playlist') {
      setActiveRoute('playlists');
      setCreatePlaylistSignal((n) => n + 1);
    } else if (action === 'add-screen') {
      setActiveRoute('screens');
      setAddScreenSignal((n) => n + 1);
    } else if (action === 'create-campaign') {
      setActiveRoute('campaigns');
      setCreateCampaignSignal((n) => n + 1);
    }
  };

  // Media Handlers
  const handleAddMedia = async (asset: MediaAsset, file?: File | null) => {
    setMediaAssets((prev) => [asset, ...prev]);
    appendActivity('upload', `Uploaded ${asset.fileName}`, `${asset.category} · ${asset.fileSize}`);
    pushToast(`Uploading "${asset.title}" to server...`, 'info');

    try {
      const saved = await uploadMediaFile(asset, file);
      setMediaAssets((prev) => prev.map((m) => (m.id === asset.id ? saved : m)));
      pushToast(`Media "${asset.title}" saved to library and database.`, 'success');
    } catch (err: any) {
      console.error('API Error:', err);
      pushToast(`Failed to save media: ${err?.message || 'Upload error'}`, 'error');
    }
  };

  const handleUpdateMedia = (updated: MediaAsset) => {
    setMediaAssets((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    pushToast(`Updated metadata for "${updated.title}".`, 'success');
  };

  const handleDeleteMedia = (id: string) => {
    const target = mediaAssets.find((m) => m.id === id);
    setMediaAssets((prev) => prev.filter((m) => m.id !== id));
    deleteMediaApi(id).catch((err) => console.error('API Error:', err));
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (!pl.items.some((item) => item.mediaId === id)) return pl;
        const nextItems = pl.items
          .filter((item) => item.mediaId !== id)
          .map((item, idx) => ({ ...item, order: idx + 1 }));
        return {
          ...pl,
          items: nextItems,
          lastUpdated: '2026-11-23 09:37',
        };
      })
    );
    if (target) pushToast(`Removed "${target.title}" from Media Library.`);
  };

  const handleAddToPlaylist = (playlistId: string, mediaId: string) => {
    const media = mediaAssets.find((m) => m.id === mediaId);
    const playlist = playlists.find((p) => p.id === playlistId);
    addMediaToPlaylistApi(playlistId, mediaId).catch((err) => console.error('API Error:', err));
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== playlistId) return pl;
        return {
          ...pl,
          lastUpdated: '2026-11-23 09:37',
          items: [
            ...pl.items,
            {
              id: `pi-${Date.now()}`,
              mediaId,
              order: pl.items.length + 1,
              displayDurationSeconds:
                media?.type === 'Video'
                  ? media.durationSeconds || 30
                  : pl.defaultImageDuration,
              muteAudio: true,
              loopVideo: false,
            },
          ],
        };
      })
    );
    if (media && playlist) {
      appendActivity('playlist', `Updated "${playlist.name}"`, `Added "${media.title}"`);
      pushToast(`Added "${media.title}" to playlist "${playlist.name}".`, 'success');
    }
  };

  // Playlist Handlers
  const handleSavePlaylist = (pl: Playlist) => {
    const exists = playlists.some((p) => p.id === pl.id);
    setPlaylists((prev) =>
      exists ? prev.map((p) => (p.id === pl.id ? pl : p)) : [pl, ...prev]
    );
    savePlaylistApi(pl).catch((err) => console.error('API Error:', err));
    appendActivity(
      'playlist',
      `${exists ? 'Updated' : 'Created'} playlist "${pl.name}"`,
      `${pl.items.length} media slides configured`
    );
    pushToast(`Saved playlist "${pl.name}" to database.`, 'success');
  };

  const handleDeletePlaylist = (id: string) => {
    const target = playlists.find((p) => p.id === id);
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    deletePlaylistApi(id).catch((err) => console.error('API Error:', err));
    if (target) pushToast(`Deleted playlist "${target.name}".`);
  };

  // Campaign Handlers
  const handleSaveCampaign = (cmp: Campaign) => {
    const exists = campaigns.some((c) => c.id === cmp.id);
    setCampaigns((prev) =>
      exists ? prev.map((c) => (c.id === cmp.id ? cmp : c)) : [cmp, ...prev]
    );
    saveCampaignApi(cmp).catch((err) => console.error('API Error:', err));
    appendActivity(
      'campaign',
      `${exists ? 'Updated' : 'Created'} campaign "${cmp.name}"`,
      `${cmp.startDate} → ${cmp.endDate} (${cmp.startTime}–${cmp.endTime}) · ${cmp.status}`
    );
    pushToast(
      `Campaign "${cmp.name}" ${exists ? 'updated' : 'saved'} as ${cmp.status}.`,
      'success'
    );
  };

  const handleUpdateCampaignStatus = (id: string, status: CampaignStatus) => {
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    updateCampaignStatusApi(id, status).catch((err) => console.error('API Error:', err));
    pushToast(`Campaign status changed to ${status}.`);
  };

  const handleDeleteCampaign = (id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    deleteCampaignApi(id).catch((err) => console.error('API Error:', err));
    pushToast('Campaign removed from schedule.');
  };

  // Screen Handlers
  const handleAddScreen = async (scr: ScreenDevice) => {
    setScreens((prev) => [scr, ...prev]);
    try {
      await createScreen(scr);
      appendActivity('screen', `Registered ${scr.id} (${scr.name})`, `${scr.building} · ${scr.floor}`);
      pushToast(`Added screen ${scr.id} to database.`, 'success');
    } catch (err: any) {
      console.error('API Error:', err);
      pushToast(`Notice: saved locally. (${err.message || 'offline'})`, 'info');
    }
  };

  const handleUpdateScreen = async (updated: ScreenDevice) => {
    setScreens((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    try {
      await updateScreenApi(updated);
      pushToast(`Saved ${updated.id} (${updated.name}) to database.`, 'success');
    } catch (err: any) {
      console.error('API Error:', err);
      pushToast(`Notice: updated locally. (${err.message || 'offline'})`, 'info');
    }
  };

  const handleAssignScreenToPlaylist = async (playlistId: string, targetScreenIds: string[]) => {
    setScreens((prev) =>
      prev.map((s) => {
        if (targetScreenIds.includes(s.id)) {
          return { ...s, assignedPlaylistId: playlistId };
        } else if (s.assignedPlaylistId === playlistId) {
          return { ...s, assignedPlaylistId: null };
        }
        return s;
      })
    );

    for (const scr of screens) {
      const willBeAssigned = targetScreenIds.includes(scr.id);
      const isCurrentlyAssigned = scr.assignedPlaylistId === playlistId;
      if (willBeAssigned !== isCurrentlyAssigned) {
        assignScreenPlaylistApi(scr.id, willBeAssigned ? playlistId : null).catch(console.error);
      }
    }
    pushToast(`Updated TV display assignments in database.`, 'success');
  };

  const handleToggleActiveScreen = (id: string) => {
    setScreens((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const nextActive = !s.isActive;
        return {
          ...s,
          isActive: nextActive,
          connectionStatus: nextActive ? s.connectionStatus : 'Offline',
          lastSeen: nextActive ? s.lastSeen : 'Turned Off (Standby)',
        };
      })
    );
    toggleScreenActiveApi(id).catch((err) => console.error('API Error:', err));
    pushToast(`Updated power state for ${id}.`);
  };

  const handleDeleteScreen = async (id: string) => {
    const target = screens.find((s) => s.id === id);
    setScreens((prev) => prev.filter((s) => s.id !== id));
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        screenIds: g.screenIds.filter((sid) => sid !== id),
      }))
    );
    setCampaigns((prev) =>
      prev.map((c) => ({
        ...c,
        targetScreenIds: c.targetScreenIds.filter((sid) => sid !== id),
      }))
    );
    try {
      await deleteScreenApi(id);
      appendActivity('screen', `Deleted screen ${id}`, target ? target.name : 'Removed display');
      pushToast(`Deleted screen ${id}.`, 'success');
    } catch (err) {
      console.error('API Error:', err);
      pushToast(`Failed to delete screen ${id} from server.`, 'info');
      refreshScreensLive();
    }
  };

  const handleSimulateReconnect = async (id: string) => {
    setScreens((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: true, playbackError: null } : s))
    );
    try {
      await reconnectScreenApi(id);
      await refreshScreensLive();
    } catch (err) {
      console.error('API Error:', err);
    }
    appendActivity('screen', `Sent wake signal to ${id}`, 'Waiting for physical TV heartbeat');
    pushToast(
      `Wake/Reconnect signal sent to ${id}. It will turn Online automatically once the physical TV responds.`,
      'info'
    );
  };

  // Group Handlers
  const handleSaveGroup = (grp: ScreenGroup) => {
    const exists = groups.some((g) => g.id === grp.id);
    setGroups((prev) =>
      exists ? prev.map((g) => (g.id === grp.id ? grp : g)) : [grp, ...prev]
    );
    saveGroupApi(grp).catch((err) => console.error('API Error:', err));
    pushToast(`Saved screen group "${grp.name}".`, 'success');
  };

  const handleDeleteGroup = (id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
    deleteGroupApi(id).catch((err) => console.error('API Error:', err));
    pushToast('Screen group removed.');
  };

  // Publishing Simulation
  const runSimulatedPublishProgress = (jobId: string, targetIds: string[]) => {
    const t1 = window.setTimeout(() => {
      setPublishJobs((prev) =>
        prev.map((j) =>
          j.id === jobId ? { ...j, status: 'Publishing', progressPct: 55 } : j
        )
      );
    }, 650);

    const t2 = window.setTimeout(() => {
      const onlineCount = targetIds.filter(
        (sid) => screens.find((s) => s.id === sid)?.connectionStatus === 'Online'
      ).length;
      const failedCount = targetIds.length - onlineCount;
      setPublishJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status: failedCount > 0 ? 'Failed' : 'Published',
                progressPct: 100,
                successCount: onlineCount,
                failedCount,
                errorMessage:
                  failedCount > 0
                    ? `${failedCount} target screen(s) currently offline`
                    : undefined,
              }
            : j
        )
      );
      pushToast(
        failedCount > 0
          ? `Simulated dispatch finished with ${failedCount} offline screen(s).`
          : `Simulated dispatch complete across ${onlineCount} screen(s).`,
        failedCount > 0 ? 'info' : 'success'
      );
    }, 1500);

    timersRef.current.push(t1, t2);
  };

  const handleTriggerPublish = (campaign: Campaign) => {
    const pl = playlists.find((p) => p.id === campaign.playlistId);
    const jobId = `pub-${Date.now().toString().slice(-4)}`;
    const newJob: PublishJob = {
      id: jobId,
      campaignId: campaign.id,
      campaignName: campaign.name,
      playlistId: campaign.playlistId,
      playlistName: pl?.name || 'Default Playlist',
      targetScreenIds: campaign.targetScreenIds,
      publicationDate: '2026-11-23 09:37',
      status: 'Pending',
      successCount: 0,
      failedCount: 0,
      progressPct: 15,
      initiatedBy: 'Vinod Kumar Jain',
    };
    setPublishJobs((prev) => [newJob, ...prev]);
    appendActivity(
      'publish',
      `Dispatched "${campaign.name}"`,
      `Queued ${campaign.targetScreenIds.length} screens (simulated)`
    );
    pushToast(`Queued simulated publish job for "${campaign.name}".`);
    runSimulatedPublishProgress(jobId, campaign.targetScreenIds);
    dispatchPublishApi(campaign, pl?.name || 'Default Playlist').catch((err) => console.error('API Error:', err));
  };

  const handleRetryPublishJob = (jobId: string) => {
    const job = publishJobs.find((j) => j.id === jobId);
    if (!job) return;
    setPublishJobs((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? { ...j, status: 'Publishing', progressPct: 40, errorMessage: undefined }
          : j
      )
    );
    pushToast(`Retrying failed screens for job ${jobId} (simulated)...`);
    runSimulatedPublishProgress(jobId, job.targetScreenIds);
  };

  // Users & Settings Handlers
  const handleSaveUser = async (
    usr: UserAccount
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await saveUserApi(usr).catch((err) => ({
      success: false,
      error: err?.message || 'Network error',
    }));
    if (!res.success) {
      return { success: false, error: res.error || 'Could not save user account.' };
    }

    const exists = users.some((u) => u.id === usr.id);
    const { password: _omit, ...cleanUser } = usr;
    setUsers((prev) =>
      exists ? prev.map((u) => (u.id === usr.id ? cleanUser : u)) : [cleanUser, ...prev]
    );
    // Sync from MySQL so timestamps & defaults match database
    getUsers()
      .then((fresh) => {
        if (Array.isArray(fresh) && fresh.length > 0) setUsers(fresh);
      })
      .catch(() => {});

    if (authUser && authUser.id === usr.id) {
      const updatedMe = { ...authUser, ...cleanUser };
      setAuthUser(updatedMe);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('campuscast_auth_user', JSON.stringify(updatedMe));
      }
    }

    pushToast(`Saved user "${usr.name}" (${usr.role}) to MySQL database.`, 'success');
    return { success: true };
  };

  const handleToggleUserStatus = (id: string) => {
    if (authUser?.id === id) {
      pushToast('Cannot suspend your own active signed-in session.');
      return;
    }
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? { ...u, status: u.status === 'Suspended' ? 'Active' : 'Suspended' }
          : u
      )
    );
    toggleUserStatusApi(id).catch((err) => console.error('API Error:', err));
    pushToast('Updated user account status in database.');
  };

  const handleDeleteUser = (id: string) => {
    if (authUser?.id === id) {
      pushToast('Cannot delete your own active signed-in account.');
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
    deleteUserApi(id).catch((err) => console.error('API Error:', err));
    pushToast('Deleted user account from database.');
  };

  const handleLoginSuccess = (token: string, user: UserAccount) => {
    setAuthToken(token);
    setAuthUser(user);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('campuscast_auth_token', token);
      window.localStorage.setItem('campuscast_auth_user', JSON.stringify(user));
    }
    const menus = getEffectiveMenus(user.role, user.allowedMenus);
    setActiveRoute(menus[0] || 'dashboard');
    getUsers()
      .then((fresh) => {
        if (Array.isArray(fresh) && fresh.length > 0) setUsers(fresh);
      })
      .catch(() => {});
    pushToast(`Welcome back, ${user.name} (${user.role})`, 'success');
  };

  const handleLogout = useCallback(
    (reason?: string) => {
      setAuthToken(null);
      setAuthUser(null);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('campuscast_auth_token');
        window.localStorage.removeItem('campuscast_auth_user');
      }
      if (reason) pushToast(reason);
    },
    [pushToast]
  );

  // Real-time session validation & RBAC permission sync every 5 seconds
  useEffect(() => {
    if (!authToken || isPlayerUrl) return;
    let cancelled = false;

    const validateLiveSession = async () => {
      try {
        const res = await verifySessionApi(authToken);
        if (cancelled) return;
        if (!res.success && (res.status === 401 || res.status === 403)) {
          handleLogout(res.error || 'Your session is no longer active.');
          return;
        }
        if (res.success && res.user) {
          setAuthUser((prev) => {
            if (prev && JSON.stringify(prev) === JSON.stringify(res.user)) return prev;
            if (typeof window !== 'undefined') {
              window.localStorage.setItem('campuscast_auth_user', JSON.stringify(res.user));
            }
            return res.user!;
          });
        }
      } catch {
        // Keep current session cleanly on transient network hiccup
      }
    };

    validateLiveSession();
    const timer = window.setInterval(validateLiveSession, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [authToken, isPlayerUrl, handleLogout]);

  const refreshScreensLive = useCallback(async () => {
    try {
      const latest = await getScreens();
      if (Array.isArray(latest)) {
        setScreens((prev) =>
          JSON.stringify(prev) === JSON.stringify(latest) ? prev : latest
        );
      }
    } catch {
      // Ignore transient network errors
    }
  }, []);

  // Poll live screen heartbeats & TV ON/OFF state every 5s in Dashboard / Monitoring / Screen Management
  useEffect(() => {
    if (!authUser || activeRoute === 'player') return;
    refreshScreensLive();
    const timer = window.setInterval(refreshScreensLive, 5000);
    return () => window.clearInterval(timer);
  }, [authUser, activeRoute, refreshScreensLive]);

  const allowedMenus = React.useMemo<PageRoute[]>(
    () => (authUser ? getEffectiveMenus(authUser.role, authUser.allowedMenus) : []),
    [authUser]
  );

  useEffect(() => {
    if (!authUser || activeRoute === 'player') return;
    if (allowedMenus.length > 0 && !allowedMenus.includes(activeRoute)) {
      setActiveRoute(allowedMenus[0]);
    }
  }, [authUser, activeRoute, allowedMenus]);

  const navigateGuarded = useCallback(
    (route: PageRoute) => {
      if (route === 'player') {
        setActiveRoute('player');
        return;
      }
      if (authUser && !allowedMenus.includes(route)) {
        pushToast(`Access restricted: "${route}" is not enabled for your role.`);
        return;
      }
      setActiveRoute(route);
    },
    [authUser, allowedMenus, pushToast]
  );

  const handleSaveSettings = (updated: UniversitySettings) => {
    setSettings(updated);
    saveSettingsApi(updated).catch((err) => console.error('API Error:', err));
    pushToast('Saved platform settings to MySQL database.', 'success');
  };

  const currentNav = NAV_ITEMS.find((item) => item.id === activeRoute) || NAV_ITEMS[0];
  const offlineCount = screens.filter((s) => s.connectionStatus === 'Offline').length;
  const totalMediaCount = ARCHIVED_LIBRARY_OFFSET + mediaAssets.length;

  if (activeRoute === 'player') {
    return (
      <TvPlayerPage
        screens={screens}
        playlists={playlists}
        mediaAssets={mediaAssets}
        campaigns={campaigns}
        groups={groups}
        initialScreenId={launchScreenId}
        initialKioskMode={launchKioskMode}
        initialCastMode={launchCastMode}
        showTvTicker={settings.showTvTicker !== false}
        onToggleTvTicker={(show) =>
          setSettings((prev) => ({ ...prev, showTvTicker: show }))
        }
        onAssignScreenPlaylist={(screenId, playlistId) => {
          setScreens((prev) =>
            prev.map((s) =>
              s.id === screenId ? { ...s, assignedPlaylistId: playlistId } : s
            )
          );
        }}
        onExit={() => {
          setLaunchKioskMode(false);
          setLaunchCastMode(false);
          if (typeof window !== 'undefined' && window.location.search) {
            window.history.replaceState({}, '', window.location.pathname);
          }
          setActiveRoute(allowedMenus[0] || 'dashboard');
        }}
      />
    );
  }

  if (!authUser) {
    return (
      <>
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onOpenTvMode={() => setActiveRoute('player')}
        />
        <ToastContainer
          toasts={toasts}
          onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#FAF8FC] text-[#1A1025]">
      <Sidebar
        activeRoute={activeRoute}
        onNavigate={navigateGuarded}
        allowedMenus={allowedMenus}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        offlineCount={offlineCount}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <Header
          pageTitle={currentNav.label}
          breadcrumbParent="Campus Signage"
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onNavigate={navigateGuarded}
          notifications={notifications}
          onMarkAllRead={() =>
            setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
          }
          screens={screens}
          campaigns={campaigns}
          mediaAssets={mediaAssets}
          playlists={playlists}
          onOpenHelp={() => setHelpOpen(true)}
          currentUser={authUser}
          allowedMenus={allowedMenus}
          onLogout={() => handleLogout('You have signed out cleanly.')}
        />

        <main className="flex-1 p-4 sm:p-6 max-w-[1480px] w-full mx-auto">
          {activeRoute === 'dashboard' && allowedMenus.includes('dashboard') && (
            <DashboardPage
              screens={screens}
              campaigns={campaigns}
              playlists={playlists}
              mediaAssets={mediaAssets}
              totalMediaCount={totalMediaCount}
              activities={activities}
              onNavigate={navigateGuarded}
              onQuickAction={handleQuickAction}
            />
          )}

          {activeRoute === 'media' && allowedMenus.includes('media') && (
            <MediaLibraryPage
              mediaAssets={mediaAssets}
              playlists={playlists}
              openUploadSignal={uploadMediaSignal}
              onAddMedia={handleAddMedia}
              onUpdateMedia={handleUpdateMedia}
              onDeleteMedia={handleDeleteMedia}
              onAddToPlaylist={handleAddToPlaylist}
            />
          )}

          {activeRoute === 'playlists' && allowedMenus.includes('playlists') && (
            <PlaylistsPage
              playlists={playlists}
              screens={screens}
              mediaAssets={mediaAssets}
              campaigns={campaigns}
              groups={groups}
              openCreateSignal={createPlaylistSignal}
              onSavePlaylist={handleSavePlaylist}
              onDeletePlaylist={handleDeletePlaylist}
              onAssignScreens={handleAssignScreenToPlaylist}
              onSchedulePlaylist={handleSaveCampaign}
              onDeleteSchedule={handleDeleteCampaign}
            />
          )}

          {activeRoute === 'campaigns' && allowedMenus.includes('campaigns') && (
            <CampaignsPage
              campaigns={campaigns}
              playlists={playlists}
              screens={screens}
              groups={groups}
              openWizardSignal={createCampaignSignal}
              onSaveCampaign={handleSaveCampaign}
              onUpdateStatus={handleUpdateCampaignStatus}
              onDeleteCampaign={handleDeleteCampaign}
            />
          )}

          {activeRoute === 'screens' && allowedMenus.includes('screens') && (
            <ScreenManagementPage
              screens={screens}
              playlists={playlists}
              mediaAssets={mediaAssets}
              campaigns={campaigns}
              groups={groups}
              openAddSignal={addScreenSignal}
              onAddScreen={handleAddScreen}
              onUpdateScreen={handleUpdateScreen}
              onToggleActiveScreen={handleToggleActiveScreen}
              onDeleteScreen={handleDeleteScreen}
              onLaunchPlayer={(screenId, mode) => {
                setLaunchScreenId(screenId);
                setLaunchKioskMode(mode === 'kiosk');
                setLaunchCastMode(mode === 'cast');
                setActiveRoute('player');
              }}
            />
          )}

          {activeRoute === 'groups' && allowedMenus.includes('groups') && (
            <ScreenGroupsPage
              groups={groups}
              screens={screens}
              playlists={playlists}
              onSaveGroup={handleSaveGroup}
              onDeleteGroup={handleDeleteGroup}
            />
          )}

          {activeRoute === 'publishing' && allowedMenus.includes('publishing') && (
            <PublishingPage
              publishJobs={publishJobs}
              campaigns={campaigns}
              playlists={playlists}
              screens={screens}
              onTriggerPublish={handleTriggerPublish}
              onRetryJob={handleRetryPublishJob}
            />
          )}

          {activeRoute === 'monitoring' && allowedMenus.includes('monitoring') && (
            <MonitoringPage
              screens={screens}
              playlists={playlists}
              mediaAssets={mediaAssets}
              onSimulateReconnect={handleSimulateReconnect}
              onPollHeartbeats={async () => {
                await refreshScreensLive();
                pushToast('Refreshed live TV heartbeats from MySQL.', 'success');
              }}
            />
          )}

          {activeRoute === 'reports' && allowedMenus.includes('reports') && (
            <ReportsPage
              campaigns={campaigns}
              screens={screens}
              mediaAssets={mediaAssets}
              publishJobs={publishJobs}
              onExportToast={(msg) => pushToast(msg, 'success')}
            />
          )}

          {activeRoute === 'users' && allowedMenus.includes('users') && (
            <UserManagementPage
              users={users}
              currentUserId={authUser.id}
              onSaveUser={handleSaveUser}
              onToggleUserStatus={handleToggleUserStatus}
              onDeleteUser={handleDeleteUser}
            />
          )}

          {activeRoute === 'settings' && allowedMenus.includes('settings') && (
            <SettingsPage
              settings={settings}
              onSaveSettings={handleSaveSettings}
            />
          )}
        </main>
      </div>

      {/* Help & Prototype Info Modal */}
      <Modal
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="CampusCast Prototype Guide"
        subtitle="Phase 1 Frontend UI/UX Prototype — Local Sample Data Mode"
        size="md"
      >
        <div className="space-y-4 text-xs text-[#645573] leading-relaxed">
          <p>
            <strong className="text-[#290044]">Simulated Frontend Environment:</strong> All media uploads, playlist reordering, campaign scheduling, pairing codes, and publishing dispatches run in local React state for UI/UX validation.
          </p>
          <div className="p-3.5 rounded-xl bg-[#FAF8FC] border border-[#E8E2EE] space-y-1.5">
            <p className="font-semibold text-[#290044]">Phase 2 Integration Architecture Ready:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>TypeScript domain models isolated in <code className="font-mono text-[#500071]">src/types/signage.ts</code></li>
              <li>Sample datasets separated in <code className="font-mono text-[#500071]">src/data/mockSignageData.ts</code></li>
              <li>Ready to bind to Node.js REST APIs, MySQL persistence, Keycloak SSO, and Android TV Player heartbeats</li>
            </ul>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              className="px-4 py-2 rounded-lg bg-[#500071] text-white font-semibold hover:bg-[#8A2A78]"
            >
              Got it
            </button>
          </div>
        </div>
      </Modal>

      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}
