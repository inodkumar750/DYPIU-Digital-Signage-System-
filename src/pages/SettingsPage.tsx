import React, { useEffect, useState } from 'react';
import {
  Bell,
  Building2,
  Clock,
  Film,
  ListVideo,
  Palette,
  Save,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { UniversitySettings } from '../types/signage';

type SettingsSectionId =
  | 'university'
  | 'branding'
  | 'general'
  | 'timezone'
  | 'playlist'
  | 'media'
  | 'notifications'
  | 'security';

const SECTIONS: {
  id: SettingsSectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'university', label: 'University Information', icon: Building2 },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'general', label: 'General Settings', icon: Sliders },
  { id: 'timezone', label: 'Timezone', icon: Clock },
  { id: 'playlist', label: 'Default Playlist Settings', icon: ListVideo },
  { id: 'media', label: 'Media Settings', icon: Film },
  { id: 'notifications', label: 'Notification Preferences', icon: Bell },
  { id: 'security', label: 'Security Preferences', icon: ShieldCheck },
];

interface SettingsPageProps {
  settings: UniversitySettings;
  onSaveSettings: (updated: UniversitySettings) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onSaveSettings,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('university');
  const [draft, setDraft] = useState<UniversitySettings>(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(draft);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="type-section-title text-[#290044]">
          Platform settings
        </h2>
        <p className="type-support text-[#645573]">
          Configure sample university profile, display defaults, media policies, and security preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Section Tabs */}
        <nav
          aria-label="Settings sections"
          className="lg:col-span-3 bg-white border border-[#E6E0EC] rounded-xl p-2 space-y-1 shadow-[0_1px_2px_rgba(41,0,68,0.04)]"
        >
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const active = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[14px] font-medium text-left transition-colors ${
                  active
                    ? 'bg-[#500071] text-white'
                    : 'text-[#290044] hover:bg-[#FAF8FC]'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#EEE3B0]' : 'text-[#500071]'}`} />
                <span className="truncate">{sec.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Form Panel */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-9 bg-white border border-[#E6E0EC] rounded-xl p-6 space-y-6 shadow-[0_1px_2px_rgba(41,0,68,0.04)]"
        >
          {activeSection === 'university' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-[#290044] font-display">
                University Information (Sample Data)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#290044] mb-1">
                    Institution Display Name
                  </label>
                  <input
                    type="text"
                    value={draft.universityName}
                    onChange={(e) =>
                      setDraft({ ...draft, universityName: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#290044] mb-1">
                    Campus Location
                  </label>
                  <input
                    type="text"
                    value={draft.campusLocation}
                    onChange={(e) =>
                      setDraft({ ...draft, campusLocation: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#290044] mb-1">
                    IT Operations Email
                  </label>
                  <input
                    type="email"
                    value={draft.itDepartmentEmail}
                    onChange={(e) =>
                      setDraft({ ...draft, itDepartmentEmail: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#290044] mb-1">
                    AV Support Desk Phone
                  </label>
                  <input
                    type="text"
                    value={draft.supportPhone}
                    onChange={(e) =>
                      setDraft({ ...draft, supportPhone: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs font-mono border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'branding' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-[#290044] font-display">
                Signage Theme & Color System
              </h3>
              <p className="text-xs text-[#645573]">
                Brand palette configured for campus UI and default screen fallback templates.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Primary Purple', value: draft.primaryColor },
                  { label: 'Secondary Purple', value: draft.secondaryColor },
                  { label: 'Accent Purple', value: draft.accentColor },
                  { label: 'Warm Cream', value: draft.creamColor },
                ].map((swatch) => (
                  <div
                    key={swatch.label}
                    className="p-3 rounded-xl border border-[#E8E2EE] space-y-2"
                  >
                    <div
                      className="h-12 rounded-lg border border-black/10"
                      style={{ backgroundColor: swatch.value }}
                    />
                    <p className="text-xs font-semibold text-[#290044]">{swatch.label}</p>
                    <p className="text-[11px] font-mono text-[#645573]">{swatch.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'general' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-[#290044] font-display">
                General Console Settings
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#290044] mb-1">
                    Date Display Format
                  </label>
                  <select
                    value={draft.dateFormat}
                    onChange={(e) => setDraft({ ...draft, dateFormat: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg"
                  >
                    <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MMM DD, YYYY">MMM DD, YYYY</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#290044] mb-1">
                    Keycloak Identity Realm (Future Integration)
                  </label>
                  <input
                    type="text"
                    value={draft.keycloakRealm}
                    onChange={(e) => setDraft({ ...draft, keycloakRealm: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono border border-[#E8E2EE] rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'timezone' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-[#290044] font-display">
                Campus Timezone & Campaign Scheduling Clock
              </h3>
              <div>
                <label className="block text-xs font-semibold text-[#290044] mb-1">
                  Primary Campus Timezone
                </label>
                <select
                  value={draft.timezone}
                  onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
                  className="w-full max-w-md px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg"
                >
                  <option value="Asia/Kolkata (UTC+05:30)">Asia/Kolkata (UTC+05:30)</option>
                  <option value="UTC (UTC+00:00)">UTC (UTC+00:00)</option>
                  <option value="America/New_York (UTC-05:00)">America/New_York (UTC-05:00)</option>
                  <option value="Europe/London (UTC+00:00)">Europe/London (UTC+00:00)</option>
                </select>
              </div>
            </div>
          )}

          {activeSection === 'playlist' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-[#290044] font-display">
                Default Playlist Playback Settings
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#290044] mb-1">
                    Default Image Slide Duration (seconds)
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={120}
                    value={draft.defaultImageDurationSeconds}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        defaultImageDurationSeconds: Number(e.target.value) || 10,
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-mono border border-[#E8E2EE] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#290044] mb-1">
                    Default Slide Transition
                  </label>
                  <select
                    value={draft.defaultTransition}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        defaultTransition: e.target.value as 'Fade' | 'Slide' | 'Cut',
                      })
                    }
                    className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg"
                  >
                    <option value="Fade">Smooth Fade</option>
                    <option value="Slide">Horizontal Slide</option>
                    <option value="Cut">Instant Cut</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2.5 pt-2 text-xs text-[#290044] cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.showTvTicker !== false}
                  onChange={(e) =>
                    setDraft({ ...draft, showTvTicker: e.target.checked })
                  }
                  className="accent-[#500071] w-4 h-4"
                />
                Show bottom campus ticker bar, scrolling notice & clock on TV screens
              </label>
            </div>
          )}

          {activeSection === 'media' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-[#290044] font-display">
                Media Upload & Encoding Policies
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#290044] mb-1">
                    Max Upload File Size (MB)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={1024}
                    value={draft.maxUploadSizeMb}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        maxUploadSizeMb: Number(e.target.value) || 250,
                      })
                    }
                    className="w-full max-w-xs px-3 py-2 text-xs font-mono border border-[#E8E2EE] rounded-lg"
                  />
                </div>
                <label className="flex items-center gap-2.5 text-xs text-[#290044] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.autoTranscodeVideo}
                    onChange={(e) =>
                      setDraft({ ...draft, autoTranscodeVideo: e.target.checked })
                    }
                    className="accent-[#500071] w-4 h-4"
                  />
                  Automatically normalize uploaded MP4 reels to 1080p H.264 for Android TV Players
                </label>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-[#290044] font-display">
                Notification & Alert Preferences
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#290044] mb-1">
                    Alert Threshold for Offline Screen (minutes)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={draft.notifyOfflineMinutes}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        notifyOfflineMinutes: Number(e.target.value) || 15,
                      })
                    }
                    className="w-full max-w-xs px-3 py-2 text-xs font-mono border border-[#E8E2EE] rounded-lg"
                  />
                </div>
                <label className="flex items-center gap-2.5 text-xs text-[#290044] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.emailAlertsEnabled}
                    onChange={(e) =>
                      setDraft({ ...draft, emailAlertsEnabled: e.target.checked })
                    }
                    className="accent-[#500071] w-4 h-4"
                  />
                  Send email alerts to IT Operations when screens miss heartbeat checks
                </label>
                <label className="flex items-center gap-2.5 text-xs text-[#290044] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.playbackFailureAlerts}
                    onChange={(e) =>
                      setDraft({ ...draft, playbackFailureAlerts: e.target.checked })
                    }
                    className="accent-[#500071] w-4 h-4"
                  />
                  Notify Content Managers when a campaign publish job encounters failed displays
                </label>
              </div>
            </div>
          )}

          {activeSection === 'security' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-[#290044] font-display">
                Security & Session Preferences
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#290044] mb-1">
                    Admin Idle Session Timeout (minutes)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={480}
                    value={draft.sessionTimeoutMinutes}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        sessionTimeoutMinutes: Number(e.target.value) || 60,
                      })
                    }
                    className="w-full max-w-xs px-3 py-2 text-xs font-mono border border-[#E8E2EE] rounded-lg"
                  />
                </div>
                <label className="flex items-center gap-2.5 text-xs text-[#290044] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.require2FAForAdmins}
                    onChange={(e) =>
                      setDraft({ ...draft, require2FAForAdmins: e.target.checked })
                    }
                    className="accent-[#500071] w-4 h-4"
                  />
                  Enforce Multi-Factor Authentication (MFA) for Super & IT Administrators
                </label>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-[#E8E2EE] flex items-center justify-between gap-4">
            <span className="text-[11px] text-[#645573]">
              Simulated prototype settings — stored in local browser session state.
            </span>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#500071] text-white text-xs font-semibold hover:bg-[#8A2A78] transition-colors whitespace-nowrap"
            >
              <Save className="w-4 h-4" />
              Save Preferences
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
