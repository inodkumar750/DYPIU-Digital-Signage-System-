import React from 'react';
import {
  Activity,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  ListVideo,
  Megaphone,
  Monitor,
  Radio,
  Send,
  Settings,
  Tv,
  Users,
  X,
} from 'lucide-react';
import { PageRoute } from '../../types/signage';

interface NavItem {
  id: PageRoute;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'media', label: 'Media Library', icon: ImageIcon },
  { id: 'playlists', label: 'Playlists', icon: ListVideo },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { id: 'screens', label: 'Screen Management', icon: Monitor },
  { id: 'groups', label: 'Screen Groups', icon: Layers },
  { id: 'publishing', label: 'Publishing', icon: Send },
  { id: 'monitoring', label: 'Monitoring', icon: Activity },
  { id: 'control', label: 'Control Center', icon: Radio },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'users', label: 'User Management', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  activeRoute: PageRoute;
  onNavigate: (route: PageRoute) => void;
  allowedMenus?: PageRoute[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  offlineCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeRoute,
  onNavigate,
  allowedMenus,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  offlineCount,
}) => {
  const visibleNavItems = allowedMenus
    ? NAV_ITEMS.filter((item) => allowedMenus.includes(item.id))
    : NAV_ITEMS;

  const handleSelect = (route: PageRoute) => {
    onNavigate(route);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#290044] text-white select-none">
      {/* Brand Mark */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-white/10 shrink-0">
        <button
          type="button"
          onClick={() => handleSelect(visibleNavItems[0]?.id || 'dashboard')}
          className="flex items-center gap-3 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EEE3B0] rounded-lg"
        >
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shrink-0 overflow-hidden shadow-md">
            <img
              src="/dypiu-logo.png"
              alt="DYPIU Logo"
              className="w-9 h-9 object-contain"
            />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="block text-[16px] font-bold tracking-tight text-white font-display leading-tight">
                NEXORA
              </span>
              <span className="block text-[13px] text-[#EEE3B0]/85 leading-tight">
                DYPIU Digital Signage
              </span>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-lg text-white/75 hover:text-white hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main navigation">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeRoute === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-[15px] leading-[1.35] font-semibold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EEE3B0] ${
                isActive
                  ? 'bg-[#500071] text-white ring-1 ring-[#8A2A78]'
                  : 'text-white/80 hover:text-white hover:bg-white/8'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 ${
                    isActive ? 'text-[#EEE3B0]' : 'text-white/70'
                  }`}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </span>

              {!collapsed && item.id === 'monitoring' && offlineCount > 0 && (
                <span className="px-2 py-0.5 text-[12px] font-mono tabular-nums rounded bg-[#EEE3B0] text-[#290044] font-semibold">
                  {offlineCount}
                </span>
              )}
            </button>
          );
        })}

        <div className="pt-3 mt-3 border-t border-white/10">
          <a
            href="/NEXORA-TV.apk"
            download="NEXORA-TV.apk"
            title={collapsed ? 'Download NEXORA TV APK (v1.0.4)' : undefined}
            className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-[15px] leading-[1.35] font-semibold bg-[#EEE3B0]/15 text-[#EEE3B0] hover:bg-[#EEE3B0] hover:text-[#290044] transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EEE3B0]"
          >
            <span className="flex items-center gap-3 min-w-0">
              <Tv className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span className="truncate">Download TV APK</span>}
            </span>
            {!collapsed && <Download className="w-4 h-4 shrink-0" />}
          </a>
        </div>
      </nav>

      {/* Collapse Toggle */}
      <div className="hidden lg:flex items-center justify-between px-3 py-3 border-t border-white/10 shrink-0">
        {!collapsed && (
          <span className="text-[13px] text-white/65 px-2 truncate">
            IT operations console
          </span>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="ml-auto p-2 rounded-lg text-white/75 hover:text-white hover:bg-[#500071] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EEE3B0]"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 border-r border-[#290044] transition-all duration-200 ${
          collapsed ? 'w-[76px]' : 'w-[264px]'
        }`}
      >
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#290044]/50 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
