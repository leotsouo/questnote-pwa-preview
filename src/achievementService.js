/**
 * 成就與稱號系統 — 條件檢查、解鎖、領獎、稱號管理
 */
import { dbGet, dbPut, STORES } from './db.js';
import { getAllTasks } from './taskService.js';
import { getTaskStats } from './taskStatsService.js';
import { getGachaStats } from './gachaService.js';
import { getCollection } from './collectionService.js';
import { getAllExpeditions } from './expeditionService.js';
import {
  getAllHabits,
  countTotalHabitLogs,
  getWeeklyHabits,
  isWeeklyGoalMet,
  getWeekMonday,
  calculateDailyStreak,
} from './habitService.js';
import {
  addStardust,
  addAdventureEnergy,
  addMaterial,
  addInventoryItem,
} from './rewardService.js';
import { MATERIAL_LABELS } from './expeditionService.js';
import { getWorkshopStats } from './workshopService.js';
import { getTodayDateString, isCompletedToday, getLocalDateStringFromIso } from './taskFilterService.js';
import { getDailyCheckIn } from './dailyCheckInService.js';
import { getQuestProgress } from './questService.js';
import { getExplorationProgress, EXPLORATION_AREA_IDS } from './explorationService.js';

const ACHIEVEMENTS_KEY = 'achievements';

const DEFAULT_STATE = {
  key: ACHIEVEMENTS_KEY,
  unlockedAchievementIds: [],
  claimedAchievementIds: [],
  unlockedTitleIds: [],
  equippedTitleId: null,
  hasExportedBackup: false,
  unseenTitleIds: [],
};

/** 成就分類標籤 */
export const CATEGORY_LABELS = {
  task: '任務',
  gacha: '召喚',
  collection: '圖鑑',
  expedition: '探險',
  bond: '親密度',
  special: '特殊',
  habit: '習慣',
  workshop: '工坊',
  daily: '每日',
  quest: '冒險任務',
};

/** 成就分類圖示 */
export const CATEGORY_ICONS = {
  task: '✅',
  gacha: '✨',
  collection: '📖',
  expedition: '🧭',
  bond: '💠',
  special: '🏅',
  habit: '🔄',
  workshop: '🔨',
  daily: '🌙',
  quest: '🗺️',
};

/** @type {object[]|null} */
let achievementsCatalog = null;
/** @type {object[]|null} */
let titlesCatalog = null;
/** @type {Map<string, object>|null} */
let titleByAchievementId = null;

const claimingIds = new Set();
let claimingAll = false;

/**
 * 正規化成就狀態，補齊舊資料缺少的欄位
 */
export function normalizeAchievementsState(data) {
  if (!data) return { ...DEFAULT_STATE };
  return {
    key: ACHIEVEMENTS_KEY,
    unlockedAchievementIds: Array.isArray(data.unlockedAchievementIds)
      ? [...data.unlockedAchievementIds]
      : [],
    claimedAchievementIds: Array.isArray(data.claimedAchievementIds)
      ? [...data.claimedAchievementIds]
      : [],
    unlockedTitleIds: Array.isArray(data.unlockedTitleIds)
      ? [...data.unlockedTitleIds]
      : [],
    equippedTitleId: data.equippedTitleId ?? null,
    hasExportedBackup: data.hasExportedBackup ?? false,
    unseenTitleIds: Array.isArray(data.unseenTitleIds)
      ? [...data.unseenTitleIds]
      : [],
  };
}

/** 取得玩家成就狀態 */
export async function getAchievementsState() {
  const data = await dbGet(STORES.META, ACHIEVEMENTS_KEY);
  return normalizeAchievementsState(data);
}

/** 儲存玩家成就狀態 */
async function saveAchievementsState(state) {
  await dbPut(STORES.META, state);
  return state;
}

/** 初始化成就狀態（首次使用或遷移舊資料） */
export async function initAchievements() {
  const state = await getAchievementsState();
  await saveAchievementsState(state);
  return state;
}

/** 載入成就定義 */
export async function loadAchievementsCatalog() {
  if (achievementsCatalog) return achievementsCatalog;
  try {
    const res = await fetch('./data/achievements.json');
    if (!res.ok) throw new Error('無法載入成就資料');
    achievementsCatalog = await res.json();
    return achievementsCatalog;
  } catch (err) {
    console.warn('[QuestNote] 成就資料載入失敗:', err);
    achievementsCatalog = null;
    return null;
  }
}

/** 載入稱號定義 */
export async function loadTitlesCatalog() {
  if (titlesCatalog) return titlesCatalog;
  try {
    const res = await fetch('./data/titles.json');
    if (!res.ok) throw new Error('無法載入稱號資料');
    const data = await res.json();
    titlesCatalog = data.titles || [];
    titleByAchievementId = new Map(
      titlesCatalog.map((t) => [t.sourceAchievementId, t])
    );
    return titlesCatalog;
  } catch (err) {
    console.warn('[QuestNote] 稱號資料載入失敗:', err);
    titlesCatalog = null;
    titleByAchievementId = null;
    return null;
  }
}

/** 依稱號 ID 取得稱號 */
export function getTitleById(titleId, titles = titlesCatalog) {
  if (!titleId || !titles) return null;
  return titles.find((t) => t.id === titleId) ?? null;
}

/** 依成就 ID 取得對應稱號 */
export function getTitleForAchievement(achievementId) {
  if (!titleByAchievementId) return null;
  return titleByAchievementId.get(achievementId) ?? null;
}

/** 判斷任務是否已完成（含已領獎） */
function isTaskCompleted(task) {
  return task.completed || task.rewardClaimed;
}

/**
 * 建立成就條件計算用的上下文
 */
export async function buildAchievementContext(allPets = []) {
  const [tasks, gachaStats, collection, expeditions, achState, taskStats, habits, workshopStats, dailyCheckIn, questProgress, explorationProgress] = await Promise.all([
    getAllTasks(),
    getGachaStats(),
    getCollection(),
    getAllExpeditions(),
    getAchievementsState(),
    getTaskStats(),
    getAllHabits(),
    getWorkshopStats(),
    getDailyCheckIn(),
    getQuestProgress(),
    getExplorationProgress(),
  ]);

  const completedTasks = tasks.filter(isTaskCompleted);
  const today = getTodayDateString();
  const completedToday = completedTasks.filter((t) => isCompletedToday(t, today)).length;
  const completedUrgent = completedTasks.filter((t) => t.priority === 'urgent').length;

  const ownedPetIds = new Set(collection.map((c) => c.petId));
  const ownedPets = allPets.filter((p) => ownedPetIds.has(p.id));
  const hasUrPet = ownedPets.some((p) => p.rarity === 'UR');
  const maxBondLevel = collection.reduce(
    (max, c) => Math.max(max, c.bondLevel ?? 1),
    0
  );
  // V2.6.0 羈絆解放：已解放（Lv.5）寵物數量
  const bondLiberatedCount = collection.filter(
    (c) => c.bondUnlocks?.bondLiberated || (c.bondLevel ?? 1) >= 5
  ).length;

  const claimedExpeditions = expeditions.filter((e) => e.claimed);
  const expeditionAreaCounts = {};
  for (const exp of claimedExpeditions) {
    if (exp.areaId) {
      expeditionAreaCounts[exp.areaId] = (expeditionAreaCounts[exp.areaId] || 0) + 1;
    }
  }

  const activeDays = new Set(
    completedTasks
      .map((t) => getLocalDateStringFromIso(t.completedAt))
      .filter(Boolean)
  );

  const monday = getWeekMonday(today);
  const habitLogTotal = countTotalHabitLogs(habits);
  const maxDailyStreak = habits
    .filter((h) => h.frequency === 'daily')
    .reduce((max, h) => Math.max(max, calculateDailyStreak(h, today)), 0);
  const hasWeeklyGoalThisWeek = getWeeklyHabits(habits).some((h) =>
    isWeeklyGoalMet(h, monday)
  );
  const hasSetNickname = collection.some(
    (c) => typeof c.nickname === 'string' && c.nickname.trim()
  );

  // V2.7.0 探索地圖探索度
  const explorationAreas = explorationProgress?.areas || {};
  const explorationAreaValues = EXPLORATION_AREA_IDS.map(
    (id) => explorationAreas[id]?.progress ?? 0
  );
  const explorationAreaProgressMax = explorationAreaValues.length
    ? Math.max(...explorationAreaValues)
    : 0;
  const explorationAreasAt50 = explorationAreaValues.filter((p) => p >= 50).length;
  const explorationAreasAt100 = explorationAreaValues.filter((p) => p >= 100).length;
  const explorationMilestonesClaimedTotal = explorationProgress?.stats?.totalMilestonesClaimed ?? 0;

  return {
    completedTasksTotal: completedTasks.length,
    completedTasksToday: completedToday,
    completedUrgentTasksTotal: completedUrgent,
    totalPulls: gachaStats.totalPulls ?? 0,
    tenPullCount: gachaStats.tenPullCount ?? 0,
    hasUrPet,
    ownedPetCount: ownedPets.length,
    expeditionClaimedTotal: claimedExpeditions.length,
    expeditionAreaCounts,
    maxBondLevel,
    bondLiberatedCount,
    activeDaysWithTasks: activeDays.size,
    hasExportedBackup: achState.hasExportedBackup ?? false,
    hasPlannedTodayEver: taskStats.hasPlannedTodayEver ?? false,
    hasCreatedSubtaskEver: taskStats.hasCreatedSubtaskEver ?? false,
    subtasksCompletedTotal: taskStats.subtasksCompletedTotal ?? 0,
    completedBeforeDueTotal: taskStats.completedBeforeDueTotal ?? 0,
    habitCount: habits.length,
    habitLogTotal,
    maxDailyHabitStreak: maxDailyStreak,
    hasWeeklyHabitGoal: hasWeeklyGoalThisWeek,
    craftCount: workshopStats.craftCount ?? 0,
    giftCount: workshopStats.giftCount ?? 0,
    favoriteGiftCount: workshopStats.favoriteGiftCount ?? 0,
    hasSetNickname,
    totalCheckIns: dailyCheckIn.totalCheckIns ?? 0,
    checkInStreak: Math.max(dailyCheckIn.streak ?? 0, dailyCheckIn.bestStreak ?? 0),
    totalWheelSpins: dailyCheckIn.totalWheelSpins ?? 0,
    totalDailyQuestsClaimed: questProgress?.stats?.totalDailyQuestsClaimed ?? 0,
    totalWeeklyQuestsClaimed: questProgress?.stats?.totalWeeklyQuestsClaimed ?? 0,
    explorationMilestonesClaimedTotal,
    explorationAreaProgressMax,
    explorationAreasAt50,
    explorationAreasAt100,
  };
}

/**
 * 計算單一成就的目前進度值
 */
export function getAchievementProgress(achievement, context) {
  switch (achievement.conditionType) {
    case 'completed_tasks_total':
      return context.completedTasksTotal;
    case 'completed_tasks_today':
      return context.completedTasksToday;
    case 'completed_urgent_tasks_total':
      return context.completedUrgentTasksTotal;
    case 'gacha_total_pulls':
      return context.totalPulls;
    case 'gacha_ten_pull_count':
      return context.tenPullCount;
    case 'has_ur_pet':
      return context.hasUrPet ? 1 : 0;
    case 'collection_owned_count':
      return context.ownedPetCount;
    case 'expedition_claimed_total':
      return context.expeditionClaimedTotal;
    case 'expedition_area_claimed':
      return context.expeditionAreaCounts[achievement.areaId] || 0;
    case 'bond_level_max':
      return context.maxBondLevel;
    case 'bond_badge_unlocked':
      return context.maxBondLevel >= 3 ? 1 : 0;
    case 'bond_liberated_count':
      return context.bondLiberatedCount;
    case 'active_days_with_tasks':
      return context.activeDaysWithTasks;
    case 'has_exported_backup':
      return context.hasExportedBackup ? 1 : 0;
    case 'first_plan_today':
      return context.hasPlannedTodayEver ? 1 : 0;
    case 'first_subtask_created':
      return context.hasCreatedSubtaskEver ? 1 : 0;
    case 'subtasks_completed_total':
      return context.subtasksCompletedTotal;
    case 'completed_before_due_total':
      return context.completedBeforeDueTotal;
    case 'create_first_habit':
      return context.habitCount >= 1 ? 1 : 0;
    case 'complete_first_habit':
      return context.habitLogTotal >= 1 ? 1 : 0;
    case 'habit_streak_7':
      return context.maxDailyHabitStreak;
    case 'habit_streak_30':
      return context.maxDailyHabitStreak;
    case 'weekly_habit_goal':
      return context.hasWeeklyHabitGoal ? 1 : 0;
    case 'complete_50_habit_logs':
      return context.habitLogTotal;
    case 'craft_count':
      return context.craftCount;
    case 'gift_count':
      return context.giftCount;
    case 'favorite_gift_count':
      return context.favoriteGiftCount;
    case 'first_nickname_set':
      return context.hasSetNickname ? 1 : 0;
    case 'check_in_total':
      return context.totalCheckIns;
    case 'check_in_streak':
      return context.checkInStreak;
    case 'wheel_spin_total':
      return context.totalWheelSpins;
    case 'quest_daily_claimed_total':
      return context.totalDailyQuestsClaimed;
    case 'quest_weekly_claimed_total':
      return context.totalWeeklyQuestsClaimed;
    case 'exploration_milestone_claimed_total':
      return context.explorationMilestonesClaimedTotal;
    case 'exploration_area_progress_max':
      return context.explorationAreaProgressMax;
    case 'exploration_areas_at_50':
      return context.explorationAreasAt50;
    case 'exploration_areas_at_100':
      return context.explorationAreasAt100;
    default:
      return 0;
  }
}

/** 判斷成就是否已達成條件 */
export function isAchievementMet(achievement, context) {
  const progress = getAchievementProgress(achievement, context);
  return progress >= (achievement.target ?? 1);
}

/**
 * 檢查並解鎖新成就
 * @returns {{ newlyUnlocked: object[], newTitles: object[], state: object }}
 */
export async function checkAndUnlockAchievements(allPets = []) {
  const catalog = await loadAchievementsCatalog();
  await loadTitlesCatalog();

  const state = await getAchievementsState();
  if (!catalog || catalog.length === 0) {
    return { newlyUnlocked: [], newTitles: [], state };
  }

  const context = await buildAchievementContext(allPets);
  const unlockedSet = new Set(state.unlockedAchievementIds);
  const titleSet = new Set(state.unlockedTitleIds);
  const newlyUnlocked = [];
  const newTitles = [];

  for (const achievement of catalog) {
    if (unlockedSet.has(achievement.id)) continue;
    if (!isAchievementMet(achievement, context)) continue;

    unlockedSet.add(achievement.id);
    newlyUnlocked.push(achievement);

    const title = getTitleForAchievement(achievement.id);
    if (title && !titleSet.has(title.id)) {
      titleSet.add(title.id);
      state.unseenTitleIds = state.unseenTitleIds || [];
      if (!state.unseenTitleIds.includes(title.id)) {
        state.unseenTitleIds.push(title.id);
      }
      newTitles.push(title);
    }
  }

  if (newlyUnlocked.length > 0) {
    state.unlockedAchievementIds = [...unlockedSet];
    state.unlockedTitleIds = [...titleSet];
    await saveAchievementsState(state);
  }

  return { newlyUnlocked, newTitles, state };
}

/** 標記稱號為已查看（清除新稱號提示） */
export async function markTitlesSeen() {
  const state = await getAchievementsState();
  if (!state.unseenTitleIds?.length) return state;
  state.unseenTitleIds = [];
  await saveAchievementsState(state);
  return state;
}

/** 標記已匯出備份 */
export async function markExportedBackup() {
  const state = await getAchievementsState();
  if (state.hasExportedBackup) return state;
  state.hasExportedBackup = true;
  await saveAchievementsState(state);
  return state;
}

/** 成就道具獎勵顯示名稱（少量，避免額外載入 craftables） */
const REWARD_ITEM_LABELS = {
  item_stardust_candy: '星塵糖果',
};

/** 格式化成就獎勵文字 */
export function formatAchievementReward(reward) {
  if (!reward) return '無';
  const parts = [];
  if (reward.stardust > 0) parts.push(`星塵 +${reward.stardust}`);
  if (reward.adventureEnergy > 0) parts.push(`冒險能量 +${reward.adventureEnergy}`);
  if (reward.materials) {
    for (const [id, amt] of Object.entries(reward.materials)) {
      if (amt > 0) {
        parts.push(`${MATERIAL_LABELS[id] || id} +${amt}`);
      }
    }
  }
  if (reward.items) {
    for (const [id, amt] of Object.entries(reward.items)) {
      if (amt > 0) {
        parts.push(`${REWARD_ITEM_LABELS[id] || id} +${amt}`);
      }
    }
  }
  return parts.length > 0 ? parts.join('、') : '無';
}

/**
 * 領取成就獎勵
 * @returns {{ success: boolean, achievement?: object, error?: string }}
 */
export async function claimAchievementReward(achievementId) {
  if (claimingAll) {
    return { success: false, error: '正在批次領取成就，請稍候' };
  }
  if (claimingIds.has(achievementId)) {
    return { success: false, error: '正在領取中，請稍候' };
  }

  claimingIds.add(achievementId);

  try {
    const catalog = await loadAchievementsCatalog();
    const achievement = catalog?.find((a) => a.id === achievementId);
    if (!achievement) {
      return { success: false, error: '成就不存在' };
    }

    const state = await getAchievementsState();

    if (!state.unlockedAchievementIds.includes(achievementId)) {
      return { success: false, error: '成就尚未達成' };
    }

    if (state.claimedAchievementIds.includes(achievementId)) {
      return { success: false, error: '獎勵已領取' };
    }

    const reward = achievement.reward || {};
    try {
      if (reward.stardust > 0) await addStardust(reward.stardust);
      if (reward.adventureEnergy > 0) await addAdventureEnergy(reward.adventureEnergy);
      if (reward.materials) {
        for (const [id, amt] of Object.entries(reward.materials)) {
          if (amt > 0) await addMaterial(id, amt);
        }
      }
      if (reward.items) {
        for (const [id, amt] of Object.entries(reward.items)) {
          if (amt > 0) await addInventoryItem(id, amt);
        }
      }
    } catch (err) {
      return { success: false, error: err.message || '獎勵發放失敗' };
    }

    state.claimedAchievementIds = [...state.claimedAchievementIds, achievementId];
    await saveAchievementsState(state);

    return { success: true, achievement };
  } finally {
    claimingIds.delete(achievementId);
  }
}

/**
 * 一鍵領取所有可領取成就
 * @param {object[]} [allPets]
 * @returns {{ success: boolean, count?: number, achievements?: object[], rewards?: object, error?: string }}
 */
export async function claimAllAchievementRewards(allPets = []) {
  if (claimingAll) {
    return { success: false, error: '正在領取中，請稍候' };
  }
  if (claimingIds.size > 0) {
    return { success: false, error: '正在領取中，請稍候' };
  }

  claimingAll = true;

  try {
    await checkAndUnlockAchievements(allPets);

    const catalog = await loadAchievementsCatalog();
    if (!catalog?.length) {
      return { success: false, error: '成就資料尚未載入' };
    }

    const state = await getAchievementsState();
    const toClaim = catalog.filter(
      (a) =>
        state.unlockedAchievementIds.includes(a.id) &&
        !state.claimedAchievementIds.includes(a.id)
    );

    if (!toClaim.length) {
      return { success: false, error: '目前沒有可領取的成就' };
    }

    let totalStardust = 0;
    let totalEnergy = 0;
    const totalMaterials = {};
    const totalItems = {};

    for (const achievement of toClaim) {
      const reward = achievement.reward || {};
      totalStardust += reward.stardust ?? 0;
      totalEnergy += reward.adventureEnergy ?? 0;
      if (reward.materials) {
        for (const [id, amt] of Object.entries(reward.materials)) {
          if (amt > 0) {
            totalMaterials[id] = (totalMaterials[id] ?? 0) + amt;
          }
        }
      }
      if (reward.items) {
        for (const [id, amt] of Object.entries(reward.items)) {
          if (amt > 0) {
            totalItems[id] = (totalItems[id] ?? 0) + amt;
          }
        }
      }
    }

    try {
      if (totalStardust > 0) await addStardust(totalStardust);
      if (totalEnergy > 0) await addAdventureEnergy(totalEnergy);
      for (const [id, amt] of Object.entries(totalMaterials)) {
        if (amt > 0) await addMaterial(id, amt);
      }
      for (const [id, amt] of Object.entries(totalItems)) {
        if (amt > 0) await addInventoryItem(id, amt);
      }
    } catch (err) {
      return { success: false, error: err.message || '獎勵發放失敗' };
    }

    state.claimedAchievementIds = [
      ...state.claimedAchievementIds,
      ...toClaim.map((a) => a.id),
    ];
    await saveAchievementsState(state);

    return {
      success: true,
      count: toClaim.length,
      achievements: toClaim,
      rewards: {
        stardust: totalStardust,
        adventureEnergy: totalEnergy,
        materials: totalMaterials,
        items: totalItems,
      },
    };
  } finally {
    claimingAll = false;
  }
}

/**
 * 裝備稱號
 */
export async function equipTitle(titleId) {
  const state = await getAchievementsState();
  await loadTitlesCatalog();

  if (!titleId) {
    state.equippedTitleId = null;
    await saveAchievementsState(state);
    return { success: true, title: null };
  }

  if (!state.unlockedTitleIds.includes(titleId)) {
    return { success: false, error: '稱號尚未解鎖' };
  }

  const title = getTitleById(titleId);
  if (!title) {
    return { success: false, error: '稱號不存在' };
  }

  state.equippedTitleId = titleId;
  await saveAchievementsState(state);
  return { success: true, title };
}

/** 計算可領取成就數 */
export function getClaimableCount(state, catalog) {
  if (!catalog) return 0;
  return catalog.filter((a) => {
    const unlocked = state.unlockedAchievementIds.includes(a.id);
    const claimed = state.claimedAchievementIds.includes(a.id);
    return unlocked && !claimed;
  }).length;
}

/** 取得成就摘要（供 UI 使用） */
export async function getAchievementSummary(allPets = []) {
  const [catalog, titles, state, context] = await Promise.all([
    loadAchievementsCatalog(),
    loadTitlesCatalog(),
    getAchievementsState(),
    buildAchievementContext(allPets),
  ]);

  const total = catalog?.length ?? 0;
  const unlocked = state.unlockedAchievementIds.length;
  const claimable = getClaimableCount(state, catalog);
  const completionRate = total > 0 ? Math.round((unlocked / total) * 100) : 0;

  const equippedTitle = state.equippedTitleId
    ? getTitleById(state.equippedTitleId, titles)
    : null;

  const recentUnlocked = (state.unlockedAchievementIds || [])
    .slice(-3)
    .reverse()
    .map((id) => (catalog || []).find((a) => a.id === id))
    .filter(Boolean);

  const items = (catalog || []).map((a) => {
    const progress = getAchievementProgress(a, context);
    const target = a.target ?? 1;
    const isUnlocked = state.unlockedAchievementIds.includes(a.id);
    const isClaimed = state.claimedAchievementIds.includes(a.id);
    let status = 'locked';
    if (isClaimed) status = 'claimed';
    else if (isUnlocked) status = 'claimable';
    return {
      achievement: a,
      progress,
      target,
      percent: Math.min(100, Math.round((progress / target) * 100)),
      status,
    };
  });

  return {
    catalogLoaded: !!catalog,
    titlesLoaded: !!titles,
    state,
    context,
    total,
    unlocked,
    claimable,
    completionRate,
    equippedTitle,
    recentUnlocked,
    items,
    titles: titles || [],
    hasUnseenTitles: (state.unseenTitleIds?.length ?? 0) > 0,
  };
}

/** 匯出成就狀態（備份用） */
export async function exportAchievementsState() {
  return getAchievementsState();
}

/** 匯入成就狀態（備份還原用） */
export async function importAchievementsState(data) {
  const state = normalizeAchievementsState({ ...data, key: ACHIEVEMENTS_KEY });
  await saveAchievementsState(state);
  return state;
}
