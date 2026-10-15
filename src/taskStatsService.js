/**
 * 任務相關成就統計 — 存於 meta store
 */
import { dbGet, dbPut, STORES } from './db.js';

const TASK_STATS_KEY = 'taskStats';

const DEFAULT_STATS = {
  key: TASK_STATS_KEY,
  hasPlannedTodayEver: false,
  hasCreatedSubtaskEver: false,
  subtasksCompletedTotal: 0,
  completedBeforeDueTotal: 0,
};

export function normalizeTaskStats(data) {
  if (!data) return { ...DEFAULT_STATS };
  return {
    key: TASK_STATS_KEY,
    hasPlannedTodayEver: data.hasPlannedTodayEver ?? false,
    hasCreatedSubtaskEver: data.hasCreatedSubtaskEver ?? false,
    subtasksCompletedTotal: data.subtasksCompletedTotal ?? 0,
    completedBeforeDueTotal: data.completedBeforeDueTotal ?? 0,
  };
}

export async function getTaskStats() {
  const data = await dbGet(STORES.META, TASK_STATS_KEY);
  return normalizeTaskStats(data);
}

async function saveTaskStats(stats) {
  await dbPut(STORES.META, stats);
  return stats;
}

export async function recordPlanToday() {
  const stats = await getTaskStats();
  if (stats.hasPlannedTodayEver) return stats;
  stats.hasPlannedTodayEver = true;
  return saveTaskStats(stats);
}

export async function recordSubtaskCreated() {
  const stats = await getTaskStats();
  if (stats.hasCreatedSubtaskEver) return stats;
  stats.hasCreatedSubtaskEver = true;
  return saveTaskStats(stats);
}

export async function recordSubtaskCompleted() {
  const stats = await getTaskStats();
  stats.subtasksCompletedTotal = (stats.subtasksCompletedTotal ?? 0) + 1;
  return saveTaskStats(stats);
}

export async function recordCompletedBeforeDue() {
  const stats = await getTaskStats();
  stats.completedBeforeDueTotal = (stats.completedBeforeDueTotal ?? 0) + 1;
  return saveTaskStats(stats);
}

/** 匯出（備份用） */
export async function exportTaskStats() {
  return getTaskStats();
}

/** 匯入（備份還原用） */
export async function importTaskStats(data) {
  const stats = normalizeTaskStats(data);
  return saveTaskStats(stats);
}
