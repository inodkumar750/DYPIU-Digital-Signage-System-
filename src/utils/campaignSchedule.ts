import { Campaign, ScreenGroup } from '../types/signage';

/** Returns local YYYY-MM-DD for a Date. */
export function getLocalDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Returns local HH:mm (24h) for a Date. */
export function getLocalTimeStr(d: Date = new Date()): string {
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}

/** Checks whether a campaign is currently within its date range and daily time window. */
export function isCampaignInWindow(
  campaign: Pick<Campaign, 'startDate' | 'endDate' | 'startTime' | 'endTime'>,
  now: Date = new Date()
): boolean {
  const today = getLocalDateStr(now);
  if (today < campaign.startDate || today > campaign.endDate) {
    return false;
  }

  const start = campaign.startTime || '00:00';
  const end = campaign.endTime || '23:59';
  const current = getLocalTimeStr(now);

  if (start === end) return true;
  if (start < end) {
    if (end === '23:59') {
      return current >= start && current <= end;
    }
    return current >= start && current < end;
  }
  // Overnight window (e.g. 22:00 -> 06:00)
  return current >= start || current < end;
}

/** Checks whether a campaign should actively play on TV right now. */
export function isCampaignLiveNow(campaign: Campaign, now: Date = new Date()): boolean {
  if (campaign.status !== 'Active' && campaign.status !== 'Scheduled') {
    return false;
  }
  return isCampaignInWindow(campaign, now);
}

const PRIORITY_RANK: Record<Campaign['priority'], number> = {
  Urgent: 3,
  High: 2,
  Normal: 1,
};

/** Resolves the highest-priority live campaign targeting a given screen right now. */
export function resolveActiveCampaignForScreen(
  screenId: string | undefined,
  campaigns: Campaign[],
  groups: ScreenGroup[] = [],
  now: Date = new Date()
): Campaign | null {
  if (!screenId || campaigns.length === 0) return null;

  const matching = campaigns.filter((c) => {
    if (!isCampaignLiveNow(c, now)) return false;
    if (c.targetScreenIds.includes(screenId)) return true;
    if (c.targetGroupIds.length === 0) return false;
    return groups.some(
      (g) => c.targetGroupIds.includes(g.id) && g.screenIds.includes(screenId)
    );
  });

  if (matching.length === 0) return null;

  return matching.slice().sort((a, b) => {
    const pDiff = (PRIORITY_RANK[b.priority] || 1) - (PRIORITY_RANK[a.priority] || 1);
    if (pDiff !== 0) return pDiff;
    return b.startDate.localeCompare(a.startDate);
  })[0];
}
