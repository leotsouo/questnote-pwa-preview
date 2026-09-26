/** First-use guide state. Kept in the local profile, outside exported backups. */
import { dbGet, dbPut, readAllStoresSnapshot, STORES } from './db.js';

export const ONBOARDING_KEY = 'onboardingV1';
export const ONBOARDING_STEPS = Object.freeze([
  'welcome',
  'task',
  'reward',
  'summon',
  'collection',
  'expedition',
]);

const STATUSES = new Set(['new', 'active', 'paused', 'dismissed', 'completed']);
const SNAPSHOT_STORES = ['tasks', 'meta', 'collection', 'expeditions', 'habits'];

export function isPristineOnboardingSnapshot(snapshot) {
  return SNAPSHOT_STORES.every((name) => Array.isArray(snapshot?.[name]) && snapshot[name].length === 0);
}

export function initialOnboardingStateForSnapshot(snapshot) {
  return normalizeOnboardingState({
    status: isPristineOnboardingSnapshot(snapshot) ? 'new' : 'dismissed',
    step: 'welcome',
  });
}

export function normalizeOnboardingState(raw) {
  return {
    key: ONBOARDING_KEY,
    schemaVersion: 1,
    status: STATUSES.has(raw?.status) ? raw.status : 'dismissed',
    step: ONBOARDING_STEPS.includes(raw?.step) ? raw.step : 'welcome',
    taskId: typeof raw?.taskId === 'string' ? raw.taskId : null,
  };
}

/** Called immediately after openDB(), before normal startup creates default meta records. */
export async function prepareOnboarding() {
  const stored = await dbGet(STORES.META, ONBOARDING_KEY);
  if (stored) return normalizeOnboardingState(stored);

  const snapshot = await readAllStoresSnapshot();
  const record = initialOnboardingStateForSnapshot(snapshot);
  await dbPut(STORES.META, record);
  return record;
}

export async function saveOnboardingState(raw) {
  const record = normalizeOnboardingState(raw);
  await dbPut(STORES.META, record);
  return record;
}

export async function resetOnboardingState() {
  return saveOnboardingState({ status: 'new', step: 'welcome', taskId: null });
}

/** Advance only after a successful product action. Manual "later" links are handled by the UI. */
export function advanceOnboardingForEvent(raw, event, detail = {}) {
  const record = normalizeOnboardingState(raw);
  if (record.status !== 'active') return record;

  if (record.step === 'task' && event === 'task-created' && typeof detail.taskId === 'string') {
    return { ...record, step: 'reward', taskId: detail.taskId };
  }
  if (record.step === 'reward' && !record.taskId && event === 'task-created'
    && typeof detail.taskId === 'string') {
    return { ...record, taskId: detail.taskId };
  }
  if (record.step === 'reward' && event === 'task-completed'
    && (!record.taskId || record.taskId === detail.taskId)) {
    return { ...record, step: 'summon' };
  }
  if (record.step === 'summon' && event === 'summon-completed') {
    return { ...record, step: 'collection' };
  }
  if (record.step === 'collection' && event === 'companion-set') {
    return { ...record, step: 'expedition' };
  }
  if (record.step === 'expedition' && event === 'expedition-started') {
    return { ...record, status: 'completed' };
  }
  return record;
}
