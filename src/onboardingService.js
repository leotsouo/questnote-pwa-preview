/** First-use guide state. Kept in the local profile, outside exported backups. */
import { dbGet, dbPut, readAllStoresSnapshot, STORES } from './db.js';
import { LESSONS, getLesson, normalizeLessonProgress, nextLessonProgress } from './onboardingLessons.js';

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
  const lessons = Object.fromEntries(LESSONS.map((lesson) => [lesson.id,
    normalizeLessonProgress(raw?.lessons?.[lesson.id], lesson)]));
  const activeLesson = getLesson(raw?.activeLesson)?.id || null;
  // Only one chapter can own the coach. Repair interrupted or malformed records.
  for (const [id, progress] of Object.entries(lessons)) {
    if (progress.status === 'active' && id !== activeLesson) progress.status = 'paused';
  }
  return {
    key: ONBOARDING_KEY,
    schemaVersion: 2,
    status: activeLesson && raw?.status === 'active' ? 'paused'
      : STATUSES.has(raw?.status) ? raw.status : 'dismissed',
    step: ONBOARDING_STEPS.includes(raw?.step) ? raw.step : 'welcome',
    taskId: typeof raw?.taskId === 'string' ? raw.taskId : null,
    activeLesson: activeLesson && lessons[activeLesson].status === 'active' ? activeLesson : null,
    lessons,
  };
}

/** Called immediately after openDB(), before normal startup creates default meta records. */
export async function prepareOnboarding() {
  const stored = await dbGet(STORES.META, ONBOARDING_KEY);
  if (stored) {
    const record = normalizeOnboardingState(stored);
    if (stored.schemaVersion !== record.schemaVersion) await dbPut(STORES.META, record);
    return record;
  }

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
  if (record.activeLesson) {
    const lesson = getLesson(record.activeLesson);
    const progress = record.lessons[lesson.id];
    if (lesson.practice[progress.step] === event) return advanceLesson(record, true);
    return record;
  }
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

export function startLesson(raw, id) {
  const record = pauseLesson(raw);
  const lesson = getLesson(id);
  if (!lesson) return record;
  const previous = record.lessons[id];
  const step = ['understood', 'practiced'].includes(previous.status) ? lesson.steps[0] : previous.step;
  return { ...record, status: ['new', 'active'].includes(record.status) ? 'paused' : record.status,
    activeLesson: id, lessons: { ...record.lessons, [id]: { ...previous, status: 'active', step } } };
}

export function pauseLesson(raw) {
  const record = normalizeOnboardingState(raw);
  if (!record.activeLesson) return record;
  const id = record.activeLesson;
  return { ...record, activeLesson: null,
    lessons: { ...record.lessons, [id]: { ...record.lessons[id], status: 'paused' } } };
}

export function advanceLesson(raw, practiced = false) {
  const record = normalizeOnboardingState(raw);
  const lesson = getLesson(record.activeLesson);
  if (!lesson) return record;
  const progress = nextLessonProgress(record.lessons[lesson.id], lesson, practiced);
  return { ...record, activeLesson: progress.status === 'active' ? lesson.id : null,
    lessons: { ...record.lessons, [lesson.id]: progress } };
}

export function previousLessonStep(raw) {
  const record = normalizeOnboardingState(raw);
  const lesson = getLesson(record.activeLesson);
  if (!lesson) return record;
  const progress = record.lessons[lesson.id];
  const step = lesson.steps[Math.max(0, lesson.steps.indexOf(progress.step) - 1)];
  return { ...record, lessons: { ...record.lessons, [lesson.id]: { ...progress, step } } };
}
