/**
 * 每日祝福 — 簽到與幸運轉盤
 */
import { dbGet, dbPut, STORES } from './db.js';
import { getTodayDateString, daysBetween } from './taskFilterService.js';
import {
  addStardust,
  addAdventureEnergy,
  addMaterial,
  applyRewardBundle,
} from './rewardService.js';

const DAILY_CHECK_IN_KEY = 'dailyCheckIn';

/** 連續簽到里程碑獎勵（僅在剛好達成天數時發放） */
const STREAK_MILESTONES = {
  3: { stardust: 30 },
  7: {
    stardust: 100,
    adventureEnergy: 3,
    materials: { star_shard: 1 },
  },
  14: {
    stardust: 200,
    items: { item_stardust_candy: 1 },
  },
  30: {
    stardust: 500,
    materials: { star_shard: 3 },
    items: { item_astral_honey: 1 },
  },
};

const BASE_CHECK_IN_REWARD = {
  stardust: 20,
  adventureEnergy: 1,
};

let isCheckingIn = false;
let isSpinning = false;

/** @type {object[]|null} */
let wheelRewardsCache = null;

/**
 * 取得本地日期 key（YYYY-MM-DD）
 * @param {Date} [date]
 */
export function getLocalDateKey(date = new Date()) {
  return getTodayDateString(date);
}

/** 驗證日期 key 格式 */
export function isValidDateKey(value) {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * 判斷 lastCheckInDate 是否為 todayKey 的前一天
 */
export function isYesterday(lastCheckInDate, todayKey) {
  if (!lastCheckInDate || !todayKey) return false;
  if (!isValidDateKey(lastCheckInDate) || !isValidDateKey(todayKey)) return false;
  const diff = daysBetween(todayKey, lastCheckInDate);
  return diff === 1;
}

/**
 * 正規化每日簽到資料
 */
export function normalizeDailyCheckIn(state) {
  const daily = state || {};
  const lastCheckInDate = isValidDateKey(daily.lastCheckInDate) ? daily.lastCheckInDate : null;
  const lastWheelSpinDate = isValidDateKey(daily.lastWheelSpinDate) ? daily.lastWheelSpinDate : null;

  return {
    key: DAILY_CHECK_IN_KEY,
    lastCheckInDate,
    lastCheckInAt: typeof daily.lastCheckInAt === 'string' ? daily.lastCheckInAt : null,
    streak: Number.isFinite(daily.streak) ? daily.streak : 0,
    bestStreak: Number.isFinite(daily.bestStreak) ? daily.bestStreak : 0,
    totalCheckIns: Number.isFinite(daily.totalCheckIns) ? daily.totalCheckIns : 0,
    lastWheelSpinDate,
    lastWheelSpinAt: typeof daily.lastWheelSpinAt === 'string' ? daily.lastWheelSpinAt : null,
    totalWheelSpins: Number.isFinite(daily.totalWheelSpins) ? daily.totalWheelSpins : 0,
    history: Array.isArray(daily.history) ? daily.history : [],
  };
}

export async function getDailyCheckIn() {
  const data = await dbGet(STORES.META, DAILY_CHECK_IN_KEY);
  return normalizeDailyCheckIn(data);
}

async function saveDailyCheckIn(daily) {
  const normalized = normalizeDailyCheckIn(daily);
  await dbPut(STORES.META, normalized);
  return normalized;
}

export async function initDailyCheckIn() {
  const daily = await getDailyCheckIn();
  return saveDailyCheckIn(daily);
}

export async function exportDailyCheckIn() {
  return getDailyCheckIn();
}

/** 今天是否已簽到 */
export function hasCheckedInToday(daily, todayKey = getLocalDateKey()) {
  return daily?.lastCheckInDate === todayKey;
}

/** 今天是否已轉盤 */
export function hasSpunWheelToday(daily, todayKey = getLocalDateKey()) {
  return daily?.lastWheelSpinDate === todayKey;
}

/** 合併獎勵 bundle */
function mergeRewardBundles(...bundles) {
  const result = { stardust: 0, adventureEnergy: 0, materials: {}, items: {} };
  for (const bundle of bundles) {
    if (!bundle) continue;
    result.stardust += bundle.stardust ?? 0;
    result.adventureEnergy += bundle.adventureEnergy ?? 0;
    if (bundle.materials) {
      for (const [id, amt] of Object.entries(bundle.materials)) {
        if (amt > 0) result.materials[id] = (result.materials[id] ?? 0) + amt;
      }
    }
    if (bundle.items) {
      for (const [id, amt] of Object.entries(bundle.items)) {
        if (amt > 0) result.items[id] = (result.items[id] ?? 0) + amt;
      }
    }
  }
  return result;
}

/** 計算簽到獎勵（含連續天數里程碑） */
export function calculateCheckInRewards(streak) {
  const bundles = [BASE_CHECK_IN_REWARD];
  if (STREAK_MILESTONES[streak]) {
    bundles.push(STREAK_MILESTONES[streak]);
  }
  return mergeRewardBundles(...bundles);
}

function upsertHistoryEntry(daily, todayKey, patch) {
  const history = Array.isArray(daily.history) ? [...daily.history] : [];
  const idx = history.findIndex((h) => h?.date === todayKey);
  const base = idx >= 0 ? { ...history[idx] } : { date: todayKey };
  const merged = { ...base, ...patch };
  if (idx >= 0) history[idx] = merged;
  else history.push(merged);
  daily.history = history.slice(-90);
}

/** 載入轉盤獎勵池 */
export async function loadWheelRewards() {
  if (wheelRewardsCache) return wheelRewardsCache;
  try {
    const res = await fetch('./data/dailyWheelRewards.json');
    if (!res.ok) throw new Error('無法載入轉盤獎勵');
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('轉盤獎勵為空');
    wheelRewardsCache = data;
    return wheelRewardsCache;
  } catch (err) {
    console.warn('[QuestNote] 轉盤獎勵載入失敗，使用內建預設:', err);
    wheelRewardsCache = [
      { id: 'wheel_stardust_30', label: '星塵 +30', type: 'stardust', amount: 30, weight: 25 },
      { id: 'wheel_stardust_50', label: '星塵 +50', type: 'stardust', amount: 50, weight: 20 },
      { id: 'wheel_energy_2', label: '冒險能量 +2', type: 'adventureEnergy', amount: 2, weight: 18 },
      { id: 'wheel_forest_leaf', label: '森林嫩葉 +3', type: 'material', materialId: 'forest_leaf', amount: 3, weight: 15 },
      { id: 'wheel_lava_core', label: '熔岩核心 +1', type: 'material', materialId: 'lava_core', amount: 1, weight: 8 },
      { id: 'wheel_machine_part', label: '古代齒輪 +1', type: 'material', materialId: 'machine_part', amount: 1, weight: 8 },
      { id: 'wheel_spirit_food', label: '小份靈食 +1', type: 'item', itemId: 'item_small_spirit_food', amount: 1, weight: 4 },
      { id: 'wheel_star_shard', label: '星界碎片 +1', type: 'material', materialId: 'star_shard', amount: 1, weight: 2 },
    ];
    return wheelRewardsCache;
  }
}

/** 依 weight 隨機選取轉盤獎勵 */
export function pickWeightedWheelReward(rewards) {
  const pool = rewards.filter((r) => (r.weight ?? 0) > 0);
  if (!pool.length) return null;
  const total = pool.reduce((sum, r) => sum + r.weight, 0);
  let roll = Math.random() * total;
  for (const reward of pool) {
    roll -= reward.weight;
    if (roll <= 0) return reward;
  }
  return pool[pool.length - 1];
}

/** 將轉盤獎項轉為 reward bundle */
export function wheelRewardToBundle(reward) {
  if (!reward) return { stardust: 0, adventureEnergy: 0, materials: {}, items: {} };
  switch (reward.type) {
    case 'stardust':
      return { stardust: reward.amount ?? 0, adventureEnergy: 0, materials: {}, items: {} };
    case 'adventureEnergy':
      return { stardust: 0, adventureEnergy: reward.amount ?? 0, materials: {}, items: {} };
    case 'material':
      return {
        stardust: 0,
        adventureEnergy: 0,
        materials: { [reward.materialId]: reward.amount ?? 1 },
        items: {},
      };
    case 'item':
      return {
        stardust: 0,
        adventureEnergy: 0,
        materials: {},
        items: { [reward.itemId]: reward.amount ?? 1 },
      };
    default:
      return { stardust: 0, adventureEnergy: 0, materials: {}, items: {} };
  }
}

/**
 * 執行每日簽到
 * @returns {Promise<{ success: boolean, error?: string, rewards?: object, streak?: number, daily?: object }>}
 */
export async function performDailyCheckIn() {
  if (isCheckingIn) {
    return { success: false, error: '簽到處理中，請稍候' };
  }

  isCheckingIn = true;

  try {
    const todayKey = getLocalDateKey();
    const daily = await getDailyCheckIn();

    if (hasCheckedInToday(daily, todayKey)) {
      return { success: false, error: '今天已經簽到過了' };
    }

    let newStreak = 1;
    if (isYesterday(daily.lastCheckInDate, todayKey)) {
      newStreak = (daily.streak ?? 0) + 1;
    } else if (daily.lastCheckInDate === todayKey) {
      return { success: false, error: '今天已經簽到過了' };
    }

    const rewards = calculateCheckInRewards(newStreak);
    await applyRewardBundle(rewards);

    const now = new Date().toISOString();
    daily.lastCheckInDate = todayKey;
    daily.lastCheckInAt = now;
    daily.streak = newStreak;
    daily.bestStreak = Math.max(daily.bestStreak ?? 0, newStreak);
    daily.totalCheckIns = (daily.totalCheckIns ?? 0) + 1;

    upsertHistoryEntry(daily, todayKey, {
      checkedInAt: now,
      checkInReward: {
        stardust: rewards.stardust,
        adventureEnergy: rewards.adventureEnergy,
        materials: { ...rewards.materials },
        items: { ...rewards.items },
      },
    });

    const saved = await saveDailyCheckIn(daily);
    return { success: true, rewards, streak: newStreak, daily: saved };
  } catch (err) {
    console.error('[QuestNote] 簽到失敗:', err);
    return { success: false, error: err?.message || '簽到失敗' };
  } finally {
    isCheckingIn = false;
  }
}

/**
 * 準備轉盤（先決定結果，尚未寫入 DB）
 */
export async function prepareDailyWheelSpin() {
  if (isSpinning) {
    return { success: false, error: '轉盤處理中，請稍候' };
  }

  const todayKey = getLocalDateKey();
  const daily = await getDailyCheckIn();

  if (hasSpunWheelToday(daily, todayKey)) {
    return { success: false, error: '今天已經轉過幸運轉盤了，明天再來吧。' };
  }

  const rewards = await loadWheelRewards();
  const reward = pickWeightedWheelReward(rewards);
  if (!reward) {
    return { success: false, error: '轉盤獎勵資料異常' };
  }

  const rewardIndex = rewards.findIndex((r) => r.id === reward.id);
  isSpinning = true;

  return {
    success: true,
    reward,
    rewardIndex: rewardIndex >= 0 ? rewardIndex : 0,
    segmentCount: rewards.length,
  };
}

/**
 * 轉盤動畫結束後套用獎勵並寫入 DB
 */
export async function finalizeDailyWheelSpin(reward) {
  try {
    const todayKey = getLocalDateKey();
    const daily = await getDailyCheckIn();

    if (hasSpunWheelToday(daily, todayKey)) {
      return { success: false, error: '今天已經轉過幸運轉盤了' };
    }

    const bundle = wheelRewardToBundle(reward);
    await applyRewardBundle(bundle);

    const now = new Date().toISOString();
    daily.lastWheelSpinDate = todayKey;
    daily.lastWheelSpinAt = now;
    daily.totalWheelSpins = (daily.totalWheelSpins ?? 0) + 1;

    upsertHistoryEntry(daily, todayKey, {
      wheelReward: {
        type: reward.type,
        amount: reward.amount,
        materialId: reward.materialId,
        itemId: reward.itemId,
        label: reward.label,
      },
    });

    const saved = await saveDailyCheckIn(daily);
    return { success: true, reward, daily: saved };
  } catch (err) {
    console.error('[QuestNote] 轉盤結算失敗:', err);
    return { success: false, error: err?.message || '轉盤結算失敗' };
  } finally {
    isSpinning = false;
  }
}

/** 取消轉盤鎖（動畫異常時） */
export function releaseWheelSpinLock() {
  isSpinning = false;
}

export function isWheelSpinning() {
  return isSpinning;
}

export function isCheckInProcessing() {
  return isCheckingIn;
}
