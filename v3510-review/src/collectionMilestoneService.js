/**
 * 圖鑑收藏里程碑 — 定義、即時計算、狀態正規化與安全領獎
 */
import { dbGet, dbPut, STORES } from './db.js';
import { getCollection } from './collectionService.js';
import { applyStardustRewardAndUpdateMeta } from './rewardService.js';

export const COLLECTION_MILESTONES_KEY = 'collectionMilestones';
export const COLLECTION_MILESTONE_STATE_VERSION = 1;
export const COLLECTION_RARITY_ORDER = ['N', 'R', 'SR', 'SSR', 'UR'];
export const COLLECTION_MILESTONE_CONDITION_TYPES = [
  'owned_count',
  'rarity_owned_count',
  'all_rarity',
  'star_count',
  'bond_level_count',
  'bond_liberated_count',
  'all_pets',
];

const badge = (badgeId, name, description, icon = '🏅') => ({
  badgeId,
  name,
  description,
  source: 'collection_milestone',
  icon,
});

export const COLLECTION_MILESTONE_DEFINITIONS = [
  { id: 'collection_005', category: 'collection', title: '收藏起步', description: '收集 5 隻不同寵物', conditionType: 'owned_count', target: 5, reward: { stardust: 20, badgeId: 'collection_005' }, badge: badge('collection_005', '收藏起步', '收集 5 隻不同寵物', '📖'), order: 10 },
  { id: 'collection_010', category: 'collection', title: '小小收藏家', description: '收集 10 隻不同寵物', conditionType: 'owned_count', target: 10, reward: { stardust: 30, badgeId: 'collection_010' }, badge: badge('collection_010', '小小收藏家', '收集 10 隻不同寵物', '📚'), order: 20 },
  { id: 'collection_020', category: 'collection', title: '圖鑑探索者', description: '收集 20 隻不同寵物', conditionType: 'owned_count', target: 20, reward: { stardust: 50, badgeId: 'collection_020' }, badge: badge('collection_020', '圖鑑探索者', '收集 20 隻不同寵物', '🧭'), order: 30 },
  { id: 'collection_030', category: 'collection', title: '資深收藏家', description: '收集 30 隻不同寵物', conditionType: 'owned_count', target: 30, reward: { stardust: 60, badgeId: 'collection_030' }, badge: badge('collection_030', '資深收藏家', '收集 30 隻不同寵物', '🏅'), order: 40 },
  { id: 'collection_040', category: 'collection', title: '珍獸鑑賞家', description: '收集 40 隻不同寵物', conditionType: 'owned_count', target: 40, reward: { stardust: 80, badgeId: 'collection_040' }, badge: badge('collection_040', '珍獸鑑賞家', '收集 40 隻不同寵物', '💎'), order: 50 },
  { id: 'collection_050', category: 'collection', title: '圖鑑大師', description: '收集 50 隻不同寵物', conditionType: 'owned_count', target: 50, reward: { stardust: 100, badgeId: 'collection_050' }, badge: badge('collection_050', '圖鑑大師', '收集 50 隻不同寵物', '👑'), order: 60 },
  { id: 'collection_all', category: 'collection', title: '完整圖鑑', description: '收集目前圖鑑中的所有寵物', conditionType: 'all_pets', targetMode: 'dynamic', reward: { stardust: 200, badgeId: 'collection_all' }, badge: badge('collection_all', '完整圖鑑', '收集目前圖鑑中的所有寵物', '🌟'), order: 70 },

  { id: 'rarity_first_sr', category: 'rarity', title: '稀有相遇', description: '獲得第一隻 SR', conditionType: 'rarity_owned_count', rarity: 'SR', target: 1, reward: { stardust: 20, badgeId: 'rarity_first_sr' }, badge: badge('rarity_first_sr', '稀有相遇', '獲得第一隻 SR', '💜'), order: 110 },
  { id: 'rarity_first_ssr', category: 'rarity', title: '金色邂逅', description: '獲得第一隻 SSR', conditionType: 'rarity_owned_count', rarity: 'SSR', target: 1, reward: { stardust: 25, badgeId: 'rarity_first_ssr' }, badge: badge('rarity_first_ssr', '金色邂逅', '獲得第一隻 SSR', '✨'), order: 120 },
  { id: 'rarity_first_ur', category: 'rarity', title: '傳說降臨', description: '獲得第一隻 UR', conditionType: 'rarity_owned_count', rarity: 'UR', target: 1, reward: { stardust: 30, badgeId: 'rarity_first_ur' }, badge: badge('rarity_first_ur', '傳說降臨', '獲得第一隻 UR', '🌈'), order: 130 },
  { id: 'rarity_all_n', category: 'rarity', title: '平凡中的珍寶', description: '收集所有 N 寵物', conditionType: 'all_rarity', rarity: 'N', targetMode: 'dynamic', reward: { stardust: 40, badgeId: 'rarity_all_n' }, badge: badge('rarity_all_n', '平凡中的珍寶', '收集所有 N 寵物', '🩶'), order: 140 },
  { id: 'rarity_all_r', category: 'rarity', title: '進階收藏', description: '收集所有 R 寵物', conditionType: 'all_rarity', rarity: 'R', targetMode: 'dynamic', reward: { stardust: 50, badgeId: 'rarity_all_r' }, badge: badge('rarity_all_r', '進階收藏', '收集所有 R 寵物', '💙'), order: 150 },
  { id: 'rarity_sr_5', category: 'rarity', title: '稀有收藏', description: '收集 5 隻不同 SR', conditionType: 'rarity_owned_count', rarity: 'SR', target: 5, reward: { stardust: 40, badgeId: 'rarity_sr_5' }, badge: badge('rarity_sr_5', '稀有收藏', '收集 5 隻不同 SR', '🔮'), order: 160 },
  { id: 'rarity_ssr_5', category: 'rarity', title: '璀璨收藏', description: '收集 5 隻不同 SSR', conditionType: 'rarity_owned_count', rarity: 'SSR', target: 5, reward: { stardust: 50, badgeId: 'rarity_ssr_5' }, badge: badge('rarity_ssr_5', '璀璨收藏', '收集 5 隻不同 SSR', '🌠'), order: 170 },
  { id: 'rarity_ur_3', category: 'rarity', title: '傳說收藏', description: '收集 3 隻不同 UR', conditionType: 'rarity_owned_count', rarity: 'UR', target: 3, reward: { stardust: 50, badgeId: 'rarity_ur_3' }, badge: badge('rarity_ur_3', '傳說收藏', '收集 3 隻不同 UR', '👑'), order: 180 },

  { id: 'star_first_3', category: 'star', title: '初次成長', description: '擁有第一隻 3 星寵物', conditionType: 'star_count', minStars: 3, target: 1, reward: { stardust: 30, badgeId: 'star_first_3' }, badge: badge('star_first_3', '初次成長', '擁有第一隻 3 星寵物', '⭐'), order: 210 },
  { id: 'star_first_5', category: 'star', title: '繁星之巔', description: '擁有第一隻 5 星寵物', conditionType: 'star_count', minStars: 5, target: 1, reward: { stardust: 50, badgeId: 'star_first_5' }, badge: badge('star_first_5', '繁星之巔', '擁有第一隻 5 星寵物', '🌟'), order: 220 },
  { id: 'star_three_5', category: 'star', title: '群星閃耀', description: '擁有 5 隻 3 星以上寵物', conditionType: 'star_count', minStars: 3, target: 5, reward: { stardust: 50, badgeId: 'star_three_5' }, badge: badge('star_three_5', '群星閃耀', '擁有 5 隻 3 星以上寵物', '✨'), order: 230 },
  { id: 'star_five_3', category: 'star', title: '五星珍藏', description: '擁有 3 隻 5 星寵物', conditionType: 'star_count', minStars: 5, target: 3, reward: { stardust: 60, badgeId: 'star_five_3' }, badge: badge('star_five_3', '五星珍藏', '擁有 3 隻 5 星寵物', '🌠'), order: 240 },

  { id: 'bond_first_lv3', category: 'bond', title: '心意相通', description: '第一隻寵物達到羈絆 Lv.3', conditionType: 'bond_level_count', minBondLevel: 3, target: 1, reward: { stardust: 30, badgeId: 'bond_first_lv3' }, badge: badge('bond_first_lv3', '心意相通', '第一隻寵物達到羈絆 Lv.3', '💞'), order: 310 },
  { id: 'bond_first_liberated', category: 'bond', title: '羈絆解放', description: '第一隻寵物完成羈絆解放', conditionType: 'bond_liberated_count', target: 1, reward: { stardust: 50, badgeId: 'bond_first_liberated' }, badge: badge('bond_first_liberated', '羈絆解放', '第一隻寵物完成羈絆解放', '💠'), order: 320 },
  { id: 'bond_liberated_5', category: 'bond', title: '永恆夥伴', description: '5 隻寵物完成羈絆解放', conditionType: 'bond_liberated_count', target: 5, reward: { stardust: 80, badgeId: 'bond_liberated_5' }, badge: badge('bond_liberated_5', '永恆夥伴', '5 隻寵物完成羈絆解放', '🤝'), order: 330 },
];

const validMilestoneIds = new Set(COLLECTION_MILESTONE_DEFINITIONS.map((item) => item.id));
const claimingIds = new Set();

export function normalizeCollectionMilestoneState(data) {
  const claimedIds = Array.isArray(data?.claimedIds)
    ? [...new Set(data.claimedIds.filter((id) => typeof id === 'string' && validMilestoneIds.has(id)))]
    : [];
  return {
    key: COLLECTION_MILESTONES_KEY,
    version: COLLECTION_MILESTONE_STATE_VERSION,
    claimedIds,
    lastUpdatedAt: typeof data?.lastUpdatedAt === 'string' ? data.lastUpdatedAt : null,
  };
}

export async function getCollectionMilestoneState() {
  const raw = await dbGet(STORES.META, COLLECTION_MILESTONES_KEY);
  return normalizeCollectionMilestoneState(raw);
}

export async function initCollectionMilestones() {
  const state = await getCollectionMilestoneState();
  await dbPut(STORES.META, state);
  return state;
}

export function buildCollectionMilestoneContext(allPets = [], collection = []) {
  const catalog = Array.isArray(allPets) ? allPets.filter((pet) => pet?.id) : [];
  const catalogById = new Map(catalog.map((pet) => [pet.id, pet]));
  const collectionById = new Map();
  for (const item of Array.isArray(collection) ? collection : []) {
    if (item?.petId && catalogById.has(item.petId) && !collectionById.has(item.petId)) {
      collectionById.set(item.petId, item);
    }
  }

  const rarityTotals = Object.fromEntries(COLLECTION_RARITY_ORDER.map((rarity) => [rarity, 0]));
  const rarityOwned = Object.fromEntries(COLLECTION_RARITY_ORDER.map((rarity) => [rarity, 0]));
  for (const pet of catalog) {
    if (COLLECTION_RARITY_ORDER.includes(pet.rarity)) {
      rarityTotals[pet.rarity] += 1;
      if (collectionById.has(pet.id)) rarityOwned[pet.rarity] += 1;
    }
  }

  const ownedItems = [...collectionById.values()];
  return {
    totalPets: catalog.length,
    ownedCount: collectionById.size,
    rarityTotals,
    rarityOwned,
    starCounts: {
      atLeast3: ownedItems.filter((item) => Number(item.stars ?? 1) >= 3).length,
      atLeast5: ownedItems.filter((item) => Number(item.stars ?? 1) >= 5).length,
    },
    bondLevelCounts: {
      atLeast3: ownedItems.filter((item) => Number(item.bondLevel ?? 1) >= 3).length,
    },
    bondLiberatedCount: ownedItems.filter(
      (item) => item.bondUnlocks?.bondLiberated === true || Number(item.bondLevel ?? 1) >= 5
    ).length,
  };
}

export function resolveCollectionMilestoneDefinitions(allPets = []) {
  const rarityTotals = Object.fromEntries(COLLECTION_RARITY_ORDER.map((rarity) => [rarity, 0]));
  for (const pet of Array.isArray(allPets) ? allPets : []) {
    if (COLLECTION_RARITY_ORDER.includes(pet?.rarity)) rarityTotals[pet.rarity] += 1;
  }
  return COLLECTION_MILESTONE_DEFINITIONS.map((definition) => {
    if (definition.conditionType === 'all_pets') {
      return { ...definition, target: allPets.length };
    }
    if (definition.conditionType === 'all_rarity') {
      return { ...definition, target: rarityTotals[definition.rarity] ?? 0 };
    }
    return { ...definition };
  });
}

export function getCollectionMilestoneProgress(definition, context) {
  switch (definition.conditionType) {
    case 'owned_count':
    case 'all_pets':
      return context.ownedCount;
    case 'rarity_owned_count':
    case 'all_rarity':
      return context.rarityOwned[definition.rarity] ?? 0;
    case 'star_count':
      return definition.minStars >= 5 ? context.starCounts.atLeast5 : context.starCounts.atLeast3;
    case 'bond_level_count':
      return context.bondLevelCounts.atLeast3;
    case 'bond_liberated_count':
      return context.bondLiberatedCount;
    default:
      return 0;
  }
}

export function buildCollectionMilestoneSummary(allPets, collection, milestoneState) {
  const context = buildCollectionMilestoneContext(allPets, collection);
  const state = normalizeCollectionMilestoneState(milestoneState);
  const claimed = new Set(state.claimedIds);
  const definitions = resolveCollectionMilestoneDefinitions(allPets);
  const items = definitions.map((definition) => {
    const target = Math.max(0, Number(definition.target) || 0);
    const rawProgress = Math.max(0, getCollectionMilestoneProgress(definition, context));
    const progress = target > 0 ? Math.min(rawProgress, target) : 0;
    const met = target > 0 && rawProgress >= target;
    const isClaimed = claimed.has(definition.id);
    return {
      ...definition,
      progress,
      rawProgress,
      target,
      percent: target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0,
      met,
      claimed: isClaimed,
      status: isClaimed ? 'claimed' : met ? 'claimable' : 'in_progress',
    };
  });

  const collectionTargets = items
    .filter((item) => item.conditionType === 'owned_count' || item.conditionType === 'all_pets')
    .filter((item) => item.target > context.ownedCount)
    .sort((a, b) => a.target - b.target || a.order - b.order);
  const nextMilestone = collectionTargets[0] ?? null;

  return {
    context,
    state,
    items,
    total: items.length,
    metCount: items.filter((item) => item.met).length,
    claimedCount: items.filter((item) => item.claimed).length,
    claimableCount: items.filter((item) => item.status === 'claimable').length,
    completionRate: context.totalPets > 0
      ? Math.min(100, Math.round((context.ownedCount / context.totalPets) * 100))
      : 0,
    nextMilestone,
    unlockedBadges: items.filter((item) => item.claimed).map((item) => item.badge),
  };
}

export async function getCollectionMilestoneSummary(allPets = []) {
  const [collection, milestoneState] = await Promise.all([
    getCollection(),
    getCollectionMilestoneState(),
  ]);
  return buildCollectionMilestoneSummary(allPets, collection, milestoneState);
}

export async function claimCollectionMilestone(milestoneId, allPets = []) {
  if (claimingIds.has(milestoneId)) {
    return { success: false, error: '正在領取中，請稍候' };
  }
  claimingIds.add(milestoneId);

  try {
    const definition = resolveCollectionMilestoneDefinitions(allPets)
      .find((item) => item.id === milestoneId);
    if (!definition) return { success: false, error: '收藏里程碑不存在' };

    const [collection, currentState] = await Promise.all([
      getCollection(),
      getCollectionMilestoneState(),
    ]);
    if (currentState.claimedIds.includes(milestoneId)) {
      return { success: false, error: '獎勵已領取' };
    }

    const context = buildCollectionMilestoneContext(allPets, collection);
    const progress = getCollectionMilestoneProgress(definition, context);
    if (definition.target <= 0 || progress < definition.target) {
      return { success: false, error: '收藏里程碑尚未完成' };
    }

    const nextState = await applyStardustRewardAndUpdateMeta({
      stardust: definition.reward?.stardust ?? 0,
      stateKey: COLLECTION_MILESTONES_KEY,
      updateState: (rawState) => {
        const normalized = normalizeCollectionMilestoneState(rawState);
        if (normalized.claimedIds.includes(milestoneId)) return null;
        return {
          ...normalized,
          claimedIds: [...normalized.claimedIds, milestoneId],
          lastUpdatedAt: new Date().toISOString(),
        };
      },
    });

    if (!nextState) return { success: false, error: '獎勵已領取' };
    return {
      success: true,
      milestone: definition,
      reward: definition.reward,
      badge: definition.badge,
      state: nextState,
    };
  } catch (error) {
    return { success: false, error: error?.message || '收藏里程碑領取失敗' };
  } finally {
    claimingIds.delete(milestoneId);
  }
}

export async function exportCollectionMilestoneState() {
  return getCollectionMilestoneState();
}
