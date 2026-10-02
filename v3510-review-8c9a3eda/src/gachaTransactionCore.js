/** Synchronous draw planner. Input records are copied; no persistence or UI effects. */
import { normalizeWallet } from './rewardService.js';
import { normalizeEntry, createCollectionEntry, FRAGMENT_BY_RARITY } from './collectionService.js';
import { normalizePoolUnlockState, normalizeIdempotentGrants, emptyPoolUnlockEntry, applyPoolDrawProgress } from './poolUnlockCore.js';
import { resolveActivePool, resolveDrawCost, resolveEffectivePool, validatePoolContent } from './poolContentContract.js';
import { getEligiblePetsForPool } from './petPoolFilter.js';
const GACHA_STATS_KEY = 'gachaStats';
const DEFAULT_PITY = { ssr: 30, ur: 100 };
const RARITY_RANK = { N: 0, R: 1, SR: 2, SSR: 3, UR: 4 };

export class InsufficientStardustError extends Error {
  constructor(cost) { super('星塵不足'); this.name = 'InsufficientStardustError'; this.cost = cost; }
}

function emptyPoolPity() {
  return { ssrPity: 0, urPity: 0 };
}

export function normalizeGachaStats(stats) {
  if (!stats) {
    return {
      key: GACHA_STATS_KEY,
      ssrPity: 0,
      urPity: 0,
      totalPulls: 0,
      tenPullCount: 0,
      selectedPoolId: null,
      poolPity: {
        standard: emptyPoolPity(),
      },
    };
  }

  const ssrPity = stats.ssrPity ?? 0;
  const urPity = stats.urPity ?? 0;
  const poolPity = Object.fromEntries(Object.entries(stats.poolPity && typeof stats.poolPity === 'object' ? stats.poolPity : {})
    .map(([id, counters]) => [id, { ...counters }]));

  if (!poolPity.standard) {
    poolPity.standard = { ssrPity, urPity };
  } else {
    poolPity.standard = {
      ssrPity: poolPity.standard.ssrPity ?? ssrPity,
      urPity: poolPity.standard.urPity ?? urPity,
    };
  }

  return {
    key: GACHA_STATS_KEY,
    ssrPity: poolPity.standard.ssrPity,
    urPity: poolPity.standard.urPity,
    totalPulls: stats.totalPulls ?? 0,
    tenPullCount: stats.tenPullCount ?? 0,
    selectedPoolId: typeof stats.selectedPoolId === 'string' ? stats.selectedPoolId : null,
    poolPity,
  };
}

export function ensurePoolPity(stats, poolId) {
  const normalized = normalizeGachaStats(stats);
  const id = poolId || 'standard';
  if (!normalized.poolPity[id]) {
    if (id === 'standard') {
      normalized.poolPity.standard = {
        ssrPity: normalized.ssrPity ?? 0,
        urPity: normalized.urPity ?? 0,
      };
    } else {
      normalized.poolPity[id] = emptyPoolPity();
    }
  }
  return normalized;
}

export function getPoolPityCounters(stats, poolId) {
  const ensured = ensurePoolPity(stats, poolId);
  return ensured.poolPity[poolId || 'standard'];
}

function pickPetByRarity(poolPets, rarity, rng) {
  const candidates = poolPets.filter((p) => p.rarity === rarity);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rng() * candidates.length)];
}

function rollRarity(rates, rng) {
  const roll = rng();
  let cumulative = 0;
  const order = ['N', 'R', 'SR', 'SSR', 'UR'];

  for (const rarity of order) {
    cumulative += rates[rarity] ?? 0;
    if (roll < cumulative) return rarity;
  }
  return 'N';
}

function rollSSRPlus(rates, poolPets, rng) {
  const ssrRate = rates.SSR ?? 0.03;
  const urRate = rates.UR ?? 0.02;
  const total = ssrRate + urRate;
  const roll = rng();

  if (roll < urRate / total && poolPets.some((p) => p.rarity === 'UR')) {
    return 'UR';
  }
  if (poolPets.some((p) => p.rarity === 'SSR')) return 'SSR';
  if (poolPets.some((p) => p.rarity === 'UR')) return 'UR';
  return 'SSR';
}

function determineRarity(poolPityCounters, pool, poolPets, rng) {
  const pity = { ...DEFAULT_PITY, ...pool.pity };
  const rates = pool.rates;

  if (poolPityCounters.urPity >= pity.ur - 1) {
    return { rarity: 'UR', triggeredPity: true };
  }

  if (poolPityCounters.ssrPity >= pity.ssr - 1) {
    return { rarity: rollSSRPlus(rates, poolPets, rng), triggeredPity: true };
  }

  return { rarity: rollRarity(rates, rng), triggeredPity: false };
}

function updatePityCounters(stats, poolId, rarity) {
  const ensured = ensurePoolPity(stats, poolId);
  const counters = ensured.poolPity[poolId];

  if (rarity === 'UR') {
    counters.ssrPity = 0;
    counters.urPity = 0;
  } else if (rarity === 'SSR') {
    counters.ssrPity = 0;
    counters.urPity += 1;
  } else {
    counters.ssrPity += 1;
    counters.urPity += 1;
  }

  ensured.totalPulls += 1;

  if (poolId === 'standard') {
    ensured.ssrPity = counters.ssrPity;
    ensured.urPity = counters.urPity;
  }

  return ensured;
}

function resolvePetFromRarity(poolPets, rarity, rng) {
  let pet = pickPetByRarity(poolPets, rarity, rng);

  if (!pet) {
    const fallbackOrder = ['UR', 'SSR', 'SR', 'R', 'N'];
    for (const r of fallbackOrder) {
      pet = pickPetByRarity(poolPets, r, rng);
      if (pet) break;
    }
  }

  return pet;
}

export function planGachaTransaction({ allPets, poolsData, selectedPoolId, count,
  wallet: rawWallet, stats: rawStats, unlockState: rawUnlock, grants: rawGrants,
  collection: rawCollection, rng = Math.random, now = new Date().toISOString() }) {
  let stats = normalizeGachaStats(rawStats);
  if (![stats.totalPulls, stats.tenPullCount].every((value) => Number.isSafeInteger(value) && value >= 0)) {
    throw new Error('抽卡統計資料無效');
  }
  const pool = resolveActivePool(poolsData, selectedPoolId ?? stats.selectedPoolId);
  if (!pool) throw new Error('目前沒有可召喚的卡池');
  const cost = resolveDrawCost(pool, count);
  const validation = validatePoolContent({ pools: [pool] }, { pets: allPets });
  if (!validation.ok) throw new Error('卡池資料無效：' + validation.errors.map((issue) => issue.message).join('；'));
  const wallet = normalizeWallet(rawWallet);
  if (!Number.isSafeInteger(wallet.stardust) || wallet.stardust < 0) throw new Error('星塵資料無效');
  if (wallet.stardust < cost) throw new InsufficientStardustError(cost);
  const state = normalizePoolUnlockState(rawUnlock);
  const grants = normalizeIdempotentGrants(rawGrants);
  const entryBefore = state.byPool[pool.id] || emptyPoolUnlockEntry(pool.id);
  const candidates = getEligiblePetsForPool(allPets, resolveEffectivePool(pool, entryBefore));
  if (!candidates.length) throw new Error('卡池中沒有可用寵物');
  const collection = new Map((rawCollection || []).map((item) => [item.petId, normalizeEntry(structuredClone(item))]));
  const changed = new Set();
  const random = () => {
    const value = rng();
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value >= 1) throw new Error('隨機數無效');
    return value;
  };
  wallet.stardust -= cost;
  const pulls = [];
  for (let index = 0; index < count; index++) {
    stats = ensurePoolPity(stats, pool.id);
    const counters = getPoolPityCounters(stats, pool.id);
    if (![counters.ssrPity, counters.urPity].every((value) => Number.isSafeInteger(value) && value >= 0)) {
      throw new Error('保底資料無效');
    }
    const { rarity, triggeredPity } = determineRarity(counters, pool, candidates, random);
    const pet = resolvePetFromRarity(candidates, rarity, random);
    if (!pet) throw new Error('無法從卡池抽取寵物');
    const existing = collection.get(pet.id);
    const isNew = !existing;
    const fragmentsGained = isNew ? 0 : FRAGMENT_BY_RARITY[pet.rarity];
    if (existing) {
      if (!Number.isSafeInteger(existing.fragments + fragmentsGained)) throw new Error('碎片數量無效');
      existing.fragments += fragmentsGained;
    } else collection.set(pet.id, createCollectionEntry(pet.id, now));
    changed.add(pet.id);
    stats = updatePityCounters(stats, pool.id, pet.rarity);
    if (!Number.isSafeInteger(stats.totalPulls)) throw new Error('抽卡累積數無效');
    stats.selectedPoolId = pool.id;
    pulls.push({ pet, rarity: pet.rarity, isNew, fragmentsGained, triggeredPity });
  }
  if (count === 10) {
    stats.tenPullCount += 1;
    if (!Number.isSafeInteger(stats.tenPullCount)) throw new Error('十連累積數無效');
  }
  // Eligibility was frozen before the first draw. Unlock and the gift happen after all draws.
  const unlockProgress = applyPoolDrawProgress({ state, grants, collection, changed,
    poolId: pool.id, expansion: pool.unlockExpansion, allPets, now }, count);
  const updatedCollection = [...collection.values()].sort((a, b) => a.petId < b.petId ? -1 : a.petId > b.petId ? 1 : 0);
  let result;
  if (count === 1) result = { ...pulls[0], pool, stats, unlockProgress };
  else {
    const results = pulls.map((pull) => ({ petId: pull.pet.id, pet: pull.pet, rarity: pull.rarity,
      isNew: pull.isNew, duplicateFragments: pull.fragmentsGained, triggeredPity: pull.triggeredPity }));
    const newCount = results.filter((pull) => pull.isNew).length;
    result = { success: true, cost, pool, results, summary: {
      newCount, duplicateCount: count - newCount,
      totalFragments: pulls.reduce((sum, pull) => sum + pull.fragmentsGained, 0),
      highestRarity: pulls.reduce((best, pull) => RARITY_RANK[pull.rarity] > RARITY_RANK[best] ? pull.rarity : best, 'N'),
    }, unlockProgress, updatedWallet: wallet, updatedCollection, updatedGachaStats: stats };
  }
  return { wallet, stats, unlockState: state, grants, collection: updatedCollection,
    changedCollection: [...changed].map((id) => collection.get(id)), result };
}
