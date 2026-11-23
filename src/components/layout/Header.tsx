import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Check,
  ChevronDown,
  HelpCircle,
  Menu,
  Monitor,
  Search,
  Settings,
  Users,
  X,
} from 'lucide-react';
import {
  Campaign,
  MediaAsset,
  NotificationItem,
  PageRoute,
  Playlist,
  ScreenDevice,
} from '../../types/signage';
import { ADMIN_AVATAR_URL } from '../../data/mockSignageData';

interface HeaderProps {
  pageTitle: string;
  breadcrumbParent: string;
  onOpenMobileSidebar: () => void;
  onNavigate: (route: PageRoute) => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  screens: ScreenDevice[];
  campaigns: Campaign[];
  mediaAssets: MediaAsset[];
  playlists: Playlist[];
  onOpenHelp: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  pageTitle,
  breadcrumbParent,
  onOpenMobileSidebar,
  onNavigate,
  notifications,
  onMarkAllRead,
  screens,
  campaigns,
  mediaAssets,
  playlists,
  onOpenHelp,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => n.unread).length;

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const q = searchQuery.trim().toLowerCase();
  const matchedScreens = q
    ? screens
        .filter(
          (s) =>
            s.id.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q) ||
            s.building.toLowerCase().includes(q)
        )
        .slice(0, 3)
    : [];
  const matchedCampaigns = q
    ? campaigns.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 3)
    : [];
  const matchedMedia = q
    ? mediaAssets
        .filter((m) => m.title.toLowerCase().includes(q) || m.fileName.toLowerCase().includes(q))
        .slice(0, 3)
    : [];
  const matchedPlaylists = q
    ? playlists.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 2)
    : [];

  const hasResults =
    matchedScreens.length +
      matchedCampaigns.length +
      matchedMedia.length +
      matchedPlaylists.length >
    0;

  return (
    <header className="sticky top-0 z-30 min-h-[72px] py-3 bg-white/95 backdrop-blur border-b border-[#E6E0EC] px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Left: Mobile Trigger + Page Title & Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 rounded-lg border border-[#E6E0EC] text-[#290044] hover:bg-[#FAF8FC]"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[13px] text-[#645573]">
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="hover:text-[#500071] transition-colors"
            >
              {breadcrumbParent}
            </button>
            <span aria-hidden="true">/</span>
            <span className="text-[#500071] font-medium truncate">{pageTitle}</span>
          </div>
          <h1 className="type-page-title text-[#290044] truncate">
            {pageTitle}
          </h1>
        </div>
      </div>

      {/* Right: Search, Notifications, Help, Admin Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Global Search */}
        <div ref={searchRef} className="relative hidden md:block w-64 xl:w-80">
          <div className="relative">
            <Search className="w-4 h-4 text-[#6E607D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              placeholder="Search screens, media, campaigns..."
              aria-label="Global search"
              className="w-full pl-9 pr-8 py-2 text-[14px] bg-[#FAF8FC] border border-[#E6E0EC] rounded-lg text-[#290044] placeholder-[#8A7D96] focus:outline-none focus:border-[#8A2A78] focus:bg-white transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6E607D] hover:text-[#290044]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {searchOpen && q.length > 0 && (
            <div className="absolute right-0 mt-2 w-96 bg-white border border-[#E6E0EC] rounded-xl shadow-lg overflow-hidden z-40">
              {!hasResults ? (
                <div className="p-4 text-[13px] text-[#645573] text-center">
                  No screens, campaigns, playlists, or media matched "{searchQuery}".
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto divide-y divide-[#F1ECF6]">
                  {matchedScreens.length > 0 && (
                    <div className="p-2">
                      <p className="px-2 py-1 text-[13px] font-semibold text-[#645573]">
                        Screens
                      </p>
                      {matchedScreens.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            onNavigate('screens');
                            setSearchOpen(false);
                          }}
                          className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-[#FAF8FC] text-left text-[13px]"
                        >
                          <span className="font-medium text-[#290044] truncate">
                            {s.id} · {s.name}
                          </span>
                          <span className="text-[#645573] shrink-0">{s.building}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {matchedCampaigns.length > 0 && (
                    <div className="p-2">
                      <p className="px-2 py-1 text-[13px] font-semibold text-[#645573]">
                        Campaigns
                      </p>
                      {matchedCampaigns.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            onNavigate('campaigns');
                            setSearchOpen(false);
                          }}
                          className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-[#FAF8FC] text-left text-[13px]"
                        >
                          <span className="font-medium text-[#290044] truncate">{c.name}</span>
                          <span className="text-[#645573] shrink-0">{c.status}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {matchedPlaylists.length > 0 && (
                    <div className="p-2">
                      <p className="px-2 py-1 text-[13px] font-semibold text-[#645573]">
                        Playlists
                      </p>
                      {matchedPlaylists.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            onNavigate('playlists');
                            setSearchOpen(false);
                          }}
                          className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-[#FAF8FC] text-left text-[13px]"
                        >
                          <span className="font-medium text-[#290044] truncate">{p.name}</span>
                          <span className="text-[#645573] shrink-0">{p.items.length} items</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {matchedMedia.length > 0 && (
                    <div className="p-2">
                      <p className="px-2 py-1 text-[13px] font-semibold text-[#645573]">
                        Media assets
                      </p>
                      {matchedMedia.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            onNavigate('media');
                            setSearchOpen(false);
                          }}
                          className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-[#FAF8FC] text-left text-[13px]"
                        >
                          <span className="font-medium text-[#290044] truncate">{m.title}</span>
                          <span className="text-[#645573] shrink-0">{m.type}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((prev) => !prev)}
            aria-label="Notifications"
            className="relative p-2.5 rounded-lg border border-[#E6E0EC] text-[#290044] hover:bg-[#FAF8FC] hover:border-[#8A2A78]/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A2A78]"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#8A2A78] text-white text-[11px] font-semibold flex items-center justify-center tabular-nums">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#E6E0EC] rounded-xl shadow-lg overflow-hidden z-40">
              <div className="px-4 py-3 border-b border-[#E6E0EC] bg-[#FAF8FC] flex items-center justify-between">
                <span className="text-[14px] font-semibold text-[#290044]">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={onMarkAllRead}
                    className="inline-flex items-center gap-1 text-[13px] font-medium text-[#500071] hover:text-[#8A2A78]"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
              </div>
              <div className="divide-y divide-[#F1ECF6] max-h-72 overflow-y-auto">
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      setNotifOpen(false);
                      onNavigate(
                        n.category === 'alert'
                          ? 'monitoring'
                          : n.category === 'publish'
                            ? 'publishing'
                            : 'campaigns'
                      );
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-[#FAF8FC] transition-colors ${
                      n.unread ? 'bg-[#EEE3B0]/20' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-[#290044]">{n.title}</span>
                      <span className="text-[12px] text-[#6E607D] shrink-0">{n.timestamp}</span>
                    </div>
                    <p className="mt-1 text-[13px] text-[#645573] leading-relaxed">{n.message}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Help Button */}
        <button
          type="button"
          onClick={onOpenHelp}
          aria-label="Help and prototype documentation"
          className="p-2.5 rounded-lg border border-[#E6E0EC] text-[#290044] hover:bg-[#FAF8FC] hover:border-[#8A2A78]/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A2A78]"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Admin Profile Dropdown */}
        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen((prev) => !prev)}
            className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1.5 rounded-lg border border-[#E6E0EC] hover:bg-[#FAF8FC] hover:border-[#8A2A78]/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A2A78]"
          >
            <img
              src={ADMIN_AVATAR_URL}
              alt="Vinod Kumar Jain"
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-md object-cover border border-[#E6E0EC]"
            />
            <div className="hidden sm:block text-left leading-tight">
              <span className="block text-[13px] font-semibold text-[#290044] whitespace-nowrap">
                Vinod Kumar Jain
              </span>
              <span className="block text-[12px] text-[#645573] whitespace-nowrap">
                Super administrator
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#645573] hidden sm:block" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-[#E6E0EC] rounded-xl shadow-lg overflow-hidden z-40">
              <div className="px-4 py-3 border-b border-[#E6E0EC] bg-[#FAF8FC]">
                <p className="text-[13px] font-semibold text-[#290044]">Vinod Kumar Jain</p>
                <p className="text-[12px] text-[#645573] truncate">vinodkumar.jain@dypiu.ac.in</p>
                <p className="mt-1.5 text-[12px] text-[#500071] font-medium">
                  Frontend prototype · Local session
                </p>
              </div>
              <div className="p-1.5 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    onNavigate('screens');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-[#290044] hover:bg-[#FAF8FC]"
                >
                  <Monitor className="w-4 h-4 text-[#500071]" />
                  Campus displays
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    onNavigate('users');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-[#290044] hover:bg-[#FAF8FC]"
                >
                  <Users className="w-4 h-4 text-[#500071]" />
                  User management
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    onNavigate('settings');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-[#290044] hover:bg-[#FAF8FC]"
                >
                  <Settings className="w-4 h-4 text-[#500071]" />
                  Platform settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
