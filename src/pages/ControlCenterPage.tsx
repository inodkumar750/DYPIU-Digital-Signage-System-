import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Megaphone,
  Power,
  PowerOff,
  Radio,
  RefreshCw,
  Search,
  Tv,
  Wifi,
} from 'lucide-react';
import { ScreenDevice, ScreenGroup } from '../types/signage';
import {
  adoptPairingApi,
  CommandRecord,
  getCommandHistory,
  getPendingPairings,
  PendingPairing,
  RemoteCommand,
  sendCommandApi,
} from '../api/signageApi';

interface ControlCenterPageProps {
  screens: ScreenDevice[];
  groups: ScreenGroup[];
  onRefreshScreens: () => Promise<void> | void;
  pushToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
}

/** `10.100.5.23` -> `10.100.5.0/24` (a typical Wi-Fi network / VLAN). */
function networkOf(ip: string): string {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/.exec(ip || '');
  if (!m || ip === '0.0.0.0') return 'Unknown network';
  return `${m[1]}.${m[2]}.${m[3]}.0/24`;
}

const COMMAND_LABEL: Record<RemoteCommand, string> = {
  reload: 'Refresh player',
  identify: 'Identify',
  message: 'Message',
  clear_message: 'Clear message',
  standby: 'Standby',
  resume: 'Wake',
};

const STATUS_STYLE: Record<CommandRecord['status'], string> = {
  pending: 'bg-amber-50 text-amber-700',
  sent: 'bg-blue-50 text-blue-700',
  done: 'bg-emerald-50 text-emerald-700',
  expired: 'bg-slate-100 text-slate-500',
};

export const ControlCenterPage: React.FC<ControlCenterPageProps> = ({ screens, groups, onRefreshScreens, pushToast }) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [msgDuration, setMsgDuration] = useState(300);
  const [msgUrgent, setMsgUrgent] = useState(false);
  const [history, setHistory] = useState<CommandRecord[]>([]);
  const [pending, setPending] = useState<PendingPairing[]>([]);
  const [adoptForm, setAdoptForm] = useState<Record<string, { name: string; building: string; floor: string }>>({});

  const online = screens.filter((s) => s.connectionStatus === 'Online').length;

  // Live data: command history + TVs waiting to be adopted.
  const refreshLive = useCallback(async () => {
    try {
      const [h, p] = await Promise.all([getCommandHistory(), getPendingPairings()]);
      setHistory(h);
      setPending(p);
    } catch {
      /* the global handler already reports connectivity / auth problems */
    }
  }, []);

  // Keep the latest callback in a ref so the polling timer is created once, not on every parent render.
  const refreshScreensRef = useRef(onRefreshScreens);
  refreshScreensRef.current = onRefreshScreens;

  useEffect(() => {
    refreshLive();
    const t = window.setInterval(() => {
      refreshLive();
      refreshScreensRef.current();
    }, 5000);
    return () => window.clearInterval(t);
  }, [refreshLive]);

  const networks = useMemo(() => {
    const map = new Map<string, string[]>();
    screens.forEach((s) => {
      const n = networkOf(s.ipAddress);
      map.set(n, [...(map.get(n) || []), s.id]);
    });
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [screens]);

  const buildings = useMemo(() => {
    const map = new Map<string, string[]>();
    screens.forEach((s) => map.set(s.building, [...(map.get(s.building) || []), s.id]));
    return [...map.entries()];
  }, [screens]);

  const visible = screens.filter((s) => {
    const q = query.trim().toLowerCase();
    return !q || `${s.name} ${s.id} ${s.building} ${s.floor} ${s.ipAddress}`.toLowerCase().includes(q);
  });

  const toggle = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const selectIds = (ids: string[]) => setSelected(ids);

  const send = async (command: RemoteCommand, extra: Parameters<typeof sendCommandApi>[2] = {}) => {
    if (selected.length === 0) {
      pushToast('Select at least one screen first.', 'error');
      return;
    }
    const risky = command === 'reload' || command === 'standby';
    if (risky && selected.length > 1 && !window.confirm(`${COMMAND_LABEL[command]} on ${selected.length} screens?`)) return;
    setBusy(true);
    try {
      const res = await sendCommandApi(selected, command, extra);
      pushToast(res.message, 'success');
      await Promise.all([refreshLive(), onRefreshScreens()]);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Command failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const adopt = async (p: PendingPairing) => {
    const f = adoptForm[p.code] || { name: '', building: buildings[0]?.[0] || 'Building A', floor: 'Ground Floor' };
    if (!f.name.trim()) {
      pushToast('Give the screen a name first.', 'error');
      return;
    }
    try {
      const res = await adoptPairingApi(p.code, { screenName: f.name.trim(), building: f.building, floor: f.floor, location: '' });
      pushToast(`${f.name} adopted as ${res.screenId}. The TV will connect within a few seconds.`, 'success');
      await Promise.all([refreshLive(), onRefreshScreens()]);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not adopt this TV.', 'error');
    }
  };

  const chip = (label: string, ids: string[], icon?: React.ReactNode) => {
    const active = ids.length > 0 && ids.length === selected.length && ids.every((i) => selected.includes(i));
    return (
      <button
        key={label}
        type="button"
        onClick={() => selectIds(ids)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
          active ? 'bg-[#EEE3B0] border-[#EEE3B0] text-[#290044] font-semibold' : 'bg-white border-[#E8E2EE] text-[#645573] hover:border-[#8A2A78]/50'
        }`}
      >
        {icon}
        {label} <span className="opacity-60">({ids.length})</span>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#290044] flex items-center gap-2">
            <Radio className="w-6 h-6 text-[#8A2A78]" /> Control Center
          </h1>
          <p className="text-sm text-[#645573] mt-1">
            Command every screen on your campus network from here. Commands reach each TV within about 10 seconds.
          </p>
        </div>
        <div className="text-sm text-[#645573]">
          <span className="font-semibold text-emerald-600">{online}</span> online of {screens.length} screens
        </div>
      </div>

      {/* TVs waiting to be adopted */}
      {pending.length > 0 && (
        <section className="bg-[#FFFBEB] border border-amber-200 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-[#290044] flex items-center gap-2">
            <Tv className="w-4 h-4 text-amber-600" /> New TVs found on the network ({pending.length})
          </h2>
          {pending.map((p) => {
            const f = adoptForm[p.code] || { name: '', building: buildings[0]?.[0] || 'Building A', floor: 'Ground Floor' };
            const set = (patch: Partial<typeof f>) => setAdoptForm((cur) => ({ ...cur, [p.code]: { ...f, ...patch } }));
            return (
              <div key={p.code} className="flex flex-col lg:flex-row lg:items-center gap-2 bg-white border border-amber-100 rounded-lg p-3">
                <div className="text-xs text-[#645573] lg:w-56">
                  <div className="font-mono font-bold text-[#290044] text-sm">{p.code}</div>
                  <div>
                    {p.ipAddress || 'unknown IP'} · {networkOf(p.ipAddress)} · {p.secondsLeft}s left
                  </div>
                </div>
                <input
                  value={f.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="Screen name, e.g. Library Entrance"
                  className="flex-1 px-3 py-2 text-xs bg-[#FAF8FC] border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
                />
                <input
                  value={f.building}
                  onChange={(e) => set({ building: e.target.value })}
                  placeholder="Building"
                  className="lg:w-36 px-3 py-2 text-xs bg-[#FAF8FC] border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
                />
                <input
                  value={f.floor}
                  onChange={(e) => set({ floor: e.target.value })}
                  placeholder="Floor"
                  className="lg:w-32 px-3 py-2 text-xs bg-[#FAF8FC] border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
                />
                <button
                  type="button"
                  onClick={() => adopt(p)}
                  className="px-4 py-2 rounded-lg bg-[#500071] text-white text-xs font-semibold hover:bg-[#8A2A78]"
                >
                  Adopt TV
                </button>
              </div>
            );
          })}
        </section>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Screen picker */}
        <section className="xl:col-span-2 bg-white border border-[#E8E2EE] rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {chip('All screens', screens.map((s) => s.id), <Tv className="w-3.5 h-3.5" />)}
            {chip('All online', screens.filter((s) => s.connectionStatus === 'Online').map((s) => s.id), <CheckCircle2 className="w-3.5 h-3.5" />)}
            <button
              type="button"
              onClick={() => selectIds([])}
              className="px-3 py-1.5 rounded-lg text-xs text-[#645573] hover:bg-[#FAF8FC]"
            >
              Clear
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#645573]">Same Wi-Fi / network</div>
            <div className="flex flex-wrap gap-1.5">{networks.map(([n, ids]) => chip(n, ids, <Wifi className="w-3.5 h-3.5" />))}</div>
          </div>
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#645573]">Buildings &amp; groups</div>
            <div className="flex flex-wrap gap-1.5">
              {buildings.map(([b, ids]) => chip(b, ids))}
              {groups.map((g) => chip(`Group: ${g.name}`, g.screenIds))}
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-[#645573] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search screens…"
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8FC] border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
            />
          </div>

          <div className="divide-y divide-[#F1ECF6] max-h-[28rem] overflow-y-auto border border-[#F1ECF6] rounded-lg">
            {visible.length === 0 && <div className="p-6 text-center text-xs text-[#645573]">No screens match.</div>}
            {visible.map((s) => (
              <label key={s.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#FAF8FC]">
                <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} className="accent-[#500071]" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#290044] truncate">{s.name}</div>
                  <div className="text-[11px] text-[#645573] truncate">
                    {s.id} · {s.building}, {s.floor} · {s.ipAddress && s.ipAddress !== '0.0.0.0' ? s.ipAddress : 'IP unknown'}
                  </div>
                </div>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    !s.isActive
                      ? 'bg-slate-100 text-slate-500'
                      : s.connectionStatus === 'Online'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {!s.isActive ? 'Standby' : s.connectionStatus}
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* Actions */}
        <section className="bg-white border border-[#E8E2EE] rounded-xl p-4 space-y-4 self-start">
          <div className="text-sm font-bold text-[#290044]">
            {selected.length === 0 ? 'No screens selected' : `${selected.length} screen${selected.length === 1 ? '' : 's'} selected`}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={() => send('reload')} className="action-btn">
              <RefreshCw className="w-4 h-4" /> Refresh player
            </button>
            <button type="button" disabled={busy} onClick={() => send('identify')} className="action-btn">
              <Eye className="w-4 h-4" /> Identify
            </button>
            <button type="button" disabled={busy} onClick={() => send('standby')} className="action-btn">
              <PowerOff className="w-4 h-4" /> Standby
            </button>
            <button type="button" disabled={busy} onClick={() => send('resume')} className="action-btn">
              <Power className="w-4 h-4" /> Wake
            </button>
          </div>

          <div className="border-t border-[#F1ECF6] pt-4 space-y-2">
            <div className="text-xs font-bold text-[#290044] flex items-center gap-1.5">
              <Megaphone className="w-4 h-4 text-[#8A2A78]" /> On-screen message
            </div>
            <textarea
              value={msgText}
              onChange={(e) => setMsgText(e.target.value.slice(0, 240))}
              rows={3}
              placeholder="e.g. Fire drill at 11:00 — please assemble at the main ground."
              className="w-full px-3 py-2 text-xs bg-[#FAF8FC] border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
            />
            <div className="flex items-center gap-2">
              <select
                value={msgDuration}
                onChange={(e) => setMsgDuration(Number(e.target.value))}
                className="flex-1 px-2 py-2 text-xs bg-[#FAF8FC] border border-[#E8E2EE] rounded-lg"
              >
                <option value={60}>Show for 1 min</option>
                <option value={300}>Show for 5 min</option>
                <option value={900}>Show for 15 min</option>
                <option value={3600}>Show for 1 hour</option>
                <option value={43200}>Until cleared</option>
              </select>
              <label className="flex items-center gap-1.5 text-xs text-[#645573] cursor-pointer">
                <input type="checkbox" checked={msgUrgent} onChange={(e) => setMsgUrgent(e.target.checked)} className="accent-red-600" />
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> Urgent
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || !msgText.trim()}
                onClick={() => send('message', { text: msgText.trim(), durationSec: msgDuration, style: msgUrgent ? 'urgent' : 'info' })}
                className="flex-1 px-3 py-2 rounded-lg bg-[#500071] text-white text-xs font-semibold hover:bg-[#8A2A78] disabled:opacity-50"
              >
                Send message
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => send('clear_message')}
                className="px-3 py-2 rounded-lg border border-[#E8E2EE] text-xs text-[#645573] hover:bg-[#FAF8FC] disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* History */}
      <section className="bg-white border border-[#E8E2EE] rounded-xl p-4">
        <h2 className="text-sm font-bold text-[#290044] mb-3">Recent commands</h2>
        {history.length === 0 ? (
          <div className="text-xs text-[#645573] py-4 text-center">Nothing sent yet.</div>
        ) : (
          <div className="divide-y divide-[#F1ECF6] max-h-72 overflow-y-auto">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 py-2 text-xs">
                <span className={`px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLE[h.status]}`}>{h.status}</span>
                <span className="font-semibold text-[#290044] w-28 shrink-0">{COMMAND_LABEL[h.command] || h.command}</span>
                <span className="flex-1 min-w-0 truncate text-[#645573]">
                  {h.screenName}
                  {h.text ? ` — “${h.text}”` : ''}
                </span>
                <span className="text-[#645573] shrink-0">{h.createdBy}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <style>{`
        .action-btn { display:flex; align-items:center; justify-content:center; gap:.4rem; padding:.6rem .5rem;
          border:1px solid #E8E2EE; border-radius:.6rem; font-size:.75rem; font-weight:600; color:#290044; background:#fff; }
        .action-btn:hover:not(:disabled) { border-color:#8A2A78; background:#FAF8FC; }
        .action-btn:disabled { opacity:.5; }
      `}</style>
    </div>
  );
};
