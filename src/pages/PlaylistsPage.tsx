import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Calendar,
  Clock,
  Edit3,
  Monitor,
  Pause,
  Play,
  Plus,
  QrCode,
  Search,
  SkipBack,
  SkipForward,
  Smartphone,
  Trash2,
  Tv,
  X,
} from 'lucide-react';
import {
  Campaign,
  MediaAspectRatio,
  MediaAsset,
  Playlist,
  PlaylistItem,
  PlaylistStatus,
  ScreenDevice,
  ScreenGroup,
} from '../types/signage';
import { StatusBadge } from '../components/ui/StatusBadge';
import { MediaThumbnail, formatDuration } from '../components/ui/MediaThumbnail';
import { Modal } from '../components/ui/Modal';
import {
  DragOverlayCard,
  SortablePlaylistItem,
} from '../components/playlists/SortablePlaylistItem';
import { getLocalDateStr, isCampaignInWindow, isCampaignLiveNow } from '../utils/campaignSchedule';

interface PlaylistsPageProps {
  playlists: Playlist[];
  screens?: ScreenDevice[];
  mediaAssets: MediaAsset[];
  campaigns?: Campaign[];
  groups?: ScreenGroup[];
  openCreateSignal: number;
  onSavePlaylist: (playlist: Playlist) => void;
  onDeletePlaylist: (id: string) => void;
  onAssignScreens?: (playlistId: string, screenIds: string[]) => void;
  onSchedulePlaylist?: (campaign: Campaign) => void;
  onDeleteSchedule?: (id: string) => void;
}

export const PlaylistsPage: React.FC<PlaylistsPageProps> = ({
  playlists,
  screens = [],
  mediaAssets,
  campaigns = [],
  groups = [],
  openCreateSignal,
  onSavePlaylist,
  onDeletePlaylist,
  onAssignScreens,
  onSchedulePlaylist,
  onDeleteSchedule,
}) => {
  const [selectedPreviewPlaylistId, setSelectedPreviewPlaylistId] = useState<string>(
    playlists[0]?.id || ''
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);

  // Assign Displays Modal State
  const [assignPl, setAssignPl] = useState<Playlist | null>(null);
  const [selectedScreenIds, setSelectedScreenIds] = useState<string[]>([]);
  const [assignBuildingFilter, setAssignBuildingFilter] = useState('All');
  const [assignFloorFilter, setAssignFloorFilter] = useState('All');

  // Schedule Playlist Modal State
  const [schedulePl, setSchedulePl] = useState<Playlist | null>(null);
  const [schedName, setSchedName] = useState('');
  const [schedBuilding, setSchedBuilding] = useState('All');
  const [schedFloor, setSchedFloor] = useState('All');
  const [schedGroupIds, setSchedGroupIds] = useState<string[]>([]);
  const [schedScreenIds, setSchedScreenIds] = useState<string[]>([]);
  const [schedStartDate, setSchedStartDate] = useState(() => getLocalDateStr());
  const [schedEndDate, setSchedEndDate] = useState(() => getLocalDateStr(new Date(Date.now() + 7 * 86400000)));
  const [schedStartTime, setSchedStartTime] = useState('08:00');
  const [schedEndTime, setSchedEndTime] = useState('22:00');
  const [schedPriority, setSchedPriority] = useState<'Normal' | 'High' | 'Urgent'>('High');
  const [schedQrUrl, setSchedQrUrl] = useState('');
  const [schedQrLabel, setSchedQrLabel] = useState('');
  const [schedError, setSchedError] = useState('');

  // Editor State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<PlaylistStatus>('Active');
  const [defaultDuration, setDefaultDuration] = useState(10);
  const [autoAdvanceVideo, setAutoAdvanceVideo] = useState(true);
  const [loopPlaylist, setLoopPlaylist] = useState(true);
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [mediaPickerSearch, setMediaPickerSearch] = useState('');
  const [mediaPickerRatioFilter, setMediaPickerRatioFilter] = useState<'All' | MediaAspectRatio>('All');
  const [editorError, setEditorError] = useState('');

  // Simulated TV & Standy Player Preview State
  const [isPlaying, setIsPlaying] = useState(true);
  const [slideIdx, setSlideIdx] = useState(0);
  const [elapsedInSlide, setElapsedInSlide] = useState(0);
  const [previewAspectMode, setPreviewAspectMode] = useState<'auto' | MediaAspectRatio>('auto');

  // dnd-kit sensors (pointer + accessible keyboard sorting)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const previewPlaylist =
    playlists.find((p) => p.id === selectedPreviewPlaylistId) || playlists[0] || null;

  const sortedPreviewItems = React.useMemo(
    () => [...(previewPlaylist?.items || [])].sort((a, b) => a.order - b.order),
    [previewPlaylist]
  );

  const previewLinkedScreens = React.useMemo(
    () => (previewPlaylist ? screens.filter((s) => s.assignedPlaylistId === previewPlaylist.id) : []),
    [screens, previewPlaylist]
  );

  // Match any Active/Scheduled QR Campaign linked to this playlist (prioritize live now, fallback to scheduled)
  const previewQrCampaign = React.useMemo(() => {
    if (!previewPlaylist) return null;
    const candidates = campaigns.filter(
      (c) =>
        c.playlistId === previewPlaylist.id &&
        (c.status === 'Active' || c.status === 'Scheduled') &&
        Boolean(c.qrUrl && c.qrUrl.trim())
    );
    return candidates.find((c) => isCampaignLiveNow(c)) || candidates[0] || null;
  }, [campaigns, previewPlaylist]);

  const [previewQrDataUrl, setPreviewQrDataUrl] = useState('');
  useEffect(() => {
    let cancelled = false;
    const url = previewQrCampaign?.qrUrl?.trim();
    if (!url) {
      setPreviewQrDataUrl('');
      return;
    }
    QRCode.toDataURL(url, {
      width: 180,
      margin: 1,
      color: { dark: '#111827', light: '#FFFFFF' },
    })
      .then((res) => {
        if (!cancelled) setPreviewQrDataUrl(res);
      })
      .catch(() => {
        if (!cancelled) setPreviewQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [previewQrCampaign?.qrUrl]);

  const getMediaById = (id: string) => mediaAssets.find((m) => m.id === id);

  useEffect(() => {
    if (openCreateSignal > 0) {
      openCreateModal();
    }
  }, [openCreateSignal]);

  // Reset slide index when switching previewed playlist
  useEffect(() => {
    setSlideIdx(0);
    setElapsedInSlide(0);
  }, [selectedPreviewPlaylistId]);

  // Simulate TV rotation timer (matches TvPlayerPage slide order and durations)
  useEffect(() => {
    if (!isPlaying || sortedPreviewItems.length === 0) return;

    const currentItem = sortedPreviewItems[slideIdx % sortedPreviewItems.length];
    const duration = Math.max(1, currentItem?.displayDurationSeconds || 10);

    const timer = window.setInterval(() => {
      setElapsedInSlide((prev) => {
        if (prev + 1 >= duration) {
          setSlideIdx((s) => (s + 1) % sortedPreviewItems.length);
          return 0;
        }
        return prev + 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isPlaying, sortedPreviewItems, slideIdx]);

  const openCreateModal = () => {
    setEditingPlaylistId(null);
    setName('');
    setDescription('');
    setStatus('Active');
    setDefaultDuration(10);
    setAutoAdvanceVideo(true);
    setLoopPlaylist(true);
    setItems([]);
    setMediaPickerSearch('');
    setMediaPickerRatioFilter('All');
    setEditorError('');
    setEditorOpen(true);
  };

  const openEditModal = (pl: Playlist) => {
    setEditingPlaylistId(pl.id);
    setName(pl.name);
    setDescription(pl.description);
    setStatus(pl.status);
    setDefaultDuration(pl.defaultImageDuration);
    setAutoAdvanceVideo(pl.autoAdvanceVideo);
    setLoopPlaylist(pl.loopPlaylist);
    setItems([...pl.items].sort((a, b) => a.order - b.order));
    setMediaPickerSearch('');
    setMediaPickerRatioFilter('All');
    setEditorError('');
    setEditorOpen(true);
  };

  const addMediaToEditor = (media: MediaAsset) => {
    const newItem: PlaylistItem = {
      id: `pi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      mediaId: media.id,
      order: items.length + 1,
      displayDurationSeconds:
        media.type === 'Video' ? media.durationSeconds || 30 : defaultDuration,
      muteAudio: true,
      loopVideo: false,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const moveItem = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= items.length) return;
    setItems((prev) =>
      arrayMove(prev, fromIdx, toIdx).map((item, idx) => ({
        ...item,
        order: idx + 1,
      }))
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over || active.id === over.id) return;

    setItems((prev) => {
      const oldIndex = prev.findIndex((it) => it.id === String(active.id));
      const newIndex = prev.findIndex((it) => it.id === String(over.id));
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex).map((item, idx) => ({
        ...item,
        order: idx + 1,
      }));
    });
  };

  const handleSaveEditor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setEditorError('Playlist name is required.');
      return;
    }
    const existing = playlists.find((p) => p.id === editingPlaylistId);
    const saved: Playlist = {
      id: existing ? existing.id : `pl-${Date.now().toString().slice(-4)}`,
      name: name.trim(),
      description: description.trim() || 'University digital signage rotation.',
      items: items.map((it, idx) => ({ ...it, order: idx + 1 })),
      assignedScreenIds: existing ? existing.assignedScreenIds : [],
      lastUpdated: '2026-11-23 10:05',
      status,
      defaultImageDuration: defaultDuration,
      autoAdvanceVideo,
      loopPlaylist,
    };
    onSavePlaylist(saved);
    setSelectedPreviewPlaylistId(saved.id);
    setEditorOpen(false);
  };

  const openAssignModal = (pl: Playlist) => {
    setAssignPl(pl);
    setAssignBuildingFilter('All');
    setAssignFloorFilter('All');
    const linked = screens.filter((s) => s.assignedPlaylistId === pl.id).map((s) => s.id);
    setSelectedScreenIds(linked);
  };

  const handleSaveScreenAssignments = () => {
    if (!assignPl || !onAssignScreens) return;
    onAssignScreens(assignPl.id, selectedScreenIds);
    setAssignPl(null);
  };

  const openScheduleModal = (pl: Playlist) => {
    const today = getLocalDateStr();
    const nextWeek = getLocalDateStr(new Date(Date.now() + 7 * 86400000));
    const linked = screens.filter((s) => s.assignedPlaylistId === pl.id).map((s) => s.id);
    setSchedulePl(pl);
    setSchedName(`${pl.name} Schedule`);
    setSchedBuilding('All');
    setSchedFloor('All');
    setSchedGroupIds([]);
    setSchedScreenIds(linked);
    setSchedStartDate(today);
    setSchedEndDate(nextWeek);
    setSchedStartTime('08:00');
    setSchedEndTime('22:00');
    setSchedPriority('High');
    setSchedQrUrl('');
    setSchedQrLabel('');
    setSchedError('');
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedulePl || !onSchedulePlaylist) return;
    if (schedScreenIds.length === 0) {
      setSchedError('Select at least one screen (or click "Select All Showing" for a floor).');
      return;
    }
    if (!schedStartDate || !schedEndDate || schedEndDate < schedStartDate) {
      setSchedError('End date must be on or after start date.');
      return;
    }
    const statusComputed = isCampaignInWindow({
      startDate: schedStartDate,
      endDate: schedEndDate,
      startTime: schedStartTime,
      endTime: schedEndTime,
    })
      ? 'Active'
      : 'Scheduled';
    const floorTag = schedFloor !== 'All' ? `${schedFloor}` : `${schedScreenIds.length} screens`;
    const newCmp: Campaign = {
      id: `cmp-${Date.now().toString().slice(-4)}`,
      name: schedName.trim() || `${schedulePl.name} (${floorTag})`,
      description: `Scheduled playlist playback (${schedBuilding !== 'All' ? schedBuilding + ' · ' : ''}${floorTag})`,
      playlistId: schedulePl.id,
      startDate: schedStartDate,
      endDate: schedEndDate,
      startTime: schedStartTime,
      endTime: schedEndTime,
      targetScreenIds: schedScreenIds,
      targetGroupIds: schedGroupIds,
      status: statusComputed,
      priority: schedPriority,
      createdBy: 'Vinod Kumar Jain',
      qrUrl: schedQrUrl.trim() || undefined,
      qrLabel: schedQrLabel.trim() || undefined,
    };
    onSchedulePlaylist(newCmp);
    setSchedulePl(null);
  };

  const allBuildings = ['All', ...Array.from(new Set(screens.map((s) => s.building).filter(Boolean)))];
  const allFloors = ['All', ...Array.from(new Set(screens.map((s) => s.floor).filter(Boolean)))];

  const filterScreensByLocation = (buildingVal: string, floorVal: string) =>
    screens.filter(
      (s) =>
        (buildingVal === 'All' || s.building === buildingVal) &&
        (floorVal === 'All' || s.floor === floorVal)
    );

  const activeDragItem = activeDragId
    ? items.find((it) => it.id === activeDragId)
    : undefined;

  const getMediaAspectRatio = (media?: MediaAsset): MediaAspectRatio => {
    if (!media) return '16:9';
    if (media.aspectRatio === '9:16' || media.aspectRatio === '16:9') {
      return media.aspectRatio;
    }
    return media.dimensions?.includes('1080 × 1920') ? '9:16' : '16:9';
  };

  const filteredPickerMedia = mediaAssets.filter((m) => {
    const ratio = getMediaAspectRatio(m);
    if (mediaPickerRatioFilter !== 'All' && ratio !== mediaPickerRatioFilter) {
      return false;
    }
    const q = mediaPickerSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      m.title.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      m.type.toLowerCase().includes(q) ||
      ratio.includes(q)
    );
  });

  const editorTotalDuration = items.reduce(
    (sum, it) => sum + it.displayDurationSeconds,
    0
  );

  const handleSetTotalLoop = (targetSec: number) => {
    if (isNaN(targetSec) || targetSec < 1 || items.length === 0) return;
    const clamped = Math.max(items.length, Math.min(3600, targetSec));
    const currentTotal = items.reduce(
      (sum, it) => sum + (it.displayDurationSeconds || 1),
      0
    );

    if (currentTotal === 0) {
      const perSlide = Math.max(1, Math.floor(clamped / items.length));
      setItems((prev) =>
        prev.map((it, idx) => ({
          ...it,
          displayDurationSeconds:
            idx === prev.length - 1 ? clamped - perSlide * (prev.length - 1) : perSlide,
        }))
      );
      return;
    }

    // Proportionally scale each slide
    let allocated = 0;
    const newItems = items.map((it, idx) => {
      if (idx === items.length - 1) {
        const remaining = Math.max(1, clamped - allocated);
        return { ...it, displayDurationSeconds: remaining };
      }
      const ratio = (it.displayDurationSeconds || 1) / currentTotal;
      const share = Math.max(1, Math.round(ratio * clamped));
      allocated += share;
      return { ...it, displayDurationSeconds: share };
    });

    const finalSum = newItems.reduce((s, it) => s + it.displayDurationSeconds, 0);
    if (finalSum !== clamped) {
      const diff = clamped - finalSum;
      newItems[newItems.length - 1].displayDurationSeconds = Math.max(
        1,
        newItems[newItems.length - 1].displayDurationSeconds + diff
      );
    }

    setItems(newItems);

    const imageSlides = newItems.filter((it) => {
      const m = getMediaById(it.mediaId);
      return !m || m.type === 'Image';
    });
    if (imageSlides.length > 0) {
      const avg = Math.round(
        imageSlides.reduce((s, it) => s + it.displayDurationSeconds, 0) /
          imageSlides.length
      );
      setDefaultDuration(Math.max(1, avg));
    }
  };

  const handleEvenlySplitTotalLoop = () => {
    if (items.length === 0) return;
    const target = editorTotalDuration > 0 ? editorTotalDuration : 30;
    const base = Math.max(1, Math.floor(target / items.length));
    const rem = target - base * items.length;

    setItems((prev) =>
      prev.map((it, idx) => ({
        ...it,
        displayDurationSeconds: base + (idx < rem ? 1 : 0),
      }))
    );
    setDefaultDuration(base);
  };

  const currentPreviewItem =
    sortedPreviewItems.length > 0
      ? sortedPreviewItems[slideIdx % sortedPreviewItems.length]
      : null;
  const currentPreviewMedia = currentPreviewItem
    ? getMediaById(currentPreviewItem.mediaId)
    : undefined;
  const currentSlideRatio = getMediaAspectRatio(currentPreviewMedia);
  const linkedStandyScreen = previewLinkedScreens.some((s) =>
    `${s.id} ${s.name}`.toLowerCase().includes('stendy') ||
    `${s.id} ${s.name}`.toLowerCase().includes('standy') ||
    `${s.id} ${s.name}`.toLowerCase().includes('portrait')
  );
  const effectivePreviewRatio: MediaAspectRatio =
    previewAspectMode !== 'auto'
      ? previewAspectMode
      : currentPreviewMedia
      ? currentSlideRatio
      : linkedStandyScreen
      ? '9:16'
      : '16:9';
  const currentSlideDuration = currentPreviewItem?.displayDurationSeconds || 10;
  const progressPct = Math.min(100, Math.round((elapsedInSlide / currentSlideDuration) * 100));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="type-section-title text-[#290044]">
            Playlist manager
          </h2>
          <p className="type-support text-[#645573]">
            Arrange slides via drag-and-drop, configure image timings and video playback, and simulate TV rotation.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#500071] text-white type-button hover:bg-[#8A2A78] transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Create playlist
        </button>
      </div>

      {/* Main Split: Playlist Cards + Live TV Preview Simulator */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Playlist Cards */}
        <div className="xl:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4">
          {playlists.map((pl) => {
            const isSelected = previewPlaylist?.id === pl.id;
            const totalDuration = pl.items.reduce(
              (sum, it) => sum + it.displayDurationSeconds,
              0
            );
            return (
              <div
                key={pl.id}
                className={`bg-white rounded-xl p-5 border shadow-[0_1px_2px_rgba(41,0,68,0.04)] transition-all flex flex-col justify-between gap-4 ${
                  isSelected
                    ? 'border-[#500071] ring-1 ring-[#500071] bg-[#FAF8FC]'
                    : 'border-[#E6E0EC] hover:border-[#8A2A78]/50'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <h3 className="type-card-title text-[#290044]">
                        {pl.name}
                      </h3>
                      {campaigns.some(
                        (c) =>
                          c.playlistId === pl.id &&
                          (c.status === 'Active' || c.status === 'Scheduled') &&
                          Boolean(c.qrUrl?.trim())
                      ) && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#EEE3B0]/70 text-[#500071] text-[10px] font-semibold">
                          <QrCode className="w-3 h-3" />
                          QR
                        </span>
                      )}
                    </div>
                    <StatusBadge status={pl.status} />
                  </div>
                  <p className="type-support text-[#645573] line-clamp-2">{pl.description}</p>
                </div>

                {/* Unboxed metrics */}
                <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-[#F1ECF6] text-xs">
                  <div>
                    <span className="block text-[11px] text-[#645573]">Media</span>
                    <span className="font-mono font-semibold text-[#290044] tabular-nums">
                      {pl.items.length} items
                    </span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-[#645573]">Screens</span>
                    <span className="font-mono font-semibold text-[#500071] tabular-nums">
                      {screens.length > 0
                        ? screens.filter((s) => s.assignedPlaylistId === pl.id).length
                        : pl.assignedScreenIds.length}{' '}
                      TVs
                    </span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-[#645573]">Loop</span>
                    <span className="font-mono font-semibold text-[#290044] tabular-nums">
                      {formatDuration(totalDuration)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-[#6E607D] font-mono">
                    Updated {pl.lastUpdated}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedPreviewPlaylistId(pl.id)}
                      className={`px-2.5 py-1.5 rounded-md font-semibold transition-colors ${
                        isSelected
                          ? 'bg-[#EEE3B0] text-[#290044]'
                          : 'bg-[#FAF8FC] text-[#500071] hover:bg-[#EEE3B0]/50'
                      }`}
                    >
                      {isSelected ? 'Previewing' : 'Preview'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openAssignModal(pl)}
                      className="p-1.5 rounded-md text-[#500071] hover:bg-[#EEE3B0]/40 transition-colors cursor-pointer"
                      title="Assign / Unassign TV screens for this playlist"
                    >
                      <Tv className="w-3.5 h-3.5" />
                    </button>
                    {onSchedulePlaylist && (
                      <button
                        type="button"
                        onClick={() => openScheduleModal(pl)}
                        className="p-1.5 rounded-md text-[#8A2A78] hover:bg-[#EEE3B0]/40 transition-colors cursor-pointer"
                        title="Schedule playlist by Building, Floor, Screen & Time"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditModal(pl)}
                      className="p-1.5 rounded-md text-[#500071] hover:bg-[#FAF8FC]"
                      title="Edit playlist"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeletePlaylist(pl.id)}
                      className="p-1.5 rounded-md text-rose-600 hover:bg-rose-50"
                      title="Delete playlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {(() => {
                  const plSchedules = campaigns.filter(
                    (c) =>
                      c.playlistId === pl.id &&
                      (c.status === 'Active' || c.status === 'Scheduled')
                  );
                  if (plSchedules.length === 0) return null;
                  return (
                    <div className="pt-2 border-t border-[#F1ECF6] space-y-1">
                      {plSchedules.map((sc) => (
                        <div
                          key={sc.id}
                          className="flex items-center justify-between gap-2 px-2 py-1 rounded-md bg-[#FAF8FC] border border-[#E8E2EE] text-[10px]"
                        >
                          <span className="truncate font-medium text-[#500071]">
                            <strong className="font-mono">
                              {isCampaignLiveNow(sc) ? 'LIVE' : `${sc.startTime}–${sc.endTime}`}
                            </strong>{' '}
                            · {sc.name} ({sc.targetScreenIds.length} TVs)
                          </span>
                          {onDeleteSchedule && (
                            <button
                              type="button"
                              onClick={() => onDeleteSchedule(sc.id)}
                              title="Remove this schedule"
                              className="text-[#645573] hover:text-rose-600 shrink-0 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>

        {/* Right: Simulated Smart TV Preview */}
        <section className="xl:col-span-5 bg-white border border-[#E6E0EC] rounded-xl p-6 shadow-[0_1px_2px_rgba(41,0,68,0.04)] sticky top-24 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {effectivePreviewRatio === '9:16' ? (
                <Smartphone className="w-4 h-4 text-[#8A2A78] shrink-0" />
              ) : (
                <Tv className="w-4 h-4 text-[#500071] shrink-0" />
              )}
              <div className="min-w-0">
                <h3 className="type-card-title text-[#290044] truncate">
                  {effectivePreviewRatio === '9:16'
                    ? 'Standy portrait preview (9:16)'
                    : 'Smart TV rotation preview'}
                </h3>
                <p className="type-support text-[#645573] truncate">
                  {previewPlaylist ? previewPlaylist.name : 'Select a playlist'}
                </p>
              </div>
            </div>
            {previewPlaylist && (
              previewLinkedScreens.length > 0 ? (
                <button
                  type="button"
                  onClick={() => openAssignModal(previewPlaylist)}
                  className="text-[11px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded hover:bg-emerald-100 shrink-0 cursor-pointer"
                  title="Click to manage which TVs play this playlist"
                >
                  Live on: {previewLinkedScreens.map((s) => s.name).join(', ')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openAssignModal(previewPlaylist)}
                  className="text-[11px] font-mono text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded hover:bg-amber-100 shrink-0 cursor-pointer"
                  title="Assign a TV screen so this playlist plays on your physical TV"
                >
                  0 TVs linked · Assign TV
                </button>
              )
            )}
          </div>

          {/* Display Orientation Switcher: TV (16:9) vs Standy (9:16) */}
          <div className="flex items-center justify-between gap-2 bg-[#FAF8FC] border border-[#E8E2EE] rounded-lg px-2.5 py-1.5 text-[11px]">
            <span className="font-semibold text-[#645573]">Preview frame:</span>
            <div className="flex items-center gap-1" role="group" aria-label="Preview aspect ratio">
              {(['auto', '16:9', '9:16'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPreviewAspectMode(mode)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    previewAspectMode === mode
                      ? 'bg-[#500071] text-white shadow-xs'
                      : 'text-[#645573] hover:text-[#290044] hover:bg-white'
                  }`}
                >
                  {mode === 'auto' && 'Auto'}
                  {mode === '16:9' && (
                    <>
                      <Monitor className="w-3 h-3" />
                      16:9 TV
                    </>
                  )}
                  {mode === '9:16' && (
                    <>
                      <Smartphone className="w-3 h-3" />
                      9:16 Standy
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>

          {previewQrCampaign && (
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#EEE3B0]/35 border border-[#EEE3B0] text-[11px]">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#500071] truncate">
                <QrCode className="w-3.5 h-3.5 shrink-0" />
                QR Campaign: {previewQrCampaign.name}
              </span>
              <span className="font-mono text-[10px] text-[#290044] shrink-0">
                {isCampaignLiveNow(previewQrCampaign)
                  ? 'Live now'
                  : `${previewQrCampaign.startTime}–${previewQrCampaign.endTime}`}
              </span>
            </div>
          )}

          {/* TV / Standy Bezel */}
          <div
            className={
              effectivePreviewRatio === '9:16'
                ? 'flex flex-col items-center py-1 bg-[#FAF8FC] rounded-xl border border-[#E8E2EE]'
                : ''
            }
          >
            <div
              className={`rounded-xl bg-[#1A1025] p-2.5 border-2 border-[#290044] shadow-md transition-all ${
                effectivePreviewRatio === '9:16' ? 'w-full max-w-[235px]' : 'w-full'
              }`}
            >
              <div
                className={`relative rounded-lg overflow-hidden bg-[#290044] ${
                  effectivePreviewRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video'
                }`}
              >
                {currentPreviewMedia ? (
                  <>
                    <MediaThumbnail
                      src={
                        currentPreviewMedia.type === 'Video' && currentPreviewMedia.fileUrl
                          ? currentPreviewMedia.fileUrl
                          : currentPreviewMedia.thumbnailUrl
                      }
                      alt={currentPreviewMedia.title}
                      type={currentPreviewMedia.type}
                      durationSeconds={currentPreviewMedia.durationSeconds}
                      accentTone={currentPreviewMedia.accentTone}
                      className="w-full h-full rounded-none border-0"
                      showDuration={false}
                    />
                    {previewQrDataUrl && previewQrCampaign && (
                      <div className="absolute bottom-14 right-2.5 z-10 bg-white/95 rounded-xl p-1.5 shadow-lg border border-[#500071]/25 text-center max-w-[84px]">
                        <img
                          src={previewQrDataUrl}
                          alt={previewQrCampaign.qrLabel || 'Campaign QR'}
                          className="w-14 h-14 mx-auto block rounded"
                        />
                        <p className="mt-0.5 text-[8px] font-bold text-[#290044] leading-tight line-clamp-2">
                          {previewQrCampaign.qrLabel || 'Scan QR Code'}
                        </p>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3.5 text-white">
                      <div className="flex items-end justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] text-[#EEE3B0] font-medium truncate">
                            {currentPreviewMedia.category} · {currentPreviewMedia.type} ·{' '}
                            {currentSlideRatio}
                          </p>
                          <p className="text-sm font-semibold truncate">
                            {currentPreviewMedia.title}
                          </p>
                        </div>
                        <span className="text-xs font-mono tabular-nums shrink-0 text-white/90">
                          {elapsedInSlide}s / {currentSlideDuration}s
                        </span>
                      </div>
                      <div className="mt-2 h-1 rounded-full bg-white/25 overflow-hidden">
                        <div
                          className="h-full bg-[#EEE3B0] transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-white/70 p-6 text-center">
                    <Monitor className="w-8 h-8 mb-2 opacity-60" />
                    <p className="text-xs font-medium">No media items in this playlist yet</p>
                  </div>
                )}
              </div>
            </div>
            {effectivePreviewRatio === '9:16' && (
              <div className="flex flex-col items-center">
                <div className="w-5 h-3 bg-[#290044]" />
                <div className="w-24 h-2 rounded-full bg-[#1A1025] shadow-sm" />
              </div>
            )}
          </div>

          {/* Player Controls */}
          {previewPlaylist && sortedPreviewItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSlideIdx((s) =>
                        s === 0 ? sortedPreviewItems.length - 1 : s - 1
                      );
                      setElapsedInSlide(0);
                    }}
                    aria-label="Previous slide"
                    className="p-2 rounded-lg border border-[#E8E2EE] text-[#290044] hover:bg-[#FAF8FC]"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPlaying((p) => !p)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#500071] text-white text-xs font-semibold hover:bg-[#8A2A78]"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        Play
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSlideIdx((s) => (s + 1) % sortedPreviewItems.length);
                      setElapsedInSlide(0);
                    }}
                    aria-label="Next slide"
                    className="p-2 rounded-lg border border-[#E8E2EE] text-[#290044] hover:bg-[#FAF8FC]"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>

                <span className="text-xs font-mono tabular-nums text-[#645573]">
                  Slide {(slideIdx % sortedPreviewItems.length) + 1} of{' '}
                  {sortedPreviewItems.length}
                </span>
              </div>

              {/* Queue Sequence */}
              <div className="divide-y divide-[#F1ECF6] border border-[#E8E2EE] rounded-lg max-h-52 overflow-y-auto">
                {sortedPreviewItems.map((item, idx) => {
                  const media = getMediaById(item.mediaId);
                  const active = idx === slideIdx % sortedPreviewItems.length;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSlideIdx(idx);
                        setElapsedInSlide(0);
                      }}
                      className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left text-xs transition-colors ${
                        active ? 'bg-[#EEE3B0]/45 font-semibold text-[#290044]' : 'hover:bg-[#FAF8FC] text-[#645573]'
                      }`}
                    >
                      <span className="truncate flex items-center gap-1.5 min-w-0">
                        <span className="font-mono shrink-0">{idx + 1}.</span>
                        <span className="truncate">{media?.title || item.mediaId}</span>
                        <span
                          className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono ${
                            getMediaAspectRatio(media) === '9:16'
                              ? 'bg-[#8A2A78]/15 text-[#8A2A78]'
                              : 'bg-[#500071]/10 text-[#500071]'
                          }`}
                        >
                          {getMediaAspectRatio(media)}
                        </span>
                      </span>
                      <span className="font-mono tabular-nums shrink-0">
                        {item.displayDurationSeconds}s
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Create / Edit Playlist Modal */}
      <Modal
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingPlaylistId ? 'Edit Playlist' : 'Create New Playlist'}
        subtitle="Drag the handle icon (or press Space + Arrow keys) to smoothly reorder media slides"
        size="2xl"
      >
        <form onSubmit={handleSaveEditor} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#290044] mb-1">
                Playlist Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setEditorError('');
                }}
                placeholder="e.g., Building A Entrance Morning Loop"
                className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#290044] mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PlaylistStatus)}
                className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
              >
                <option value="Active">Active</option>
                <option value="Draft">Draft</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#290044] mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe target lobbies or content theme..."
                className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#290044]">
                  Default Image Duration (sec)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setItems((prev) =>
                      prev.map((it) => {
                        const media = getMediaById(it.mediaId);
                        if (!media || media.type === 'Image') {
                          return { ...it, displayDurationSeconds: defaultDuration };
                        }
                        return it;
                      })
                    );
                  }}
                  className="text-[10px] font-semibold text-[#8A2A78] hover:text-[#500071] underline cursor-pointer"
                  title="Force all image slides in this playlist to use this duration"
                >
                  Apply to all images
                </button>
              </div>
              <input
                type="number"
                min={1}
                max={300}
                value={defaultDuration}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  const newDuration = isNaN(val) ? 1 : Math.max(1, Math.min(300, val));
                  setDefaultDuration(newDuration);
                  // Automatically cascade to all image slides in real time
                  setItems((prev) =>
                    prev.map((it) => {
                      const media = getMediaById(it.mediaId);
                      if (!media || media.type === 'Image') {
                        return { ...it, displayDurationSeconds: newDuration };
                      }
                      return it;
                    })
                  );
                }}
                className="w-full px-3 py-2 text-xs font-mono tabular-nums border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
              />
              <p className="text-[10px] text-[#645573] mt-1">
                Updates all image slides in real time. Total Loop recalculates automatically.
              </p>
            </div>
          </div>

          {/* Playback Toggles & Loop Duration Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-4 py-3 rounded-lg bg-[#FAF8FC] border border-[#E8E2EE] text-xs">
            {/* Left: Toggles */}
            <div className="flex flex-wrap items-center gap-6">
              <label className="inline-flex items-center gap-2 cursor-pointer text-[#290044]">
                <input
                  type="checkbox"
                  checked={autoAdvanceVideo}
                  onChange={(e) => setAutoAdvanceVideo(e.target.checked)}
                  className="accent-[#500071] w-4 h-4"
                />
                Auto-advance after video completion
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer text-[#290044]">
                <input
                  type="checkbox"
                  checked={loopPlaylist}
                  onChange={(e) => setLoopPlaylist(e.target.checked)}
                  className="accent-[#500071] w-4 h-4"
                />
                Loop playlist continuously on Smart TV
              </label>
            </div>

            {/* Right: Direct Editable Total Loop Duration */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-[#8A2A78]/40 shadow-xs">
                <Clock className="w-3.5 h-3.5 text-[#500071]" />
                <label htmlFor="total-loop-input" className="font-bold text-xs text-[#290044]">
                  Set Loop Duration:
                </label>
                <input
                  id="total-loop-input"
                  type="number"
                  min={items.length || 1}
                  max={3600}
                  value={editorTotalDuration}
                  onChange={(e) => handleSetTotalLoop(parseInt(e.target.value, 10))}
                  aria-label="Set Total Loop Duration in seconds"
                  className="w-16 px-2 py-0.5 text-xs font-mono font-bold text-[#500071] text-center border border-[#8A2A78] rounded bg-[#FAF8FC] focus:outline-none focus:ring-2 focus:ring-[#8A2A78]"
                />
                <span className="font-mono text-xs font-semibold text-[#500071]">sec</span>
                <span className="text-[11px] font-mono text-[#645573] bg-[#F1ECF6] px-2 py-0.5 rounded font-semibold">
                  {formatDuration(editorTotalDuration)}
                </span>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1">
                {[15, 30, 33, 45, 60, 90].map((presetSec) => (
                  <button
                    key={presetSec}
                    type="button"
                    onClick={() => handleSetTotalLoop(presetSec)}
                    title={`Set total loop to ${presetSec} seconds`}
                    className={`px-2 py-1 text-[11px] font-mono font-semibold rounded border transition-colors cursor-pointer ${
                      editorTotalDuration === presetSec
                        ? 'bg-[#500071] text-white border-[#500071]'
                        : 'bg-white text-[#500071] border-[#E8E2EE] hover:bg-[#EEE3B0]/60'
                    }`}
                  >
                    {presetSec}s
                  </button>
                ))}

                <button
                  type="button"
                  onClick={handleEvenlySplitTotalLoop}
                  title="Evenly divide the total loop duration across all slides"
                  className="px-2 py-1 text-[11px] font-semibold text-[#8A2A78] bg-white border border-[#E8E2EE] rounded hover:bg-[#FAF8FC] hover:border-[#8A2A78] transition-colors cursor-pointer ml-1"
                >
                  Split Evenly
                </button>
              </div>
            </div>
          </div>

          {/* Two-Column Builder: Sortable Sequence vs Media Library Picker */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: dnd-kit Sortable Sequence */}
            <div className="lg:col-span-7 border border-[#E8E2EE] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-[#290044]">
                  Playback Order ({items.length} slides)
                </h4>
                <span className="text-[11px] text-[#645573]">
                  Drag grip or use arrows
                </span>
              </div>

              {items.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#645573] border border-dashed border-[#D7CEE0] rounded-lg bg-[#FAF8FC]">
                  Select media from the library panel on the right to build this playlist.
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragCancel={() => setActiveDragId(null)}
                >
                  <SortableContext
                    items={items.map((it) => it.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {items.map((item, idx) => (
                        <SortablePlaylistItem
                          key={item.id}
                          item={item}
                          index={idx}
                          totalCount={items.length}
                          media={getMediaById(item.mediaId)}
                          onMoveUp={() => moveItem(idx, idx - 1)}
                          onMoveDown={() => moveItem(idx, idx + 1)}
                          onUpdateDuration={(val) =>
                            setItems((prev) =>
                              prev.map((it) =>
                                it.id === item.id
                                  ? { ...it, displayDurationSeconds: val }
                                  : it
                              )
                            )
                          }
                          onToggleMute={() =>
                            setItems((prev) =>
                              prev.map((it) =>
                                it.id === item.id
                                  ? { ...it, muteAudio: !it.muteAudio }
                                  : it
                              )
                            )
                          }
                          onToggleLoop={() =>
                            setItems((prev) =>
                              prev.map((it) =>
                                it.id === item.id
                                  ? { ...it, loopVideo: !it.loopVideo }
                                  : it
                              )
                            )
                          }
                          onRemove={() =>
                            setItems((prev) =>
                              prev
                                .filter((it) => it.id !== item.id)
                                .map((it, i) => ({ ...it, order: i + 1 }))
                            )
                          }
                        />
                      ))}
                    </div>
                  </SortableContext>

                  <DragOverlay>
                    {activeDragItem ? (
                      <DragOverlayCard
                        item={activeDragItem}
                        media={getMediaById(activeDragItem.mediaId)}
                      />
                    ) : null}
                  </DragOverlay>
                </DndContext>
              )}
            </div>

            {/* Right: Add Media from Library */}
            <div className="lg:col-span-5 border border-[#E8E2EE] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-[#290044]">Add Media from Library</h4>
                <span className="text-[11px] font-mono text-[#645573] tabular-nums">
                  {filteredPickerMedia.length} assets
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {(['All', '16:9', '9:16'] as const).map((ratioOpt) => (
                  <button
                    key={ratioOpt}
                    type="button"
                    onClick={() => setMediaPickerRatioFilter(ratioOpt)}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
                      mediaPickerRatioFilter === ratioOpt
                        ? 'bg-[#500071] text-white border-[#500071]'
                        : 'bg-[#FAF8FC] text-[#645573] border-[#E8E2EE] hover:text-[#290044]'
                    }`}
                  >
                    {ratioOpt === 'All'
                      ? 'All ratios'
                      : ratioOpt === '16:9'
                      ? '16:9 TV'
                      : '9:16 Standy'}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#6E607D] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={mediaPickerSearch}
                  onChange={(e) => setMediaPickerSearch(e.target.value)}
                  placeholder="Filter media assets..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#FAF8FC] border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78] focus:bg-white"
                />
              </div>

              <div className="divide-y divide-[#F1ECF6] max-h-68 overflow-y-auto pr-1">
                {filteredPickerMedia.map((media) => {
                  const ratio = getMediaAspectRatio(media);
                  return (
                    <div
                      key={media.id}
                      className="py-2 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={ratio === '9:16' ? 'w-7 shrink-0' : 'w-12 shrink-0'}>
                          <MediaThumbnail
                            src={media.thumbnailUrl}
                            alt={media.title}
                            type={media.type}
                            aspectRatio={ratio}
                            accentTone={media.accentTone}
                            showDuration={false}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-xs font-semibold text-[#290044] truncate">
                              {media.title}
                            </p>
                            <span
                              className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                                ratio === '9:16'
                                  ? 'bg-[#8A2A78]/15 text-[#8A2A78]'
                                  : 'bg-[#500071]/10 text-[#500071]'
                              }`}
                            >
                              {ratio}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#645573] truncate">
                            {media.category} · {media.type}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addMediaToEditor(media)}
                        className="px-2.5 py-1 rounded-md bg-[#EEE3B0]/75 text-[#290044] text-[11px] font-semibold hover:bg-[#EEE3B0] shrink-0"
                      >
                        + Add
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {editorError && <p className="text-xs font-medium text-rose-700">{editorError}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="px-4 py-2 rounded-lg border border-[#E8E2EE] text-xs font-semibold text-[#290044]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#500071] text-white text-xs font-semibold hover:bg-[#8A2A78]"
            >
              {editingPlaylistId ? 'Save Playlist' : 'Create Playlist'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign Displays Modal (with Building & Floor Filter) */}
      <Modal
        isOpen={Boolean(assignPl)}
        onClose={() => setAssignPl(null)}
        title={assignPl ? `Assign Displays · ${assignPl.name}` : 'Assign Displays'}
        subtitle="Filter by Building & Floor or select individual campus screens"
        size="md"
      >
        {(() => {
          const filteredAssignScreens = filterScreensByLocation(
            assignBuildingFilter,
            assignFloorFilter
          );
          return (
            <div className="space-y-4">
              <p className="text-xs text-[#645573]">
                Check the boxes below to broadcast <strong>{assignPl?.name}</strong> permanently on those screens. Any un-checked screen will stop playing this playlist.
              </p>

              {/* Building & Floor Quick Filters */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <select
                  value={assignBuildingFilter}
                  onChange={(e) => setAssignBuildingFilter(e.target.value)}
                  aria-label="Filter displays by building"
                  className="px-2.5 py-2 bg-[#FAF8FC] border border-[#E8E2EE] rounded-lg text-[#290044]"
                >
                  {allBuildings.map((b) => (
                    <option key={b} value={b}>
                      {b === 'All' ? 'All Buildings' : b}
                    </option>
                  ))}
                </select>
                <select
                  value={assignFloorFilter}
                  onChange={(e) => setAssignFloorFilter(e.target.value)}
                  aria-label="Filter displays by floor"
                  className="px-2.5 py-2 bg-[#FAF8FC] border border-[#E8E2EE] rounded-lg text-[#290044]"
                >
                  {allFloors.map((f) => (
                    <option key={f} value={f}>
                      {f === 'All' ? 'All Floors' : f}
                    </option>
                  ))}
                </select>
              </div>

              {filteredAssignScreens.length > 0 && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#645573]">
                    Showing {filteredAssignScreens.length} matching screen(s)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedScreenIds(filteredAssignScreens.map((s) => s.id))
                      }
                      className="font-semibold text-[#500071] hover:underline cursor-pointer"
                    >
                      Only Showing
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedScreenIds((prev) =>
                          Array.from(new Set([...prev, ...filteredAssignScreens.map((s) => s.id)]))
                        )
                      }
                      className="font-semibold text-[#8A2A78] hover:underline cursor-pointer"
                    >
                      + Add Showing
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedScreenIds([])}
                      className="font-semibold text-[#645573] hover:text-rose-600 cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              )}

              <div className="max-h-72 overflow-y-auto space-y-2 border border-[#E8E2EE] rounded-xl p-3 bg-[#FAF8FC]">
                {filteredAssignScreens.length === 0 ? (
                  <p className="text-xs text-[#645573] text-center py-4">
                    No screens match the selected building/floor filter.
                  </p>
                ) : (
                  filteredAssignScreens.map((scr) => {
                    const isChecked = selectedScreenIds.includes(scr.id);
                    return (
                      <label
                        key={scr.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                          isChecked
                            ? 'border-[#500071] bg-white ring-1 ring-[#500071]'
                            : 'border-[#E8E2EE] bg-white hover:border-[#8A2A78]/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedScreenIds((prev) =>
                                prev.includes(scr.id)
                                  ? prev.filter((id) => id !== scr.id)
                                  : [...prev, scr.id]
                              );
                            }}
                            className="accent-[#500071] w-4 h-4"
                          />
                          <div className="min-w-0">
                            <span className="font-mono font-bold text-[#500071] block">
                              {scr.id}
                            </span>
                            <span className="text-[#290044] font-medium truncate block">
                              {scr.name}
                            </span>
                          </div>
                        </div>
                        <span className="text-[11px] text-[#645573] shrink-0 text-right">
                          {scr.building} · {scr.floor}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-mono font-semibold text-[#500071]">
                  {selectedScreenIds.length} display(s) selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignPl(null)}
                    className="px-4 py-2 rounded-lg border border-[#E8E2EE] text-xs font-semibold text-[#290044]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveScreenAssignments}
                    className="px-4 py-2 rounded-lg bg-[#500071] text-white text-xs font-semibold hover:bg-[#8A2A78]"
                  >
                    Save Assignments
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Schedule Playlist by Floor, Screen & Time Modal */}
      <Modal
        isOpen={Boolean(schedulePl)}
        onClose={() => setSchedulePl(null)}
        title={schedulePl ? `Schedule Playlist · ${schedulePl.name}` : 'Schedule Playlist'}
        subtitle="Select Building, Floor, TV Screens, and Date/Time Window"
        size="lg"
      >
        {schedulePl && (() => {
          const filteredSchedScreens = filterScreensByLocation(schedBuilding, schedFloor);
          return (
            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#290044] mb-1">
                    Schedule Name
                  </label>
                  <input
                    type="text"
                    value={schedName}
                    onChange={(e) => setSchedName(e.target.value)}
                    placeholder="e.g., First Floor Morning Rotation"
                    className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#290044] mb-1">
                    Priority
                  </label>
                  <select
                    value={schedPriority}
                    onChange={(e) =>
                      setSchedPriority(e.target.value as 'Normal' | 'High' | 'Urgent')
                    }
                    className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
                  >
                    <option value="Normal">Normal</option>
                    <option value="High">High (Overrides default playlist)</option>
                    <option value="Urgent">Urgent (Campus override)</option>
                  </select>
                </div>
              </div>

              {/* Select by Building, Floor, Groups & Screens */}
              <div className="p-3.5 rounded-xl border border-[#E8E2EE] bg-[#FAF8FC] space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[#290044]">
                    Select Building, Floor &amp; TV Screens
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-[#500071]">
                    {schedScreenIds.length} screen(s) selected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <select
                    value={schedBuilding}
                    onChange={(e) => setSchedBuilding(e.target.value)}
                    aria-label="Schedule filter by building"
                    className="px-2.5 py-2 bg-white border border-[#E8E2EE] rounded-lg text-[#290044]"
                  >
                    {allBuildings.map((b) => (
                      <option key={b} value={b}>
                        {b === 'All' ? 'All Buildings' : b}
                      </option>
                    ))}
                  </select>
                  <select
                    value={schedFloor}
                    onChange={(e) => setSchedFloor(e.target.value)}
                    aria-label="Schedule filter by floor"
                    className="px-2.5 py-2 bg-white border border-[#E8E2EE] rounded-lg text-[#290044]"
                  >
                    {allFloors.map((f) => (
                      <option key={f} value={f}>
                        {f === 'All' ? 'All Floors' : f}
                      </option>
                    ))}
                  </select>
                </div>

                {groups.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {groups.map((grp) => {
                      const activeGrp = schedGroupIds.includes(grp.id);
                      return (
                        <button
                          key={grp.id}
                          type="button"
                          onClick={() => {
                            if (activeGrp) {
                              setSchedGroupIds((prev) => prev.filter((id) => id !== grp.id));
                            } else {
                              setSchedGroupIds((prev) => [...prev, grp.id]);
                              setSchedScreenIds((prev) =>
                                Array.from(new Set([...prev, ...grp.screenIds]))
                              );
                            }
                          }}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
                            activeGrp
                              ? 'bg-[#500071] text-white border-[#500071]'
                              : 'bg-white text-[#500071] border-[#E8E2EE] hover:border-[#8A2A78]'
                          }`}
                        >
                          Group: {grp.name} ({grp.screenIds.length})
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#645573]">
                    Showing {filteredSchedScreens.length} matching display(s)
                  </span>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setSchedScreenIds(filteredSchedScreens.map((s) => s.id))
                      }
                      className="font-semibold text-[#500071] hover:underline cursor-pointer"
                    >
                      Only Showing
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSchedScreenIds((prev) =>
                          Array.from(new Set([...prev, ...filteredSchedScreens.map((s) => s.id)]))
                        )
                      }
                      className="font-semibold text-[#8A2A78] hover:underline cursor-pointer"
                    >
                      + Add Showing
                    </button>
                    <button
                      type="button"
                      onClick={() => setSchedScreenIds([])}
                      className="font-semibold text-[#645573] hover:text-rose-600 cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="max-h-44 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredSchedScreens.map((scr) => {
                    const checked = schedScreenIds.includes(scr.id);
                    return (
                      <label
                        key={scr.id}
                        className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          checked
                            ? 'border-[#500071] bg-white ring-1 ring-[#500071]'
                            : 'border-[#E8E2EE] bg-white hover:border-[#8A2A78]/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSchedScreenIds((prev) =>
                              prev.includes(scr.id)
                                ? prev.filter((id) => id !== scr.id)
                                : [...prev, scr.id]
                            )
                          }
                          className="accent-[#500071] w-4 h-4 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-[#290044] truncate">{scr.name}</p>
                          <p className="text-[10px] font-mono text-[#645573] truncate">
                            {scr.id} · {scr.building} · {scr.floor}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Date & Daily Time Window */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-[#290044]">
                    Date &amp; Daily Time Window
                  </span>
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    {[
                      { label: 'Morning 08–13', s: '08:00', e: '13:00' },
                      { label: 'Afternoon 13–18', s: '13:00', e: '18:00' },
                      { label: 'Full Day 08–22', s: '08:00', e: '22:00' },
                      { label: '24 Hours', s: '00:00', e: '23:59' },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setSchedStartTime(preset.s);
                          setSchedEndTime(preset.e);
                        }}
                        className="px-2 py-0.5 rounded bg-[#FAF8FC] border border-[#E8E2EE] text-[#500071] font-semibold hover:bg-[#EEE3B0]/50 cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#645573] mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={schedStartDate}
                      onChange={(e) => setSchedStartDate(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs font-mono border border-[#E8E2EE] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#645573] mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={schedEndDate}
                      onChange={(e) => setSchedEndDate(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs font-mono border border-[#E8E2EE] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#645573] mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={schedStartTime}
                      onChange={(e) => setSchedStartTime(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs font-mono border border-[#E8E2EE] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#645573] mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={schedEndTime}
                      onChange={(e) => setSchedEndTime(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs font-mono border border-[#E8E2EE] rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Optional QR Overlay */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-[#F1ECF6]">
                <div>
                  <label className="block text-[11px] font-semibold text-[#645573] mb-1">
                    Optional QR Link URL
                  </label>
                  <input
                    type="url"
                    value={schedQrUrl}
                    onChange={(e) => setSchedQrUrl(e.target.value)}
                    placeholder="https://dypiu.ac.in/... (optional)"
                    className="w-full px-2.5 py-2 text-xs border border-[#E8E2EE] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#645573] mb-1">
                    Optional QR Caption
                  </label>
                  <input
                    type="text"
                    maxLength={40}
                    value={schedQrLabel}
                    onChange={(e) => setSchedQrLabel(e.target.value)}
                    placeholder="e.g., Scan for Info"
                    className="w-full px-2.5 py-2 text-xs border border-[#E8E2EE] rounded-lg"
                  />
                </div>
              </div>

              {schedError && <p className="text-xs font-medium text-rose-700">{schedError}</p>}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E2EE]">
                <button
                  type="button"
                  onClick={() => setSchedulePl(null)}
                  className="px-4 py-2 rounded-lg border border-[#E8E2EE] text-xs font-semibold text-[#290044]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#500071] text-white text-xs font-semibold hover:bg-[#8A2A78] cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Save Playlist Schedule
                </button>
              </div>
            </form>
          );
        })()}
      </Modal>
    </div>
  );
};
