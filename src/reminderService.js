import { dbGet, dbMutateRecords, readAllStoresSnapshot, STORES } from './db.js';
import { RELEASE_PROFILE } from './releaseProfile.js';
import { REMINDER_DEFAULTS, projectReminderData } from './reminderRules.js';

export const REMINDER_KEY = 'dailyReminder';
let syncPromise = null;
const endpoint = () => RELEASE_PROFILE?.profile === 'production'
  ? 'https://questnote-reminders.werewolf-private-room-7e22.workers.dev'
  : ['localhost', '127.0.0.1'].includes(location.hostname) ? `${location.origin}/reminder-api` : null;
export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Taipei';
export async function getReminderState() {
  return await dbGet(STORES.META, REMINDER_KEY) || { key: REMINDER_KEY, enabled: false, revision: 0, settings: { ...REMINDER_DEFAULTS, timeZone: deviceTimeZone() } };
}
function updateState(reduce) {
  return dbMutateRecords([{ store: STORES.META, key: REMINDER_KEY }], ([raw]) => {
    const value = reduce(raw || { key: REMINDER_KEY, revision: 0, settings: { ...REMINDER_DEFAULTS, timeZone: deviceTimeZone() } });
    return { puts: [{ store: STORES.META, value }], result: value };
  });
}
function announce() { window.dispatchEvent(new Event('questnote-reminder-status')); }
export function reminderCapability() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && !navigator.standalone && !matchMedia('(display-mode: standalone)').matches) return '請先從瀏覽器分享選單「加入主畫面」，再從主畫面開啟 QuestNote 啟用通知。';
  if (!window.isSecureContext || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return '目前瀏覽器不支援背景通知，請使用新版 Safari 主畫面 App 或 Android Chrome。';
  if (!endpoint()) return '這是隔離預覽版；請在正式版啟用手機通知。';
  return '';
}
function base64Bytes(value) {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
}
async function api(path, options = {}, state = null) {
  const base = endpoint(); if (!base) throw new Error('請在正式版啟用每日提醒');
  const response = await fetch(`${base}${path}`, {
    ...options, cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', ...(state?.token ? { Authorization: `Bearer ${state.token}`, 'X-Installation-Id': state.installationId } : {}), ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || '提醒服務連線失敗'), { status: response.status });
  return data;
}
function locked(action) {
  return navigator.locks ? navigator.locks.request(`questnote-reminders-${location.pathname}`, action) : action();
}
export async function enableReminders(settings) {
  const problem = reminderCapability(); if (problem) throw new Error(problem);
  // Keep the permission request on the direct click's activation stack for iOS.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('尚未允許通知，請到系統設定開啟 QuestNote 通知');
  const registration = await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('App 更新尚未就緒，請關閉後重新開啟')), 15000))]);
  const { publicKey } = await api('/v1/push/public-key');
  const previous = await getReminderState();
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !previous.enabled) { await subscription.unsubscribe(); subscription = null; }
  if (subscription && subscription.options.applicationServerKey && Array.from(new Uint8Array(subscription.options.applicationServerKey)).join(',') !== Array.from(base64Bytes(publicKey)).join(',')) {
    await subscription.unsubscribe(); subscription = null;
  }
  subscription ||= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64Bytes(publicKey) });
  await locked(async () => {
    let state = await getReminderState();
    if (state.pendingDisable) await revokeInstallation(state);
    state = await getReminderState();
    if (!state.token) {
      const identity = await api('/v1/reminder-installations', { method: 'POST', body: '{}' });
      await updateState((s) => ({ ...s, ...identity }));
    }
    await updateState((s) => ({ ...s, enabled: true, pendingDisable: false, subscription: subscription.toJSON(),
      settings: { ...REMINDER_DEFAULTS, ...settings, timeZone: deviceTimeZone() }, revision: s.revision + 1, dirty: true, error: null, lastSyncedAt: null }));
  });
  await syncReminders();
  announce();
}
export async function saveReminderSettings(settings) {
  await updateState((s) => ({ ...s, settings: { ...REMINDER_DEFAULTS, ...settings, timeZone: deviceTimeZone() }, revision: s.revision + 1, dirty: true, error: null }));
  await syncReminders(); announce();
}
async function revokeInstallation(state) {
  if (state.token) {
    try { await api('/v1/reminder-installation/state', { method: 'DELETE' }, state); }
    catch (error) { if (error.status !== 401) throw error; }
  }
  await updateState((s) => ({ key: REMINDER_KEY, enabled: false, revision: s.revision + 1, settings: s.settings, dirty: false, pendingDisable: false }));
}
export async function disableReminders() {
  const state = await updateState((s) => ({ ...s, enabled: false, pendingDisable: !!s.token, revision: s.revision + 1 }));
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    const subscription = await registration?.pushManager?.getSubscription();
    if (subscription) await subscription.unsubscribe();
    await locked(() => revokeInstallation(state));
  } catch (error) {
    await updateState((s) => ({ ...s, error: '本機已關閉；雲端停用待確認，恢復連線後會重試。' }));
    throw error;
  } finally { announce(); }
}
async function performSync() {
  let state = await getReminderState();
  if (state.pendingDisable) { await revokeInstallation(state); announce(); return; }
  if (!state.enabled || !state.token) return;
  if (state.lastSyncedAt) {
    const status = await api('/v1/reminder-installation/status', {}, state);
    if (!status.enabled) {
      await updateState((s) => ({ ...s, enabled: false, error: '推播訂閱已失效，請重新啟用每日提醒。' }));
      announce(); return;
    }
  }
  // Advance the projection revision even on a foreground refresh: retained habit dates can change across days.
  await updateState((s) => ({ ...s, revision: s.revision + 1, dirty: true }));
  if (state.settings.timeZone !== deviceTimeZone()) {
    await updateState((s) => ({ ...s, settings: { ...s.settings, timeZone: deviceTimeZone() }, revision: s.revision + 1, dirty: true }));
  }
  const snapshot = await readAllStoresSnapshot();
  state = snapshot.meta.find((item) => item.key === REMINDER_KEY);
  if (!state?.enabled) return;
  const projection = projectReminderData(snapshot.tasks, snapshot.habits, state.settings);
  const result = await api('/v1/reminder-installation/state', { method: 'PUT', body: JSON.stringify({ revision: state.revision, settings: state.settings, subscription: state.subscription, ...projection }) }, state);
  await updateState((s) => ({ ...s, dirty: s.revision !== result.revision, lastSyncedAt: result.syncedAt, nextAt: result.nextAt, error: null }));
  const latest = await getReminderState();
  if (latest.dirty && latest.enabled) setTimeout(() => { void syncReminders().catch(() => {}); }, 1000);
  announce();
}
export function syncReminders() {
  if (!syncPromise) syncPromise = locked(performSync).catch(async (error) => {
    await updateState((s) => ({ ...s, error: error.message, ...(error.status === 401 ? { enabled: false, token: null, installationId: null } : {}) }));
    announce(); throw error;
  }).finally(() => { syncPromise = null; });
  return syncPromise;
}
export async function testReminder() {
  await syncReminders();
  return api('/v1/reminder-installation/test', { method: 'POST', body: '{}' }, await getReminderState());
}
export async function getReminderServerStatus() {
  const state = await getReminderState(); if (!state.token || !state.enabled) return null;
  return api('/v1/reminder-installation/status', {}, state);
}
