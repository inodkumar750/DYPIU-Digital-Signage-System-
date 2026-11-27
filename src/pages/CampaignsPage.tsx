import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  List,
  Pause,
  Play,
  Plus,
  QrCode,
  Search,
  Trash2,
} from 'lucide-react';
import {
  Campaign,
  CampaignStatus,
  Playlist,
  ScreenDevice,
  ScreenGroup,
} from '../types/signage';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import {
  getLocalDateStr,
  isCampaignInWindow,
  isCampaignLiveNow,
} from '../utils/campaignSchedule';

interface CampaignsPageProps {
  campaigns: Campaign[];
  playlists: Playlist[];
  screens: ScreenDevice[];
  groups: ScreenGroup[];
  openWizardSignal: number;
  onSaveCampaign: (campaign: Campaign) => void;
  onUpdateStatus: (id: string, status: CampaignStatus) => void;
  onDeleteCampaign: (id: string) => void;
}

const STATUS_TABS: ('All' | CampaignStatus)[] = [
  'All',
  'Active',
  'Scheduled',
  'Draft',
  'Paused',
  'Completed',
];

const WIZARD_STEPS = [
  'Campaign Details',
  'Select Playlist',
  'Select Screens',
  'Set Schedule',
  'Review & Publish',
];

export const CampaignsPage: React.FC<CampaignsPageProps> = ({
  campaigns,
  playlists,
  screens,
  groups,
  openWizardSignal,
  onSaveCampaign,
  onUpdateStatus,
  onDeleteCampaign,
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [statusFilter, setStatusFilter] = useState<'All' | CampaignStatus>('All');
  const [search, setSearch] = useState('');
  const [calendarMonth, setCalendarMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [nowTick, setNowTick] = useState<Date>(() => new Date());

  useEffect(() => {
    const t = window.setInterval(() => setNowTick(new Date()), 15000);
    return () => window.clearInterval(t);
  }, []);

  const defaultToday = getLocalDateStr();
  const defaultNextWeek = getLocalDateStr(new Date(Date.now() + 7 * 86400000));

  // 5-Step Wizard Modal State
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [wizardError, setWizardError] = useState('');

  const [cmpName, setCmpName] = useState('');
  const [cmpDesc, setCmpDesc] = useState('');
  const [cmpPriority, setCmpPriority] = useState<'Normal' | 'High' | 'Urgent'>('Normal');
  const [cmpPlaylistId, setCmpPlaylistId] = useState(playlists[0]?.id || '');
  const [cmpGroupIds, setCmpGroupIds] = useState<string[]>([]);
  const [cmpScreenIds, setCmpScreenIds] = useState<string[]>([]);
  const [cmpStartDate, setCmpStartDate] = useState(defaultToday);
  const [cmpEndDate, setCmpEndDate] = useState(defaultNextWeek);
  const [cmpStartTime, setCmpStartTime] = useState('08:00');
  const [cmpEndTime, setCmpEndTime] = useState('22:00');
  const [cmpQrUrl, setCmpQrUrl] = useState('');
  const [cmpQrLabel, setCmpQrLabel] = useState('');
  const [qrPreviewUrl, setQrPreviewUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    const val = cmpQrUrl.trim();
    if (!val) {
      setQrPreviewUrl('');
      return;
    }
    QRCode.toDataURL(val, {
      width: 180,
      margin: 1,
      color: { dark: '#111827', light: '#FFFFFF' },
    })
      .then((url) => {
        if (!cancelled) setQrPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrPreviewUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [cmpQrUrl]);

  useEffect(() => {
    if (openWizardSignal > 0) {
      openWizard();
    }
  }, [openWizardSignal]);

  const openWizard = () => {
    const today = getLocalDateStr();
    const nextWeek = getLocalDateStr(new Date(Date.now() + 7 * 86400000));
    setEditingCampaignId(null);
    setStep(1);
    setWizardError('');
    setCmpName('');
    setCmpDesc('');
    setCmpPriority('Normal');
    setCmpPlaylistId(playlists[0]?.id || '');
    setCmpGroupIds([]);
    setCmpScreenIds([]);
    setCmpStartDate(today);
    setCmpEndDate(nextWeek);
    setCmpStartTime('08:00');
    setCmpEndTime('22:00');
    setCmpQrUrl('');
    setCmpQrLabel('');
    setWizardOpen(true);
  };

  const openEditWizard = (cmp: Campaign) => {
    setEditingCampaignId(cmp.id);
    setStep(4);
    setWizardError('');
    setCmpName(cmp.name);
    setCmpDesc(cmp.description);
    setCmpPriority(cmp.priority);
    setCmpPlaylistId(cmp.playlistId);
    setCmpGroupIds(cmp.targetGroupIds || []);
    setCmpScreenIds(cmp.targetScreenIds || []);
    setCmpStartDate(cmp.startDate);
    setCmpEndDate(cmp.endDate);
    setCmpStartTime(cmp.startTime);
    setCmpEndTime(cmp.endTime);
    setCmpQrUrl(cmp.qrUrl || '');
    setCmpQrLabel(cmp.qrLabel || '');
    setWizardOpen(true);
  };

  const toggleGroupSelection = (grp: ScreenGroup) => {
    const exists = cmpGroupIds.includes(grp.id);
    if (exists) {
      setCmpGroupIds((prev) => prev.filter((id) => id !== grp.id));
    } else {
      setCmpGroupIds((prev) => [...prev, grp.id]);
      setCmpScreenIds((prev) => Array.from(new Set([...prev, ...grp.screenIds])));
    }
  };

  const toggleScreenSelection = (screenId: string) => {
    setCmpScreenIds((prev) =>
      prev.includes(screenId) ? prev.filter((id) => id !== screenId) : [...prev, screenId]
    );
  };

  const validateAndNext = () => {
    setWizardError('');
    if (step === 1 && !cmpName.trim()) {
      setWizardError('Please enter a campaign name before continuing.');
      return;
    }
    if (step === 2 && !cmpPlaylistId) {
      setWizardError('Please select a playlist for this campaign.');
      return;
    }
    if (step === 3 && cmpScreenIds.length === 0) {
      setWizardError('Select at least one screen or screen group.');
      return;
    }
    if (step === 4) {
      if (!cmpStartDate || !cmpEndDate || cmpEndDate < cmpStartDate) {
        setWizardError('End date must be on or after the start date.');
        return;
      }
    }
    setStep((s) => Math.min(5, s + 1));
  };

  const computeScheduledStatus = (): CampaignStatus => {
    const today = getLocalDateStr();
    if (cmpEndDate < today) return 'Completed';
    const isLiveRightNow = isCampaignInWindow({
      startDate: cmpStartDate,
      endDate: cmpEndDate,
      startTime: cmpStartTime,
      endTime: cmpEndTime,
    });
    return isLiveRightNow ? 'Active' : 'Scheduled';
  };

  const submitWizard = (targetStatus: CampaignStatus) => {
    if (!cmpStartDate || !cmpEndDate || cmpEndDate < cmpStartDate) {
      setWizardError('End date must be on or after the start date.');
      setStep(4);
      return;
    }
    if (!cmpName.trim() || !cmpPlaylistId || cmpScreenIds.length === 0) {
      setWizardError('Please complete campaign name, playlist, and target screens.');
      return;
    }
    const newCmp: Campaign = {
      id: editingCampaignId || `cmp-${Date.now().toString().slice(-4)}`,
      name: cmpName.trim(),
      description: cmpDesc.trim() || 'Scheduled university signage campaign.',
      playlistId: cmpPlaylistId,
      startDate: cmpStartDate,
      endDate: cmpEndDate,
      startTime: cmpStartTime,
      endTime: cmpEndTime,
      targetScreenIds: cmpScreenIds,
      targetGroupIds: cmpGroupIds,
      status: targetStatus,
      priority: cmpPriority,
      createdBy: 'Vinod Kumar Jain',
      qrUrl: cmpQrUrl.trim() || undefined,
      qrLabel: cmpQrLabel.trim() || undefined,
    };
    onSaveCampaign(newCmp);
    setWizardOpen(false);
  };

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const getPlaylistName = (id: string) =>
    playlists.find((p) => p.id === id)?.name || 'Unassigned Playlist';

  // Calendar grid builder - dynamic month
  const [calYear, calMonthNum] = calendarMonth.split('-').map(Number);
  const daysInMonth = new Date(calYear, calMonthNum, 0).getDate();
  const firstDayOffset = new Date(calYear, calMonthNum - 1, 1).getDay();
  const calendarMonthLabel = new Date(calYear, calMonthNum - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const shiftCalendarMonth = (delta: number) => {
    const next = new Date(calYear, calMonthNum - 1 + delta, 1);
    setCalendarMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };
  const nowDate = new Date();
  const todayStr = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;
  const calendarCells = Array.from({ length: firstDayOffset + daysInMonth }, (_, i) => {
    if (i < firstDayOffset) return null;
    const dayNum = i - firstDayOffset + 1;
    const dateStr = `${calendarMonth}-${String(dayNum).padStart(2, '0')}`;
    const matching = filteredCampaigns.filter(
      (c) => dateStr >= c.startDate && dateStr <= c.endDate
    );
    return { dayNum, dateStr, matching };
  });

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="type-section-title text-[#290044]">
            Campaign scheduler
          </h2>
          <p className="type-support text-[#645573]">
            Coordinate time-bound university promotions across campus TV groups.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 bg-white border border-[#E6E0EC] rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-[#500071] text-white'
                  : 'text-[#645573] hover:text-[#290044]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-[#500071] text-white'
                  : 'text-[#645573] hover:text-[#290044]'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Calendar
            </button>
          </div>

          <button
            type="button"
            onClick={openWizard}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#500071] text-white type-button hover:bg-[#8A2A78] transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Schedule campaign
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#E8E2EE] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_TABS.map((tab) => {
            const count =
              tab === 'All'
                ? campaigns.length
                : campaigns.filter((c) => c.status === tab).length;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap tabular-nums ${
                  statusFilter === tab
                    ? 'bg-[#EEE3B0] text-[#290044] font-semibold'
                    : 'text-[#645573] hover:bg-[#FAF8FC] hover:text-[#290044]'
                }`}
              >
                {tab} ({count})
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-[#6E607D] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter campaigns..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8FC] border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78] focus:bg-white"
          />
        </div>
      </div>

      {/* Table or Calendar */}
      {viewMode === 'table' ? (
        <div className="bg-white border border-[#E8E2EE] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E8E2EE] bg-[#FAF8FC] text-[11px] font-semibold text-[#645573]">
                  <th className="py-3 px-4">Campaign Name</th>
                  <th className="py-3 px-4">Playlist</th>
                  <th className="py-3 px-4">Date Range</th>
                  <th className="py-3 px-4">Daily Window</th>
                  <th className="py-3 px-4">Assigned Screens</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1ECF6] text-xs">
                {filteredCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-[#645573]">
                      No campaigns match your current filters.
                    </td>
                  </tr>
                ) : (
                  filteredCampaigns.map((cmp) => (
                    <tr key={cmp.id} className="hover:bg-[#FAF8FC] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-[#290044]">{cmp.name}</p>
                          {cmp.qrUrl && (
                            <span
                              title={`TV QR Overlay: ${cmp.qrUrl}`}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#EEE3B0]/60 text-[#500071] text-[10px] font-semibold"
                            >
                              <QrCode className="w-3 h-3" />
                              QR
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#645573] truncate max-w-xs">
                          {cmp.description}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-[#500071] font-medium">
                        {getPlaylistName(cmp.playlistId)}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-[#645573] whitespace-nowrap">
                        {cmp.startDate} → {cmp.endDate}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-[#645573] whitespace-nowrap">
                        {cmp.startTime} – {cmp.endTime}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-[#290044]">
                        {cmp.targetScreenIds.length} screens
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge status={cmp.status} />
                          {(cmp.status === 'Active' || cmp.status === 'Scheduled') && (
                            isCampaignLiveNow(cmp, nowTick) ? (
                              <span className="text-[10px] font-mono text-emerald-700 font-semibold">
                                Playing on TV now
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-[#645573]">
                                {cmp.startDate > getLocalDateStr(nowTick)
                                  ? `Starts ${cmp.startDate}`
                                  : `Window ${cmp.startTime}–${cmp.endTime}`}
                              </span>
                            )
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditWizard(cmp)}
                            title="Edit schedule (dates, time, playlist & screens)"
                            className="p-1.5 rounded-md text-[#500071] hover:bg-[#EEE3B0]/40 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {cmp.status === 'Active' || cmp.status === 'Scheduled' ? (
                            <button
                              type="button"
                              onClick={() => onUpdateStatus(cmp.id, 'Paused')}
                              title="Pause campaign"
                              className="p-1.5 rounded-md text-amber-700 hover:bg-amber-50"
                            >
                              <Pause className="w-3.5 h-3.5" />
                            </button>
                          ) : cmp.status === 'Paused' || cmp.status === 'Draft' ? (
                            <button
                              type="button"
                              onClick={() => onUpdateStatus(cmp.id, 'Active')}
                              title="Activate campaign"
                              className="p-1.5 rounded-md text-emerald-700 hover:bg-emerald-50"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => onDeleteCampaign(cmp.id)}
                            title="Delete campaign"
                            className="p-1.5 rounded-md text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#E8E2EE] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#290044] font-display">
              {calendarMonthLabel}
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => shiftCalendarMonth(-1)}
                className="p-1.5 rounded-lg border border-[#E8E2EE] text-[#290044] hover:bg-[#FAF8FC] cursor-pointer"
                title="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => shiftCalendarMonth(1)}
                className="p-1.5 rounded-lg border border-[#E8E2EE] text-[#290044] hover:bg-[#FAF8FC] cursor-pointer"
                title="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold text-[#645573]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarCells.map((cell, idx) =>
              cell === null ? (
                <div key={`empty-${idx}`} className="min-h-24 rounded-lg bg-[#FAF8FC]/60" />
              ) : (
                <div
                  key={cell.dateStr}
                  className={`min-h-24 rounded-lg border p-2 flex flex-col gap-1 ${
                    cell.dateStr === todayStr
                      ? 'border-[#500071] bg-[#EEE3B0]/20'
                      : 'border-[#E8E2EE] bg-white'
                  }`}
                >
                  <span className="text-[11px] font-mono font-semibold text-[#290044] tabular-nums">
                    {cell.dayNum}
                  </span>
                  <div className="space-y-1 overflow-hidden">
                    {cell.matching.slice(0, 3).map((m) => (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => openEditWizard(m)}
                        title={`${m.name} (${m.startTime}–${m.endTime}) — Click to edit schedule`}
                        className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate cursor-pointer hover:opacity-90 ${
                          m.status === 'Active'
                            ? 'bg-[#500071] text-white'
                            : m.status === 'Scheduled'
                              ? 'bg-[#EEE3B0] text-[#290044]'
                              : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {m.name}
                      </button>
                    ))}
                    {cell.matching.length > 3 && (
                      <span className="block text-[10px] text-[#645573] font-mono">
                        +{cell.matching.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* 5-Step Campaign Creation / Edit Wizard Modal */}
      <Modal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        title={editingCampaignId ? 'Edit Campaign Schedule' : 'Create Signage Campaign'}
        subtitle={`Step ${step} of 5 · ${WIZARD_STEPS[step - 1]}`}
        size="xl"
      >
        <div className="space-y-6">
          {/* Stepper Indicator (clickable when editing so user can jump between Details, Playlist, Screens, Schedule) */}
          <ol className="grid grid-cols-5 gap-2">
            {WIZARD_STEPS.map((label, idx) => {
              const sNum = idx + 1;
              const isCompleted = step > sNum;
              const isCurrent = step === sNum;
              return (
                <li key={label}>
                  <button
                    type="button"
                    disabled={!editingCampaignId && sNum > step}
                    onClick={() => {
                      if (editingCampaignId || sNum <= step) {
                        setWizardError('');
                        setStep(sNum);
                      }
                    }}
                    className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors ${
                      isCurrent
                        ? 'border-[#500071] bg-[#EEE3B0]/35 text-[#290044]'
                        : isCompleted
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                          : 'border-[#E8E2EE] bg-[#FAF8FC] text-[#645573]'
                    } ${editingCampaignId || sNum <= step ? 'cursor-pointer hover:border-[#8A2A78]' : 'cursor-default'}`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold">
                      <span
                        className={`w-5 h-5 rounded-full text-[11px] font-mono flex items-center justify-center shrink-0 ${
                          isCurrent
                            ? 'bg-[#500071] text-white'
                            : isCompleted
                              ? 'bg-emerald-600 text-white'
                              : 'bg-[#E8E2EE] text-[#645573]'
                        }`}
                      >
                        {isCompleted ? <Check className="w-3 h-3" /> : sNum}
                      </span>
                      <span className="truncate hidden sm:inline">{label}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Step 1: Campaign Details */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#290044] mb-1">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  value={cmpName}
                  onChange={(e) => setCmpName(e.target.value)}
                  placeholder="e.g., Spring Orientation Welcome Banner"
                  className="w-full px-3 py-2.5 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#290044] mb-1">
                  Campaign Description
                </label>
                <textarea
                  rows={3}
                  value={cmpDesc}
                  onChange={(e) => setCmpDesc(e.target.value)}
                  placeholder="Target audience, department sponsor, and display goal..."
                  className="w-full px-3 py-2.5 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#290044] mb-1">
                  Playback Priority
                </label>
                <select
                  value={cmpPriority}
                  onChange={(e) =>
                    setCmpPriority(e.target.value as 'Normal' | 'High' | 'Urgent')
                  }
                  className="w-full px-3 py-2.5 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
                >
                  <option value="Normal">Normal (Standard Rotation)</option>
                  <option value="High">High (Weighted Frequency)</option>
                  <option value="Urgent">Urgent (Campus Priority Override)</option>
                </select>
              </div>

              {/* Optional TV QR Code Overlay */}
              <div className="p-4 rounded-xl border border-[#E8E2EE] bg-[#FAF8FC] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-[#500071]" />
                    <span className="text-xs font-bold text-[#290044]">
                      TV QR Code Overlay (Optional)
                    </span>
                  </div>
                  <span className="text-[11px] text-[#645573]">
                    Leave blank for standard campaigns
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  <div className="flex-1 w-full space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#290044] mb-1">
                        Destination Link / URL (Optional)
                      </label>
                      <input
                        type="url"
                        value={cmpQrUrl}
                        onChange={(e) => setCmpQrUrl(e.target.value)}
                        placeholder="https://dypiu.ac.in/... or Google Form link"
                        className="w-full px-3 py-2 text-xs bg-white border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#290044] mb-1">
                        QR Caption Below Code (Optional)
                      </label>
                      <input
                        type="text"
                        maxLength={40}
                        value={cmpQrLabel}
                        onChange={(e) => setCmpQrLabel(e.target.value)}
                        placeholder="e.g., Scan to Register"
                        className="w-full px-3 py-2 text-xs bg-white border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
                      />
                    </div>
                  </div>
                  {qrPreviewUrl && (
                    <div className="shrink-0 bg-white border border-[#E8E2EE] rounded-xl p-2 text-center w-28">
                      <img
                        src={qrPreviewUrl}
                        alt="Campaign QR preview"
                        className="w-24 h-24 mx-auto block"
                      />
                      <p className="text-[10px] font-bold text-[#290044] mt-1 truncate">
                        {cmpQrLabel.trim() || 'Scan QR Code'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Select Playlist */}
          {step === 2 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
              {playlists.map((pl) => {
                const selected = cmpPlaylistId === pl.id;
                return (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => setCmpPlaylistId(pl.id)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      selected
                        ? 'border-[#500071] bg-[#EEE3B0]/30 ring-1 ring-[#500071]'
                        : 'border-[#E8E2EE] hover:border-[#8A2A78]/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-bold text-[#290044] font-display">
                        {pl.name}
                      </span>
                      <StatusBadge status={pl.status} />
                    </div>
                    <p className="mt-1 text-xs text-[#645573] line-clamp-2">{pl.description}</p>
                    <p className="mt-2.5 text-[11px] font-mono text-[#500071]">
                      {pl.items.length} media items · {pl.assignedScreenIds.length} linked TVs
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 3: Select Screens or Screen Groups */}
          {step === 3 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-2">
                <p className="text-xs font-bold text-[#290044]">Quick Select Screen Groups</p>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {groups.map((grp) => {
                    const checked = cmpGroupIds.includes(grp.id);
                    return (
                      <label
                        key={grp.id}
                        className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer text-xs ${
                          checked
                            ? 'border-[#500071] bg-[#EEE3B0]/25'
                            : 'border-[#E8E2EE] hover:bg-[#FAF8FC]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleGroupSelection(grp)}
                          className="accent-[#500071] mt-0.5"
                        />
                        <div className="min-w-0">
                          <span className="font-semibold text-[#290044] block">{grp.name}</span>
                          <span className="text-[11px] text-[#645573]">
                            {grp.screenIds.length} screens · {grp.description}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-[#290044]">
                  Individual Displays ({cmpScreenIds.length} selected)
                </p>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 border border-[#E8E2EE] rounded-lg p-2">
                  {screens.map((scr) => {
                    const checked = cmpScreenIds.includes(scr.id);
                    return (
                      <label
                        key={scr.id}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md hover:bg-[#FAF8FC] cursor-pointer text-xs"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleScreenSelection(scr.id)}
                            className="accent-[#500071]"
                          />
                          <span className="font-mono text-[11px] text-[#500071]">{scr.id}</span>
                          <span className="text-[#290044] truncate">{scr.name}</span>
                        </span>
                        <span className="text-[11px] text-[#645573] shrink-0">
                          {scr.building}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Set Schedule */}
          {step === 4 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#290044] mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={cmpStartDate}
                  onChange={(e) => setCmpStartDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs font-mono border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#290044] mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={cmpEndDate}
                  onChange={(e) => setCmpEndDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs font-mono border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#290044] mb-1">
                  Daily Start Time
                </label>
                <input
                  type="time"
                  value={cmpStartTime}
                  onChange={(e) => setCmpStartTime(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs font-mono border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#290044] mb-1">
                  Daily End Time
                </label>
                <input
                  type="time"
                  value={cmpEndTime}
                  onChange={(e) => setCmpEndTime(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs font-mono border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
                />
              </div>
            </div>
          )}

          {/* Step 5: Review and Publish */}
          {step === 5 && (
            <div className="rounded-xl bg-[#FAF8FC] border border-[#E8E2EE] p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[#645573]">Campaign Title</p>
                  <p className="font-bold text-sm text-[#290044] mt-0.5">{cmpName}</p>
                </div>
                <div>
                  <p className="text-[#645573]">Assigned Playlist</p>
                  <p className="font-semibold text-[#500071] mt-0.5">
                    {getPlaylistName(cmpPlaylistId)}
                  </p>
                </div>
                <div>
                  <p className="text-[#645573]">Schedule Window</p>
                  <p className="font-mono font-semibold text-[#290044] mt-0.5 tabular-nums">
                    {cmpStartDate} → {cmpEndDate} ({cmpStartTime} – {cmpEndTime})
                  </p>
                </div>
                <div>
                  <p className="text-[#645573]">Target Fleet</p>
                  <p className="font-mono font-semibold text-[#290044] mt-0.5 tabular-nums">
                    {cmpScreenIds.length} campus displays ({cmpPriority} Priority)
                  </p>
                </div>
                <div className="sm:col-span-2 flex items-center justify-between gap-4 pt-2 border-t border-[#E8E2EE]">
                  <div className="min-w-0">
                    <p className="text-[#645573]">TV QR Code Overlay</p>
                    {cmpQrUrl.trim() ? (
                      <p className="font-mono text-[#500071] font-semibold mt-0.5 truncate">
                        {cmpQrLabel.trim() || 'Scan QR Code'} → {cmpQrUrl.trim()}
                      </p>
                    ) : (
                      <p className="text-[#645573] mt-0.5">None (standard campaign)</p>
                    )}
                  </div>
                  {qrPreviewUrl && (
                    <img
                      src={qrPreviewUrl}
                      alt="QR Preview"
                      className="w-14 h-14 rounded-lg border border-[#E8E2EE] bg-white p-1 shrink-0"
                    />
                  )}
                </div>
              </div>
              <p className="text-[11px] text-[#645573] border-t border-[#E8E2EE] pt-3">
                Scheduling saves directly to MySQL and automatically displays on the selected TVs during the scheduled window.
              </p>
            </div>
          )}

          {wizardError && (
            <p className="text-xs font-medium text-rose-700">{wizardError}</p>
          )}

          {/* Wizard Footer Controls */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#E8E2EE]">
            <button
              type="button"
              onClick={() => (step === 1 ? setWizardOpen(false) : setStep((s) => s - 1))}
              className="px-4 py-2 rounded-lg border border-[#E8E2EE] text-xs font-semibold text-[#290044] hover:bg-[#FAF8FC]"
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </button>

            <div className="flex items-center gap-2.5">
              {editingCampaignId && step < 5 && (
                <button
                  type="button"
                  onClick={() => submitWizard(computeScheduledStatus())}
                  className="px-4 py-2 rounded-lg bg-[#500071] text-white text-xs font-semibold hover:bg-[#8A2A78] cursor-pointer"
                >
                  Save Schedule Changes
                </button>
              )}
              {step === 5 ? (
                <>
                  <button
                    type="button"
                    onClick={() => submitWizard('Draft')}
                    className="px-4 py-2 rounded-lg border border-[#500071] text-[#500071] text-xs font-semibold hover:bg-[#FAF8FC]"
                  >
                    Save as Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => submitWizard(computeScheduledStatus())}
                    className="px-5 py-2 rounded-lg bg-[#500071] text-white text-xs font-semibold hover:bg-[#8A2A78]"
                  >
                    {editingCampaignId ? 'Save Schedule Changes' : 'Schedule & Publish'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={validateAndNext}
                  className={`px-5 py-2 rounded-lg text-xs font-semibold ${
                    editingCampaignId
                      ? 'border border-[#500071] text-[#500071] hover:bg-[#FAF8FC]'
                      : 'bg-[#500071] text-white hover:bg-[#8A2A78]'
                  }`}
                >
                  Continue
                </button>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
