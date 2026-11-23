import React, { useEffect, useState } from 'react';
import {
  Edit3,
  Eye,
  Film,
  Image as ImageIcon,
  ListVideo,
  Monitor,
  Play,
  Plus,
  Power,
  QrCode,
  RefreshCw,
  Search,
} from 'lucide-react';
import { MediaAsset, Playlist, ScreenDevice } from '../types/signage';
import { CAMPUS_BUILDINGS, CAMPUS_FLOORS } from '../data/mockSignageData';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { MediaThumbnail, formatDuration } from '../components/ui/MediaThumbnail';

interface ScreenManagementPageProps {
  screens: ScreenDevice[];
  playlists: Playlist[];
  mediaAssets: MediaAsset[];
  openAddSignal: number;
  onAddScreen: (screen: ScreenDevice) => void;
  onUpdateScreen: (screen: ScreenDevice) => void;
  onToggleActiveScreen: (id: string) => void;
}

export const ScreenManagementPage: React.FC<ScreenManagementPageProps> = ({
  screens,
  playlists,
  mediaAssets,
  openAddSignal,
  onAddScreen,
  onUpdateScreen,
  onToggleActiveScreen,
}) => {
  const [search, setSearch] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('All');
  const [floorFilter, setFloorFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Online' | 'Offline'>('All');

  // Modals
  const [addOpen, setAddOpen] = useState(false);
  const [pairingOpen, setPairingOpen] = useState(false);
  const [pairingCode, setPairingCode] = useState('DYP-84K');
  const [pairingStatus, setPairingStatus] = useState<'waiting' | 'paired'>('waiting');

  const [detailScreen, setDetailScreen] = useState<ScreenDevice | null>(null);
  const [editScreen, setEditScreen] = useState<ScreenDevice | null>(null);
  const [assignTarget, setAssignTarget] = useState<ScreenDevice | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('');
  const [playlistPreview, setPlaylistPreview] = useState<{
    playlist: Playlist;
    activeMediaId: string;
  } | null>(null);

  // Add / Edit Form fields
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formBuilding, setFormBuilding] = useState('Building A');
  const [formFloor, setFormFloor] = useState('Ground Floor');
  const [formLocation, setFormLocation] = useState('');
  const [formDeviceType, setFormDeviceType] = useState('LG webOS 55" Commercial');
  const [formPlaylistId, setFormPlaylistId] = useState(playlists[0]?.id || '');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (openAddSignal > 0) {
      openAddModal();
    }
  }, [openAddSignal]);

  const buildings = ['All', ...Array.from(new Set(screens.map((s) => s.building)))];
  const floors = ['All', ...Array.from(new Set(screens.map((s) => s.floor)))];

  const filteredScreens = screens.filter((s) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      s.id.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.location.toLowerCase().includes(q);
    const matchesBuilding = buildingFilter === 'All' || s.building === buildingFilter;
    const matchesFloor = floorFilter === 'All' || s.floor === floorFilter;
    const matchesStatus = statusFilter === 'All' || s.connectionStatus === statusFilter;
    return matchesSearch && matchesBuilding && matchesFloor && matchesStatus;
  });

  const getPlaylist = (id: string | null): Playlist | undefined =>
    playlists.find((p) => p.id === id);

  const getPlaylistMedia = (playlist: Playlist | undefined): MediaAsset[] => {
    if (!playlist) return [];
    return playlist.items
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((item) => mediaAssets.find((m) => m.id === item.mediaId))
      .filter((m): m is MediaAsset => Boolean(m));
  };

  const renderMiniMediaFeed = (
    playlist: Playlist | undefined,
    maxVisible = 4,
    interactive = true
  ) => {
    if (!playlist) return null;
    const slides = getPlaylistMedia(playlist);
    if (slides.length === 0) {
      return (
        <p className="mt-1 text-[11px] text-[#6E607D]">Empty playlist (0 slides)</p>
      );
    }

    const visibleSlides = slides.slice(0, maxVisible);
    const remainingCount = slides.length - visibleSlides.length;
    const imageCount = slides.filter((s) => s.type === 'Image').length;
    const videoCount = slides.filter((s) => s.type === 'Video').length;

    return (
      <div className="mt-1.5 space-y-1">
        <div className="flex items-center gap-1.5">
          {visibleSlides.map((asset) => {
            const thumb = (
              <div className="relative w-12 h-7 rounded overflow-hidden border border-[#E8E2EE] bg-[#290044]/10 shrink-0">
                <MediaThumbnail
                  src={asset.thumbnailUrl}
                  alt={asset.title}
                  type={asset.type}
                  durationSeconds={asset.durationSeconds}
                  accentTone={asset.accentTone}
                  className="w-full h-full !rounded-none !border-0"
                  showDuration={false}
                />
                {asset.type === 'Video' && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded bg-black/75 text-white flex items-center justify-center"
                  >
                    <Play className="w-2 h-2 fill-current" />
                  </span>
                )}
              </div>
            );

            if (!interactive) {
              return (
                <div key={asset.id} title={`${asset.title} (${asset.type})`}>
                  {thumb}
                </div>
              );
            }

            return (
              <button
                key={asset.id}
                type="button"
                onClick={() =>
                  setPlaylistPreview({ playlist, activeMediaId: asset.id })
                }
                title={`Preview ${asset.title} (${asset.type})`}
                aria-label={`Preview ${asset.title}`}
                className="group/thumb rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A2A78] hover:ring-2 hover:ring-[#8A2A78]/60 transition-all"
              >
                {thumb}
              </button>
            );
          })}

          {remainingCount > 0 && (
            <button
              type="button"
              onClick={() =>
                interactive &&
                setPlaylistPreview({
                  playlist,
                  activeMediaId: slides[maxVisible].id,
                })
              }
              title={`View all ${slides.length} slides in ${playlist.name}`}
              className="h-7 px-1.5 rounded border border-[#E8E2EE] bg-[#FAF8FC] text-[10px] font-mono font-semibold text-[#500071] hover:bg-[#EEE3B0]/50 transition-colors tabular-nums"
            >
              +{remainingCount}
            </button>
          )}
        </div>
        <p className="text-[11px] text-[#645573] tabular-nums">
          {imageCount > 0 ? `${imageCount} img` : ''}
          {imageCount > 0 && videoCount > 0 ? ' · ' : ''}
          {videoCount > 0 ? `${videoCount} vid` : ''}
        </p>
      </div>
    );
  };

  const openAddModal = () => {
    const nextNum = String(screens.length + 1).padStart(3, '0');
    setFormId(`DYPIU-TV-${nextNum}`);
    setFormName('');
    setFormBuilding('Building A');
    setFormFloor('Ground Floor');
    setFormLocation('');
    setFormDeviceType('LG webOS 55" Commercial');
    setFormPlaylistId(playlists[0]?.id || '');
    setFormError('');
    setAddOpen(true);
  };

  const openEditModal = (scr: ScreenDevice) => {
    setEditScreen(scr);
    setFormId(scr.id);
    setFormName(scr.name);
    setFormBuilding(scr.building);
    setFormFloor(scr.floor);
    setFormLocation(scr.location);
    setFormDeviceType(scr.deviceType);
    setFormPlaylistId(scr.assignedPlaylistId || '');
    setFormError('');
  };

  const handleCreateScreen = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId.trim() || !formName.trim()) {
      setFormError('Screen ID and Screen Name are required.');
      return;
    }
    const created: ScreenDevice = {
      id: formId.trim().toUpperCase(),
      name: formName.trim(),
      building: formBuilding,
      floor: formFloor,
      location: formLocation.trim() || `${formBuilding} ${formFloor}`,
      deviceType: formDeviceType,
      resolution: '3840 × 2160',
      osVersion: 'Android TV 13',
      playerAppVersion: '2.4.1',
      connectionStatus: 'Online',
      lastSeen: 'Just now',
      lastHeartbeat: '2026-11-23 09:37:15',
      assignedPlaylistId: formPlaylistId || null,
      currentMediaId: 'med-001',
      ipAddress: `10.14.20.${130 + screens.length}`,
      storageUsedPct: 18,
      playbackError: null,
      isActive: true,
    };
    onAddScreen(created);
    setAddOpen(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editScreen || !formName.trim()) {
      setFormError('Screen Name is required.');
      return;
    }
    onUpdateScreen({
      ...editScreen,
      name: formName.trim(),
      building: formBuilding,
      floor: formFloor,
      location: formLocation.trim(),
      deviceType: formDeviceType,
      assignedPlaylistId: formPlaylistId || null,
    });
    setEditScreen(null);
  };

  const regeneratePairingCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'DYP-';
    for (let i = 0; i < 3; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    setPairingCode(code);
    setPairingStatus('waiting');
  };

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="type-section-title text-[#290044]">
            Campus screen fleet
          </h2>
          <p className="type-support text-[#645573]">
            Register Smart TVs, assign playlists, inspect device health, and pair new Android TV players.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              regeneratePairingCode();
              setPairingOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#500071] text-[#500071] bg-white type-button hover:bg-[#FAF8FC] transition-colors whitespace-nowrap"
          >
            <QrCode className="w-4 h-4" />
            Pairing code
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#500071] text-white type-button hover:bg-[#8A2A78] transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Register screen
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E8E2EE] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-[#6E607D] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Screen ID, name, or location..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8FC] border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78] focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <select
            value={buildingFilter}
            onChange={(e) => setBuildingFilter(e.target.value)}
            aria-label="Filter by building"
            className="px-3 py-2 bg-[#FAF8FC] border border-[#E8E2EE] rounded-lg text-[#290044] focus:outline-none focus:border-[#8A2A78]"
          >
            {buildings.map((b) => (
              <option key={b} value={b}>
                {b === 'All' ? 'All Buildings' : b}
              </option>
            ))}
          </select>

          <select
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
            aria-label="Filter by floor"
            className="px-3 py-2 bg-[#FAF8FC] border border-[#E8E2EE] rounded-lg text-[#290044] focus:outline-none focus:border-[#8A2A78]"
          >
            {floors.map((f) => (
              <option key={f} value={f}>
                {f === 'All' ? 'All Floors' : f}
              </option>
            ))}
          </select>

          <div className="flex items-center p-1 bg-[#FAF8FC] border border-[#E8E2EE] rounded-lg">
            {(['All', 'Online', 'Offline'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === st
                    ? 'bg-[#500071] text-white'
                    : 'text-[#645573] hover:text-[#290044]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Screens Table */}
      <div className="bg-white border border-[#E8E2EE] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E8E2EE] bg-[#FAF8FC] text-[11px] font-semibold text-[#645573]">
                <th className="py-3 px-4">Screen ID</th>
                <th className="py-3 px-4">Screen Name</th>
                <th className="py-3 px-4">Building & Floor</th>
                <th className="py-3 px-4">Device Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Seen</th>
                <th className="py-3 px-4">Assigned Playlist</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1ECF6] text-xs">
              {filteredScreens.map((scr) => (
                <tr
                  key={scr.id}
                  className={`hover:bg-[#FAF8FC] transition-colors ${
                    !scr.isActive ? 'opacity-55' : ''
                  }`}
                >
                  <td className="py-3 px-4 font-mono font-semibold text-[#500071] whitespace-nowrap">
                    {scr.id}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-[#290044]">{scr.name}</p>
                    <p className="text-[11px] text-[#645573]">{scr.location}</p>
                  </td>
                  <td className="py-3 px-4 text-[#290044] whitespace-nowrap">
                    {scr.building} · <span className="text-[#645573]">{scr.floor}</span>
                  </td>
                  <td className="py-3 px-4 text-[#645573] whitespace-nowrap">
                    {scr.deviceType}
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={scr.isActive ? scr.connectionStatus : 'Archived'} />
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-[#645573] whitespace-nowrap">
                    {scr.lastSeen}
                  </td>
                  <td className="py-3 px-4">
                    {(() => {
                      const assignedPlaylist = getPlaylist(scr.assignedPlaylistId);
                      if (!assignedPlaylist) {
                        return <span className="text-[#6E607D]">Unassigned</span>;
                      }
                      return (
                        <div className="min-w-[190px]">
                          <p className="text-[#500071] font-medium leading-snug">
                            {assignedPlaylist.name}
                          </p>
                          {renderMiniMediaFeed(assignedPlaylist, 4, true)}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setDetailScreen(scr)}
                        title="View Details"
                        className="p-1.5 rounded-md text-[#500071] hover:bg-[#EEE3B0]/40"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(scr)}
                        title="Edit Screen"
                        className="p-1.5 rounded-md text-[#500071] hover:bg-[#EEE3B0]/40"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAssignTarget(scr);
                          setSelectedPlaylistId(scr.assignedPlaylistId || playlists[0]?.id || '');
                        }}
                        title="Assign Playlist"
                        className="p-1.5 rounded-md text-[#8A2A78] hover:bg-[#EEE3B0]/40"
                      >
                        <ListVideo className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleActiveScreen(scr.id)}
                        title={scr.isActive ? 'Deactivate Screen' : 'Reactivate Screen'}
                        className={`p-1.5 rounded-md ${
                          scr.isActive
                            ? 'text-rose-600 hover:bg-rose-50'
                            : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Screen Modal */}
      <Modal
        isOpen={addOpen || Boolean(editScreen)}
        onClose={() => {
          setAddOpen(false);
          setEditScreen(null);
        }}
        title={editScreen ? `Edit Screen · ${editScreen.id}` : 'Add Campus Screen'}
        subtitle="Configure physical location and initial playback assignment"
        size="md"
      >
        <form onSubmit={editScreen ? handleSaveEdit : handleCreateScreen} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#290044] mb-1">
                Screen ID *
              </label>
              <input
                type="text"
                value={formId}
                disabled={Boolean(editScreen)}
                onChange={(e) => setFormId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-[#E8E2EE] rounded-lg disabled:bg-[#FAF8FC] focus:outline-none focus:border-[#8A2A78]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#290044] mb-1">
                Screen Name *
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Main Entrance"
                className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#290044] mb-1">Building</label>
              <select
                value={formBuilding}
                onChange={(e) => setFormBuilding(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
              >
                {(CAMPUS_BUILDINGS.includes(formBuilding)
                  ? CAMPUS_BUILDINGS
                  : [...CAMPUS_BUILDINGS, formBuilding]
                ).map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#290044] mb-1">Floor</label>
              <select
                value={formFloor}
                onChange={(e) => setFormFloor(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
              >
                {(CAMPUS_FLOORS.includes(formFloor)
                  ? CAMPUS_FLOORS
                  : [...CAMPUS_FLOORS, formFloor]
                ).map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#290044] mb-1">
              Specific Location
            </label>
            <input
              type="text"
              value={formLocation}
              onChange={(e) => setFormLocation(e.target.value)}
              placeholder="e.g., North Atrium Reception Desk"
              className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#290044] mb-1">
                Device Hardware
              </label>
              <input
                type="text"
                value={formDeviceType}
                onChange={(e) => setFormDeviceType(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#290044] mb-1">
                Assigned Playlist
              </label>
              <select
                value={formPlaylistId}
                onChange={(e) => setFormPlaylistId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
              >
                <option value="">Unassigned</option>
                {playlists.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formPlaylistId && (
            <div className="p-3 rounded-lg bg-[#FAF8FC] border border-[#E8E2EE]">
              <p className="text-[11px] font-semibold text-[#290044]">
                Playlist Media Preview
              </p>
              {renderMiniMediaFeed(getPlaylist(formPlaylistId), 6, false)}
            </div>
          )}

          {formError && <p className="text-xs font-medium text-rose-700">{formError}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setAddOpen(false);
                setEditScreen(null);
              }}
              className="px-4 py-2 rounded-lg border border-[#E8E2EE] text-xs font-semibold text-[#290044]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#500071] text-white text-xs font-semibold hover:bg-[#8A2A78]"
            >
              {editScreen ? 'Save Changes' : 'Register Screen'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Pairing Code Modal */}
      <Modal
        isOpen={pairingOpen}
        onClose={() => setPairingOpen(false)}
        title="Pair Android TV Signage Player"
        subtitle="Simulated device provisioning — enter this code on the CampusCast TV Player app"
        size="sm"
      >
        <div className="text-center space-y-5 py-2">
          <div className="p-6 rounded-2xl bg-[#290044] text-white space-y-2">
            <p className="text-xs text-[#EEE3B0]">6-Character Device Pairing Token</p>
            <p className="text-3xl font-mono font-bold tracking-[0.25em] text-white">
              {pairingCode}
            </p>
            <p className="text-[11px] text-white/70">Valid for 15 minutes · Realm: campus-tv</p>
          </div>

          {pairingStatus === 'paired' ? (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
              Simulated handshake verified! Android TV player is ready to be saved under Add Screen.
            </div>
          ) : (
            <p className="text-xs text-[#645573]">
              Open CampusCast Player on the campus Android TV and type the token above to link it to this dashboard.
            </p>
          )}

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={regeneratePairingCode}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E8E2EE] text-xs font-semibold text-[#290044] hover:bg-[#FAF8FC]"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              New Code
            </button>
            <button
              type="button"
              onClick={() => setPairingStatus('paired')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#500071] text-white text-xs font-semibold hover:bg-[#8A2A78]"
            >
              <Monitor className="w-3.5 h-3.5" />
              Simulate TV Handshake
            </button>
          </div>
        </div>
      </Modal>

      {/* Assign Playlist Modal */}
      <Modal
        isOpen={Boolean(assignTarget)}
        onClose={() => setAssignTarget(null)}
        title={`Assign Playlist · ${assignTarget?.id}`}
        subtitle={assignTarget?.name}
        size="sm"
      >
        <div className="space-y-4">
          <select
            value={selectedPlaylistId}
            onChange={(e) => setSelectedPlaylistId(e.target.value)}
            className="w-full px-3 py-2.5 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
          >
            <option value="">Unassigned</option>
            {playlists.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.items.length} slides)
              </option>
            ))}
          </select>

          {selectedPlaylistId && (
            <div className="p-3 rounded-lg bg-[#FAF8FC] border border-[#E8E2EE]">
              <p className="text-[11px] font-semibold text-[#290044]">
                Included Images & Videos
              </p>
              {renderMiniMediaFeed(getPlaylist(selectedPlaylistId), 5, false)}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setAssignTarget(null)}
              className="px-4 py-2 rounded-lg border border-[#E8E2EE] text-xs font-semibold text-[#290044]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (assignTarget) {
                  onUpdateScreen({
                    ...assignTarget,
                    assignedPlaylistId: selectedPlaylistId || null,
                  });
                  setAssignTarget(null);
                }
              }}
              className="px-4 py-2 rounded-lg bg-[#500071] text-white text-xs font-semibold hover:bg-[#8A2A78]"
            >
              Update Assignment
            </button>
          </div>
        </div>
      </Modal>

      {/* View Screen Details Modal */}
      <Modal
        isOpen={Boolean(detailScreen)}
        onClose={() => setDetailScreen(null)}
        title={detailScreen ? `${detailScreen.id} · ${detailScreen.name}` : 'Screen Details'}
        subtitle={detailScreen ? `${detailScreen.building} · ${detailScreen.floor}` : ''}
        size="md"
      >
        {detailScreen && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF8FC] border border-[#E8E2EE]">
              <div>
                <p className="text-[#645573]">Connection State</p>
                <p className="font-mono font-semibold text-[#290044] mt-0.5">
                  IP {detailScreen.ipAddress} · Last heartbeat {detailScreen.lastHeartbeat}
                </p>
              </div>
              <StatusBadge status={detailScreen.connectionStatus} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-[#E8E2EE]">
                <p className="text-[#645573]">Hardware</p>
                <p className="font-semibold text-[#290044] mt-0.5">{detailScreen.deviceType}</p>
              </div>
              <div className="p-3 rounded-lg border border-[#E8E2EE]">
                <p className="text-[#645573]">Display Resolution</p>
                <p className="font-mono font-semibold text-[#290044] mt-0.5">
                  {detailScreen.resolution}
                </p>
              </div>
              <div className="p-3 rounded-lg border border-[#E8E2EE]">
                <p className="text-[#645573]">OS & Player Build</p>
                <p className="font-mono font-semibold text-[#290044] mt-0.5">
                  {detailScreen.osVersion} · v{detailScreen.playerAppVersion}
                </p>
              </div>
              <div className="p-3 rounded-lg border border-[#E8E2EE]">
                <p className="text-[#645573]">Local Cache Used</p>
                <p className="font-mono font-semibold text-[#290044] mt-0.5 tabular-nums">
                  {detailScreen.storageUsedPct}%
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-[#E8E2EE]">
              <p className="text-[#645573]">Assigned Playlist</p>
              <p className="font-semibold text-[#500071] mt-0.5">
                {getPlaylist(detailScreen.assignedPlaylistId)?.name || 'Unassigned'}
              </p>
              {renderMiniMediaFeed(
                getPlaylist(detailScreen.assignedPlaylistId),
                6,
                false
              )}
            </div>

            {detailScreen.playbackError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
                Diagnostic Alert: {detailScreen.playbackError}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Assigned Playlist Media Preview Modal */}
      <Modal
        isOpen={Boolean(playlistPreview)}
        onClose={() => setPlaylistPreview(null)}
        title={playlistPreview?.playlist.name || 'Playlist Preview'}
        subtitle="Click any slide below to inspect images and videos in this playlist"
        size="lg"
      >
        {playlistPreview && (() => {
          const slides = getPlaylistMedia(playlistPreview.playlist);
          const activeSlide =
            slides.find((s) => s.id === playlistPreview.activeMediaId) || slides[0];
          if (!activeSlide) {
            return (
              <p className="text-xs text-[#645573]">
                No media assets are currently linked to this playlist.
              </p>
            );
          }
          return (
            <div className="space-y-4">
              <MediaThumbnail
                src={activeSlide.thumbnailUrl}
                alt={activeSlide.title}
                type={activeSlide.type}
                durationSeconds={activeSlide.durationSeconds}
                accentTone={activeSlide.accentTone}
              />

              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[#FAF8FC] border border-[#E8E2EE] text-xs">
                <div className="min-w-0">
                  <p className="font-semibold text-[#290044] truncate">
                    {activeSlide.title}
                  </p>
                  <p className="text-[11px] font-mono text-[#6E607D] truncate">
                    {activeSlide.fileName} · {activeSlide.dimensions}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 font-medium text-[#500071]">
                  {activeSlide.type === 'Video' ? (
                    <Film className="w-3.5 h-3.5" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5" />
                  )}
                  {activeSlide.type}
                  {activeSlide.type === 'Video' && activeSlide.durationSeconds
                    ? ` · ${formatDuration(activeSlide.durationSeconds)}`
                    : ''}
                </span>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-[#645573]">
                  Playlist Slides ({slides.length})
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {slides.map((slide, idx) => {
                    const isCurrent = slide.id === activeSlide.id;
                    return (
                      <button
                        key={`${slide.id}-${idx}`}
                        type="button"
                        onClick={() =>
                          setPlaylistPreview({
                            playlist: playlistPreview.playlist,
                            activeMediaId: slide.id,
                          })
                        }
                        className={`text-left p-1.5 rounded-lg border transition-colors ${
                          isCurrent
                            ? 'border-[#500071] bg-[#EEE3B0]/35'
                            : 'border-[#E8E2EE] bg-white hover:border-[#8A2A78]/50'
                        }`}
                      >
                        <MediaThumbnail
                          src={slide.thumbnailUrl}
                          alt={slide.title}
                          type={slide.type}
                          durationSeconds={slide.durationSeconds}
                          accentTone={slide.accentTone}
                        />
                        <p className="mt-1.5 text-[11px] font-medium text-[#290044] truncate">
                          {idx + 1}. {slide.title}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};
