/** One durable award per advancing local calendar day, shared by task and habit completion. */
export const DAILY_ENCOUNTER_FRAGMENTS = 10;
function validDay(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(day + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day;
}
export function validateDailyEncounterReceipt(receipt) {
  return !!receipt && typeof receipt === 'object' && !Array.isArray(receipt)
    && Object.keys(receipt).every(key => ['date', 'source', 'sourceId', 'amount'].includes(key))
    && validDay(receipt.date) && ['task', 'habit'].includes(receipt.source)
    && typeof receipt.sourceId === 'string' && receipt.sourceId.length > 0
    && receipt.amount === DAILY_ENCOUNTER_FRAGMENTS;
}
function localDay(timestamp) {
  if (typeof timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(timestamp)) return null;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function dailyEncounterReceipt({ source, current, next, date }) {
  if (!validDay(date) || !current || !next || current.id !== next.id || typeof next.id !== 'string' || !next.id) return null;
  if (source === 'task') {
    if (current.isTutorial || next.isTutorial || current.completed || current.rewardClaimed || !next.completed || localDay(next.completedAt) !== date) return null;
  } else if (source === 'habit') {
    if (!current.isActive || current.archivedAt || !next.isActive || next.archivedAt || current.isTutorial || next.isTutorial) return null;
    const before = current.logs?.[date];
    const after = next.logs?.[date];
    if (before?.completed || before?.rewardClaimed || !after?.completed || localDay(after.completedAt) !== date) return null;
  } else return null;
  return { date, source, sourceId:next.id, amount:DAILY_ENCOUNTER_FRAGMENTS };
}
export function applyDailyEncounter(economy, receipt) {
  if (!receipt) return false;
  if (!validateDailyEncounterReceipt(receipt)) throw new Error('每日相遇收據無效');
  if (economy.dailyReceipt && !validateDailyEncounterReceipt(economy.dailyReceipt)) throw new Error('每日相遇收據無效');
  // A backwards clock cannot replay an earlier day. Moving forwards is not server verification.
  if (economy.dailyReceipt?.date >= receipt.date) return false;
  if (!Number.isSafeInteger(economy.balance) || economy.balance < 0 || !Number.isSafeInteger(economy.balance + receipt.amount)) throw new Error('相遇碎片數值無效');
  economy.balance += receipt.amount;
  economy.dailyReceipt = { ...receipt };
  return true;
}
export function dailyEncounterMessage(economy, date) {
  if (economy?.dailyReceipt?.date === date) return '今日的相遇進度已存下 · +10 碎片';
  if (economy?.dailyReceipt?.date > date) return '今日日期早於上次紀錄，進度保留至日期恢復後繼續。';
  return '今天完成 1 個任務或習慣，即可累積 10 枚相遇碎片。';
}
