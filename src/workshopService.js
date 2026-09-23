/**
 * 材料工坊 — 材料管理、道具製作、親密度道具贈送
 */
import { dbGet, dbPut, STORES } from './db.js';
import { getWallet, spendMaterials } from './rewardService.js';
import {
  getPetCollection,
  addBondExpToPet,
  getBondLevelFromExp,
  getBondProgress,
} from './collectionService.js';
import { getTodayDateString } from './taskFilterService.js';

const INVENTORY_KEY = 'inventory';
const WORKSHOP_STATS_KEY = 'workshopStats';

/** 每隻寵物每日親密度道具使用上限 */
export const DAILY_BOND_ITEM_LIMIT = 5;

/** 預設道具庫存（craftables 載入後補齊） */
export const DEFAULT_ITEM_IDS = [
  'item_small_spirit_food',
  'item_warm_snack',
  'item_stardust_candy',
  'item_fire_meat',
  'item_machine_biscuit',
  'item_astral_honey',
];

const DEFAULT_WORKSHOP_STATS = {
  craftCount: 0,
  giftCount: 0,
  favoriteGiftCount: 0,
  firstCraftAt: null,
  firstGiftAt: null,
  firstFavoriteGiftAt: null,
};

/** @type {object[]|null} */
let materialsCatalog = null;
/** @type {object[]|null} */
let craftablesCatalog = null;
/** @type {Map<string, object>|null} */
let materialById = null;
/** @type {Map<string, object>|null} */
let craftableById = null;

let craftingLock = false;
let usingLock = false;

/** 未來用途標籤顯示 */
export const FUTURE_TAG_LABELS = {
  crafting: '製作',
  bond_item: '羈絆',
  future_area_unlock: '未來解鎖',
  awakening: '覺醒',
  workshop_upgrade: '工坊升級',
  bond_unlock: '羈絆解放',
  future_awakening: '未來覺醒',
};

/**
 * 正規化道具庫存
 */
export function normalizeInventory(inventory) {
  if (!inventory || typeof inventory !== 'object') {
    return {
      key: INVENTORY_KEY,
      items: {},
      itemUsageLogs: {},
    };
  }
  return {
    key: INVENTORY_KEY,
    items: { ...(inventory.items || {}) },
    itemUsageLogs: { ...(inventory.itemUsageLogs || {}) },
  };
}

/**
 * 正規化工坊統計
 */
export function normalizeWorkshopStats(stats) {
  if (!stats || typeof stats !== 'object') {
    return { key: WORKSHOP_STATS_KEY, ...DEFAULT_WORKSHOP_STATS };
  }
  return {
    key: WORKSHOP_STATS_KEY,
    craftCount: stats.craftCount ?? 0,
    giftCount: stats.giftCount ?? 0,
    favoriteGiftCount: stats.favoriteGiftCount ?? 0,
    firstCraftAt: stats.firstCraftAt ?? null,
    firstGiftAt: stats.firstGiftAt ?? null,
    firstFavoriteGiftAt: stats.firstFavoriteGiftAt ?? null,
  };
}

/** 載入材料定義 */
export async function loadMaterials() {
  if (materialsCatalog) return materialsCatalog;
  try {
    const res = await fetch('./data/materials.json');
    if (!res.ok) throw new Error('無法載入材料資料');
    materialsCatalog = await res.json();
    materialById = new Map(materialsCatalog.map((m) => [m.id, m]));
    return materialsCatalog;
  } catch (err) {
    console.warn('[QuestNote] 材料資料載入失敗:', err);
    materialsCatalog = [];
    materialById = new Map();
    return materialsCatalog;
  }
}

/** 載入可製作道具定義 */
export async function loadCraftables() {
  if (craftablesCatalog) return craftablesCatalog;
  try {
    const res = await fetch('./data/craftables.json');
    if (!res.ok) throw new Error('無法載入道具資料');
    craftablesCatalog = await res.json();
    craftableById = new Map(craftablesCatalog.map((c) => [c.id, c]));
    return craftablesCatalog;
  } catch (err) {
    console.warn('[QuestNote] 道具資料載入失敗:', err);
    craftablesCatalog = [];
    craftableById = new Map();
    return craftablesCatalog;
  }
}

/** 取得材料顯示資訊 */
export function getMaterialInfo(materialId) {
  const known = materialById?.get(materialId);
  if (known) return known;
  return {
    id: materialId,
    name: '未知材料',
    rarity: '?',
    description: '尚未登錄的材料。',
    category: 'unknown',
    sourceArea: null,
    futureTags: [],
  };
}

/** 取得道具顯示資訊 */
export function getCraftableInfo(itemId) {
  const known = craftableById?.get(itemId);
  if (known) return known;
  return {
    id: itemId,
    name: '未知道具',
    type: 'unknown',
    rarity: '?',
    description: '尚未登錄的道具。',
    effect: { bondExp: 0 },
    recipe: {},
    enabled: false,
    futureTags: [],
  };
}

/** 取得材料名稱 */
export function getMaterialName(materialId) {
  return getMaterialInfo(materialId).name;
}

/** 取得道具名稱 */
export function getItemName(itemId) {
  return getCraftableInfo(itemId).name;
}

/** 取得道具庫存 */
export async function getInventory() {
  const data = await dbGet(STORES.META, INVENTORY_KEY);
  return normalizeInventory(data);
}

/** 儲存道具庫存 */
async function saveInventory(inventory) {
  const normalized = normalizeInventory(inventory);
  await dbPut(STORES.META, normalized);
  return normalized;
}

/** 取得工坊統計 */
export async function getWorkshopStats() {
  const data = await dbGet(STORES.META, WORKSHOP_STATS_KEY);
  return normalizeWorkshopStats(data);
}

/** 儲存工坊統計 */
async function saveWorkshopStats(stats) {
  const normalized = normalizeWorkshopStats(stats);
  await dbPut(STORES.META, normalized);
  return normalized;
}

/** 初始化工坊資料（migration） */
export async function initWorkshop() {
  await loadMaterials();
  await loadCraftables();

  const inventory = await getInventory();
  const craftables = craftablesCatalog || [];
  for (const craftable of craftables) {
    if (inventory.items[craftable.id] === undefined) {
      inventory.items[craftable.id] = 0;
    }
  }
  await saveInventory(inventory);

  const stats = await getWorkshopStats();
  await saveWorkshopStats(stats);

  return { inventory, stats };
}

/** 取得材料庫存 */
export function getMaterialInventory(wallet) {
  return wallet?.materials || {};
}

/** 取得道具庫存 */
export function getItemInventory(inventory) {
  return inventory?.items || {};
}

/** 判斷材料是否足夠 */
export function canCraft(craftable, wallet, quantity = 1) {
  if (!craftable?.enabled) return false;
  const materials = wallet?.materials || {};
  const recipe = craftable.recipe || {};
  for (const [matId, needed] of Object.entries(recipe)) {
    const have = materials[matId] || 0;
    if (have < needed * quantity) return false;
  }
  return true;
}

/** 計算最大可製作數量 */
export function getMaxCraftQuantity(craftable, wallet) {
  if (!craftable?.enabled) return 0;
  const materials = wallet?.materials || {};
  const recipe = craftable.recipe || {};
  const entries = Object.entries(recipe);
  if (entries.length === 0) return 0;

  let maxQty = Infinity;
  for (const [matId, needed] of entries) {
    if (needed <= 0) continue;
    const have = materials[matId] || 0;
    maxQty = Math.min(maxQty, Math.floor(have / needed));
  }
  return maxQty === Infinity ? 0 : maxQty;
}

/** 製作預覽 */
export function getCraftingPreview(craftableId, quantity = 1, wallet) {
  const craftable = getCraftableInfo(craftableId);
  const materials = wallet?.materials || {};
  const recipe = craftable.recipe || {};
  const preview = [];

  for (const [matId, needed] of Object.entries(recipe)) {
    const have = materials[matId] || 0;
    const totalNeeded = needed * quantity;
    preview.push({
      id: matId,
      name: getMaterialName(matId),
      have,
      need: totalNeeded,
      enough: have >= totalNeeded,
    });
  }

  return {
    craftable,
    quantity,
    materials: preview,
    canCraft: canCraft(craftable, wallet, quantity),
    maxQuantity: getMaxCraftQuantity(craftable, wallet),
  };
}

/** 取得缺少的材料描述 */
export function getMissingMaterialsText(craftable, wallet, quantity = 1) {
  const preview = getCraftingPreview(craftable.id, quantity, wallet);
  const missing = preview.materials.filter((m) => !m.enough);
  if (missing.length === 0) return '';
  return missing.map((m) => `${m.name} 缺 ${m.need - m.have}`).join('、');
}

/**
 * 製作道具
 * @returns {Promise<{ success: boolean, message: string, itemId?: string, quantity?: number, itemName?: string }>}
 */
export async function craftItem(craftableId, quantity = 1) {
  if (craftingLock) {
    return { success: false, message: '製作進行中，請稍候' };
  }

  const craftable = getCraftableInfo(craftableId);
  if (!craftable.enabled) {
    return { success: false, message: '此道具目前無法製作' };
  }

  const qty = Math.max(1, Math.floor(quantity));
  craftingLock = true;

  try {
    const wallet = await getWallet();
    if (!canCraft(craftable, wallet, qty)) {
      return { success: false, message: '材料不足，無法製作。' };
    }

    const scaledRecipe = {};
    for (const [matId, needed] of Object.entries(craftable.recipe || {})) {
      scaledRecipe[matId] = needed * qty;
    }
    await spendMaterials(scaledRecipe);

    const inventory = await getInventory();
    inventory.items[craftableId] = (inventory.items[craftableId] || 0) + qty;
    await saveInventory(inventory);

    const stats = await getWorkshopStats();
    stats.craftCount += qty;
    if (!stats.firstCraftAt) stats.firstCraftAt = new Date().toISOString();
    await saveWorkshopStats(stats);

    return {
      success: true,
      message: `製作完成：${craftable.name} x${qty}`,
      itemId: craftableId,
      quantity: qty,
      itemName: craftable.name,
    };
  } finally {
    craftingLock = false;
  }
}

/** 判斷寵物是否喜好道具 */
export function getFavoriteBonus(item, pet) {
  if (!item || !pet || item.type !== 'favorite_bond_item') {
    return { isFavorite: false, bondExp: item?.effect?.bondExp ?? 0 };
  }

  const baseExp = item.effect?.bondExp ?? 0;
  const bonusExp = item.effect?.favoriteBonusBondExp ?? baseExp;

  const speciesTypes = item.favoriteSpeciesTypes || [];
  const elements = item.favoriteElements || [];
  const keywords = item.favoriteKeywords || [];

  const petSpecies = (pet.speciesType || '').toLowerCase();
  const petElement = (pet.element || '').toLowerCase();
  const petTheme = (pet.visualTheme || '').toLowerCase();
  const petName = pet.name || '';
  const petDesc = pet.description || '';

  if (speciesTypes.some((s) => s.toLowerCase() === petSpecies)) {
    return { isFavorite: true, bondExp: bonusExp };
  }

  if (elements.some((el) => {
    const lower = el.toLowerCase();
    return petElement.includes(lower) || petTheme.includes(lower);
  })) {
    return { isFavorite: true, bondExp: bonusExp };
  }

  if (keywords.some((kw) => petName.includes(kw) || petDesc.includes(kw))) {
    return { isFavorite: true, bondExp: bonusExp };
  }

  if (keywords.some((kw) => petTheme.includes(kw.toLowerCase()))) {
    return { isFavorite: true, bondExp: bonusExp };
  }

  return { isFavorite: false, bondExp: baseExp };
}

/** 取得某寵物今日已使用道具數 */
export function getDailyBondItemUsage(petId, date, inventory) {
  const logs = inventory?.itemUsageLogs || {};
  const dayLog = logs[date] || {};
  const petLog = dayLog[petId] || {};
  return petLog.bondItemsUsed ?? 0;
}

/** 是否可使用親密度道具 */
export async function canUseBondItem(itemId, petId, allPets = []) {
  const craftable = getCraftableInfo(itemId);
  if (craftable.type !== 'bond_item' && craftable.type !== 'favorite_bond_item') {
    return { ok: false, reason: '此道具無法贈送' };
  }

  const inventory = await getInventory();
  const count = inventory.items[itemId] || 0;
  if (count <= 0) {
    return { ok: false, reason: '道具庫存不足' };
  }

  const collection = await getPetCollection(petId);
  if (!collection) {
    return { ok: false, reason: '尚未獲得此寵物' };
  }

  const today = getTodayDateString();
  const used = getDailyBondItemUsage(petId, today, inventory);
  if (used >= DAILY_BOND_ITEM_LIMIT) {
    return { ok: false, reason: '今天這隻寵物已經收到足夠多禮物了，明天再來吧。' };
  }

  const pet = allPets.find((p) => p.id === petId) || { id: petId };
  const bonus = getFavoriteBonus(craftable, pet);

  return {
    ok: true,
    bondExp: bonus.bondExp,
    isFavorite: bonus.isFavorite,
    dailyUsed: used,
    dailyLimit: DAILY_BOND_ITEM_LIMIT,
  };
}

/** 預覽贈送效果 */
export async function getGiftPreview(itemId, petId, allPets = []) {
  const check = await canUseBondItem(itemId, petId, allPets);
  if (!check.ok) return check;

  const collection = await getPetCollection(petId);
  const oldLevel = collection.bondLevel ?? getBondLevelFromExp(collection.bondExp ?? 0);
  const newExp = (collection.bondExp ?? 0) + check.bondExp;
  const newLevel = getBondLevelFromExp(newExp);

  return {
    ok: true,
    bondExp: check.bondExp,
    isFavorite: check.isFavorite,
    dailyUsed: check.dailyUsed,
    dailyLimit: check.dailyLimit,
    currentBondExp: collection.bondExp ?? 0,
    currentBondLevel: oldLevel,
    willLevelUp: newLevel > oldLevel,
    newBondLevel: newLevel,
    progress: getBondProgress(collection.bondExp ?? 0, oldLevel),
    afterProgress: getBondProgress(newExp, newLevel),
  };
}

/**
 * 使用親密度道具
 */
export async function useBondItem(itemId, petId, allPets = []) {
  if (usingLock) {
    return { success: false, message: '贈送進行中，請稍候' };
  }

  const check = await canUseBondItem(itemId, petId, allPets);
  if (!check.ok) {
    return { success: false, message: check.reason };
  }

  const craftable = getCraftableInfo(itemId);
  usingLock = true;

  try {
    const inventory = await getInventory();
    inventory.items[itemId] = (inventory.items[itemId] || 0) - 1;
    if (inventory.items[itemId] < 0) inventory.items[itemId] = 0;

    const today = getTodayDateString();
    if (!inventory.itemUsageLogs[today]) inventory.itemUsageLogs[today] = {};
    if (!inventory.itemUsageLogs[today][petId]) {
      inventory.itemUsageLogs[today][petId] = { bondItemsUsed: 0 };
    }
    inventory.itemUsageLogs[today][petId].bondItemsUsed += 1;
    await saveInventory(inventory);

    const bondResult = await addBondExpToPet(petId, check.bondExp);

    const stats = await getWorkshopStats();
    stats.giftCount += 1;
    if (!stats.firstGiftAt) stats.firstGiftAt = new Date().toISOString();
    if (check.isFavorite) {
      stats.favoriteGiftCount += 1;
      if (!stats.firstFavoriteGiftAt) stats.firstFavoriteGiftAt = new Date().toISOString();
    }
    await saveWorkshopStats(stats);

    return {
      success: true,
      bondExp: check.bondExp,
      isFavorite: check.isFavorite,
      leveledUp: bondResult?.leveledUp ?? false,
      newLevel: bondResult?.newLevel,
      itemName: craftable.name,
      message: check.isFavorite
        ? `牠很喜歡這份禮物！親密度 +${check.bondExp}`
        : `親密度提升 +${check.bondExp}`,
    };
  } finally {
    usingLock = false;
  }
}

/** 是否有足夠材料製作任一道具 */
export function hasCraftableMaterials(wallet, craftables) {
  return (craftables || []).some(
    (c) => c.enabled && canCraft(c, wallet, 1)
  );
}

/** 是否有可贈送的親密度道具 */
export function hasBondItemsInInventory(inventory, craftables) {
  const items = inventory?.items || {};
  return (craftables || []).some((c) => {
    if (c.type !== 'bond_item' && c.type !== 'favorite_bond_item') return false;
    return (items[c.id] || 0) > 0;
  });
}

/** 陪伴寵物是否對庫存道具有喜好加成 */
export function companionLikesAnyGift(companion, inventory, craftables) {
  if (!companion) return false;
  const items = inventory?.items || {};
  return (craftables || []).some((c) => {
    if (c.type !== 'favorite_bond_item') return false;
    if ((items[c.id] || 0) <= 0) return false;
    return getFavoriteBonus(c, companion).isFavorite;
  });
}

/** 材料是否很少或沒有 */
export function hasLowMaterials(wallet) {
  const materials = wallet?.materials || {};
  const total = Object.values(materials).reduce((sum, n) => sum + (n || 0), 0);
  return total <= 2;
}

/** 取得啟用的 craftables */
export function getEnabledCraftables() {
  return (craftablesCatalog || []).filter((c) => c.enabled);
}

/** 匯出 inventory */
export async function exportInventory() {
  return getInventory();
}

/** 匯出 workshopStats */
export async function exportWorkshopStats() {
  return getWorkshopStats();
}

/** 匯入 inventory */
export async function importInventory(data) {
  const normalized = normalizeInventory(data);
  await loadCraftables();
  for (const id of DEFAULT_ITEM_IDS) {
    if (normalized.items[id] === undefined) normalized.items[id] = 0;
  }
  await saveInventory(normalized);
  return normalized;
}

/** 匯入 workshopStats */
export async function importWorkshopStats(data) {
  const normalized = normalizeWorkshopStats(data);
  await saveWorkshopStats(normalized);
  return normalized;
}

/** 道具效果描述文字 */
export function formatItemEffect(craftable) {
  if (!craftable?.effect) return '';
  const base = craftable.effect.bondExp ?? 0;
  if (craftable.type === 'favorite_bond_item') {
    const bonus = craftable.effect.favoriteBonusBondExp ?? base;
    return `親密度 +${base}（喜好 +${bonus}）`;
  }
  return `親密度 +${base}`;
}

/** 未來標籤 HTML 用標籤列表 */
export function getFutureTagLabels(tags = []) {
  return tags
    .map((t) => FUTURE_TAG_LABELS[t] || t)
    .filter(Boolean);
}
