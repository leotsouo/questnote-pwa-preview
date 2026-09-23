/**
 * 習慣追蹤服務 — CRUD、完成紀錄、獎勵、統計與 streak
 */
import { dbGetAll, dbPut, dbGet, dbDelete, STORES } from './db.js';
import { getTodayDateString } from './taskFilterService.js';
import { addStardust, addAdventureEnergy } from './rewardService.js';
import { addBondExpToCompanion } from './collectionService.js';

export const DAILY_STARDUST_REWARD = 5;
export const DAILY_STARDUST_CAP = 30;
export const DAILY_BOND_CAP = 10;
export const WEEKLY_ENERGY_REWARD = 3;

/**
 * 取得週一日期字串（週一至週日為一週）
 * @param {string} [dateStr] YYYY-MM-DD
 */
export function getWeekMonday(dateStr = getTodayDateString()) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return getTodayDateString(d);
}

/** 週獎勵紀錄用的 log key */
export function weekRewardKey(mondayStr) {
  return `week_${mondayStr}`;
}

/** 正規化單筆習慣 */
export function normalizeHabit(habit) {
  if (!habit) return null;
  return {
    id: habit.id,
    name: habit.name || '',
    description: habit.description || '',
    frequency: habit.frequency === 'weekly' ? 'weekly' : 'daily',
    targetPerWeek:
      habit.frequency === 'weekly'
        ? Math.min(7, Math.max(1, habit.targetPerWeek ?? 1))
        : null,
    categoryId: habit.categoryId || 'general',
    isActive: habit.isActive !== false,
    createdAt: habit.createdAt || new Date().toISOString(),
    updatedAt: habit.updatedAt || new Date().toISOString(),
    archivedAt: habit.archivedAt ?? null,
    logs: habit.logs && typeof habit.logs === 'object' ? { ...habit.logs } : {},
  };
}

/** 取得所有習慣 */
export async function getAllHabits() {
  const rows = await dbGetAll(STORES.HABITS);
  return rows.map(normalizeHabit).filter(Boolean);
}

/** 依 ID 取得習慣 */
export async function getHabitById(id) {
  const row = await dbGet(STORES.HABITS, id);
  return normalizeHabit(row);
}

/** 儲存習慣 */
async function saveHabit(habit) {
  const normalized = normalizeHabit(habit);
  normalized.updatedAt = new Date().toISOString();
  await dbPut(STORES.HABITS, normalized);
  return normalized;
}

/**
 * 初始化 habits store（migration）
 * @returns {{ success: boolean, error?: string }}
 */
export async function initHabits() {
  try {
    const habits = await getAllHabits();
    return { success: true, count: habits.length };
  } catch (err) {
    console.error('[QuestNote] 習慣資料初始化失敗:', err);
    return { success: false, error: err.message };
  }
}

/** 建立習慣 */
export async function createHabit({ name, description, frequency, targetPerWeek, categoryId }) {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    return { success: false, error: '習慣名稱不可空白' };
  }

  const freq = frequency === 'weekly' ? 'weekly' : 'daily';
  let target = null;
  if (freq === 'weekly') {
    const t = Number(targetPerWeek);
    if (!Number.isInteger(t) || t < 1 || t > 7) {
      return { success: false, error: '每週目標必須為 1～7' };
    }
    target = t;
  }

  const now = new Date().toISOString();
  const habit = normalizeHabit({
    id: `habit_${Date.now()}`,
    name: trimmed,
    description: (description || '').trim(),
    frequency: freq,
    targetPerWeek: target,
    categoryId: categoryId || 'general',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    logs: {},
  });

  await saveHabit(habit);
  return { success: true, habit };
}

/** 編輯習慣（保留 logs） */
export async function updateHabit(id, { name, description, frequency, targetPerWeek, categoryId }) {
  const existing = await getHabitById(id);
  if (!existing) return { success: false, error: '習慣不存在' };
  if (existing.archivedAt) return { success: false, error: '已封存的習慣無法編輯' };

  const trimmed = (name || '').trim();
  if (!trimmed) return { success: false, error: '習慣名稱不可空白' };

  const freq = frequency === 'weekly' ? 'weekly' : 'daily';
  let target = null;
  if (freq === 'weekly') {
    const t = Number(targetPerWeek);
    if (!Number.isInteger(t) || t < 1 || t > 7) {
      return { success: false, error: '每週目標必須為 1～7' };
    }
    target = t;
  }

  const habit = {
    ...existing,
    name: trimmed,
    description: (description || '').trim(),
    frequency: freq,
    targetPerWeek: target,
    categoryId: categoryId || 'general',
    logs: existing.logs,
  };

  await saveHabit(habit);
  return { success: true, habit };
}

/** 封存習慣（不刪除 logs） */
export async function archiveHabit(id) {
  const existing = await getHabitById(id);
  if (!existing) return { success: false, error: '習慣不存在' };

  existing.isActive = false;
  existing.archivedAt = new Date().toISOString();
  await saveHabit(existing);
  return { success: true, habit: existing };
}

/** 判斷 log 是否為日期紀錄（非週獎勵 key） */
function isDateLogKey(key) {
  return /^\d{4}-\d{2}-\d{2}$/.test(key);
}

/** 取得習慣在指定週內的完成次數 */
export function getWeeklyCompletionCount(habit, mondayStr = getWeekMonday()) {
  const logs = habit.logs || {};
  const monday = new Date(mondayStr + 'T12:00:00');
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const key = getTodayDateString(d);
    if (logs[key]?.completed) count++;
  }
  return count;
}

/** 本週是否已達標 */
export function isWeeklyGoalMet(habit, mondayStr = getWeekMonday()) {
  if (habit.frequency !== 'weekly') return false;
  const target = habit.targetPerWeek ?? 1;
  return getWeeklyCompletionCount(habit, mondayStr) >= target;
}

/** 本週達標獎勵是否已領 */
export function isWeeklyRewardClaimed(habit, mondayStr = getWeekMonday()) {
  const key = weekRewardKey(mondayStr);
  return !!(habit.logs?.[key]?.weeklyRewardClaimed);
}

/** 今日是否已完成 */
export function isCompletedToday(habit, today = getTodayDateString()) {
  return !!(habit.logs?.[today]?.completed);
}

/** 計算今日已領習慣星塵（跨所有習慣） */
export function countTodayStardustClaimed(habits, today = getTodayDateString()) {
  let total = 0;
  for (const h of habits) {
    const log = h.logs?.[today];
    if (log?.rewardClaimed && log?.stardustGiven) {
      total += log.stardustGiven;
    }
  }
  return total;
}

/** 計算今日已給親密度（跨所有習慣） */
export function countTodayBondGiven(habits, today = getTodayDateString()) {
  let total = 0;
  for (const h of habits) {
    const log = h.logs?.[today];
    if (log?.bondGiven) total += log.bondGiven;
  }
  return total;
}

/** 累積完成次數（所有日期 log） */
export function countTotalHabitLogs(habits) {
  let total = 0;
  for (const h of habits) {
    const logs = h.logs || {};
    for (const key of Object.keys(logs)) {
      if (isDateLogKey(key) && logs[key]?.completed) total++;
    }
  }
  return total;
}

/**
 * 計算每日習慣 streak
 * 今天未完成時，顯示到昨天的連續天數
 */
export function calculateDailyStreak(habit, today = getTodayDateString()) {
  if (habit.frequency !== 'daily') return 0;
  const logs = habit.logs || {};

  let streak = 0;
  let cursor = new Date(today + 'T12:00:00');

  if (!logs[today]?.completed) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (true) {
    const key = getTodayDateString(cursor);
    if (logs[key]?.completed) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/**
 * 計算每週習慣連續達標週數
 */
export function calculateWeeklyStreak(habit, today = getTodayDateString()) {
  if (habit.frequency !== 'weekly') return 0;

  let streak = 0;
  let monday = getWeekMonday(today);
  const currentMonday = monday;

  if (!isWeeklyGoalMet(habit, monday)) {
    const d = new Date(monday + 'T12:00:00');
    d.setDate(d.getDate() - 7);
    monday = getTodayDateString(d);
  }

  while (monday <= currentMonday) {
    if (isWeeklyGoalMet(habit, monday)) {
      streak++;
      const d = new Date(monday + 'T12:00:00');
      d.setDate(d.getDate() - 7);
      monday = getTodayDateString(d);
    } else {
      break;
    }
  }
  return streak;
}

/** 取得習慣 streak（依頻率） */
export function getHabitStreak(habit, today = getTodayDateString()) {
  if (habit.frequency === 'weekly') return calculateWeeklyStreak(habit, today);
  return calculateDailyStreak(habit, today);
}

/** streak 顯示文字 */
export function formatStreakLabel(habit, streak) {
  if (streak <= 0) return '';
  if (habit.frequency === 'weekly') return `連續 ${streak} 週`;
  return `連續 ${streak} 天`;
}

/** 活躍習慣（未封存） */
export function getActiveHabits(habits) {
  return habits.filter((h) => h.isActive && !h.archivedAt);
}

/** 已封存習慣 */
export function getArchivedHabits(habits) {
  return habits.filter((h) => !h.isActive || h.archivedAt);
}

/** 今日需完成的習慣 */
export function getTodayHabits(habits, today = getTodayDateString()) {
  const active = getActiveHabits(habits);
  const monday = getWeekMonday(today);
  return active.filter((h) => {
    if (h.frequency === 'daily') return true;
    if (h.frequency === 'weekly') {
      return !isWeeklyGoalMet(h, monday);
    }
    return false;
  });
}

/** 本週每週習慣列表 */
export function getWeeklyHabits(habits) {
  return getActiveHabits(habits).filter((h) => h.frequency === 'weekly');
}

/** 是否有習慣本週只差 1 次達標 */
export function hasWeeklyNearGoal(habits, today = getTodayDateString()) {
  const monday = getWeekMonday(today);
  return getWeeklyHabits(habits).some((h) => {
    const count = getWeeklyCompletionCount(h, monday);
    const target = h.targetPerWeek ?? 1;
    return count === target - 1 && count < target;
  });
}

/** 任一習慣 streak >= n */
export function hasAnyDailyStreak(habits, minDays, today = getTodayDateString()) {
  return getActiveHabits(habits).some(
    (h) => h.frequency === 'daily' && calculateDailyStreak(h, today) >= minDays
  );
}

/**
 * 習慣頁統計資料
 */
export function getHabitPageStats(habits, today = getTodayDateString()) {
  const active = getActiveHabits(habits);
  const todayHabits = getTodayHabits(habits, today);
  const todayTotal = todayHabits.length;
  const todayCompleted = todayHabits.filter((h) => isCompletedToday(h, today)).length;

  const monday = getWeekMonday(today);
  let weekSlots = 0;
  let weekDone = 0;
  for (const h of active) {
    if (h.frequency === 'daily') {
      weekSlots += 7;
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday + 'T12:00:00');
        d.setDate(d.getDate() + i);
        const key = getTodayDateString(d);
        if (h.logs?.[key]?.completed) weekDone++;
      }
    } else {
      weekSlots += h.targetPerWeek ?? 1;
      weekDone += Math.min(getWeeklyCompletionCount(h, monday), h.targetPerWeek ?? 1);
    }
  }
  const weekCompletionRate = weekSlots > 0 ? Math.round((weekDone / weekSlots) * 100) : 0;

  let maxStreak = 0;
  for (const h of active) {
    if (h.frequency === 'daily') {
      const s = calculateDailyStreak(h, today);
      if (s > maxStreak) maxStreak = s;
    }
  }

  const todayStardust = countTodayStardustClaimed(habits, today);
  const todayBond = countTodayBondGiven(habits, today);

  const weeklyGoalsMet = getWeeklyHabits(habits).filter((h) =>
    isWeeklyGoalMet(h, monday)
  ).length;

  const allTodayDone = todayTotal > 0 && todayCompleted === todayTotal;
  const hasIncompleteToday = todayTotal > 0 && todayCompleted < todayTotal;

  return {
    todayTotal,
    todayCompleted,
    weekCompletionRate,
    maxStreak,
    todayStardust,
    todayBond,
    weeklyGoalsMet,
    allTodayDone,
    hasIncompleteToday,
    hasHabits: habits.length > 0,
    activeCount: active.length,
  };
}

/**
 * 完成今日習慣
 */
export async function completeHabitToday(id, today = getTodayDateString()) {
  const habit = await getHabitById(id);
  if (!habit) return { success: false, error: '習慣不存在' };
  if (!habit.isActive || habit.archivedAt) {
    return { success: false, error: '已封存的習慣無法完成' };
  }

  const logs = { ...habit.logs };
  const existing = logs[today];

  if (existing?.completed) {
    return { success: false, error: '今日已完成' };
  }

  const alreadyClaimedReward = existing?.rewardClaimed === true;

  const allHabits = await getAllHabits();
  const todayStardustSoFar = countTodayStardustClaimed(allHabits, today);
  const todayBondSoFar = countTodayBondGiven(allHabits, today);

  let stardustGiven = 0;
  let bondGiven = 0;
  let energyGiven = 0;
  let rewardClaimed = false;
  let stardustCapped = false;

  const logEntry = {
    completed: true,
    completedAt: new Date().toISOString(),
    rewardClaimed: false,
    stardustGiven: 0,
    bondGiven: 0,
  };

  if (habit.frequency === 'daily') {
    if (alreadyClaimedReward) {
      logEntry.rewardClaimed = true;
      logEntry.stardustGiven = existing.stardustGiven || 0;
    } else if (todayStardustSoFar < DAILY_STARDUST_CAP) {
      stardustGiven = DAILY_STARDUST_REWARD;
      await addStardust(stardustGiven);
      logEntry.rewardClaimed = true;
      logEntry.stardustGiven = stardustGiven;
      rewardClaimed = true;
    } else {
      stardustCapped = true;
    }
  }

  if (todayBondSoFar < DAILY_BOND_CAP && !existing?.bondGiven) {
    bondGiven = 1;
    try {
      await addBondExpToCompanion(1);
      logEntry.bondGiven = bondGiven;
    } catch {
      bondGiven = 0;
      logEntry.bondGiven = 0;
    }
  } else if (existing?.bondGiven) {
    logEntry.bondGiven = existing.bondGiven;
  }

  logs[today] = logEntry;

  if (habit.frequency === 'weekly') {
    const monday = getWeekMonday(today);
    if (isWeeklyGoalMet({ ...habit, logs }, monday) && !isWeeklyRewardClaimed(habit, monday)) {
      const wKey = weekRewardKey(monday);
      logs[wKey] = {
        weeklyRewardClaimed: true,
        weeklyGoalMet: true,
        claimedAt: new Date().toISOString(),
      };
      energyGiven = WEEKLY_ENERGY_REWARD;
      await addAdventureEnergy(energyGiven);
    }
  }

  habit.logs = logs;
  await saveHabit(habit);

  return {
    success: true,
    habit,
    stardustGiven,
    bondGiven,
    energyGiven,
    rewardClaimed,
    stardustCapped,
  };
}

/**
 * 取消今日完成（不退獎勵；保留 rewardClaimed 狀態）
 */
export async function uncompleteHabitToday(id, today = getTodayDateString()) {
  const habit = await getHabitById(id);
  if (!habit) return { success: false, error: '習慣不存在' };
  if (!habit.isActive || habit.archivedAt) {
    return { success: false, error: '已封存的習慣無法操作' };
  }

  const logs = { ...habit.logs };
  const existing = logs[today];
  if (!existing?.completed) {
    return { success: false, error: '今日尚未完成' };
  }

  const hadReward = existing.rewardClaimed;
  const hadStardust = existing.stardustGiven || 0;
  const hadBond = existing.bondGiven || 0;

  delete logs[today];

  if (hadReward || hadStardust > 0) {
    logs[today] = {
      completed: false,
      rewardClaimed: true,
      stardustGiven: hadStardust,
      bondGiven: hadBond,
      cancelledAt: new Date().toISOString(),
    };
  }

  habit.logs = logs;
  await saveHabit(habit);
  return { success: true, habit };
}

/** 匯出習慣（備份用） */
export async function exportHabits() {
  return getAllHabits();
}

/** 匯入習慣（備份還原用） */
export async function importHabits(habits) {
  if (!Array.isArray(habits)) return;
  for (const h of habits) {
    const normalized = normalizeHabit(h);
    if (normalized?.id) await dbPut(STORES.HABITS, normalized);
  }
}

/** 刪除單筆（僅重置用） */
export async function deleteHabit(id) {
  await dbDelete(STORES.HABITS, id);
}
