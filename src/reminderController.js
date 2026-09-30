import { trackUpdateActivity } from './updateActivity.js';
import { getReminderState, reminderCapability, enableReminders, saveReminderSettings, disableReminders, syncReminders, testReminder, getReminderServerStatus } from './reminderService.js';
import { zonedParts, shiftDate } from './reminderRules.js';

let initialized = false;
let timer;
const $ = (id) => document.getElementById(id);
function renderPreview() {
  const names = $('reminder-titles').checked;
  const tasks = $('reminder-tasks').checked;
  const habits = $('reminder-habits').checked;
  const lines = [`今天有 ${tasks ? 3 : 0} 項任務、${habits ? 2 : 0} 項每日習慣。`];
  if (habits && $('reminder-weekly').checked) lines.push('1 項本週習慣尚未達標。');
  if ($('reminder-overdue').checked && tasks) lines.push('另有 1 項逾期待處理。');
  if (names && (tasks || habits)) lines.push([...(tasks ? ['閱讀', '整理書桌'] : []), ...(habits ? ['散步'] : [])].join('、'));
  $('reminder-preview-body').textContent = lines.join('\n');
}
function nextReminderLabel(at, timeZone) {
  const today = zonedParts(Date.now(), timeZone).date;
  const next = zonedParts(at, timeZone);
  const day = next.date === today ? '今天' : next.date === shiftDate(today, 1) ? '明天' : new Date(at).toLocaleDateString('zh-TW', { timeZone, month: 'numeric', day: 'numeric' });
  return `${day} ${next.time}`;
}
function settings() {
  return { time: $('reminder-time').value || '08:00', tasks: $('reminder-tasks').checked, habits: $('reminder-habits').checked,
    weekly: $('reminder-weekly').checked, overdue: $('reminder-overdue').checked, showTitles: $('reminder-titles').checked };
}
export async function renderReminderSettings() {
  const state = await getReminderState();
  if (!$('reminder-status')) return;
  if (!$('reminder-form').contains(document.activeElement)) {
    $('reminder-time').value = state.settings.time;
    for (const [id, key] of [['tasks', 'tasks'], ['habits', 'habits'], ['weekly', 'weekly'], ['overdue', 'overdue'], ['titles', 'showTitles']]) $('reminder-' + id).checked = state.settings[key];
  }
  $('reminder-enable').textContent = state.enabled ? '重新啟用通知' : '啟用每日提醒';
  $('reminder-disable').hidden = !state.enabled && !state.pendingDisable;
  $('reminder-test').hidden = !state.enabled;
  const permission = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  $('reminder-enable').hidden = state.enabled && permission === 'granted';
  $('reminder-save').dataset.primary = String(state.enabled && permission === 'granted');
  $('reminder-save').textContent = state.enabled ? '儲存提醒設定' : '儲存提醒偏好';
  $('reminder-consent-label').hidden = state.enabled;
  $('reminder-privacy-receipt').hidden = !state.enabled;
  if (state.enabled) $('reminder-consent').checked = true;
  $('reminder-delivery').hidden = !state.enabled && !state.pendingDisable;
  const status = state.pendingDisable ? '本機已關閉，雲端停用待確認' : !state.enabled ? '尚未啟用' : permission !== 'granted' ? '系統通知權限已關閉' : state.error ? '已儲存在本機，提醒資料待同步' : state.dirty ? '提醒資料待同步' : '每日提醒已啟用';
  $('reminder-status').textContent = status;
  $('reminder-status').dataset.state = state.pendingDisable || state.error || state.dirty || (state.enabled && permission !== 'granted') ? 'pending' : state.enabled ? 'on' : 'off';
  $('reminder-hint').textContent = state.error || reminderCapability() || '關閉 App 也能接收通知；離線修改請先恢復連線同步。手機系統可能延後顯示通知。';
  const timeZone = state.settings.timeZone;
  const offset = new Intl.DateTimeFormat('zh-TW', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(Date.now()).find((part) => part.type === 'timeZoneName')?.value || '';
  $('reminder-timezone').textContent = `${timeZone === 'Asia/Taipei' ? '台北時間' : timeZone} · ${offset}`;
  $('reminder-next').textContent = state.nextAt && state.enabled ? nextReminderLabel(state.nextAt, timeZone) : '等待同步';
  $('reminder-synced').textContent = state.lastSyncedAt ? `最後同步 ${new Date(state.lastSyncedAt).toLocaleString('zh-TW', { timeZone, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}` : '尚未同步';
  renderPreview();
}
export function initReminders({ openToday }) {
  if (initialized) return; initialized = true;
  const form = $('reminder-form'); if (!form) return;
  form.addEventListener('change', renderPreview);
  const feedback = (message) => { $('reminder-result').textContent = message; };
  const run = trackUpdateActivity(async (button, action, success) => {
    button.disabled = true;
    try { await action(); feedback(success); } catch (error) { feedback(error.message); }
    finally { button.disabled = false; await renderReminderSettings(); }
  });
  $('reminder-enable').addEventListener('click', (event) => {
    if (!$('reminder-consent').checked) { feedback('請先勾選允許同步提醒所需的資料。'); return; }
    void run(event.currentTarget, () => enableReminders(settings()), '已啟用每日提醒。可發送測試通知確認手機收件。');
  });
  form.addEventListener('submit', (event) => { event.preventDefault(); void run($('reminder-save'), () => saveReminderSettings(settings()), '提醒設定已儲存。'); });
  $('reminder-disable').addEventListener('click', (event) => { void run(event.currentTarget, disableReminders, '每日提醒已關閉，雲端提醒資料已刪除。'); });
  $('reminder-test').addEventListener('click', (event) => { void run(event.currentTarget, testReminder, '推播服務已接受測試通知，請查看手機通知中心。'); });
  $('reminder-sync').addEventListener('click', (event) => { void run(event.currentTarget, syncReminders, '提醒資料已同步。'); });
  $('reminder-open-today').addEventListener('click', openToday);
  window.addEventListener('questnote-reminder-status', () => { void renderReminderSettings(); });
  const queueSync = () => {
    clearTimeout(timer); timer = setTimeout(() => { void syncReminders().catch(() => {}); }, 500);
  };
  window.addEventListener('questnote-reminder-change', queueSync);
  window.addEventListener('online', queueSync);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) queueSync(); });
  navigator.serviceWorker?.addEventListener('message', (event) => { if (event.data?.type === 'questnote-open-today') openToday(); });
  const url = new URL(location.href);
  if (url.searchParams.get('reminder') === 'today') {
    url.searchParams.delete('reminder'); history.replaceState(null, '', url); setTimeout(openToday, 1000);
  }
  void renderReminderSettings();
  void syncReminders().then(async () => {
    const status = await getReminderServerStatus();
    if (status && !status.enabled) feedback('推播訂閱已失效，請重新啟用每日提醒。');
  }).catch(() => {});
}
