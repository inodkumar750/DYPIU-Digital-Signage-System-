/**
 * Single source of truth for "which campaign is live right now".
 * Mirrors src/utils/campaignSchedule.ts so the CMS preview and the TV agree.
 */

export const PRIORITY_RANK = { Urgent: 3, High: 2, Normal: 1 };

/** Returns { date: 'YYYY-MM-DD', time: 'HH:mm' } for the given instant in an IANA timezone. */
export function zonedNow(timeZone, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const g = (t) => parts.find((p) => p.type === t)?.value || '00';
  const hour = g('hour') === '24' ? '00' : g('hour');
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${hour}:${g('minute')}` };
}

/** True when `now` falls inside the campaign's date range and daily time window. */
export function isCampaignInWindow(c, now) {
  const startDate = String(c.start_date ?? c.startDate ?? '');
  const endDate = String(c.end_date ?? c.endDate ?? '');
  if (now.date < startDate || now.date > endDate) return false;

  const start = c.start_time ?? c.startTime ?? '00:00';
  const end = c.end_time ?? c.endTime ?? '23:59';
  if (start === end) return true; // all-day
  if (start < end) {
    return end === '23:59' ? now.time >= start && now.time <= end : now.time >= start && now.time < end;
  }
  // Overnight window, e.g. 22:00 -> 06:00
  return now.time >= start || now.time < end;
}

export function pickLiveCampaign(campaigns, now) {
  const live = campaigns
    .filter((c) => (c.status === 'Active' || c.status === 'Scheduled') && isCampaignInWindow(c, now))
    .sort((a, b) => {
      const d = (PRIORITY_RANK[b.priority] || 1) - (PRIORITY_RANK[a.priority] || 1);
      if (d !== 0) return d;
      return String(b.start_date ?? b.startDate).localeCompare(String(a.start_date ?? a.startDate));
    });
  return live[0] || null;
}
