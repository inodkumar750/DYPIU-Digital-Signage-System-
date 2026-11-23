import React, { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import {
  Campaign,
  MediaAsset,
  PublishJob,
  ScreenDevice,
} from '../types/signage';
import { CAMPAIGN_PERFORMANCE_SERIES } from '../data/mockSignageData';
import { CampaignPerformanceChart, HorizontalBarChart } from '../components/ui/Charts';
import { StatusBadge } from '../components/ui/StatusBadge';

interface ReportsPageProps {
  campaigns: Campaign[];
  screens: ScreenDevice[];
  mediaAssets: MediaAsset[];
  publishJobs: PublishJob[];
  onExportToast: (msg: string) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  campaigns,
  screens,
  mediaAssets,
  publishJobs,
  onExportToast,
}) => {
  const [range, setRange] = useState<'7d' | '14d' | '30d'>('14d');

  // Media usage by category
  const categoryCounts = mediaAssets.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});

  const mediaUsageBars = Object.entries(categoryCounts).map(([label, value], idx) => ({
    label,
    value,
    tone: (idx % 3 === 0 ? 'primary' : idx % 3 === 1 ? 'secondary' : 'accent') as
      | 'primary'
      | 'secondary'
      | 'accent',
  }));

  // Building uptime summary
  const buildingBars = ['Building A', 'Building B', 'Student Hub'].map((b, idx) => {
    const list = screens.filter((s) => s.building === b);
    const online = list.filter((s) => s.connectionStatus === 'Online').length;
    const pct = list.length > 0 ? Math.round((online / list.length) * 100) : 0;
    return {
      label: `${b} (${online}/${list.length} screens)`,
      value: pct,
      total: 100,
      tone: (idx === 0 ? 'primary' : idx === 1 ? 'secondary' : 'cream') as
        | 'primary'
        | 'secondary'
        | 'cream',
    };
  });

  const handleExportCSV = () => {
    const headers = ['Screen ID', 'Name', 'Building', 'Floor', 'Status', 'Last Heartbeat', 'Cache %'];
    const rows = screens.map((s) => [
      s.id,
      `"${s.name}"`,
      `"${s.building}"`,
      `"${s.floor}"`,
      s.connectionStatus,
      s.lastHeartbeat,
      String(s.storageUsedPct),
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `campuscast-signage-report-${range}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onExportToast(`Downloaded CSV report (${screens.length} campus displays).`);
  };

  const handleExportPDF = () => {
    onExportToast('Opening browser print dialog for PDF export.');
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header & Export Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="type-section-title text-[#290044]">
            Analytics and reports
          </h2>
          <p className="type-support text-[#645573]">
            Campus screen uptime, campaign playback activity, media distribution, and publishing logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center p-1 bg-white border border-[#E6E0EC] rounded-lg">
            {(['7d', '14d', '30d'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-md text-[13px] font-medium uppercase ${
                  range === r
                    ? 'bg-[#EEE3B0] text-[#290044] font-semibold'
                    : 'text-[#645573] hover:text-[#290044]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#500071] text-[#500071] bg-white type-button hover:bg-[#FAF8FC] whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#500071] text-white type-button hover:bg-[#8A2A78] whitespace-nowrap"
          >
            <FileText className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 bg-white border border-[#E6E0EC] rounded-xl p-6 shadow-[0_1px_2px_rgba(41,0,68,0.04)]">
          <div className="mb-4 space-y-1">
            <h3 className="type-card-title text-[#290044]">
              Campaign activity and impressions ({range.toUpperCase()})
            </h3>
            <p className="type-support text-[#645573]">
              Total playback cycles recorded across active university Smart TVs.
            </p>
          </div>
          <CampaignPerformanceChart data={CAMPAIGN_PERFORMANCE_SERIES} />
        </section>

        <div className="space-y-6">
          <section className="bg-white border border-[#E6E0EC] rounded-xl p-6 shadow-[0_1px_2px_rgba(41,0,68,0.04)]">
            <h3 className="type-card-title text-[#290044] mb-4">
              Screen availability by building
            </h3>
            <HorizontalBarChart items={buildingBars} unit="%" />
          </section>

          <section className="bg-white border border-[#E6E0EC] rounded-xl p-6 shadow-[0_1px_2px_rgba(41,0,68,0.04)]">
            <h3 className="type-card-title text-[#290044] mb-4">
              Media library usage by category
            </h3>
            <HorizontalBarChart items={mediaUsageBars} unit=" assets" />
          </section>
        </div>
      </div>

      {/* Tables Row: Publishing History + Device Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-[#E8E2EE] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E8E2EE]">
            <h3 className="text-sm font-bold text-[#290044] font-display">
              Content Publishing History
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E8E2EE] bg-[#FAF8FC] text-[11px] font-semibold text-[#645573]">
                  <th className="py-2.5 px-4">Campaign</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Delivery</th>
                  <th className="py-2.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1ECF6] text-xs">
                {publishJobs.map((job) => (
                  <tr key={job.id}>
                    <td className="py-3 px-4 font-medium text-[#290044]">{job.campaignName}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-[#645573] whitespace-nowrap">
                      {job.publicationDate}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-[#290044]">
                      {job.successCount}/{job.targetScreenIds.length}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <StatusBadge status={job.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white border border-[#E8E2EE] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E8E2EE]">
            <h3 className="text-sm font-bold text-[#290044] font-display">
              Device Performance & Cache Health
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E8E2EE] bg-[#FAF8FC] text-[11px] font-semibold text-[#645573]">
                  <th className="py-2.5 px-4">Screen ID</th>
                  <th className="py-2.5 px-4">Building</th>
                  <th className="py-2.5 px-4">Cache Used</th>
                  <th className="py-2.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1ECF6] text-xs">
                {screens.slice(0, 6).map((scr) => (
                  <tr key={scr.id}>
                    <td className="py-3 px-4 font-mono font-semibold text-[#500071]">
                      {scr.id}
                    </td>
                    <td className="py-3 px-4 text-[#290044]">{scr.building}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-[#645573]">
                      {scr.storageUsedPct}%
                    </td>
                    <td className="py-3 px-4 text-right">
                      <StatusBadge status={scr.connectionStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
