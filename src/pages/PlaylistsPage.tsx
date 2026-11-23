import React, { useEffect, useState } from 'react';
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
  Edit3,
  Monitor,
  Pause,
  Play,
  Plus,
  Search,
  SkipBack,
  SkipForward,
  Trash2,
  Tv,
} from 'lucide-react';
import {
  MediaAsset,
  Playlist,
  PlaylistItem,
  PlaylistStatus,
} from '../types/signage';
import { StatusBadge } from '../components/ui/StatusBadge';
import { MediaThumbnail, formatDuration } from '../components/ui/MediaThumbnail';
import { Modal } from '../components/ui/Modal';
import {
  DragOverlayCard,
  SortablePlaylistItem,
} from '../components/playlists/SortablePlaylistItem';

interface PlaylistsPageProps {
  playlists: Playlist[];
  mediaAssets: MediaAsset[];
  openCreateSignal: number;
  onSavePlaylist: (playlist: Playlist) => void;
  onDeletePlaylist: (id: string) => void;
}

export const PlaylistsPage: React.FC<PlaylistsPageProps> = ({
  playlists,
  mediaAssets,
  openCreateSignal,
  onSavePlaylist,
  onDeletePlaylist,
}) => {
  const [selectedPreviewPlaylistId, setSelectedPreviewPlaylistId] = useState<string>(
    playlists[0]?.id || ''
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);

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
  const [editorError, setEditorError] = useState('');

  // Simulated TV Player Preview State
  const [isPlaying, setIsPlaying] = useState(true);
  const [slideIdx, setSlideIdx] = useState(0);
  const [elapsedInSlide, setElapsedInSlide] = useState(0);

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

  // Simulate TV rotation timer
  useEffect(() => {
    if (!isPlaying || !previewPlaylist || previewPlaylist.items.length === 0) return;

    const currentItem = previewPlaylist.items[slideIdx % previewPlaylist.items.length];
    const duration = Math.max(3, currentItem?.displayDurationSeconds || 10);

    const timer = window.setInterval(() => {
      setElapsedInSlide((prev) => {
        if (prev + 1 >= duration) {
          setSlideIdx((s) => (s + 1) % previewPlaylist.items.length);
          return 0;
        }
        return prev + 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isPlaying, previewPlaylist, slideIdx]);

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

  const activeDragItem = activeDragId
    ? items.find((it) => it.id === activeDragId)
    : undefined;

  const filteredPickerMedia = mediaAssets.filter((m) => {
    const q = mediaPickerSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      m.title.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      m.type.toLowerCase().includes(q)
    );
  });

  const editorTotalDuration = items.reduce(
    (sum, it) => sum + it.displayDurationSeconds,
    0
  );

  const currentPreviewItem =
    previewPlaylist && previewPlaylist.items.length > 0
      ? previewPlaylist.items[slideIdx % previewPlaylist.items.length]
      : null;
  const currentPreviewMedia = currentPreviewItem
    ? getMediaById(currentPreviewItem.mediaId)
    : undefined;
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
                    <h3 className="type-card-title text-[#290044]">
                      {pl.name}
                    </h3>
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
                    <span className="font-mono font-semibold text-[#290044] tabular-nums">
                      {pl.assignedScreenIds.length} TVs
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
                  <div className="flex items-center gap-1.5">
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
              </div>
            );
          })}
        </div>

        {/* Right: Simulated Smart TV Preview */}
        <section className="xl:col-span-5 bg-white border border-[#E6E0EC] rounded-xl p-6 shadow-[0_1px_2px_rgba(41,0,68,0.04)] sticky top-24 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Tv className="w-4 h-4 text-[#500071] shrink-0" />
              <div className="min-w-0">
                <h3 className="type-card-title text-[#290044] truncate">
                  Smart TV rotation preview
                </h3>
                <p className="type-support text-[#645573] truncate">
                  {previewPlaylist ? previewPlaylist.name : 'Select a playlist'}
                </p>
              </div>
            </div>
            <span className="text-[12px] font-mono text-[#500071] bg-[#EEE3B0]/60 px-2.5 py-0.5 rounded">
              Simulated player
            </span>
          </div>

          {/* TV Bezel */}
          <div className="rounded-xl bg-[#1A1025] p-2.5 border-2 border-[#290044] shadow-md">
            <div className="relative aspect-video rounded-lg overflow-hidden bg-[#290044]">
              {currentPreviewMedia ? (
                <>
                  <MediaThumbnail
                    src={currentPreviewMedia.thumbnailUrl}
                    alt={currentPreviewMedia.title}
                    type={currentPreviewMedia.type}
                    durationSeconds={currentPreviewMedia.durationSeconds}
                    accentTone={currentPreviewMedia.accentTone}
                    className="w-full h-full rounded-none border-0"
                    showDuration={false}
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3.5 text-white">
                    <div className="flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] text-[#EEE3B0] font-medium">
                          {currentPreviewMedia.category} · {currentPreviewMedia.type}
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

          {/* Player Controls */}
          {previewPlaylist && previewPlaylist.items.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSlideIdx((s) =>
                        s === 0 ? previewPlaylist.items.length - 1 : s - 1
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
                      setSlideIdx((s) => (s + 1) % previewPlaylist.items.length);
                      setElapsedInSlide(0);
                    }}
                    aria-label="Next slide"
                    className="p-2 rounded-lg border border-[#E8E2EE] text-[#290044] hover:bg-[#FAF8FC]"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>

                <span className="text-xs font-mono tabular-nums text-[#645573]">
                  Slide {(slideIdx % previewPlaylist.items.length) + 1} of{' '}
                  {previewPlaylist.items.length}
                </span>
              </div>

              {/* Queue Sequence */}
              <div className="divide-y divide-[#F1ECF6] border border-[#E8E2EE] rounded-lg max-h-52 overflow-y-auto">
                {previewPlaylist.items.map((item, idx) => {
                  const media = getMediaById(item.mediaId);
                  const active = idx === slideIdx % previewPlaylist.items.length;
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
                      <span className="truncate">
                        <span className="font-mono mr-2">{idx + 1}.</span>
                        {media?.title || item.mediaId}
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
              <label className="block text-xs font-semibold text-[#290044] mb-1">
                Default Image Duration (sec)
              </label>
              <input
                type="number"
                min={3}
                max={120}
                value={defaultDuration}
                onChange={(e) => setDefaultDuration(Math.max(3, Number(e.target.value) || 10))}
                className="w-full px-3 py-2 text-xs font-mono tabular-nums border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
              />
            </div>
          </div>

          {/* Playback Toggles */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 rounded-lg bg-[#FAF8FC] border border-[#E8E2EE] text-xs">
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
            <span className="font-mono tabular-nums text-[#500071] font-semibold">
              Total Loop: {formatDuration(editorTotalDuration)}
            </span>
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
                {filteredPickerMedia.map((media) => (
                  <div
                    key={media.id}
                    className="py-2 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-12 shrink-0">
                        <MediaThumbnail
                          src={media.thumbnailUrl}
                          alt={media.title}
                          type={media.type}
                          accentTone={media.accentTone}
                          showDuration={false}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#290044] truncate">
                          {media.title}
                        </p>
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
                ))}
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
    </div>
  );
};
