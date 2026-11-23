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

export default function App() {
  const [activeRoute, setActiveRoute] = useState<PageRoute>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Domain State (Phase 1 Local Prototype State)
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>(INITIAL_MEDIA_ASSETS);
  const [playlists, setPlaylists] = useState<Playlist[]>(INITIAL_PLAYLISTS);
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);
  const [screens, setScreens] = useState<ScreenDevice[]>(INITIAL_SCREENS);
  const [groups, setGroups] = useState<ScreenGroup[]>(INITIAL_SCREEN_GROUPS);
  const [publishJobs, setPublishJobs] = useState<PublishJob[]>(INITIAL_PUBLISH_JOBS);
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
  const handleAddMedia = (asset: MediaAsset) => {
    setMediaAssets((prev) => [asset, ...prev]);
    appendActivity('upload', `Uploaded ${asset.fileName}`, `${asset.category} · ${asset.fileSize}`);
    pushToast(`Simulated upload: "${asset.title}" added to local Media Library.`, 'success');
  };

  const handleUpdateMedia = (updated: MediaAsset) => {
    setMediaAssets((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    pushToast(`Updated metadata for "${updated.title}".`, 'success');
  };

  const handleDeleteMedia = (id: string) => {
    const target = mediaAssets.find((m) => m.id === id);
    setMediaAssets((prev) => prev.filter((m) => m.id !== id));
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
    appendActivity(
      'playlist',
      `${exists ? 'Updated' : 'Created'} playlist "${pl.name}"`,
      `${pl.items.length} media slides configured`
    );
    pushToast(`Saved playlist "${pl.name}" locally.`, 'success');
  };

  const handleDeletePlaylist = (id: string) => {
    const target = playlists.find((p) => p.id === id);
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    if (target) pushToast(`Deleted playlist "${target.name}".`);
  };

  // Campaign Handlers
  const handleSaveCampaign = (cmp: Campaign) => {
    setCampaigns((prev) => [cmp, ...prev]);
    appendActivity(
      'campaign',
      `Created campaign "${cmp.name}"`,
      `${cmp.targetScreenIds.length} screens · ${cmp.status}`
    );
    pushToast(`Campaign "${cmp.name}" saved as ${cmp.status}.`, 'success');
  };

  const handleUpdateCampaignStatus = (id: string, status: CampaignStatus) => {
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    pushToast(`Campaign status changed to ${status}.`);
  };

  const handleDeleteCampaign = (id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    pushToast('Campaign removed from schedule.');
  };

  // Screen Handlers
  const handleAddScreen = (scr: ScreenDevice) => {
    setScreens((prev) => [scr, ...prev]);
    appendActivity('screen', `Registered ${scr.id} (${scr.name})`, `${scr.building} · ${scr.floor}`);
    pushToast(`Added screen ${scr.id} to campus inventory.`, 'success');
  };

  const handleUpdateScreen = (updated: ScreenDevice) => {
    setScreens((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    pushToast(`Updated ${updated.id} (${updated.name}).`, 'success');
  };

  const handleToggleActiveScreen = (id: string) => {
    setScreens((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s))
    );
    pushToast(`Updated active state for ${id}.`);
  };

  const handleSimulateReconnect = (id: string) => {
    setScreens((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              connectionStatus: 'Online',
              lastSeen: 'Just now',
              lastHeartbeat: '2026-11-23 09:37:20',
              playbackError: null,
            }
          : s
      )
    );
    appendActivity('screen', `Reconnected ${id}`, 'Simulated heartbeat restored');
    pushToast(`Simulated reconnect: ${id} is now Online.`, 'success');
  };

  // Group Handlers
  const handleSaveGroup = (grp: ScreenGroup) => {
    const exists = groups.some((g) => g.id === grp.id);
    setGroups((prev) =>
      exists ? prev.map((g) => (g.id === grp.id ? grp : g)) : [grp, ...prev]
    );
    pushToast(`Saved screen group "${grp.name}".`, 'success');
  };

  const handleDeleteGroup = (id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
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
  const handleSaveUser = (usr: UserAccount) => {
    const exists = users.some((u) => u.id === usr.id);
    setUsers((prev) =>
      exists ? prev.map((u) => (u.id === usr.id ? usr : u)) : [usr, ...prev]
    );
    pushToast(`Saved administrator "${usr.name}" (${usr.role}).`, 'success');
  };

  const handleToggleUserStatus = (id: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? { ...u, status: u.status === 'Suspended' ? 'Active' : 'Suspended' }
          : u
      )
    );
    pushToast('Updated user account status.');
  };

  const handleSaveSettings = (updated: UniversitySettings) => {
    setSettings(updated);
    pushToast('Saved platform settings to local prototype session.', 'success');
  };

  const currentNav = NAV_ITEMS.find((item) => item.id === activeRoute) || NAV_ITEMS[0];
  const offlineCount = screens.filter((s) => s.connectionStatus === 'Offline').length;
  const totalMediaCount = ARCHIVED_LIBRARY_OFFSET + mediaAssets.length;

  return (
    <div className="min-h-screen flex bg-[#FAF8FC] text-[#1A1025]">
      <Sidebar
        activeRoute={activeRoute}
        onNavigate={setActiveRoute}
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
          onNavigate={setActiveRoute}
          notifications={notifications}
          onMarkAllRead={() =>
            setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
          }
          screens={screens}
          campaigns={campaigns}
          mediaAssets={mediaAssets}
          playlists={playlists}
          onOpenHelp={() => setHelpOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 max-w-[1480px] w-full mx-auto">
          {activeRoute === 'dashboard' && (
            <DashboardPage
              screens={screens}
              campaigns={campaigns}
              playlists={playlists}
              mediaAssets={mediaAssets}
              totalMediaCount={totalMediaCount}
              activities={activities}
              onNavigate={setActiveRoute}
              onQuickAction={handleQuickAction}
            />
          )}

          {activeRoute === 'media' && (
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

          {activeRoute === 'playlists' && (
            <PlaylistsPage
              playlists={playlists}
              mediaAssets={mediaAssets}
              openCreateSignal={createPlaylistSignal}
              onSavePlaylist={handleSavePlaylist}
              onDeletePlaylist={handleDeletePlaylist}
            />
          )}

          {activeRoute === 'campaigns' && (
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

          {activeRoute === 'screens' && (
            <ScreenManagementPage
              screens={screens}
              playlists={playlists}
              mediaAssets={mediaAssets}
              openAddSignal={addScreenSignal}
              onAddScreen={handleAddScreen}
              onUpdateScreen={handleUpdateScreen}
              onToggleActiveScreen={handleToggleActiveScreen}
            />
          )}

          {activeRoute === 'groups' && (
            <ScreenGroupsPage
              groups={groups}
              screens={screens}
              playlists={playlists}
              onSaveGroup={handleSaveGroup}
              onDeleteGroup={handleDeleteGroup}
            />
          )}

          {activeRoute === 'publishing' && (
            <PublishingPage
              publishJobs={publishJobs}
              campaigns={campaigns}
              playlists={playlists}
              screens={screens}
              onTriggerPublish={handleTriggerPublish}
              onRetryJob={handleRetryPublishJob}
            />
          )}

          {activeRoute === 'monitoring' && (
            <MonitoringPage
              screens={screens}
              playlists={playlists}
              mediaAssets={mediaAssets}
              onSimulateReconnect={handleSimulateReconnect}
            />
          )}

          {activeRoute === 'reports' && (
            <ReportsPage
              campaigns={campaigns}
              screens={screens}
              mediaAssets={mediaAssets}
              publishJobs={publishJobs}
              onExportToast={(msg) => pushToast(msg, 'success')}
            />
          )}

          {activeRoute === 'users' && (
            <UserManagementPage
              users={users}
              onSaveUser={handleSaveUser}
              onToggleUserStatus={handleToggleUserStatus}
            />
          )}

          {activeRoute === 'settings' && (
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
