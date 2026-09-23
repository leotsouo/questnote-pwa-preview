/**
 * 放置探險系統 — 地區解鎖、派遣、獎勵計算
 */
import { dbGetAll, dbGet, dbPut, STORES } from './db.js';
import {
  getWallet,
  spendAdventureEnergy,
  addStardust,
  addMaterial,
} from './rewardService.js';
import {
  getPetCollection,
  getCollection,
  addBondExpToPet,
  addFragments,
} from './collectionService.js';

/** 稀有度星塵加成 */
const RARITY_BONUS = { N: 0, R: 0.05, SR: 0.1, SSR: 0.15, UR: 0.2 };

/** 親密度等級星塵加成 */
const BOND_LEVEL_BONUS = { 1: 0, 2: 0.02, 3: 0.04, 4: 0.06, 5: 0.1 };

/** 材料顯示名稱 */
export const MATERIAL_LABELS = {
  forest_leaf: '森林之葉',
  lava_core: '熔岩核心',
  machine_part: '機械零件',
  star_shard: '星界碎片',
  aurora_ice: '極光冰晶',
  harvest_charm: '豐穗護符',
};

/**
 * 載入探險地區設定
 */
export async function loadExpeditionAreas() {
  const res = await fetch('./data/expeditions.json');
  if (!res.ok) throw new Error('無法載入探險資料');
  const data = await res.json();
  return data.areas || [];
}

/** 正規化探險紀錄 */
export function normalizeExpedition(expedition) {
  if (!expedition || typeof expedition !== 'object') return null;
  return {
    ...expedition,
    id: expedition.id,
    areaId: expedition.areaId ?? null,
    petId: expedition.petId ?? null,
    startedAt: expedition.startedAt ?? null,
    endsAt: expedition.endsAt ?? null,
    claimed: expedition.claimed ?? false,
    rewards: expedition.rewards ?? null,
  };
}

/** 取得所有探險紀錄 */
export async function getAllExpeditions() {
  const rows = await dbGetAll(STORES.EXPEDITIONS);
  return rows.map(normalizeExpedition).filter(Boolean);
}

/** 取得進行中或未領取的探險（同一時間最多一筆） */
export async function getActiveExpedition() {
  const all = await getAllExpeditions();
  return all.find((e) => !e.claimed) ?? null;
}

/** 判斷探險是否已結束（依 endsAt） */
export function isExpeditionTimeComplete(expedition) {
  if (!expedition?.endsAt) return false;
  return Date.now() >= new Date(expedition.endsAt).getTime();
}

/** 計算剩餘毫秒 */
export function getRemainingMs(expedition) {
  if (!expedition?.endsAt) return 0;
  return Math.max(0, new Date(expedition.endsAt).getTime() - Date.now());
}

/** 格式化倒數時間 */
export function formatRemainingTime(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function textContainsKeyword(text, keywords) {
  const t = text || '';
  return keywords.some((kw) => t.includes(kw));
}

function petMatchesElements(pet, elements) {
  const el = (pet.element || '').toLowerCase();
  return elements.some((e) => {
    const key = e.toLowerCase();
    return el === key || el.includes(key);
  });
}

function petMatchesTraitUnlock(pet, unlock) {
  const keywords = unlock.keywords || [];
  const elements = unlock.elements || [];
  const poolTags = unlock.poolTags || [];
  const tags = pet.poolTags || [];
  return (
    petMatchesElements(pet, elements) ||
    textContainsKeyword(pet.name, keywords) ||
    textContainsKeyword(pet.description, keywords) ||
    textContainsKeyword(pet.lore, keywords) ||
    (poolTags.length > 0 && poolTags.some((t) => tags.includes(t)))
  );
}

/**
 * 檢查地區是否解鎖
 * @returns {{ unlocked: boolean, hint: string }}
 */
export function checkAreaUnlock(area, ownedPets) {
  const unlock = area.unlock || { type: 'default' };

  if (unlock.type === 'default') {
    return { unlocked: true, hint: '' };
  }

  if (unlock.type === 'fire_pet') {
    const ok = ownedPets.some((p) => petMatchesTraitUnlock(p, unlock));
    return { unlocked: ok, hint: unlock.hint || '需要火屬性夥伴' };
  }

  if (unlock.type === 'mechanical_pet') {
    const ok = ownedPets.some((p) => petMatchesTraitUnlock(p, unlock));
    return { unlocked: ok, hint: unlock.hint || '需要機械系夥伴' };
  }

  if (unlock.type === 'frost_pet') {
    const ok = ownedPets.some((p) => petMatchesTraitUnlock(p, unlock));
    return { unlocked: ok, hint: unlock.hint || '需要極寒或北境系夥伴' };
  }

  if (unlock.type === 'rustic_pet') {
    const ok = ownedPets.some((p) => petMatchesTraitUnlock(p, unlock));
    return { unlocked: ok, hint: unlock.hint || '需要田園或守護系夥伴' };
  }

  if (unlock.type === 'ur_pet') {
    const ok = ownedPets.some((p) => p.rarity === 'UR');
    return { unlocked: ok, hint: unlock.hint || '需要 UR 寵物' };
  }

  return { unlocked: false, hint: '尚未解鎖' };
}

/** 計算星塵加成 */
export function getStardustBonuses(pet) {
  const rarityBonus = RARITY_BONUS[pet.rarity] ?? 0;
  const bondLevel = pet.bondLevel ?? 1;
  const bondBonus = BOND_LEVEL_BONUS[bondLevel] ?? 0;
  const totalBonus = rarityBonus + bondBonus;
  return { rarityBonus, bondBonus, totalBonus };
}

/**
 * 計算探險獎勵（領取時才真正發放）
 */
export function calculateExpeditionRewards(area, pet) {
  const rewards = area.rewards;
  const baseStardust = randomInt(rewards.stardust.min, rewards.stardust.max);
  const { rarityBonus, bondBonus, totalBonus } = getStardustBonuses(pet);
  const bonusStardust = Math.floor(baseStardust * totalBonus);
  const stardust = baseStardust + bonusStardust;

  const mat = rewards.material;
  const materialAmount = randomInt(mat.min, mat.max);
  const materials = materialAmount > 0 ? { [mat.id]: materialAmount } : {};

  let fragmentGained = 0;
  if (rewards.fragmentChance && pet.rarity === 'UR' && Math.random() < rewards.fragmentChance) {
    fragmentGained = 1;
  }

  return {
    stardust,
    baseStardust,
    bonusStardust,
    rarityBonus,
    bondBonus,
    totalBonus,
    materials,
    bondExp: rewards.bondExp || 0,
    fragmentGained,
    petId: pet.id,
  };
}

/**
 * 開始探險
 */
export async function startExpedition(petId, areaId, areas, allPets) {
  const active = await getActiveExpedition();
  if (active) {
    throw new Error('已有探險進行中，請先完成或領取獎勵');
  }

  const area = areas.find((a) => a.id === areaId);
  if (!area) throw new Error('探險地區不存在');

  const petData = allPets.find((p) => p.id === petId);
  const collection = await getPetCollection(petId);
  if (!collection || !petData) {
    throw new Error('尚未獲得此寵物，無法派遣');
  }

  const enrichedOwned = await getOwnedPetsForUnlock(allPets);
  const { unlocked, hint } = checkAreaUnlock(area, enrichedOwned);
  if (!unlocked) {
    throw new Error(`地區未解鎖：${hint}`);
  }

  const wallet = await getWallet();
  if ((wallet.adventureEnergy || 0) < area.energyCost) {
    throw new Error(`冒險能量不足（需要 ${area.energyCost}）`);
  }

  await spendAdventureEnergy(area.energyCost);

  const now = new Date();
  const endsAt = new Date(now.getTime() + area.durationMinutes * 60 * 1000);

  const expedition = {
    id: `expedition_${now.getTime()}`,
    petId,
    areaId,
    durationMinutes: area.durationMinutes,
    energyCost: area.energyCost,
    startedAt: now.toISOString(),
    endsAt: endsAt.toISOString(),
    completed: false,
    claimed: false,
    rewardsPreview: null,
    rewardsFinal: null,
  };

  await dbPut(STORES.EXPEDITIONS, expedition);
  return expedition;
}

/** 取得已擁有寵物（合併資料）用於解鎖判定 */
async function getOwnedPetsForUnlock(allPets) {
  const collection = await getCollection();
  const ownedIds = new Set(collection.map((c) => c.petId));
  return allPets.filter((p) => ownedIds.has(p.id));
}

/** 標記探險完成（時間到） */
export async function markExpeditionComplete(expeditionId) {
  const exp = await dbGet(STORES.EXPEDITIONS, expeditionId);
  if (!exp || exp.completed) return exp;
  exp.completed = true;
  await dbPut(STORES.EXPEDITIONS, exp);
  return exp;
}

/** 強制結束進行中的探險（開發測試用） */
export async function forceCompleteActiveExpedition() {
  const active = await getActiveExpedition();
  if (!active) throw new Error('沒有進行中的探險');

  const now = new Date().toISOString();
  active.endsAt = now;
  active.completed = true;
  await dbPut(STORES.EXPEDITIONS, active);
  return active;
}

/**
 * 領取探險獎勵
 */
export async function claimExpeditionRewards(expeditionId, areas, allPets) {
  const exp = await dbGet(STORES.EXPEDITIONS, expeditionId);
  if (!exp) throw new Error('探險紀錄不存在');
  if (exp.claimed) throw new Error('獎勵已領取');
  if (!isExpeditionTimeComplete(exp)) {
    throw new Error('探險尚未結束');
  }

  const area = areas.find((a) => a.id === exp.areaId);
  if (!area) throw new Error('探險地區不存在');

  const collection = await getPetCollection(exp.petId);
  const petData = allPets.find((p) => p.id === exp.petId);
  if (!collection || !petData) throw new Error('寵物資料不存在');

  const pet = {
    ...petData,
    bondLevel: collection.bondLevel ?? 1,
    bondExp: collection.bondExp ?? 0,
  };

  const rewards = calculateExpeditionRewards(area, pet);

  await addStardust(rewards.stardust);

  for (const [matId, amount] of Object.entries(rewards.materials)) {
    if (amount > 0) await addMaterial(matId, amount);
  }

  const bondResult = await addBondExpToPet(exp.petId, rewards.bondExp);

  if (rewards.fragmentGained > 0) {
    await addFragments(exp.petId, rewards.fragmentGained);
  }

  exp.completed = true;
  exp.claimed = true;
  exp.rewardsFinal = rewards;
  await dbPut(STORES.EXPEDITIONS, exp);

  return { expedition: exp, rewards, bond: bondResult, pet };
}

/** 寵物是否正在探險中 */
export function isPetOnExpedition(petId, activeExpedition) {
  return activeExpedition?.petId === petId && !activeExpedition.claimed;
}

export async function exportExpeditions() {
  return getAllExpeditions();
}

export async function importExpeditions(items) {
  for (const item of items) {
    const normalized = normalizeExpedition(item);
    if (normalized?.id) await dbPut(STORES.EXPEDITIONS, normalized);
  }
}
