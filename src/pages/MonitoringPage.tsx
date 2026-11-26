import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Clock,
  Monitor,
  MonitorOff,
  RefreshCw,
  Wifi,
} from 'lucide-react';
import { MediaAsset, Playlist, ScreenDevice } from '../types/signage';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { MediaThumbnail } from '../components/ui/MediaThumbnail';
import { Modal } from '../components/ui/Modal';

interface MonitoringPageProps {
  screens: ScreenDevice[];
  playlists: Playlist[];
  mediaAssets: MediaAsset[];
  onSimulateReconnect: (screenId: string) => void;
  onPollHeartbeats?: () => Promise<void> | void;
}

export const MonitoringPage: React.FC<MonitoringPageProps> = ({
  screens,
  playlists,
  mediaAssets,
  onSimulateReconnect,
  onPollHeartbeats,
}) => {
  const [statusFilter, setStatusFilter] = useState<'All' | 'Online' | 'Offline' | 'Errors'>('All');
  const [buildingFilter, setBuildingFilter] = useState('All');
  const [inspectedScreen, setInspectedScreen] = useState<ScreenDevice | null>(null);
  const formatNowTime = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };
  const [lastSyncTime, setLastSyncTime] = useState(formatNowTime);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    setLastSyncTime(formatNowTime());
  }, [screens]);

  const totalDevices = screens.length;
  const connectedDevices = screens.filter((s) => s.connectionStatus === 'Online').length;
  const offlineDevices = screens.filter((s) => s.connectionStatus === 'Offline').length;
  const playbackErrors = screens.filter((s) => Boolean(s.playbackError)).length;

  const buildings = ['All', ...Array.from(new Set(screens.map((s) => s.building)))];

  const filtered = screens.filter((s) => {
    const matchesBuilding = buildingFilter === 'All' || s.building === buildingFilter;
    const matchesStatus =
      statusFilter === 'All'
        ? true
        : statusFilter === 'Online'
          ? s.connectionStatus === 'Online'
          : statusFilter === 'Offline'
            ? s.connectionStatus === 'Offline'
            : Boolean(s.playbackError);
    return matchesBuilding && matchesStatus;
  });

  const getPlaylistName = (id: string | null) =>
    playlists.find((p) => p.id === id)?.name || 'No active playlist';

  const getMedia = (id: string | null) =>
    mediaAssets.find((m) => m.id === id) || mediaAssets[0];

  const handleGlobalPoll = async () => {
    setPolling(true);
    try {
      await onPollHeartbeats?.();
    } finally {
      setLastSyncTime(formatNowTime());
      setPolling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="type-section-title text-[#290044]">
            Live campus screen monitoring
          </h2>
          <p className="type-support text-[#645573]">
            Verify Android TV player heartbeats, active slide previews, and diagnostic alerts.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGlobalPoll}
          disabled={polling}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#500071] text-white type-button hover:bg-[#8A2A78] transition-colors whitespace-nowrap disabled:opacity-70"
        >
          <RefreshCw className={`w-4 h-4 ${polling ? 'animate-spin' : ''}`} />
          {polling ? 'Polling live status...' : 'Poll all heartbeats'}
        </button>
      </div>

      {/* 5 Monitoring KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          label="Total devices"
          value={totalDevices}
          description="Registered displays."
          icon={Monitor}
          tone="default"
        />
        <StatCard
          label="Connected devices"
          value={connectedDevices}
          description="Heartbeat active."
          icon={Wifi}
          tone="online"
        />
        <StatCard
          label="Offline devices"
          value={offlineDevices}
          description="No recent signal."
          icon={MonitorOff}
          tone="offline"
        />
        <StatCard
          label="Playback errors"
          value={playbackErrors}
          description="Diagnostic alerts."
          icon={AlertTriangle}
          tone="cream"
        />
        <StatCard
          label="Last sync"
          value={lastSyncTime}
          description="Live 5s MySQL telemetry."
          icon={Clock}
          tone="highlight"
        />
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E8E2EE] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['All', 'Online', 'Offline', 'Errors'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === tab
                  ? 'bg-[#EEE3B0] text-[#290044] font-semibold'
                  : 'text-[#645573] hover:bg-[#FAF8FC] hover:text-[#290044]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <select
          value={buildingFilter}
          onChange={(e) => setBuildingFilter(e.target.value)}
          aria-label="Filter monitoring by building"
          className="px-3 py-2 text-xs bg-[#FAF8FC] border border-[#E8E2EE] rounded-lg text-[#290044] focus:outline-none focus:border-[#8A2A78]"
        >
          {buildings.map((b) => (
            <option key={b} value={b}>
              {b === 'All' ? 'All Buildings' : b}
            </option>
          ))}
        </select>
      </div>

      {/* Screen Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((scr) => {
          const media = getMedia(scr.currentMediaId);
          return (
            <article
              key={scr.id}
              className="group bg-white border border-[#E8E2EE] rounded-xl overflow-hidden hover:border-[#8A2A78]/50 transition-all flex flex-col"
            >
              <div className="p-3 pb-0 relative">
                <MediaThumbnail
                  src={media?.thumbnailUrl}
                  alt={media?.title || scr.name}
                  type={media?.type || 'Image'}
                  durationSeconds={media?.durationSeconds}
                  accentTone={media?.accentTone}
                  showDuration={false}
                />
                {(scr.connectionStatus === 'Offline' || !scr.isActive) && (
                  <div className="absolute inset-3 bottom-0 rounded-lg bg-[#290044]/75 flex items-center justify-center text-white text-xs font-semibold gap-2">
                    <MonitorOff className="w-4 h-4 text-[#EEE3B0]" />
                    {scr.isActive ? 'TV Powered Off / No Signal' : 'Turned Off (Standby)'}
                  </div>
                )}
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-mono font-semibold text-[#500071]">
                        {scr.id}
                      </p>
                      <h3 className="type-card-title text-[#290044] truncate">{scr.name}</h3>
                    </div>
                    <StatusBadge status={scr.isActive ? scr.connectionStatus : 'Standby'} />
                  </div>
                  <p className="text-xs text-[#645573] truncate">
                    {scr.building} · {scr.floor} · {scr.location}
                  </p>
                </div>

                <div className="pt-2.5 border-t border-[#F1ECF6] space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#645573]">Playlist</span>
                    <span className="font-medium text-[#290044] truncate max-w-[190px]">
                      {getPlaylistName(scr.assignedPlaylistId)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#645573]">Last Heartbeat</span>
                    <span className="font-mono tabular-nums text-[#645573]">
                      {scr.lastHeartbeat}
                    </span>
                  </div>
                  {scr.playbackError && (
                    <p className="text-rose-700 font-medium truncate">
                      Alert: {scr.playbackError}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setInspectedScreen(scr)}
                    className="flex-1 py-2 px-3 rounded-lg bg-[#FAF8FC] border border-[#E8E2EE] text-xs font-semibold text-[#500071] hover:bg-[#EEE3B0]/45 transition-colors"
                  >
                    Inspect Telemetry
                  </button>
                  {scr.connectionStatus === 'Offline' && (
                    <button
                      type="button"
                      onClick={() => onSimulateReconnect(scr.id)}
                      title="Sends a remote wake-up signal to reopen CampusCast on this TV if powered on"
                      className="py-2 px-3 rounded-lg bg-[#500071] text-white text-xs font-semibold hover:bg-[#8A2A78] transition-colors cursor-pointer"
                    >
                      Wake / Reconnect
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Detailed Screen Monitoring Modal */}
      <Modal
        isOpen={Boolean(inspectedScreen)}
        onClose={() => setInspectedScreen(null)}
        title={inspectedScreen ? `${inspectedScreen.id} · ${inspectedScreen.name}` : 'Screen Monitor'}
        subtitle={inspectedScreen ? `${inspectedScreen.building} · ${inspectedScreen.location}` : ''}
        size="lg"
      >
        {inspectedScreen && (
          <div className="space-y-4">
            <MediaThumbnail
              src={getMedia(inspectedScreen.currentMediaId)?.thumbnailUrl}
              alt={getMedia(inspectedScreen.currentMediaId)?.title || inspectedScreen.name}
              type={getMedia(inspectedScreen.currentMediaId)?.type || 'Image'}
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[#FAF8FC] border border-[#E8E2EE]">
                <p className="text-[#645573]">Status</p>
                <div className="mt-1">
                  <StatusBadge status={inspectedScreen.connectionStatus} />
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#FAF8FC] border border-[#E8E2EE]">
                <p className="text-[#645573]">IP Address</p>
                <p className="font-mono font-semibold text-[#290044] mt-1">
                  {inspectedScreen.ipAddress}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-[#FAF8FC] border border-[#E8E2EE]">
                <p className="text-[#645573]">Player App</p>
                <p className="font-mono font-semibold text-[#290044] mt-1">
                  v{inspectedScreen.playerAppVersion}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-[#FAF8FC] border border-[#E8E2EE]">
                <p className="text-[#645573]">Storage Cache</p>
                <p className="font-mono font-semibold text-[#290044] mt-1 tabular-nums">
                  {inspectedScreen.storageUsedPct}% used
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#E8E2EE]">
              <span className="inline-flex items-center gap-1.5 text-xs text-[#645573]">
                <Activity className="w-4 h-4 text-[#500071]" />
                Now Playing: {getMedia(inspectedScreen.currentMediaId)?.title}
              </span>
              {inspectedScreen.connectionStatus === 'Offline' && (
                <button
                  type="button"
                  onClick={() => {
                    onSimulateReconnect(inspectedScreen.id);
                    setInspectedScreen(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#500071] text-white text-xs font-semibold hover:bg-[#8A2A78] cursor-pointer"
                >
                  Send Wake / Reconnect
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
