/** Atomic pool unlock persistence. Draws use the same pure transitions in their transaction. */
import { dbGet, dbPut, dbUpdateRecord, dbMutateRecords, STORES } from './db.js';
import { normalizeEntry } from './collectionService.js';
import {
  POOL_UNLOCK_META_KEY, IDEMPOTENT_GRANTS_META_KEY, normalizePoolUnlockState,
  normalizeIdempotentGrants, emptyPoolUnlockEntry, applyUnlockGift, applyPoolDrawProgress,
} from './poolUnlockCore.js';
export {
  POOL_UNLOCK_META_KEY, IDEMPOTENT_GRANTS_META_KEY, MORNING_GARDEN_GRANT_ID,
  MORNING_GARDEN_REWARD_SOURCE, normalizePoolUnlockState, normalizeIdempotentGrants,
  emptyPoolUnlockEntry, mergeLifetimeDraws,
} from './poolUnlockCore.js';
export { normalizeUnlockExpansion, resolveEffectivePool } from './poolContentContract.js';

export async function getPoolUnlockState() {
  return normalizePoolUnlockState(await dbGet(STORES.META, POOL_UNLOCK_META_KEY));
}

/** Explicit replacement only; runtime mutations must use updateUnlockState. */
export async function savePoolUnlockState(state) {
  const normalized = normalizePoolUnlockState(state);
  await dbPut(STORES.META, normalized);
  return normalized;
}

function updateUnlockState(update) {
  return dbUpdateRecord(STORES.META, POOL_UNLOCK_META_KEY, (raw) => {
    const state = normalizePoolUnlockState(raw);
    update(state);
    return state;
  });
}

export async function getPoolUnlockEntry(poolId) {
  if (!poolId) return emptyPoolUnlockEntry('');
  return (await getPoolUnlockState()).byPool[poolId] || emptyPoolUnlockEntry(poolId);
}

export function ensurePoolUnlockLegacyBackfillMarked() {
  return updateUnlockState((state) => {
    if (state.legacyBackfill.attempted) return;
    state.legacyBackfill = { attempted: true, status: 'unavailable_no_pool_history',
      note: '抽卡歷史未保存 poolId，已停止舊玩家自動補判定；lifetimeDraws 僅自 V3.4.0 起累積。不得使用 pity 或全池 totalPulls 猜測。' };
  });
}

export async function addLifetimeDraws(poolId, delta) {
  if (!poolId) return emptyPoolUnlockEntry('');
  const add = Math.max(0, Math.floor(Number(delta) || 0));
  const state = await updateUnlockState((state) => {
    const entry = state.byPool[poolId] || emptyPoolUnlockEntry(poolId);
    if (!Number.isSafeInteger(entry.lifetimeDraws + add)) throw new Error('抽卡累積數無效');
    entry.lifetimeDraws += add;
    state.byPool[poolId] = entry;
  });
  return state.byPool[poolId];
}

export async function evaluateUnlockThreshold(poolId, expansion) {
  let justUnlocked = false;
  const state = await updateUnlockState((state) => {
    const entry = state.byPool[poolId] || emptyPoolUnlockEntry(poolId);
    if (expansion && !entry.unlocked && entry.lifetimeDraws >= expansion.threshold) {
      entry.unlocked = true;
      entry.unlockedAt = entry.unlockedAt || new Date().toISOString();
      state.byPool[poolId] = entry;
      justUnlocked = true;
    }
  });
  return { entry: state.byPool[poolId] || emptyPoolUnlockEntry(poolId), justUnlocked };
}

export async function getIdempotentGrants() {
  return normalizeIdempotentGrants(await dbGet(STORES.META, IDEMPOTENT_GRANTS_META_KEY));
}
export async function hasClaimedGrant(grantId) {
  return !!grantId && (await getIdempotentGrants()).claimedIds.includes(grantId);
}
export function markGrantClaimed(grantId) {
  return dbUpdateRecord(STORES.META, IDEMPOTENT_GRANTS_META_KEY, (raw) => {
    const data = normalizeIdempotentGrants(raw);
    if (grantId && !data.claimedIds.includes(grantId)) data.claimedIds.push(grantId);
    return data;
  });
}

function mutateUnlockAndCollection(poolId, expansion, allPets, operation) {
  return dbMutateRecords([
    { store: STORES.META, key: POOL_UNLOCK_META_KEY },
    { store: STORES.META, key: IDEMPOTENT_GRANTS_META_KEY },
    { store: STORES.COLLECTION, all: true },
  ], ([rawState, rawGrants, items]) => {
    const state = normalizePoolUnlockState(rawState);
    const grants = normalizeIdempotentGrants(rawGrants);
    const collection = new Map(items.map((entry) => [entry.petId, normalizeEntry(entry)]));
    const changed = new Set();
    const result = operation({ state, grants, collection, changed, poolId, expansion,
      allPets, now: new Date().toISOString() });
    return { puts: [{ store: STORES.META, value: state }, { store: STORES.META, value: grants },
      ...[...changed].map((id) => ({ store: STORES.COLLECTION, value: collection.get(id) }))], result };
  });
}

export async function grantUnlockReward(poolId, expansion, allPets = []) {
  if (!poolId || !expansion?.rewardPetId) return { ok: false, error: '缺少解鎖獎勵設定' };
  return mutateUnlockAndCollection(poolId, expansion, allPets, applyUnlockGift);
}

export function ensureUnlockRewardClaimed(poolId, expansion, allPets = []) {
  return mutateUnlockAndCollection(poolId, expansion, allPets, (context) => {
    const entry = context.state.byPool[poolId] || emptyPoolUnlockEntry(poolId);
    if (!expansion || !entry.unlocked) return { ok: true, skipped: true, entry };
    // This also reconciles a legacy rewardClaimed flag without adding duplicate fragments.
    return applyUnlockGift(context);
  });
}

export async function markUnlockAnimationSeen(poolId) {
  if (!poolId) return emptyPoolUnlockEntry('');
  const state = await updateUnlockState((state) => {
    const entry = state.byPool[poolId] || emptyPoolUnlockEntry(poolId);
    entry.animationSeen = true;
    state.byPool[poolId] = entry;
  });
  return state.byPool[poolId];
}

/** Kept for explicit callers; draws combine this transition with wallet/pity in one transaction. */
export function processPoolDrawProgress(poolId, drawCount, expansion, allPets = []) {
  return mutateUnlockAndCollection(poolId, expansion, allPets, (context) => applyPoolDrawProgress(context, drawCount));
}
export function exportPoolUnlockState() { return getPoolUnlockState(); }
export function exportIdempotentGrants() { return getIdempotentGrants(); }
