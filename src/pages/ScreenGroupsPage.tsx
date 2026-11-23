import React, { useState } from 'react';
import { Building2, Edit3, Layers, Monitor, Plus, Trash2 } from 'lucide-react';
import { Playlist, ScreenDevice, ScreenGroup } from '../types/signage';
import { CAMPUS_BUILDINGS, CAMPUS_FLOORS } from '../data/mockSignageData';
import { Modal } from '../components/ui/Modal';

interface ScreenGroupsPageProps {
  groups: ScreenGroup[];
  screens: ScreenDevice[];
  playlists: Playlist[];
  onSaveGroup: (group: ScreenGroup) => void;
  onDeleteGroup: (id: string) => void;
}

export const ScreenGroupsPage: React.FC<ScreenGroupsPageProps> = ({
  groups,
  screens,
  playlists,
  onSaveGroup,
  onDeleteGroup,
}) => {
  const [buildingFilter, setBuildingFilter] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ScreenGroup | null>(null);

  const [name, setName] = useState('');
  const [building, setBuilding] = useState('Building A');
  const [floor, setFloor] = useState('Ground Floor');
  const [description, setDescription] = useState('');
  const [selectedScreenIds, setSelectedScreenIds] = useState<string[]>([]);
  const [assignedPlaylistId, setAssignedPlaylistId] = useState<string>('');
  const [error, setError] = useState('');

  const buildings = ['All', ...Array.from(new Set(groups.map((g) => g.building)))];

  const openCreate = () => {
    setEditingGroup(null);
    setName('');
    setBuilding('Building A');
    setFloor('Ground Floor');
    setDescription('');
    setSelectedScreenIds([]);
    setAssignedPlaylistId(playlists[0]?.id || '');
    setError('');
    setModalOpen(true);
  };

  const openEdit = (grp: ScreenGroup) => {
    setEditingGroup(grp);
    setName(grp.name);
    setBuilding(grp.building);
    setFloor(grp.floor);
    setDescription(grp.description);
    setSelectedScreenIds(grp.screenIds);
    setAssignedPlaylistId(grp.assignedPlaylistId || '');
    setError('');
    setModalOpen(true);
  };

  const toggleScreen = (id: string) => {
    setSelectedScreenIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Group name is required.');
      return;
    }
    const saved: ScreenGroup = {
      id: editingGroup ? editingGroup.id : `grp-${Date.now().toString().slice(-4)}`,
      name: name.trim(),
      building,
      floor,
      description: description.trim() || `${building} · ${floor} displays`,
      screenIds: selectedScreenIds,
      assignedPlaylistId: assignedPlaylistId || null,
    };
    onSaveGroup(saved);
    setModalOpen(false);
  };

  const visibleGroups =
    buildingFilter === 'All'
      ? groups
      : groups.filter((g) => g.building === buildingFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="type-section-title text-[#290044]">
            Campus screen groups
          </h2>
          <p className="type-support text-[#645573]">
            Organize Smart TVs by building and floor for rapid campaign targeting.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#500071] text-white type-button hover:bg-[#8A2A78] transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Create screen group
        </button>
      </div>

      {/* Building Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 bg-white border border-[#E8E2EE] rounded-xl p-2">
        {buildings.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBuildingFilter(b)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              buildingFilter === b
                ? 'bg-[#EEE3B0] text-[#290044] font-semibold'
                : 'text-[#645573] hover:bg-[#FAF8FC] hover:text-[#290044]'
            }`}
          >
            {b === 'All' ? 'All Campus Buildings' : b}
          </button>
        ))}
      </div>

      {/* Group Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {visibleGroups.map((grp) => {
          const groupScreens = screens.filter((s) => grp.screenIds.includes(s.id));
          const onlineCount = groupScreens.filter(
            (s) => s.connectionStatus === 'Online'
          ).length;
          const playlistName =
            playlists.find((p) => p.id === grp.assignedPlaylistId)?.name || 'No default playlist';

          return (
            <article
              key={grp.id}
              className="bg-white border border-[#E8E2EE] rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-[#8A2A78]/50 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#FAF8FC] border border-[#E8E2EE] text-[#500071] flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="type-card-title text-[#290044] truncate">
                        {grp.name}
                      </h3>
                      <p className="type-support text-[#645573] flex items-center gap-1 truncate">
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        {grp.building} · {grp.floor}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(grp)}
                      title="Edit group"
                      className="p-1.5 rounded-md text-[#500071] hover:bg-[#FAF8FC]"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteGroup(grp.id)}
                      title="Delete group"
                      className="p-1.5 rounded-md text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-[#645573]">{grp.description}</p>

                <div className="flex flex-wrap gap-1.5">
                  {groupScreens.map((s) => (
                    <span
                      key={s.id}
                      className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#FAF8FC] border border-[#E8E2EE] text-[#290044]"
                    >
                      {s.id}
                    </span>
                  ))}
                  {groupScreens.length === 0 && (
                    <span className="text-[11px] text-[#6E607D]">No screens assigned</span>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-[#F1ECF6] flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-[#290044] font-semibold">
                  <Monitor className="w-3.5 h-3.5 text-[#500071]" />
                  {onlineCount}/{groupScreens.length} Online
                </span>
                <span className="text-[11px] text-[#500071] font-medium truncate">
                  {playlistName}
                </span>
              </div>
            </article>
          );
        })}
      </div>

      {/* Create / Edit Group Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingGroup ? 'Edit Screen Group' : 'Create Screen Group'}
        subtitle="Group campus TVs by building, floor, or functional wing"
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#290044] mb-1">
                Group Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                placeholder="e.g., Building A — Fourth Floor"
                className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#290044] mb-1">Building</label>
              <select
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
              >
                {(CAMPUS_BUILDINGS.includes(building)
                  ? CAMPUS_BUILDINGS
                  : [...CAMPUS_BUILDINGS, building]
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
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
              >
                {(CAMPUS_FLOORS.includes(floor)
                  ? CAMPUS_FLOORS
                  : [...CAMPUS_FLOORS, floor]
                ).map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#290044] mb-1">
                Default Playlist
              </label>
              <select
                value={assignedPlaylistId}
                onChange={(e) => setAssignedPlaylistId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
              >
                <option value="">None</option>
                {playlists.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#290044] mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional group description..."
                className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-[#290044] mb-2">
              Assign Screens ({selectedScreenIds.length} selected)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto p-2 border border-[#E8E2EE] rounded-lg">
              {screens.map((scr) => (
                <label
                  key={scr.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[#FAF8FC] cursor-pointer text-xs"
                >
                  <input
                    type="checkbox"
                    checked={selectedScreenIds.includes(scr.id)}
                    onChange={() => toggleScreen(scr.id)}
                    className="accent-[#500071]"
                  />
                  <span className="font-mono text-[11px] text-[#500071]">{scr.id}</span>
                  <span className="truncate text-[#290044]">{scr.name}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-xs font-medium text-rose-700">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-[#E8E2EE] text-xs font-semibold text-[#290044]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#500071] text-white text-xs font-semibold hover:bg-[#8A2A78]"
            >
              {editingGroup ? 'Save Group' : 'Create Group'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
