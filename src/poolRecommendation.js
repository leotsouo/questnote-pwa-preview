// Recommendation is display metadata, never an eligibility or transaction clock.
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const DATE_FORMAT = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function parseTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return NaN;
  const timestamp = Date.parse(value);
  const calendar = new Date(value.slice(0, 19) + 'Z');
  if (!Number.isFinite(timestamp) || !Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 19) !== value.slice(0, 19)) return NaN;
  return timestamp;
}

export function recommendationState(schedule, now = Date.now()) {
  if (schedule == null) return { status: 'unscheduled', nextUpdateAt: null };
  const startsAt = parseTimestamp(schedule.startsAt);
  const endsAt = parseTimestamp(schedule.endsAt);
  if (!Number.isFinite(now) || !Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) {
    return { status: 'invalid', nextUpdateAt: null };
  }
  const status = now < startsAt ? 'upcoming' : now < endsAt ? 'active' : 'ended';
  const boundary = status === 'upcoming' ? startsAt : endsAt;
  return {
    status, startsAt, endsAt, remainingMs: Math.max(0, endsAt - now),
    nextUpdateAt: status === 'ended' ? null : Math.min(boundary, now + MINUTE),
  };
}

export function recommendationCopy(state) {
  if (state.status === 'unscheduled' || state.status === 'invalid') return null;
  const date = (timestamp) => DATE_FORMAT.format(new Date(timestamp));
  if (state.status === 'upcoming') return {
    label: '推薦即將開始', dateLabel: '推薦開始', dateTime: new Date(state.startsAt).toISOString(), dateText: date(state.startsAt),
    explanation: '本系列已開放，現在即可抽取。推薦期不影響抽取資格或保底。',
  };
  if (state.status === 'ended') return {
    label: '持續開放', dateLabel: '推薦已結束', dateTime: new Date(state.endsAt).toISOString(), dateText: date(state.endsAt),
    explanation: '推薦期已結束，仍可在「全部系列」選擇本池抽取；保底累積保留。',
  };
  const minutes = Math.max(1, Math.ceil(state.remainingMs / MINUTE));
  const remaining = state.remainingMs > DAY
    ? `${Math.floor(state.remainingMs / DAY)} 天 ${Math.floor(state.remainingMs % DAY / HOUR)} 小時`
    : `${Math.floor(minutes / 60)} 小時 ${minutes % 60} 分鐘`;
  return {
    label: `推薦期剩餘 ${remaining}`, dateLabel: '推薦至', dateTime: new Date(state.endsAt).toISOString(), dateText: date(state.endsAt),
    explanation: '推薦期結束後，仍可在「全部系列」選擇本池抽取；保底累積保留。',
  };
}
