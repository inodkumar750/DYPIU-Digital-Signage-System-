import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  Cast,
  ChevronLeft,
  ChevronRight,
  Clock,
  EyeOff,
  ListVideo,
  Lock,
  Maximize,
  Minimize,
  Monitor,
  PanelBottomClose,
  PanelBottomOpen,
  Pause,
  Play,
  Unlock,
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react';
import { Campaign, MediaAsset, Playlist, ScreenDevice, ScreenGroup } from '../types/signage';
import { API_BASE, formatMediaUrl, getAuthToken, getDeviceKey } from '../api/signageApi';
import { resolveActiveCampaignForScreen } from '../utils/campaignSchedule';

// Isolated Clock Component to prevent re-rendering the slide rotation engine
const LiveClock: React.FC = () => {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
      setDate(
        now.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      );
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="flex items-center gap-3 text-right"
      style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'right', flexShrink: 0 }}
    >
      <div>
        <div
          className="text-base font-bold font-mono tracking-tight text-white leading-tight tabular-nums"
          style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF', fontFamily: 'monospace' }}
        >
          {time}
        </div>
        <div
          className="text-[11px] text-[#EEE3B0]/70 font-medium leading-tight"
          style={{ fontSize: '11px', color: 'rgba(238, 227, 176, 0.75)', fontWeight: 500 }}
        >
          {date}
        </div>
      </div>
      <div
        className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"
        style={{ width: '10px', height: '10px', borderRadius: '9999px', backgroundColor: '#34d399' }}
        title="Live Heartbeat Active"
      />
    </div>
  );
};

interface TvPlayerPageProps {
  screens: ScreenDevice[];
  playlists: Playlist[];
  mediaAssets: MediaAsset[];
  campaigns?: Campaign[];
  groups?: ScreenGroup[];
  initialScreenId?: string;
  initialKioskMode?: boolean;
  initialCastMode?: boolean;
  showTvTicker?: boolean;
  onToggleTvTicker?: (show: boolean) => void;
  onAssignScreenPlaylist?: (screenId: string, playlistId: string | null) => void;
  onExit: () => void;
}

export const TvPlayerPage: React.FC<TvPlayerPageProps> = ({
  screens,
  playlists,
  mediaAssets,
  campaigns = [],
  groups = [],
  initialScreenId = 'DYPIU-TV-001',
  initialKioskMode = false,
  initialCastMode = false,
  showTvTicker = true,
  onToggleTvTicker,
  onAssignScreenPlaylist,
  onExit,
}) => {
  const [selectedScreenId, setSelectedScreenId] = useState<string>(initialScreenId);
  const [isKioskMode, setIsKioskMode] = useState<boolean>(initialKioskMode);
  const [isCastMode, setIsCastMode] = useState<boolean>(initialCastMode);
  const [liveShowTicker, setLiveShowTicker] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('ticker') === '0' || p.get('hideTicker') === '1') return false;
      if (p.get('ticker') === '1') return true;
    }
    return showTvTicker;
  });
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const [castHint, setCastHint] = useState<string>('');
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(!initialKioskMode && !initialCastMode);
  const [slideProgress, setSlideProgress] = useState(0);
  const [nowTick, setNowTick] = useState<Date>(() => new Date());

  // Real-time live records polled from MySQL backend
  const [liveScreens, setLiveScreens] = useState<ScreenDevice[] | null>(null);
  const [livePlaylists, setLivePlaylists] = useState<Playlist[] | null>(null);
  const [liveMedia, setLiveMedia] = useState<MediaAsset[] | null>(null);
  const [liveCampaigns, setLiveCampaigns] = useState<Campaign[] | null>(null);
  const [liveGroups, setLiveGroups] = useState<ScreenGroup[] | null>(null);

  const controlsTimeoutRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const logoTapCountRef = useRef<number>(0);
  const logoTapTimerRef = useRef<number | null>(null);
  const tickerSyncPauseUntilRef = useRef<number>(0);

  // Auth for write calls made from this page: the admin's session, or the TV's own device key.
  const playerHeaders = (): Record<string, string> => {
    const token = getAuthToken();
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = `Bearer ${token}`;
    else {
      h['X-Device-Key'] = getDeviceKey();
      h['X-Screen-Id'] = selectedScreenId || '';
    }
    return h;
  };

  // Keep selectedScreenId synced if launched with a new initialScreenId
  useEffect(() => {
    if (initialScreenId) {
      setSelectedScreenId(initialScreenId);
      setCurrentSlideIndex(0);
    }
  }, [initialScreenId]);

  // Screen Wake Lock API: prevents phone/laptop/TV browser from sleeping during Kiosk or Cast mirroring
  useEffect(() => {
    let wakeLockSentinel: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };

    const requestWakeLock = async () => {
      try {
        if (nav.wakeLock) {
          wakeLockSentinel = await nav.wakeLock.request('screen');
          setWakeLockActive(true);
        }
      } catch {
        setWakeLockActive(false);
      }
    };

    requestWakeLock();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      wakeLockSentinel?.release().catch(() => {});
      setWakeLockActive(false);
    };
  }, []);

  // Update schedule clock every 5s so scheduled campaigns trigger on the exact minute
  useEffect(() => {
    const t = window.setInterval(() => setNowTick(new Date()), 5000);
    return () => window.clearInterval(t);
  }, []);

  // Sync local ticker state when prop changes from Dashboard/Settings (unless URL explicitly overrides)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.has('ticker') || p.has('hideTicker')) return;
    }
    setLiveShowTicker(showTvTicker);
  }, [showTvTicker]);

  // Live auto-sync.
  //  • Kiosk / TV (no admin session): one lightweight, version-checked request to /device/:id/feed.
  //    The server answers {unchanged:true} when nothing relevant changed, so an idle TV costs almost nothing.
  //  • Admin preview (signed-in): the authenticated CMS endpoints.
  useEffect(() => {
    let feedVersion = '';
    let cancelled = false;

    const same = <T,>(prev: T | null, next: T) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next);

    const applyData = (d: {
      screens?: ScreenDevice[];
      playlists?: Playlist[];
      media?: MediaAsset[];
      campaigns?: Campaign[];
      groups?: ScreenGroup[];
      settings?: any;
    }) => {
      if (Array.isArray(d.screens)) {
        const incoming = d.screens;
        setLiveScreens((prev) => {
          if (prev && JSON.stringify(prev) === JSON.stringify(incoming)) return prev;
          const oldMatch = prev?.find((x) => x.id === selectedScreenId);
          const newMatch = incoming.find((x) => x.id === selectedScreenId);
          if (oldMatch && newMatch && oldMatch.assignedPlaylistId !== newMatch.assignedPlaylistId) {
            setCurrentSlideIndex(0);
          }
          return incoming;
        });
      }
      if (Array.isArray(d.playlists)) setLivePlaylists((prev) => same(prev, d.playlists!));
      if (Array.isArray(d.media)) setLiveMedia((prev) => same(prev, d.media!));
      if (Array.isArray(d.campaigns)) setLiveCampaigns((prev) => same(prev, d.campaigns!));
      if (Array.isArray(d.groups)) setLiveGroups((prev) => same(prev, d.groups!));
      if (d.settings && Date.now() >= tickerSyncPauseUntilRef.current) {
        const p = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        if (!p || (!p.has('ticker') && !p.has('hideTicker'))) {
          setLiveShowTicker(d.settings.showTvTicker !== false);
        }
      }
    };

    const fetchLatestData = async () => {
      try {
        const token = getAuthToken();
        if (token) {
          const h = { Authorization: `Bearer ${token}` };
          const [sR, pR, mR, cR, gR, stR] = await Promise.allSettled(
            ['screens', 'playlists', 'media', 'campaigns', 'groups', 'settings'].map((e) =>
              fetch(`${API_BASE}/${e}`, { headers: h }).then((r) => r.json())
            )
          );
          const ok = (r: PromiseSettledResult<any>) => (r.status === 'fulfilled' && r.value?.success ? r.value.data : undefined);
          if (!cancelled) {
            applyData({ screens: ok(sR), playlists: ok(pR), media: ok(mR), campaigns: ok(cR), groups: ok(gR), settings: ok(stR) });
          }
        } else if (selectedScreenId) {
          const res = await fetch(
            `${API_BASE}/device/${encodeURIComponent(selectedScreenId)}/feed?v=${encodeURIComponent(feedVersion)}`,
            { headers: { 'X-Device-Key': getDeviceKey() } }
          );
          const json = await res.json();
          if (!cancelled && json.success && !json.unchanged && json.data) {
            feedVersion = json.version;
            applyData(json.data);
          }
        }
      } catch {
        // Server unreachable: keep playing the last known playlist (offline resilience).
      }
    };

    fetchLatestData();
    const pollInterval = window.setInterval(fetchLatestData, 5000);
    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [selectedScreenId]);

  const currentScreens = liveScreens || screens;
  const currentPlaylists = livePlaylists || playlists;
  const currentMedia = liveMedia || mediaAssets;
  const currentCampaigns = liveCampaigns || campaigns;
  const currentGroups = liveGroups || groups;

  // Active Screen resolution (always uses latest MySQL list when available)
  const activeScreen = useMemo(
    () => currentScreens.find((s) => s.id === selectedScreenId) || currentScreens[0],
    [currentScreens, selectedScreenId]
  );

  // Scheduled Campaign override: if an Active/Scheduled campaign is inside its date + daily time window for this screen, play its playlist
  const activeCampaign = useMemo(
    () => resolveActiveCampaignForScreen(activeScreen?.id, currentCampaigns, currentGroups, nowTick),
    [activeScreen?.id, currentCampaigns, currentGroups, nowTick]
  );

  // QR Campaign: show QR overlay for ANY campaign targeting this screen that is within its DATE range
  // (not restricted to time window — QR should show all day, not just during playlist override hours)
  const qrCampaign = useMemo(() => {
    if (!activeScreen?.id) return null;
    const screenId = activeScreen.id;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const candidates = currentCampaigns.filter((c) => {
      if (c.status !== 'Active' && c.status !== 'Scheduled') return false;
      if (!c.qrUrl?.trim()) return false;
      if (todayStr < c.startDate || todayStr > c.endDate) return false;
      if (c.targetScreenIds.includes(screenId)) return true;
      if (c.targetGroupIds.length === 0) return false;
      return currentGroups.some((g) => c.targetGroupIds.includes(g.id) && g.screenIds.includes(screenId));
    });
    if (candidates.length === 0) return null;
    // Pick highest priority
    const rank: Record<string, number> = { Urgent: 3, High: 2, Normal: 1 };
    return candidates.slice().sort((a, b) => (rank[b.priority] || 1) - (rank[a.priority] || 1))[0];
  }, [activeScreen?.id, currentCampaigns, currentGroups]);

  const [campaignQrDataUrl, setCampaignQrDataUrl] = useState<string>('');
  // Use qrCampaign (date-range only) for QR display, so QR shows all day not just in time window
  const activeQrUrl = qrCampaign?.qrUrl?.trim() || '';
  const activeQrLabel = qrCampaign?.qrLabel?.trim() || activeCampaign?.qrLabel?.trim() || 'Scan QR Code';

  useEffect(() => {
    let cancelled = false;
    if (!activeQrUrl) {
      setCampaignQrDataUrl('');
      return;
    }
    QRCode.toDataURL(activeQrUrl, {
      width: 240,
      margin: 1,
      color: { dark: '#111827', light: '#FFFFFF' },
    })
      .then((url) => {
        if (!cancelled) setCampaignQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setCampaignQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [activeQrUrl]);

  // Active Playlist resolution: active campaign takes priority, then direct screen playlist, then screen group default playlist
  const groupDefaultPlaylistId = useMemo(() => {
    if (!activeScreen?.id) return null;
    const grp = currentGroups.find(
      (g) => g.screenIds.includes(activeScreen.id) && Boolean(g.assignedPlaylistId)
    );
    return grp?.assignedPlaylistId || null;
  }, [activeScreen?.id, currentGroups]);

  const effectivePlaylistId =
    activeCampaign?.playlistId || activeScreen?.assignedPlaylistId || groupDefaultPlaylistId;

  const assignedPlaylist = useMemo(() => {
    if (!effectivePlaylistId) return null;
    return currentPlaylists.find((p) => p.id === effectivePlaylistId) || null;
  }, [currentPlaylists, effectivePlaylistId]);

  // Reset slide index when active campaign/playlist transitions
  useEffect(() => {
    setCurrentSlideIndex(0);
    setSlideProgress(0);
  }, [effectivePlaylistId]);

  const handleAssignPlaylistToActiveScreen = async (newPlaylistId: string | null) => {
    if (!activeScreen) return;
    setCurrentSlideIndex(0);
    setSlideProgress(0);
    setLiveScreens((prev) =>
      (prev || screens).map((s) =>
        s.id === activeScreen.id ? { ...s, assignedPlaylistId: newPlaylistId } : s
      )
    );
    onAssignScreenPlaylist?.(activeScreen.id, newPlaylistId);
    try {
      await fetch(`${API_BASE}/screens/${activeScreen.id}/assign-playlist`, {
        method: 'PATCH',
        headers: playerHeaders(),
        body: JSON.stringify({ assignedPlaylistId: newPlaylistId }),
      });
      // If a single-screen Active Campaign is overriding this TV, pause it so the admin's manual playlist switch applies immediately on the physical TV
      let pausedCampaignName = '';
      if (
        activeCampaign &&
        newPlaylistId !== activeCampaign.playlistId &&
        (!activeCampaign.targetGroupIds || activeCampaign.targetGroupIds.length === 0) &&
        activeCampaign.targetScreenIds.length <= 1
      ) {
        await fetch(`${API_BASE}/campaigns/${activeCampaign.id}/status`, {
          method: 'PATCH',
          headers: playerHeaders(),
          body: JSON.stringify({ status: 'Paused' }),
        });
        setLiveCampaigns((prev) =>
          (prev || campaigns).map((c) =>
            c.id === activeCampaign.id ? { ...c, status: 'Paused' } : c
          )
        );
        pausedCampaignName = activeCampaign.name;
      }

      const targetName =
        currentPlaylists.find((p) => p.id === newPlaylistId)?.name || 'Unassigned';
      if (pausedCampaignName) {
        setCastHint(
          `Paused overriding campaign "${pausedCampaignName}" and switched ${activeScreen.id} to "${targetName}" (physical TV syncs in 3s).`
        );
      } else if (activeCampaign && newPlaylistId !== activeCampaign.playlistId) {
        setCastHint(
          `Saved "${targetName}" for ${activeScreen.id}, but multi-TV campaign "${activeCampaign.name}" overrides it until ${activeCampaign.endTime}.`
        );
      } else {
        setCastHint(`Updated ${activeScreen.id} (${activeScreen.name}) -> "${targetName}". Physical TV syncs within 3s.`);
      }
      window.setTimeout(() => setCastHint(''), 5000);
    } catch {
      // Ignore network errors silently
    }
  };

  // Resolve slides to media assets
  const slides = useMemo(() => {
    return (assignedPlaylist?.items || [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((item) => {
        const media = currentMedia.find((m) => m.id === item.mediaId);
        return {
          ...item,
          media,
        };
      })
      .filter((s) => Boolean(s.media));
  }, [assignedPlaylist, currentMedia]);

  // INSTANT PRELOADER: Pre-caches image slides in browser memory without consuming hardware video decoders on TV
  useEffect(() => {
    if (!slides || slides.length === 0) return;
    slides.forEach((slide) => {
      const media = slide.media;
      if (!media || media.type !== 'Image') return;
      const src = formatMediaUrl(
        media.thumbnailUrl || media.fileUrl || `/src/assets/images/${media.fileName}`
      );
      if (src) {
        const img = new Image();
        img.src = src;
      }
    });
  }, [slides]);

  const currentSlide = slides[currentSlideIndex] || slides[0];

  // Keep video playback synced with slide changes and play/pause state
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isPlaying) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [isPlaying, currentSlide?.mediaId]);

  // Clamp index if playlist shrinks
  useEffect(() => {
    if (slides.length > 0 && currentSlideIndex >= slides.length) {
      setCurrentSlideIndex(0);
    }
  }, [slides.length, currentSlideIndex]);

  // Keyboard navigation for TV / Desktop preview
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (slides.length === 0) return;
      if (e.key === 'ArrowRight') {
        setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
        setSlideProgress(0);
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlideIndex((prev) => (prev - 1 + slides.length) % slides.length);
        setSlideProgress(0);
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [slides.length]);

  const playlistId = assignedPlaylist?.id;
  const playlistDefaultDuration = assignedPlaylist?.defaultImageDuration;
  const currentSlideMediaId = currentSlide?.mediaId;
  const currentSlideDuration = currentSlide?.displayDurationSeconds;

  // Slide Rotation Engine (only depends on primitives so 3s polling never resets the slide timer)
  useEffect(() => {
    if (!isPlaying || slides.length === 0 || !currentSlideMediaId) return;

    const durationSec = Math.max(
      1,
      currentSlideDuration || playlistDefaultDuration || 10
    );
    const durationMs = durationSec * 1000;
    const tickInterval = 100;
    let elapsed = 0;

    setSlideProgress(0);

    const timer = window.setInterval(() => {
      elapsed += tickInterval;
      setSlideProgress(Math.min(100, Math.round((elapsed / durationMs) * 100)));

      if (elapsed >= durationMs) {
        clearInterval(timer);
        setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
        setSlideProgress(0);
      }
    }, tickInterval);

    return () => clearInterval(timer);
  }, [
    currentSlideIndex,
    isPlaying,
    slides.length,
    playlistId,
    playlistDefaultDuration,
    currentSlideMediaId,
    currentSlideDuration,
  ]);

  // Live Heartbeat Telemetry (sends real ping every 15s while screen is active)
  useEffect(() => {
    if (!activeScreen || activeScreen.isActive === false) return;
    // An admin merely previewing a screen must not make it look Online; real TVs (kiosk/cast/no session) do report.
    if (getAuthToken() && !isKioskMode && !isCastMode) return;

    const sendHeartbeat = async () => {
      try {
        await fetch(`${API_BASE}/device/${activeScreen.id}/heartbeat`, {
          method: 'POST',
          headers: playerHeaders(),
          body: JSON.stringify({
            currentMediaId: currentSlide?.mediaId || null,
            playerAppVersion: 'web-player',
            playbackError: null,
          }),
        });
      } catch (err) {
        // Silently fail if server is unreachable
      }
    };

    sendHeartbeat();
    const heartbeatTimer = window.setInterval(sendHeartbeat, 15000);
    return () => clearInterval(heartbeatTimer);
  }, [activeScreen?.id, activeScreen?.isActive, currentSlide?.mediaId, isKioskMode, isCastMode]);

  // Auto-hide controls when mouse is inactive (disabled when Kiosk locked)
  const handleRevealControls = () => {
    if (isKioskMode) return;
    setShowControls(true);
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => {
      setShowControls(false);
    }, 4000);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Option 3: Clean Cast / Mirror Mode handler
  const activateCastMode = () => {
    setIsCastMode(true);
    setShowControls(false);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    }
    setCastHint(
      'Cast View active (Screen Awake on). On phone: open Smart View / Cast. On Windows: press Win + K to mirror to Sansui TV.'
    );
    window.setTimeout(() => setCastHint(''), 5500);
  };

  // Triple-tap DYP badge in footer to unlock Kiosk mode
  const handleLogoTap = () => {
    logoTapCountRef.current += 1;
    if (logoTapTimerRef.current) window.clearTimeout(logoTapTimerRef.current);
    logoTapTimerRef.current = window.setTimeout(() => {
      logoTapCountRef.current = 0;
    }, 1200);

    if (logoTapCountRef.current >= 3) {
      logoTapCountRef.current = 0;
      setIsKioskMode(false);
      setIsCastMode(false);
      setShowControls(true);
    }
  };

  const handleToggleTickerBar = async () => {
    const next = !liveShowTicker;
    tickerSyncPauseUntilRef.current = Date.now() + 8000;
    setLiveShowTicker(next);
    if (onToggleTvTicker) {
      onToggleTvTicker(next);
    }
    try {
      await fetch(`${API_BASE}/settings/ticker`, {
        method: 'PATCH',
        headers: playerHeaders(),
        body: JSON.stringify({ showTvTicker: next }),
      });
      setCastHint(
        next
          ? 'Bottom notice bar & clock enabled — physical TVs update within 3s.'
          : 'Bottom notice bar hidden — clean fullscreen media synced to all TVs within 3s.'
      );
      window.setTimeout(() => setCastHint(''), 4000);
    } catch {
      // ignore transient network error
    }
  };

  if (activeScreen && activeScreen.isActive === false) {
    return (
      <div className="fixed inset-0 bg-[#1A0B2E] text-white flex flex-col items-center justify-center space-y-4 p-6 text-center">
        <Monitor className="w-16 h-16 text-[#EEE3B0]/70" />
        <h2 className="text-2xl font-bold font-display">Screen in Standby Mode</h2>
        <p className="text-white/70 text-sm max-w-md">
          {activeScreen.id} ({activeScreen.name}) is currently deactivated from Screen Management. Reactivate it from the dashboard to resume playback.
        </p>
        {!isKioskMode && (
          <button
            onClick={onExit}
            className="mt-4 px-4 py-2 bg-[#500071] rounded-lg text-white font-medium hover:bg-[#8A2A78] cursor-pointer"
          >
            Exit to Dashboard
          </button>
        )}
      </div>
    );
  }

  if (!currentSlide || !currentSlide.media) {
    return (
      <div className="fixed inset-0 bg-[#1A0B2E] text-white flex flex-col items-center justify-center space-y-5 p-6 text-center">
        <Monitor className="w-16 h-16 text-[#EEE3B0] animate-pulse" />
        <h2 className="text-2xl font-bold font-display">
          {assignedPlaylist ? 'Playlist Has No Media Slides' : 'No Playlist Assigned'}
        </h2>
        <p className="text-white/75 text-sm max-w-md">
          Screen <strong>{activeScreen?.id || selectedScreenId}</strong> ({activeScreen?.name || 'TV'}) currently has{' '}
          {assignedPlaylist ? `empty playlist "${assignedPlaylist.name}"` : 'no playlist assigned'}.
        </p>
        {!isKioskMode && (
          <div className="bg-black/40 border border-white/15 rounded-xl p-4 space-y-3 w-full max-w-md text-left">
            <div>
              <label className="block text-xs text-[#EEE3B0] font-semibold mb-1">
                Switch Preview Screen
              </label>
              <select
                value={selectedScreenId}
                onChange={(e) => {
                  setSelectedScreenId(e.target.value);
                  setCurrentSlideIndex(0);
                  setSlideProgress(0);
                }}
                className="w-full bg-[#290044] border border-white/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
              >
                {currentScreens.map((scr) => (
                  <option key={scr.id} value={scr.id}>
                    {scr.id} — {scr.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#EEE3B0] font-semibold mb-1">
                Assign &amp; Push Playlist to {activeScreen?.id || selectedScreenId}
              </label>
              <select
                value={activeScreen?.assignedPlaylistId || ''}
                onChange={(e) => handleAssignPlaylistToActiveScreen(e.target.value || null)}
                className="w-full bg-[#290044] border border-[#8A2A78] rounded-lg px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
              >
                <option value="">-- Select a Playlist --</option>
                {currentPlaylists.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name} ({pl.items.length} slides)
                  </option>
                ))}
              </select>
            </div>
            <div className="pt-1 flex justify-end">
              <button
                onClick={onExit}
                className="px-4 py-2 bg-[#500071] rounded-lg text-xs text-white font-semibold hover:bg-[#8A2A78] cursor-pointer"
              >
                Exit to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const media = currentSlide.media;
  const isVideoFileUrl = (url?: string | null) =>
    Boolean(url && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url.trim()));
  const isActualVideo = media.type === 'Video' && isVideoFileUrl(media.fileUrl);
  const rawImageSource =
    media.thumbnailUrl ||
    media.fileUrl ||
    `/src/assets/images/${media.fileName}`;
  const imageSource = formatMediaUrl(rawImageSource);
  const videoSrc = formatMediaUrl(media.fileUrl);
  const videoPoster = isVideoFileUrl(media.thumbnailUrl) ? undefined : imageSource || undefined;

  return (
    <div
      onMouseMove={handleRevealControls}
      onTouchStart={handleRevealControls}
      className="fixed inset-0 w-screen h-screen z-50 bg-black select-none overflow-hidden flex flex-col"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 50,
        backgroundColor: '#000000',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        cursor: showControls && !isKioskMode ? 'default' : 'none',
      }}
    >
      {/* Main Playback Area */}

      {/* Cast Mode Toast Hint */}
      {castHint && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-[#290044]/95 border border-[#EEE3B0]/50 text-[#EEE3B0] px-4 py-2.5 rounded-xl text-xs font-medium shadow-xl max-w-md text-center">
          {castHint}
        </div>
      )}

      {/* Floating Header Controls (Hidden in Kiosk Mode; Appears on Hover / Tap otherwise) */}
      {!isKioskMode && (
        <div
          className={`absolute top-4 left-4 right-4 z-40 flex items-center justify-between gap-2 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-3 bg-black/70 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-white flex-wrap">
            <button
              onClick={onExit}
              className="flex items-center gap-2 text-sm text-[#EEE3B0] hover:text-white font-medium cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </button>
            <span className="text-white/30">|</span>
            <div className="flex items-center gap-2 text-xs">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span>Control TV:</span>
              <select
                value={selectedScreenId}
                onChange={(e) => {
                  setSelectedScreenId(e.target.value);
                  setCurrentSlideIndex(0);
                  setSlideProgress(0);
                }}
                className="bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none cursor-pointer"
              >
                {currentScreens.map((scr) => (
                  <option key={scr.id} value={scr.id} className="bg-[#290044] text-white">
                    {scr.id} — {scr.name}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-white/30 hidden sm:inline">|</span>
            <div className="hidden sm:flex items-center gap-1.5 bg-[#500071] px-2.5 py-1 rounded-lg border border-[#8A2A78] text-xs font-semibold text-[#EEE3B0]">
              <ListVideo className="w-3.5 h-3.5 shrink-0" />
              <span>Playlist:</span>
              <select
                value={effectivePlaylistId || ''}
                onChange={(e) => handleAssignPlaylistToActiveScreen(e.target.value || null)}
                title="Change which playlist this screen plays (updates physical TV in 3s)"
                className="bg-transparent text-[#EEE3B0] font-semibold focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-[#290044] text-white">
                  Unassigned
                </option>
                {currentPlaylists.map((pl) => (
                  <option key={pl.id} value={pl.id} className="bg-[#290044] text-white">
                    {pl.name}
                  </option>
                ))}
              </select>
            </div>
            {activeCampaign && (
              <span
                className="hidden md:inline-flex items-center gap-1 text-[11px] text-[#290044] bg-[#EEE3B0] px-2 py-0.5 rounded-md font-semibold"
                title={`Active scheduled campaign (${activeCampaign.startTime}–${activeCampaign.endTime})`}
              >
                Scheduled: {activeCampaign.name}
              </span>
            )}
            {wakeLockActive && (
              <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-emerald-300 bg-emerald-500/15 border border-emerald-400/30 px-2 py-0.5 rounded-md">
                Screen Awake
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 text-white">
            {slides.length > 1 && (
              <button
                onClick={() => {
                  setCurrentSlideIndex((prev) => (prev - 1 + slides.length) % slides.length);
                  setSlideProgress(0);
                }}
                className="p-1.5 rounded-lg hover:bg-white/20 text-white/90 cursor-pointer"
                title="Previous Slide (Left Arrow)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setIsPlaying((p) => !p)}
              className="p-1.5 rounded-lg hover:bg-white/20 text-white/90 cursor-pointer"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            {slides.length > 1 && (
              <button
                onClick={() => {
                  setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
                  setSlideProgress(0);
                }}
                className="p-1.5 rounded-lg hover:bg-white/20 text-white/90 cursor-pointer"
                title="Next Slide (Right Arrow)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {isActualVideo && (
              <button
                onClick={() => setIsMuted((m) => !m)}
                className="p-1.5 rounded-lg hover:bg-white/20 text-white/90 cursor-pointer"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={handleToggleTickerBar}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                liveShowTicker
                  ? 'hover:bg-white/20 text-[#EEE3B0]'
                  : 'bg-[#500071] text-white border border-[#8A2A78]'
              }`}
              title={
                liveShowTicker
                  ? 'Hide bottom notice bar & clock (Full-screen media)'
                  : 'Show bottom notice bar & clock'
              }
            >
              {liveShowTicker ? (
                <>
                  <PanelBottomClose className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Hide Bar</span>
                </>
              ) : (
                <>
                  <PanelBottomOpen className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Show Bar</span>
                </>
              )}
            </button>
            <button
              onClick={activateCastMode}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                isCastMode
                  ? 'bg-emerald-600/80 text-white'
                  : 'hover:bg-white/20 text-[#EEE3B0]'
              }`}
              title="Clean Fullscreen Cast View (Option 3: Screen Mirror / Cast)"
            >
              <Cast className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Cast View</span>
            </button>
            <button
              onClick={() => {
                setIsKioskMode(true);
                setShowControls(false);
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(() => {});
                  setIsFullscreen(true);
                }
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/20 text-white/90 text-xs font-medium cursor-pointer"
              title="Lock Kiosk Mode (Option 2: 24/7 TV Signage — Triple-tap DYP logo to unlock)"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Kiosk Lock</span>
            </button>
            <button
              onClick={() => setShowControls(false)}
              className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 cursor-pointer"
              title="Hide Controls Now"
            >
              <EyeOff className="w-4 h-4" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg hover:bg-white/20 text-white/90 cursor-pointer"
              title="Toggle Fullscreen (F11)"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Main Playback Area (100% Contained Fullscreen Media — inline CSS guarantees fit even on older TV WebViews) */}
      <div
        onClick={isKioskMode && !liveShowTicker ? handleLogoTap : undefined}
        className="flex-1 min-h-0 min-w-0 relative bg-[#0F051D] overflow-hidden"
        style={{
          flex: '1 1 0%',
          minHeight: 0,
          minWidth: 0,
          position: 'relative',
          backgroundColor: '#0F051D',
          overflow: 'hidden',
          width: '100%',
        }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center p-0 overflow-hidden"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            overflow: 'hidden',
          }}
        >
          {isActualVideo ? (
            <video
              ref={videoRef}
              key={media.id}
              src={videoSrc}
              poster={videoPoster}
              preload="auto"
              autoPlay
              muted={isMuted}
              playsInline
              loop={Boolean(currentSlide.loopVideo)}
              onLoadedData={(e) => {
                if (isPlaying) {
                  e.currentTarget.play().catch(() => {});
                }
              }}
              onCanPlay={(e) => {
                if (isPlaying) {
                  e.currentTarget.play().catch(() => {});
                }
              }}
              onEnded={() => {
                if (!currentSlide.loopVideo && slides.length > 1) {
                  setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
                  setSlideProgress(0);
                }
              }}
              className="w-full h-full max-w-full max-h-full object-contain"
              style={{
                width: '100%',
                height: '100%',
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                display: 'block',
                backgroundColor: '#000000',
              }}
            />
          ) : (
            <img
              key={media.id}
              src={imageSource}
              alt={media.title}
              decoding="async"
              className="w-full h-full max-w-full max-h-full object-contain select-none transition-opacity duration-200"
              style={{
                width: '100%',
                height: '100%',
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
              onError={(e) => {
                e.currentTarget.src = '/src/assets/images/media_admissions_poster_1795455460163.jpg';
              }}
            />
          )}
        </div>

        {/* Optional Campaign QR Code Overlay (bottom-right inside stage) */}
        {campaignQrDataUrl && (
          <div
            className="absolute bottom-5 right-5 z-20 bg-white/95 text-[#1A1025] rounded-2xl p-2.5 shadow-2xl border-2 border-[#500071]/25 text-center max-w-[160px]"
            style={{
              position: 'absolute',
              right: '20px',
              bottom: '20px',
              zIndex: 20,
              backgroundColor: 'rgba(255, 255, 255, 0.96)',
              color: '#1A1025',
              borderRadius: '14px',
              padding: '10px',
              textAlign: 'center',
              maxWidth: '160px',
            }}
          >
            <img
              src={campaignQrDataUrl}
              alt={activeQrLabel}
              className="w-28 h-28 mx-auto block rounded-md"
              style={{ width: '116px', height: '116px', display: 'block', margin: '0 auto' }}
            />
            <p
              className="mt-1.5 text-[11px] font-bold text-[#290044] leading-tight break-words"
              style={{ marginTop: '6px', fontSize: '11px', fontWeight: 700, color: '#290044' }}
            >
              {activeQrLabel}
            </p>
          </div>
        )}

        {/* Slide & Playlist Counter Overlay Badge */}
        {!isKioskMode && (
          <div
            className={`absolute ${
              campaignQrDataUrl ? 'bottom-5 left-6' : liveShowTicker ? 'bottom-20 right-6' : 'bottom-6 right-6'
            } z-20 bg-black/70 backdrop-blur-md border border-white/10 text-white/90 px-3 py-1.5 rounded-lg text-xs font-mono transition-opacity duration-300 flex items-center gap-2 ${
              showControls ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <ListVideo className="w-3.5 h-3.5 text-[#EEE3B0]" />
            <span>
              {assignedPlaylist?.name} · Slide {currentSlideIndex + 1} of {slides.length} ({currentSlide.displayDurationSeconds}s)
            </span>
          </div>
        )}
      </div>

      {/* Campus Signage Bottom Ticker Bar (Optional — controlled from TV Bar toggle or Settings) */}
      {liveShowTicker && (
      <footer
        className="h-16 bg-[#290044] text-white flex items-center justify-between px-6 border-t border-[#8A2A78]/30 shrink-0 z-30"
        style={{
          height: '64px',
          minHeight: '64px',
          backgroundColor: '#290044',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: '24px',
          paddingRight: '24px',
          borderTop: '1px solid rgba(138, 42, 120, 0.35)',
          flexShrink: 0,
          zIndex: 30,
        }}
      >
        {/* Left: Brand Identity & Live Screen Info (Triple-tap DYP badge to unlock Kiosk mode) */}
        <div
          className="flex items-center gap-3"
          style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
        >
          <button
            type="button"
            onClick={handleLogoTap}
            title={isKioskMode ? 'Triple-tap to unlock Kiosk Controls' : 'D.Y. Patil International University'}
            className="w-9 h-9 rounded-lg bg-[#500071] border border-[#EEE3B0]/40 flex items-center justify-center font-bold text-[#EEE3B0] text-sm cursor-default"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#500071',
              border: '1px solid rgba(238, 227, 176, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              color: '#EEE3B0',
              fontSize: '14px',
            }}
          >
            DYP
          </button>
          <div className="hidden sm:block">
            <p
              className="font-bold text-sm tracking-tight font-display text-white leading-tight"
              style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: '#FFFFFF' }}
            >
              D.Y. Patil International University
            </p>
            <p
              className="text-xs text-[#EEE3B0]/80 leading-tight"
              style={{ margin: 0, fontSize: '12px', color: 'rgba(238, 227, 176, 0.85)' }}
            >
              {activeScreen?.name} · {activeScreen?.building} ({activeScreen?.floor})
            </p>
          </div>
        </div>

        {/* Center: Live Scrolling Notice Ticker showing Active Playlist & Slide */}
        <div
          className="flex-1 max-w-2xl mx-8 overflow-hidden relative"
          style={{ flex: '1 1 0%', maxWidth: '672px', marginLeft: '24px', marginRight: '24px', overflow: 'hidden' }}
        >
          <div
            className="whitespace-nowrap inline-block animate-marquee text-xs text-[#EEE3B0] font-medium tracking-wide"
            style={{ whiteSpace: 'nowrap', fontSize: '12px', color: '#EEE3B0', fontWeight: 500 }}
          >
            📢 [{assignedPlaylist?.name}] — {media.title} • {media.description || 'Welcome to D.Y. Patil International University Campus Network'} •
          </div>
        </div>

        {/* Right: Isolated Real-time Clock */}
        <LiveClock />
      </footer>
      )}
    </div>
  );
};
