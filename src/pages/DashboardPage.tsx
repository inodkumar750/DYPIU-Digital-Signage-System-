import React, { useState } from 'react';
import {
  Activity,
  Building2,
  CalendarClock,
  Eye,
  Film,
  Image as ImageIcon,
  ListVideo,
  Megaphone,
  Monitor,
  MonitorOff,
  Play,
  Plus,
  Send,
  Upload,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  ActivityEvent,
  Campaign,
  MediaAsset,
  PageRoute,
  Playlist,
  ScreenDevice,
} from '../types/signage';
import { CAMPAIGN_PERFORMANCE_SERIES } from '../data/mockSignageData';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { CampaignPerformanceChart, HorizontalBarChart } from '../components/ui/Charts';
import { Modal } from '../components/ui/Modal';
import { MediaThumbnail } from '../components/ui/MediaThumbnail';

interface DashboardPageProps {
  screens: ScreenDevice[];
  campaigns: Campaign[];
  playlists: Playlist[];
  mediaAssets: MediaAsset[];
  totalMediaCount: number;
  activities: ActivityEvent[];
  onNavigate: (route: PageRoute) => void;
  onQuickAction: (action: 'upload-media' | 'create-playlist' | 'add-screen' | 'create-campaign') => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  screens,
  campaigns,
  playlists,
  mediaAssets,
  totalMediaCount,
  activities,
  onNavigate,
  onQuickAction,
}) => {
  const [previewCampaign, setPreviewCampaign] = useState<Campaign | null>(null);
  const totalScreens = screens.length;
  const onlineScreens = screens.filter((s) => s.connectionStatus === 'Online').length;
  const offlineScreens = screens.filter((s) => s.connectionStatus === 'Offline').length;
  const activeCampaigns = campaigns.filter((c) => c.status === 'Active').length;
  const scheduledCampaigns = campaigns.filter((c) => c.status === 'Scheduled').length;

  const onlinePct = totalScreens > 0 ? Math.round((onlineScreens / totalScreens) * 100) : 0;

  const buildingMap = screens.reduce<Record<string, { total: number; online: number }>>(
    (acc, scr) => {
      if (!acc[scr.building]) acc[scr.building] = { total: 0, online: 0 };
      acc[scr.building].total += 1;
      if (scr.connectionStatus === 'Online') acc[scr.building].online += 1;
      return acc;
    },
    {}
  );

  const buildingBars = Object.entries(buildingMap).map(([building, stats], i) => ({
    label: building,
    value: stats.online,
    total: stats.total,
    tone: (i === 0 ? 'primary' : i === 1 ? 'secondary' : 'accent') as
      | 'primary'
      | 'secondary'
      | 'accent',
  }));

  const offlineList = screens.filter((s) => s.connectionStatus === 'Offline');
  const recentCampaigns = campaigns.slice(0, 5);

  const getCampaignScreens = (cmp: Campaign): ScreenDevice[] =>
    cmp.targetScreenIds
      .map((id) => screens.find((s) => s.id === id))
      .filter((s): s is ScreenDevice => Boolean(s));

  const getCampaignSlides = (cmp: Campaign): MediaAsset[] => {
    const pl = playlists.find((p) => p.id === cmp.playlistId);
    if (!pl) return [];
    return pl.items
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((item) => mediaAssets.find((m) => m.id === item.mediaId))
      .filter((m): m is MediaAsset => Boolean(m));
  };

  const getActivityIcon = (type: ActivityEvent['actionType']) => {
    switch (type) {
      case 'upload':
        return <ImageIcon className="w-4 h-4 text-[#500071]" />;
      case 'playlist':
        return <ListVideo className="w-4 h-4 text-[#8A2A78]" />;
      case 'publish':
        return <Send className="w-4 h-4 text-[#290044]" />;
      case 'screen':
        return <Monitor className="w-4 h-4 text-rose-600" />;
      case 'campaign':
      default:
        return <Megaphone className="w-4 h-4 text-[#500071]" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <section className="bg-[#290044] text-white rounded-xl p-5 sm:p-6 lg:p-8 border border-[#500071] shadow-[0_2px_8px_rgba(41,0,68,0.12)] overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start lg:items-end">
          <div className="lg:col-span-7 min-w-0 flex flex-col gap-3">
            <p className="text-[12px] leading-[1.35] font-semibold tracking-[0.08em] text-[#EEE3B0]">
              CAMPUS DIGITAL SIGNAGE
            </p>
            <h2 className="font-display text-[24px] sm:text-[28px] xl:text-[32px] leading-[1.2] font-bold tracking-[-0.02em] text-white text-balance break-words">
              Manage every campus display from one place.
            </h2>
            <p className="text-[15px] leading-[1.55] font-normal text-white/85 max-w-2xl">
              Upload promotional content, manage playlists, schedule campaigns and monitor every university screen from one centralized dashboard.
            </p>
          </div>

          <div className="lg:col-span-5 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onQuickAction('upload-media')}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#EEE3B0] text-[#290044] type-button hover:bg-[#f4ebc2] transition-colors whitespace-nowrap"
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span>Upload media</span>
            </button>
            <button
              type="button"
              onClick={() => onQuickAction('create-playlist')}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#500071] text-white border border-[#8A2A78] type-button hover:bg-[#61008a] transition-colors whitespace-nowrap"
            >
              <ListVideo className="w-4 h-4 shrink-0" />
              <span>Create playlist</span>
            </button>
            <button
              type="button"
              onClick={() => onQuickAction('add-screen')}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 text-white border border-white/20 type-button hover:bg-white/15 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Register screen</span>
            </button>
            <button
              type="button"
              onClick={() => onQuickAction('create-campaign')}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#8A2A78] text-white type-button hover:bg-[#9b3288] transition-colors whitespace-nowrap"
            >
              <Megaphone className="w-4 h-4 shrink-0" />
              <span>Schedule campaign</span>
            </button>
          </div>
        </div>
      </section>

      {/* 6 KPI Stat Cards: 4 cards in Row 1 + 2 balanced wide cards in Row 2 */}
      <section aria-label="Key signage metrics" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Registered screens"
          value={totalScreens}
          description="Across 3 campus buildings."
          icon={Monitor}
          tone="default"
          onClick={() => onNavigate('screens')}
        />
        <StatCard
          label="Online screens"
          value={onlineScreens}
          description="Connected and reporting."
          icon={Wifi}
          tone="online"
          onClick={() => onNavigate('monitoring')}
        />
        <StatCard
          label="Offline screens"
          value={offlineScreens}
          description="No recent heartbeat."
          icon={MonitorOff}
          tone="offline"
          onClick={() => onNavigate('monitoring')}
        />
        <StatCard
          label="Active campaigns"
          value={activeCampaigns}
          description="Currently running."
          icon={Megaphone}
          tone="highlight"
          onClick={() => onNavigate('campaigns')}
        />
        <StatCard
          label="Scheduled campaigns"
          value={scheduledCampaigns}
          description="Queued to start."
          icon={CalendarClock}
          tone="cream"
          className="xl:col-span-2"
          onClick={() => onNavigate('campaigns')}
        />
        <StatCard
          label="Media assets"
          value={totalMediaCount}
          description="Posters, images and videos."
          icon={Film}
          tone="default"
          className="xl:col-span-2"
          onClick={() => onNavigate('media')}
        />
      </section>

      {/* Main Analytics Row: Campaign Performance + Screen Connectivity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 bg-white border border-[#E6E0EC] rounded-xl p-6 shadow-[0_1px_2px_rgba(41,0,68,0.04)]">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div className="space-y-1">
              <h3 className="type-section-title text-[#290044]">
                Campaign performance
              </h3>
              <p className="type-support text-[#645573]">
                Playback activity over the last 14 days.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="type-button text-[#500071] hover:text-[#8A2A78] transition-colors whitespace-nowrap"
            >
              View full analytics →
            </button>
          </div>
          <CampaignPerformanceChart data={CAMPAIGN_PERFORMANCE_SERIES} />
        </section>

        <section className="bg-white border border-[#E6E0EC] rounded-xl p-6 shadow-[0_1px_2px_rgba(41,0,68,0.04)] flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <h3 className="type-section-title text-[#290044]">
                  Screen connectivity
                </h3>
                <p className="type-support text-[#645573]">
                  Live connectivity across campus displays.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('monitoring')}
                className="type-button text-[#500071] hover:text-[#8A2A78] whitespace-nowrap"
              >
                Monitor →
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#FAF8FC] border border-[#E6E0EC] space-y-3">
              <div className="flex items-center justify-between text-[13px] font-medium">
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <Wifi className="w-4 h-4" />
                  Online ({onlineScreens})
                </span>
                <span className="inline-flex items-center gap-1.5 text-rose-700">
                  <WifiOff className="w-4 h-4" />
                  Offline ({offlineScreens})
                </span>
              </div>
              <div className="h-3 rounded-full bg-rose-200 overflow-hidden flex">
                <div
                  className="bg-emerald-600 h-full transition-all duration-300"
                  style={{ width: `${onlinePct}%` }}
                />
              </div>
              <p className="type-support text-[#645573] tabular-nums">
                {onlinePct}% of registered campus Smart TVs responded within the last 5 minutes.
              </p>
            </div>

            <div className="space-y-2.5">
              <p className="text-[14px] font-semibold text-[#290044]">
                Displays requiring attention
              </p>
              {offlineList.length === 0 ? (
                <p className="type-support text-emerald-700 py-2">
                  All campus displays are online and synchronized.
                </p>
              ) : (
                <div className="divide-y divide-[#F1ECF6] border border-[#E6E0EC] rounded-lg overflow-hidden">
                  {offlineList.map((screen) => (
                    <button
                      key={screen.id}
                      type="button"
                      onClick={() => onNavigate('monitoring')}
                      className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-[#FAF8FC] transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[#290044] truncate">
                          <span className="font-mono">{screen.id}</span> · {screen.name}
                        </p>
                        <p className="text-[12px] text-[#645573] truncate">
                          {screen.building} · Last seen {screen.lastSeen}
                        </p>
                      </div>
                      <StatusBadge status="Offline" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Bottom Grid: Recent Campaigns + Screen Locations + Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 bg-white border border-[#E6E0EC] rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(41,0,68,0.04)] flex flex-col">
          <div className="px-6 py-5 border-b border-[#E6E0EC] flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h3 className="type-section-title text-[#290044]">
                Recent campaigns
              </h3>
              <p className="type-support text-[#645573]">
                Recently published and scheduled campaigns.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('campaigns')}
              className="type-button text-[#500071] hover:text-[#8A2A78] whitespace-nowrap"
            >
              All campaigns →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E6E0EC] bg-[#FAF8FC] text-[13px] font-semibold text-[#645573]">
                  <th className="py-3 px-6">Campaign</th>
                  <th className="py-3 px-4">Assigned screens</th>
                  <th className="py-3 px-4">Schedule dates</th>
                  <th className="py-3 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1ECF6] text-[14px]">
                {recentCampaigns.map((cmp) => {
                  const targetScreens = getCampaignScreens(cmp);
                  const slides = getCampaignSlides(cmp);
                  const visibleScreens = targetScreens.slice(0, 3);
                  const extraScreens = Math.max(0, targetScreens.length - visibleScreens.length);
                  const leadOnline = targetScreens.filter(
                    (s) => s.connectionStatus === 'Online'
                  ).length;

                  return (
                    <tr
                      key={cmp.id}
                      onClick={() => onNavigate('campaigns')}
                      className="hover:bg-[#FAF8FC] cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-6 font-semibold text-[#290044]">
                        {cmp.name}
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewCampaign(cmp);
                          }}
                          title="Preview assigned displays and active media"
                          className="group/preview text-left rounded-lg p-1.5 -m-1.5 hover:bg-[#EEE3B0]/35 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A2A78]"
                        >
                          <div className="flex items-center gap-1.5">
                            {visibleScreens.map((scr, idx) => {
                              const slide =
                                slides[idx % Math.max(1, slides.length)] ||
                                mediaAssets.find((m) => m.id === scr.currentMediaId);
                              return (
                                <div
                                  key={scr.id}
                                  title={`${scr.id} · ${scr.name} (${scr.building} · ${scr.connectionStatus})`}
                                  className="relative w-11 h-7 rounded-[5px] border-2 border-[#290044] bg-[#290044] overflow-hidden shrink-0 shadow-[0_1px_2px_rgba(41,0,68,0.12)]"
                                >
                                  {slide ? (
                                    <MediaThumbnail
                                      src={slide.thumbnailUrl}
                                      alt={`${scr.name} — ${slide.title}`}
                                      type={slide.type}
                                      durationSeconds={slide.durationSeconds}
                                      accentTone={slide.accentTone}
                                      className="w-full h-full !rounded-none !border-0"
                                      showDuration={false}
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white/70">
                                      <Monitor className="w-3 h-3" />
                                    </div>
                                  )}
                                  <span
                                    aria-hidden="true"
                                    className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ring-1 ring-[#290044] ${
                                      scr.connectionStatus === 'Online'
                                        ? 'bg-emerald-400'
                                        : 'bg-rose-400'
                                    }`}
                                  />
                                  {slide?.type === 'Video' && (
                                    <span
                                      aria-hidden="true"
                                      className="absolute bottom-0.5 left-0.5 w-3 h-3 rounded bg-black/70 text-white flex items-center justify-center"
                                    >
                                      <Play className="w-1.5 h-1.5 fill-current" />
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                            {extraScreens > 0 && (
                              <span className="h-7 px-1.5 rounded border border-[#E6E0EC] bg-[#FAF8FC] text-[11px] font-mono font-semibold text-[#500071] inline-flex items-center tabular-nums">
                                +{extraScreens}
                              </span>
                            )}
                            <span className="ml-1 inline-flex items-center gap-1 text-[12px] font-medium text-[#500071] group-hover/preview:text-[#8A2A78] whitespace-nowrap tabular-nums">
                              {cmp.targetScreenIds.length} displays
                              <Eye className="w-3 h-3 opacity-70" />
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-[#645573] truncate max-w-[230px] tabular-nums">
                            {targetScreens.length > 0
                              ? `${targetScreens[0].id} (${leadOnline}/${targetScreens.length} online)`
                              : 'No displays linked'}
                          </p>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-[#645573] font-mono text-[13px] tabular-nums whitespace-nowrap">
                        {cmp.startDate} → {cmp.endDate}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <StatusBadge status={cmp.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          <section className="bg-white border border-[#E6E0EC] rounded-xl p-6 shadow-[0_1px_2px_rgba(41,0,68,0.04)]">
            <div className="flex items-start justify-between gap-2 mb-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#500071]" />
                  <h3 className="type-card-title text-[#290044]">
                    Screen locations
                  </h3>
                </div>
                <p className="type-support text-[#645573]">
                  Registered displays across campus buildings.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('groups')}
                className="text-[13px] font-semibold text-[#500071] hover:text-[#8A2A78] shrink-0"
              >
                Groups →
              </button>
            </div>
            <HorizontalBarChart items={buildingBars} unit=" online" />
          </section>

          <section className="bg-white border border-[#E6E0EC] rounded-xl p-6 shadow-[0_1px_2px_rgba(41,0,68,0.04)]">
            <div className="space-y-0.5 mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#500071]" />
                <h3 className="type-card-title text-[#290044]">
                  Recent activity
                </h3>
              </div>
              <p className="type-support text-[#645573]">
                Latest updates across your signage platform.
              </p>
            </div>
            <div className="space-y-4">
              {activities.slice(0, 4).map((act) => (
                <div key={act.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#FAF8FC] border border-[#E6E0EC] flex items-center justify-center shrink-0 mt-0.5">
                    {getActivityIcon(act.actionType)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-[#290044] leading-snug">
                      {act.title}
                    </p>
                    <p className="type-support text-[#645573]">{act.detail}</p>
                    <p className="text-[12px] text-[#8A7D96] mt-0.5">
                      {act.actor} · {act.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Assigned Displays Preview Modal */}
      <Modal
        isOpen={Boolean(previewCampaign)}
        onClose={() => setPreviewCampaign(null)}
        title={previewCampaign ? `${previewCampaign.name} · Display Previews` : 'Display Previews'}
        subtitle={
          previewCampaign
            ? `${previewCampaign.targetScreenIds.length} assigned screen(s) · ${previewCampaign.startDate} → ${previewCampaign.endDate}`
            : ''
        }
        size="xl"
      >
        {previewCampaign && (() => {
          const targetScreens = getCampaignScreens(previewCampaign);
          const slides = getCampaignSlides(previewCampaign);
          const playlist = playlists.find((p) => p.id === previewCampaign.playlistId);

          return (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#FAF8FC] border border-[#E8E2EE] text-xs">
                <div className="space-y-0.5">
                  <p className="text-[#645573]">Assigned Playlist</p>
                  <p className="font-semibold text-[#290044]">
                    {playlist?.name || 'No playlist linked'} ({slides.length} slide
                    {slides.length === 1 ? '' : 's'})
                  </p>
                </div>
                <StatusBadge status={previewCampaign.status} />
              </div>

              {targetScreens.length === 0 ? (
                <p className="text-xs text-[#645573]">
                  No displays are currently assigned to this campaign.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {targetScreens.map((scr, idx) => {
                    const activeMedia =
                      slides[idx % Math.max(1, slides.length)] ||
                      mediaAssets.find((m) => m.id === scr.currentMediaId);
                    return (
                      <div
                        key={scr.id}
                        className="rounded-xl border border-[#E8E2EE] bg-white p-3 space-y-2.5"
                      >
                        <div className="rounded-lg border-[3px] border-[#290044] bg-[#290044] overflow-hidden shadow-sm">
                          {activeMedia ? (
                            <MediaThumbnail
                              src={activeMedia.thumbnailUrl}
                              alt={activeMedia.title}
                              type={activeMedia.type}
                              durationSeconds={activeMedia.durationSeconds}
                              accentTone={activeMedia.accentTone}
                              className="aspect-video !rounded-none !border-0"
                            />
                          ) : (
                            <div className="aspect-video flex flex-col items-center justify-center text-white/70 text-xs">
                              <Monitor className="w-6 h-6 mb-1" />
                              <span>No active media</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[11px] font-mono font-semibold text-[#500071]">
                              {scr.id}
                            </p>
                            <p className="text-xs font-semibold text-[#290044] truncate">
                              {scr.name}
                            </p>
                            <p className="text-[11px] text-[#645573] truncate">
                              {scr.building} · {scr.floor}
                            </p>
                          </div>
                          <StatusBadge status={scr.connectionStatus} />
                        </div>
                        {activeMedia && (
                          <p className="pt-2 border-t border-[#F1ECF6] text-[11px] text-[#645573] truncate">
                            Previewing: <span className="text-[#290044] font-medium">{activeMedia.title}</span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-[#F1ECF6]">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewCampaign(null);
                    onNavigate('screens');
                  }}
                  className="px-4 py-2 rounded-lg border border-[#E8E2EE] text-xs font-semibold text-[#290044] hover:bg-[#FAF8FC]"
                >
                  Open Screen Management
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewCampaign(null);
                    onNavigate('campaigns');
                  }}
                  className="px-4 py-2 rounded-lg bg-[#500071] text-white text-xs font-semibold hover:bg-[#8A2A78]"
                >
                  Manage Campaign
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};
