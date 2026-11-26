import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Send,
} from 'lucide-react';
import {
  Campaign,
  Playlist,
  PublishJob,
  ScreenDevice,
} from '../types/signage';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';

interface PublishingPageProps {
  publishJobs: PublishJob[];
  campaigns: Campaign[];
  playlists: Playlist[];
  screens: ScreenDevice[];
  onTriggerPublish: (campaign: Campaign) => void;
  onRetryJob: (jobId: string) => void;
}

export const PublishingPage: React.FC<PublishingPageProps> = ({
  publishJobs,
  campaigns,
  playlists,
  screens,
  onTriggerPublish,
  onRetryJob,
}) => {
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Publishing' | 'Published' | 'Failed'>('All');
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState(campaigns[0]?.id || '');

  const filteredJobs =
    statusFilter === 'All'
      ? publishJobs
      : publishJobs.filter((j) => j.status === statusFilter);

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);
  const selectedPlaylist = playlists.find((p) => p.id === selectedCampaign?.playlistId);

  const onlineTargetCount = selectedCampaign
    ? selectedCampaign.targetScreenIds.filter(
        (id) => screens.find((s) => s.id === id)?.connectionStatus === 'Online'
      ).length
    : 0;
  const offlineTargetCount = selectedCampaign
    ? selectedCampaign.targetScreenIds.length - onlineTargetCount
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="type-section-title text-[#290044]">
            Content publishing center
          </h2>
          <p className="type-support text-[#645573]">
            Dispatch campaign bundles to campus Smart TVs and track synchronization status (simulated local delivery).
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSelectedCampaignId(campaigns[0]?.id || '');
            setPublishModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#500071] text-white type-button hover:bg-[#8A2A78] transition-colors whitespace-nowrap"
        >
          <Send className="w-4 h-4" />
          Publish now
        </button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E6E0EC] rounded-xl p-5 shadow-[0_1px_2px_rgba(41,0,68,0.04)]">
          <p className="type-support text-[#645573]">Total dispatch jobs</p>
          <p className="mt-2 type-kpi text-[#290044]">
            {publishJobs.length}
          </p>
        </div>
        <div className="bg-white border border-[#E6E0EC] rounded-xl p-5 shadow-[0_1px_2px_rgba(41,0,68,0.04)]">
          <p className="type-support text-[#645573]">Published cleanly</p>
          <p className="mt-2 type-kpi text-emerald-700">
            {publishJobs.filter((j) => j.status === 'Published').length}
          </p>
        </div>
        <div className="bg-white border border-[#E6E0EC] rounded-xl p-5 shadow-[0_1px_2px_rgba(41,0,68,0.04)]">
          <p className="type-support text-[#645573]">In progress or pending</p>
          <p className="mt-2 type-kpi text-[#500071]">
            {publishJobs.filter((j) => j.status === 'Publishing' || j.status === 'Pending').length}
          </p>
        </div>
        <div className="bg-white border border-[#E6E0EC] rounded-xl p-5 shadow-[0_1px_2px_rgba(41,0,68,0.04)]">
          <p className="type-support text-[#645573]">Partial or failed jobs</p>
          <p className="mt-2 type-kpi text-rose-700">
            {publishJobs.filter((j) => j.status === 'Failed').length}
          </p>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 bg-white border border-[#E8E2EE] rounded-xl p-2">
        {(['All', 'Pending', 'Publishing', 'Published', 'Failed'] as const).map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === st
                ? 'bg-[#EEE3B0] text-[#290044] font-semibold'
                : 'text-[#645573] hover:bg-[#FAF8FC] hover:text-[#290044]'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Publishing Jobs Table */}
      <div className="bg-white border border-[#E8E2EE] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E8E2EE] bg-[#FAF8FC] text-[11px] font-semibold text-[#645573]">
                <th className="py-3 px-4">Campaign & Playlist</th>
                <th className="py-3 px-4">Target Screens</th>
                <th className="py-3 px-4">Publication Date</th>
                <th className="py-3 px-4">Sync Progress</th>
                <th className="py-3 px-4">Delivery Counts</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1ECF6] text-xs">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-[#645573]">
                    No publish records found. When campaigns are published to campus displays, live dispatch jobs will appear here.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                <tr key={job.id} className="hover:bg-[#FAF8FC] transition-colors">
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-[#290044]">{job.campaignName}</p>
                    <p className="text-[11px] text-[#500071]">
                      Playlist: {job.playlistName}
                    </p>
                    {job.errorMessage && (
                      <p className="mt-1 text-[11px] text-rose-700 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        {job.errorMessage}
                      </p>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono tabular-nums text-[#290044]">
                    {job.targetScreenIds.length} screens
                  </td>
                  <td className="py-3.5 px-4 font-mono tabular-nums text-[#645573] whitespace-nowrap">
                    {job.publicationDate}
                  </td>
                  <td className="py-3.5 px-4 w-44">
                    <div className="space-y-1">
                      <div className="h-2 rounded-full bg-[#F1ECF6] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            job.status === 'Failed'
                              ? 'bg-rose-600'
                              : job.status === 'Published'
                                ? 'bg-emerald-600'
                                : 'bg-[#500071]'
                          }`}
                          style={{ width: `${job.progressPct}%` }}
                        />
                      </div>
                      <span className="block text-[11px] font-mono tabular-nums text-[#645573]">
                        {job.progressPct}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono tabular-nums whitespace-nowrap">
                    <span className="text-emerald-700 font-semibold">
                      {job.successCount} ok
                    </span>
                    <span className="text-[#8A7D96] mx-1.5">/</span>
                    <span className={job.failedCount > 0 ? 'text-rose-700 font-semibold' : 'text-[#645573]'}>
                      {job.failedCount} failed
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    {job.status === 'Failed' ? (
                      <button
                        type="button"
                        onClick={() => onRetryJob(job.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EEE3B0] text-[#290044] text-xs font-semibold hover:bg-[#e5d692]"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Retry Failed
                      </button>
                    ) : job.status === 'Published' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Verified
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#500071] font-medium">
                        Syncing...
                      </span>
                    )}
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Publish Now Modal */}
      <Modal
        isOpen={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        title="Publish Campaign Bundle"
        subtitle="Simulated prototype dispatch — pushes playlist manifests to target campus screens"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#290044] mb-1.5">
              Select Campaign to Publish
            </label>
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="w-full px-3 py-2.5 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.status})
                </option>
              ))}
            </select>
          </div>

          {selectedCampaign && (
            <div className="p-4 rounded-xl bg-[#FAF8FC] border border-[#E8E2EE] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#645573]">Playlist</span>
                <span className="font-semibold text-[#500071]">
                  {selectedPlaylist?.name || 'Default'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#645573]">Target Screens</span>
                <span className="font-mono font-semibold text-[#290044] tabular-nums">
                  {selectedCampaign.targetScreenIds.length} displays
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#645573]">Currently Online</span>
                <span className="font-mono text-emerald-700 font-semibold tabular-nums">
                  {onlineTargetCount} reachable · {offlineTargetCount} offline
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setPublishModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-[#E8E2EE] text-xs font-semibold text-[#290044]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedCampaign) {
                  onTriggerPublish(selectedCampaign);
                  setPublishModalOpen(false);
                }
              }}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#500071] text-white text-xs font-semibold hover:bg-[#8A2A78]"
            >
              <Send className="w-3.5 h-3.5" />
              Dispatch Now
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
