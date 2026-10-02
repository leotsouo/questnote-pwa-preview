/**
 * 寵物圖鑑、碎片、升星、陪伴與親密度管理
 */
import { dbGetAll, dbGet, dbPut, dbMutateRecords, STORES } from './db.js';

/** 重複寵物轉換碎片數量 */
export const FRAGMENT_BY_RARITY = {
  N: 1,
  R: 2,
  SR: 5,
  SSR: 10,
  UR: 20,
};

/** 升星所需碎片 */
export const STAR_UPGRADE_COST = {
  2: 5,
  3: 15,
  4: 30,
  5: 50,
};

/** 親密度等級門檻（累積 EXP） */
export const BOND_LEVEL_THRESHOLDS = [0, 50, 150, 300, 500];

/** 撫摸冷卻時間（4 小時） */
export const PET_COOLDOWN_MS = 4 * 60 * 60 * 1000;

/** 每次撫摸增加的親密度 */
export const PET_BOND_EXP_GAIN = 5;

/** 暱稱長度上限（中文算 2 單位、英文算 1 單位，最多 24 單位 = 12 中文或 24 英文） */
export const NICKNAME_MAX_UNITS = 24;

function isCjkChar(ch) {
  return /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(ch);
}

/** 計算暱稱字元單位數 */
export function getNicknameCharUnits(text) {
  if (!text) return 0;
  let units = 0;
  for (const ch of text) {
    units += isCjkChar(ch) ? 2 : 1;
  }
  return units;
}

/**
 * 正規化暱稱輸入（trim、移除換行）
 * @returns {string|null}
 */
export function normalizePetNickname(nickname) {
  if (nickname == null) return null;
  if (typeof nickname !== 'string') return null;
  const trimmed = nickname.trim().replace(/[\r\n]+/g, '');
  return trimmed || null;
}

/**
 * 驗證暱稱
 * @returns {{ valid: boolean, nickname?: string|null, error?: string }}
 */
export function validatePetNickname(nickname) {
  const normalized = normalizePetNickname(nickname);
  if (!normalized) {
    return { valid: true, nickname: null };
  }
  const units = getNicknameCharUnits(normalized);
  if (units > NICKNAME_MAX_UNITS) {
    return {
      valid: false,
      error: '暱稱太長，請控制在 12 個中文字以內。',
    };
  }
  return { valid: true, nickname: normalized };
}

/** 儲存用暱稱 sanitize（匯入時過長可截斷） */
function sanitizeStoredNickname(nickname) {
  if (nickname == null) return null;
  if (typeof nickname !== 'string') return null;
  const trimmed = nickname.trim().replace(/[\r\n]+/g, '');
  if (!trimmed) return null;

  const validation = validatePetNickname(trimmed);
  if (validation.valid) return validation.nickname;

  let result = '';
  let units = 0;
  for (const ch of trimmed) {
    const chUnits = isCjkChar(ch) ? 2 : 1;
    if (units + chUnits > NICKNAME_MAX_UNITS) break;
    result += ch;
    units += chUnits;
  }
  if (result) {
    console.warn('[QuestNote] 暱稱過長已截斷:', nickname);
    return result;
  }
  return null;
}

/** 取得寵物顯示名稱（暱稱優先） */
export function getPetDisplayName(pet, collectionItem) {
  if (!pet) return '';
  const nickname = collectionItem?.nickname ?? pet?.nickname ?? null;
  if (typeof nickname === 'string' && nickname.trim()) {
    return nickname.trim();
  }
  return pet.name || '';
}

/** 取得寵物原始名稱 */
export function getPetOriginalName(pet) {
  return pet?.name || '';
}

/**
 * 設定寵物暱稱
 * @returns {Promise<{ success: boolean, message?: string, entry?: object, cleared?: boolean }>}
 */
export async function setPetNickname(petId, nickname) {
  try {
    return await mutatePet(petId, (entry) => {
      if (!entry) return noCollectionChange({ success: false, message: '尚未獲得的寵物無法設定暱稱。' });
      const validation = validatePetNickname(nickname);
      if (!validation.valid) return noCollectionChange({ success: false, message: validation.error || '暱稱太長，請重新輸入。' });
      entry.nickname = validation.nickname;
      return saveCollectionChange(entry, { success: true, entry, cleared: validation.nickname === null });
    });
  } catch (err) {
    console.error('[QuestNote] 暱稱儲存失敗:', err);
    return { success: false, message: '暱稱儲存失敗，請稍後再試。' };
  }
}

/**
 * 清除寵物暱稱
 */
export async function clearPetNickname(petId) {
  try {
    return await mutatePet(petId, (entry) => {
      if (!entry) return noCollectionChange({ success: false, message: '找不到這隻寵物資料。' });
      entry.nickname = null;
      return saveCollectionChange(entry, { success: true, entry });
    });
  } catch (err) {
    console.error('[QuestNote] 暱稱清除失敗:', err);
    return { success: false, message: '暱稱儲存失敗，請稍後再試。' };
  }
}

/** 啟動時 migration：補齊 nickname 與 bondUnlocks 欄位（bondUnlocks 為 silent unlock） */
export async function migrateCollectionNicknames() {
  await dbMutateRecords([{ store: STORES.COLLECTION, all: true }], ([items]) => {
    const puts = [];
    for (const item of items) {
      const normalized = normalizeEntry(item);
      if (!('nickname' in item) || item.nickname !== normalized.nickname || !item.bondUnlocks
        || typeof item.bondUnlocks !== 'object' || !Array.isArray(item.bondUnlocks.notifiedLevels)) {
        puts.push({ store: STORES.COLLECTION, value: normalized });
      }
    }
    return { puts };
  });
}

/* ─── V2.6.0 羈絆解放：解鎖狀態 ─── */

/** 各解鎖項目對應的親密度等級門檻 */
export const BOND_UNLOCK_LEVEL_MAP = {
  dialogueLv2: 2,
  badgeLv3: 3,
  homeEffectLv4: 4,
  bondFrameLv5: 5,
  bondStoryLv5: 5,
};

/** 會觸發解鎖提示的等級（依序） */
export const BOND_UNLOCK_LEVELS = [2, 3, 4, 5];

/** 預設（全未解鎖）的 bondUnlocks 結構 */
export function defaultBondUnlocks() {
  return {
    dialogueLv2: false,
    badgeLv3: false,
    homeEffectLv4: false,
    bondFrameLv5: false,
    bondStoryLv5: false,
    bondLiberated: false,
    notifiedLevels: [],
  };
}

/** 依親密度等級推算各解鎖旗標（保證與 bondLevel 一致） */
function computeBondUnlockFlags(bondLevel) {
  const lv = Number.isFinite(bondLevel) ? bondLevel : 1;
  return {
    dialogueLv2: lv >= 2,
    badgeLv3: lv >= 3,
    homeEffectLv4: lv >= 4,
    bondFrameLv5: lv >= 5,
    bondStoryLv5: lv >= 5,
    bondLiberated: lv >= 5,
  };
}

/**
 * 正規化 bondUnlocks，補齊缺少欄位並讓旗標與 bondLevel 一致。
 * - 舊資料（完全沒有 bondUnlocks）：silent unlock，將已達成等級全部標記為已提示，避免啟動時洗版。
 * - 既有 bondUnlocks：保留 notifiedLevels（讓 updatePetBondUnlocks 能偵測真正的新解鎖）。
 * @param {object|null|undefined} raw
 * @param {number} bondLevel
 */
export function normalizeBondUnlocks(raw, bondLevel = 1) {
  const flags = computeBondUnlockFlags(bondLevel);
  const isLegacy = !raw || typeof raw !== 'object';

  let notifiedLevels;
  if (isLegacy) {
    // 舊資料 silent migration：已達成的解鎖等級直接視為已提示
    notifiedLevels = BOND_UNLOCK_LEVELS.filter((lv) => bondLevel >= lv);
  } else {
    notifiedLevels = Array.isArray(raw.notifiedLevels)
      ? [...new Set(raw.notifiedLevels.filter((n) => Number.isInteger(n) && n >= 2 && n <= 5))]
      : [];
  }
  notifiedLevels.sort((a, b) => a - b);

  return { ...flags, notifiedLevels };
}

/** 依親密度等級取得該版本會解鎖的項目清單 */
export function getBondUnlocksByLevel(bondLevel) {
  const map = {
    2: ['dialogueLv2'],
    3: ['badgeLv3'],
    4: ['homeEffectLv4'],
    5: ['bondFrameLv5', 'bondStoryLv5', 'bondLiberated'],
  };
  const result = [];
  for (const lv of BOND_UNLOCK_LEVELS) {
    if (bondLevel >= lv) result.push(...map[lv]);
  }
  return result;
}

/** 依累積 EXP 計算親密度等級 */
export function getBondLevelFromExp(exp) {
  if (exp >= 500) return 5;
  if (exp >= 300) return 4;
  if (exp >= 150) return 3;
  if (exp >= 50) return 2;
  return 1;
}

/**
 * 計算當前等級的親密度進度
 * @returns {{ current: number, max: number, percent: number }}
 */
export function getBondProgress(bondExp, bondLevel) {
  if (bondLevel >= 5) {
    return { current: bondExp - 500, max: 0, percent: 100 };
  }
  const currentThreshold = BOND_LEVEL_THRESHOLDS[bondLevel - 1];
  const nextThreshold = BOND_LEVEL_THRESHOLDS[bondLevel];
  const current = bondExp - currentThreshold;
  const max = nextThreshold - currentThreshold;
  return {
    current,
    max,
    percent: Math.min(100, Math.round((current / max) * 100)),
  };
}

/** 正規化收藏紀錄，補齊舊資料缺少的欄位 */
export function normalizeCollectionItem(entry) {
  return normalizeEntry(entry);
}

function normalizeLastPettedAt(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return value;
}

export function normalizeEntry(entry) {
  if (!entry) return entry;
  const bondExp = entry.bondExp ?? 0;
  const bondLevel = entry.bondLevel ?? getBondLevelFromExp(bondExp);
  return {
    ...entry,
    stars: entry.stars ?? 1,
    fragments: entry.fragments ?? 0,
    bondExp,
    bondLevel,
    isCompanion: entry.isCompanion ?? false,
    nickname: sanitizeStoredNickname(entry.nickname),
    lastPettedAt: normalizeLastPettedAt(entry.lastPettedAt),
    bondUnlocks: normalizeBondUnlocks(entry.bondUnlocks, bondLevel),
  };
}


function noCollectionChange(result) { return { puts: [], result }; }
function saveCollectionChange(entry, result = entry) {
  return { puts: [{ store: STORES.COLLECTION, value: entry }], result };
}
function mutatePet(petId, reduce) {
  return dbMutateRecords([{ store: STORES.COLLECTION, key: petId }], ([raw]) => reduce(normalizeEntry(raw)));
}
function mutateCompanion(reduce) {
  return dbMutateRecords([{ store: STORES.COLLECTION, all: true }], ([raw]) => {
    return reduce(raw.map(normalizeEntry).find((entry) => entry.isCompanion) || null);
  });
}

/** Pure initial record shared by first draws and fixed gifts. */
export function createCollectionEntry(petId, now = new Date().toISOString()) {
  return normalizeEntry({ petId, stars: 1, fragments: 0, bondExp: 0, bondLevel: 1,
    isCompanion: false, nickname: null, lastPettedAt: null, obtainedAt: now });
}

/** 取得全部收藏紀錄（已正規化） */
export async function getCollection() {
  const items = await dbGetAll(STORES.COLLECTION);
  return items.map(normalizeEntry);
}

/** 取得單一寵物收藏（已正規化） */
export async function getPetCollection(petId) {
  const entry = await dbGet(STORES.COLLECTION, petId);
  return entry ? normalizeEntry(entry) : null;
}

/**
 * 新增寵物到圖鑑（首次獲得）
 */
export async function addPetToCollection(petId) {
  return mutatePet(petId, (entry) => entry
    ? noCollectionChange(entry) : saveCollectionChange(createCollectionEntry(petId)));
}

/**
 * 增加碎片（重複抽到的寵物）
 */
export async function addFragments(petId, amount) {
  return mutatePet(petId, (existing) => {
    const entry = existing || createCollectionEntry(petId);
    entry.fragments = (entry.fragments || 0) + amount;
    return saveCollectionChange(entry);
  });
}

/**
 * 升星
 */
export async function upgradeStar(petId) {
  return mutatePet(petId, (entry) => {
    if (!entry) return noCollectionChange({ success: false, message: '尚未獲得此寵物' });
    const currentStars = entry.stars || 1;
    if (currentStars >= 5) return noCollectionChange({ success: false, message: '已達最高星級' });
    const nextStar = currentStars + 1;
    const cost = STAR_UPGRADE_COST[nextStar];
    if ((entry.fragments || 0) < cost) return noCollectionChange({ success: false, message: '碎片不足，需要 ' + cost + ' 碎片' });
    entry.fragments -= cost;
    entry.stars = nextStar;
    return saveCollectionChange(entry, { success: true, entry });
  });
}

/**
 * 設為陪伴寵物（同一時間僅一隻）
 */
export async function setCompanion(petId) {
  return dbMutateRecords([{ store: STORES.COLLECTION, all: true }], ([items]) => {
    const collection = items.map(normalizeEntry);
    const owned = collection.find((entry) => entry.petId === petId);
    if (!owned) throw new Error('尚未獲得此寵物');
    const puts = [];
    for (const entry of collection) {
      const selected = entry.petId === petId;
      if (entry.isCompanion !== selected) {
        entry.isCompanion = selected;
        puts.push({ store: STORES.COLLECTION, value: entry });
      }
    }
    return { puts, result: owned };
  });
}

/** 取得目前陪伴寵物的收藏紀錄 */
export async function getCompanionPet() {
  const collection = await getCollection();
  return collection.find((c) => c.isCompanion) || null;
}

/** 撫摸冷卻是否已結束 */
export function canPetCompanion(collectionItem) {
  return getPetCooldownRemaining(collectionItem) <= 0;
}

/** 撫摸冷卻剩餘毫秒數 */
export function getPetCooldownRemaining(collectionItem) {
  if (!collectionItem?.lastPettedAt) return 0;
  const last = new Date(collectionItem.lastPettedAt);
  if (Number.isNaN(last.getTime())) return 0;
  const elapsed = Date.now() - last.getTime();
  return Math.max(0, PET_COOLDOWN_MS - elapsed);
}

/** 格式化冷卻剩餘時間 */
export function formatCooldown(ms) {
  if (ms <= 0) return '1 分鐘內';
  const totalMinutes = Math.ceil(ms / 60000);
  if (totalMinutes < 1) return '1 分鐘內';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours} 小時 ${minutes} 分鐘`;
  if (hours > 0) return `${hours} 小時`;
  return `${minutes} 分鐘`;
}

/**
 * 撫摸陪伴寵物（+5 親密度，4 小時冷卻）
 */
export async function petCompanion() {
  return mutateCompanion((entry) => {
    if (!entry) return noCollectionChange({ success: false, message: '尚未設定陪伴寵物。' });
    if (!canPetCompanion(entry)) {
      const remaining = getPetCooldownRemaining(entry);
      return noCollectionChange({ success: false,
        message: '牠剛剛已經被摸過了，還要 ' + formatCooldown(remaining) + '才能再次撫摸。', cooldownRemaining: remaining });
    }
    const oldLevel = entry.bondLevel;
    entry.bondExp = (entry.bondExp || 0) + PET_BOND_EXP_GAIN;
    entry.bondLevel = getBondLevelFromExp(entry.bondExp);
    entry.lastPettedAt = new Date().toISOString();
    return saveCollectionChange(entry, { success: true, entry, expGained: PET_BOND_EXP_GAIN,
      leveledUp: entry.bondLevel > oldLevel, newLevel: entry.bondLevel, oldLevel });
  });
}

/**
 * 取得目前陪伴寵物（合併 pets 資料）
 */
export async function getCompanion(allPets) {
  const collection = await getCollection();
  const companionEntry = collection.find((c) => c.isCompanion);
  if (!companionEntry) return null;

  const pet = allPets.find((p) => p.id === companionEntry.petId);
  if (!pet) return null;

  return {
    // Catalog identity and presentation cannot be overridden by stored user state.
    ...companionEntry,
    ...pet,
    // 保留 lore 的 bondUnlocks（等級→台詞文字），避免被收藏項目的解鎖旗標覆蓋
    bondUnlocks: pet.bondUnlocks ?? {},
    bondUnlockState: companionEntry.bondUnlocks ?? normalizeBondUnlocks(null, companionEntry.bondLevel ?? 1),
    owned: true,
    nickname: companionEntry.nickname ?? null,
    displayName: getPetDisplayName(pet, companionEntry),
    originalName: pet.name,
  };
}

/**
 * 為指定寵物增加親密度（探險獎勵用）
 * @returns {{ expGained: number, leveledUp: boolean, newLevel: number, oldLevel: number } | null}
 */
export async function addBondExpToPet(petId, amount) {
  if (amount <= 0) return null;
  return mutatePet(petId, (entry) => addBondChange(entry, amount));
}

/**
 * 為陪伴寵物增加親密度
 * @returns {{ expGained: number, leveledUp: boolean, newLevel: number, oldLevel: number } | null}
 */
export async function addBondExpToCompanion(amount) {
  if (amount <= 0) return null;
  return mutateCompanion((entry) => addBondChange(entry, amount));
}

/**
 * 檢查並更新寵物羈絆解鎖狀態，回傳這次新解鎖的等級（供 UI 顯示提示）。
 * - 旗標永遠與 bondLevel 一致（normalizeEntry 保證）。
 * - notifiedLevels 用來避免重複提示。
 * @param {string} petId
 * @returns {Promise<{ newlyUnlockedLevels: number[], bondUnlocks: object|null, entry: object|null }>}
 */
export async function updatePetBondUnlocks(petId) {
  return mutatePet(petId, (entry) => {
    if (!entry) return noCollectionChange({ newlyUnlockedLevels: [], bondUnlocks: null, entry: null });
    const bondLevel = entry.bondLevel ?? 1;
    const unlocks = entry.bondUnlocks || normalizeBondUnlocks(null, bondLevel);
    const notified = new Set(unlocks.notifiedLevels || []);
    const reached = BOND_UNLOCK_LEVELS.filter((lv) => bondLevel >= lv);
    const newlyUnlockedLevels = reached.filter((lv) => !notified.has(lv));
    if (!newlyUnlockedLevels.length) return noCollectionChange({ newlyUnlockedLevels: [], bondUnlocks: unlocks, entry });
    for (const lv of newlyUnlockedLevels) notified.add(lv);
    entry.bondUnlocks = { ...unlocks, notifiedLevels: [...notified].sort((a, b) => a - b) };
    return saveCollectionChange(entry, { newlyUnlockedLevels, bondUnlocks: entry.bondUnlocks, entry });
  });
}

/** 取得寵物目前的羈絆解鎖狀態（已正規化） */
export async function getPetBondUnlockStatus(petId) {
  const entry = await getPetCollection(petId);
  if (!entry) return null;
  return {
    petId,
    bondLevel: entry.bondLevel ?? 1,
    bondUnlocks: entry.bondUnlocks || normalizeBondUnlocks(null, entry.bondLevel ?? 1),
  };
}

/** 寵物是否已達羈絆解放（Lv.5） */
export async function hasBondLiberated(petId) {
  const entry = await getPetCollection(petId);
  return !!entry?.bondUnlocks?.bondLiberated;
}

/** 同步寵物資料庫 */
export async function syncWithPetDatabase(allPets) {
  return getCollection();
}

/** 圖鑑收集進度 */
export async function getCollectionProgress(allPets) {
  const collection = await getCollection();
  const ownedIds = new Set(collection.map((c) => c.petId));
  const total = allPets.length;
  const owned = allPets.filter((p) => ownedIds.has(p.id)).length;
  return { owned, total };
}

/** 合併寵物資料與收藏狀態 */
export async function getEnrichedCollection(allPets) {
  const collection = await getCollection();
  const map = new Map(collection.map((c) => [c.petId, c]));

  return allPets.map((pet) => {
    const entry = map.get(pet.id);
    const normalized = entry ? normalizeEntry(entry) : null;
    return {
      ...pet,
      owned: !!normalized,
      stars: normalized?.stars ?? 0,
      fragments: normalized?.fragments ?? 0,
      bondExp: normalized?.bondExp ?? 0,
      bondLevel: normalized?.bondLevel ?? 0,
      bondUnlockState: normalized?.bondUnlocks ?? defaultBondUnlocks(),
      isCompanion: normalized?.isCompanion ?? false,
      obtainedAt: normalized?.obtainedAt ?? null,
      nickname: normalized?.nickname ?? null,
      displayName: normalized ? getPetDisplayName(pet, normalized) : pet.name,
      originalName: pet.name,
    };
  });
}

export async function exportCollection() {
  return getCollection();
}

export async function importCollection(items) {
  for (const item of items) {
    await dbPut(STORES.COLLECTION, normalizeEntry(item));
  }
}

function addBondChange(entry, amount) {
  if (!entry) return noCollectionChange(null);
  const oldLevel = entry.bondLevel;
  entry.bondExp = (entry.bondExp || 0) + amount;
  entry.bondLevel = getBondLevelFromExp(entry.bondExp);
  return saveCollectionChange(entry, { expGained: amount, leveledUp: entry.bondLevel > oldLevel,
    newLevel: entry.bondLevel, oldLevel });
}
