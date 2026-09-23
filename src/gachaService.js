/** Atomic gacha service. Public result shapes are preserved for the existing reveal UI. */
import { dbGet, dbPut, dbUpdateRecord, dbMutateRecords, STORES } from './db.js';
import { getPoolUnlockEntry } from './poolUnlockService.js';
import { resolveActivePool, resolveEffectivePool } from './poolContentContract.js';
import { getEligiblePetsForPool } from './petPoolFilter.js';
import { normalizeGachaStats, planGachaTransaction, InsufficientStardustError } from './gachaTransactionCore.js';
export { matchesPetPoolFilter, getEligiblePetsForPool } from './petPoolFilter.js';
export { normalizeGachaStats, ensurePoolPity, getPoolPityCounters } from './gachaTransactionCore.js';
const GACHA_STATS_KEY = 'gachaStats';

export async function getGachaStats() {
  return normalizeGachaStats(await dbGet(STORES.META, GACHA_STATS_KEY));
}
export async function initGachaStats() {
  await dbUpdateRecord(STORES.META, GACHA_STATS_KEY, normalizeGachaStats);
}
export function getActivePools(poolsData) { return (poolsData?.pools || []).filter((pool) => pool.active); }
export function getActivePool(poolsData, selectedPoolId) { return resolveActivePool(poolsData, selectedPoolId); }
export function resolveSelectedPoolId(poolsData, selectedPoolId) { return getActivePool(poolsData, selectedPoolId)?.id || null; }
export function setSelectedPoolId(poolId) {
  return dbUpdateRecord(STORES.META, GACHA_STATS_KEY, (raw) => ({ ...normalizeGachaStats(raw), selectedPoolId: poolId || null }));
}
export function getPoolPets(allPets, pool, unlockEntry = null) {
  return pool ? getEligiblePetsForPool(allPets, resolveEffectivePool(pool, unlockEntry)) : [];
}
export async function getPoolPetsAsync(allPets, pool) {
  return getPoolPets(allPets, pool, pool?.id ? await getPoolUnlockEntry(pool.id) : null);
}

function executeDraw(allPets, poolsData, selectedPoolId, count) {
  return dbMutateRecords([
    { store: STORES.META, key: 'wallet' },
    { store: STORES.META, key: GACHA_STATS_KEY },
    { store: STORES.META, key: 'poolUnlockState' },
    { store: STORES.META, key: 'idempotentGrants' },
    { store: STORES.COLLECTION, all: true },
  ], ([wallet, stats, unlockState, grants, collection]) => {
    const plan = planGachaTransaction({ allPets, poolsData, selectedPoolId, count,
      wallet, stats, unlockState, grants, collection });
    return { puts: [plan.wallet, plan.stats, plan.unlockState, plan.grants]
      .map((value) => ({ store: STORES.META, value }))
      .concat(plan.changedCollection.map((value) => ({ store: STORES.COLLECTION, value }))), result: plan.result };
  });
}
export function pullOnce(allPets, poolsData, selectedPoolId) {
  return executeDraw(allPets, poolsData, selectedPoolId, 1);
}
export async function performTenPull(allPets, poolsData, selectedPoolId) {
  try { return await executeDraw(allPets, poolsData, selectedPoolId, 10); }
  catch (error) {
    if (error instanceof InsufficientStardustError) return { success: false, error: '星塵不足，10 連抽需要 ' + error.cost + ' 星塵' };
    throw error;
  }
}
export function exportGachaStats() { return getGachaStats(); }
/** Explicit import replacement, not a runtime read-modify-write path. */
export async function importGachaStats(data) {
  await dbPut(STORES.META, normalizeGachaStats({ key: GACHA_STATS_KEY, ...data }));
}
