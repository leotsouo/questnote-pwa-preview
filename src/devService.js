/**
 * 開發測試工具 — 僅 localhost 環境使用，正式部署可整檔移除
 */
import {
  addPetToCollection,
  getPetCollection,
  getCollection,
  addBondExpToCompanion,
  getBondLevelFromExp,
} from './collectionService.js';
import { addStardust, getWallet } from './rewardService.js';
import { forceCompleteActiveExpedition } from './expeditionService.js';
import {
  getDailyCheckIn,
  getLocalDateKey,
  normalizeDailyCheckIn,
  releaseWheelSpinLock,
} from './dailyCheckInService.js';
import { dbPut, STORES } from './db.js';
import { RELEASE_PROFILE } from './releaseProfile.js';

/** 每次測試發放的星塵數量 */
export const DEV_STARDUST_GRANT = 100000;

/** 測試解鎖的高稀有寵物 ID */
export const DEV_TEST_PET_IDS = [
  'pet_ur01',
  'pet_ur02',
  'pet_ur03',
  'pet_ur04',
  'pet_ssr01',
  'pet_ssr02',
  'pet_sr01',
  'pet_sr02',
];

/** 是否為開發模式（Live Server / 本機） */
export function isDevMode() {
  return isAuthorLocalDevMode();
}

/**
 * 作者本機開發模式 — 信箱測試工具專用，比一般 Debug 更嚴格。
 * 僅 localhost / 127.0.0.1 / [::1]。
 * 正式 GitHub Pages 即使 ?debug=1 或 localStorage debug 也不得通過。
 */
export function isAuthorLocalDevMode() {
  if (RELEASE_PROFILE) return false;
  try {
    const hostname = window.location.hostname;
    return (
      hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname === '[::1]'
    );
  } catch {
    return false;
  }
}

/**
 * 是否為 Debug 模式（供演出測試按鈕等使用）。
 * 條件：網址帶 ?debug=1 或 localStorage.questnote_debug === '1'。
 * 注意：不得單獨用來顯示信箱測試／作者發信工具。
 * @returns {boolean}
 */
export function isDebugMode() {
  if (RELEASE_PROFILE) return false;
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('debug') === '1') return true;
    return localStorage.getItem('questnote_debug') === '1';
  } catch {
    return false;
  }
}

/**
 * 將測試寵物加入圖鑑（不影響抽卡邏輯）
 * @returns {Promise<number>} 本次新解鎖數量
 */
export async function unlockDevTestPets() {
  let newlyAdded = 0;
  for (const petId of DEV_TEST_PET_IDS) {
    const before = await getPetCollection(petId);
    await addPetToCollection(petId);
    if (!before) newlyAdded += 1;
  }
  return newlyAdded;
}

/**
 * 將全部寵物加入圖鑑（開發測試用）
 * @param {string[]} petIds
 * @returns {Promise<{ newlyAdded: number, total: number }>}
 */
export async function unlockAllDevPets(petIds) {
  let newlyAdded = 0;
  for (const petId of petIds) {
    const before = await getPetCollection(petId);
    await addPetToCollection(petId);
    if (!before) newlyAdded += 1;
  }
  return { newlyAdded, total: petIds.length };
}

/**
 * 開發測試：發放大量星塵
 * @returns {Promise<number>} 發放後的星塵總數
 */
export async function grantDevStardust() {
  if (!isAuthorLocalDevMode()) throw new Error('Test currency is available only in a local source checkout');
  await addStardust(DEV_STARDUST_GRANT);
  const wallet = await getWallet();
  return wallet.stardust ?? 0;
}

/**
 * 開發測試：立即結束進行中的探險
 */
export async function devForceCompleteExpedition() {
  return forceCompleteActiveExpedition();
}

/** 各親密度等級所需的累積 EXP 門檻（對應 getBondLevelFromExp） */
const BOND_LEVEL_THRESHOLDS = { 2: 50, 3: 150, 4: 300, 5: 500 };

/**
 * 開發測試：將「陪伴中」的寵物親密度提升一個等級（剛好跨過下一級門檻）。
 * 一次一級，方便逐級觀察 Lv.2～Lv.5 的羈絆解鎖提示。
 * @returns {Promise<{ success: boolean, maxed?: boolean, petId?: string, oldLevel?: number, newLevel?: number, message: string }>}
 */
export async function raiseDevCompanionBond() {
  const collection = await getCollection();
  const companion = collection.find((c) => c.isCompanion);
  if (!companion) {
    return { success: false, message: '目前沒有陪伴中的寵物，請先在圖鑑設定一隻陪伴寵物。' };
  }

  const currentExp = companion.bondExp || 0;
  const currentLevel = getBondLevelFromExp(currentExp);
  if (currentLevel >= 5) {
    return {
      success: true,
      maxed: true,
      petId: companion.petId,
      oldLevel: currentLevel,
      newLevel: 5,
      message: '陪伴寵物親密度已達 Lv.5（滿級）。',
    };
  }

  const nextLevel = currentLevel + 1;
  const amount = Math.max(1, BOND_LEVEL_THRESHOLDS[nextLevel] - currentExp);
  const result = await addBondExpToCompanion(amount);
  const newLevel = result?.newLevel ?? nextLevel;

  return {
    success: true,
    maxed: false,
    petId: companion.petId,
    oldLevel: currentLevel,
    newLevel,
    message: `陪伴寵物親密度提升到 Lv.${newLevel}`,
  };
}

/**
 * 開發測試：重置今日每日祝福（簽到與轉盤）
 * @returns {Promise<{ success: boolean, changed: boolean, message: string }>}
 */
export async function resetDevDailyBlessing() {
  const todayKey = getLocalDateKey();
  const daily = await getDailyCheckIn();
  const hadCheckIn = daily.lastCheckInDate === todayKey;
  const hadWheel = daily.lastWheelSpinDate === todayKey;

  if (!hadCheckIn && !hadWheel) {
    return { success: true, changed: false, message: '今日尚未完成簽到或轉盤，無需重置。' };
  }

  if (hadCheckIn) {
    const prevEntries = (daily.history || [])
      .filter((h) => h?.date !== todayKey && h?.checkedInAt)
      .sort((a, b) => a.date.localeCompare(b.date));
    const prev = prevEntries[prevEntries.length - 1];

    daily.lastCheckInDate = prev?.date ?? null;
    daily.lastCheckInAt = prev?.checkedInAt ?? null;
    daily.streak = Math.max(0, (daily.streak ?? 0) - 1);
    daily.totalCheckIns = Math.max(0, (daily.totalCheckIns ?? 0) - 1);
  }

  if (hadWheel) {
    daily.lastWheelSpinDate = null;
    daily.lastWheelSpinAt = null;
    daily.totalWheelSpins = Math.max(0, (daily.totalWheelSpins ?? 0) - 1);
  }

  daily.history = (daily.history || [])
    .map((h) => {
      if (h?.date !== todayKey) return h;
      const entry = { ...h };
      if (hadCheckIn) {
        delete entry.checkedInAt;
        delete entry.checkInReward;
      }
      if (hadWheel) delete entry.wheelReward;
      return entry.checkedInAt || entry.checkInReward || entry.wheelReward ? entry : null;
    })
    .filter(Boolean);

  releaseWheelSpinLock();
  await dbPut(STORES.META, normalizeDailyCheckIn(daily));

  return { success: true, changed: true, message: '已重置今日每日祝福，可重新簽到與轉盤。' };
}
