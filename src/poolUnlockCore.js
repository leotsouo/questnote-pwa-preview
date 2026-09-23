/** Pure unlock state transitions, shared by draws and recovery transactions. */
import { createCollectionEntry, FRAGMENT_BY_RARITY } from './collectionService.js';
import { resolveUnlockGrantId, resolveUnlockRewardSource } from './poolContentContract.js';

export const POOL_UNLOCK_META_KEY = 'poolUnlockState';
export const IDEMPOTENT_GRANTS_META_KEY = 'idempotentGrants';
export const MORNING_GARDEN_GRANT_ID = 'awakening_reward:eternal_slumber_bloom:20';
export const MORNING_GARDEN_REWARD_SOURCE = 'morning_garden_unlock_reward';
const asSafeText = (value) => typeof value === 'string' ? value.trim() : '';

export function normalizePoolUnlockState(raw) {
  const byPool = {};
  const source = raw?.byPool && typeof raw.byPool === 'object' ? raw.byPool : {};
  for (const [poolId, entry] of Object.entries(source)) {
    if (typeof poolId !== 'string' || !poolId.trim()) continue;
    byPool[poolId] = normalizePoolUnlockEntry(poolId, entry);
  }
  return {
    key: POOL_UNLOCK_META_KEY,
    schemaVersion: 1,
    byPool,
    /**
     * 舊玩家補判定狀態：
     * 現有系統未保存含 poolId 的抽卡歷史，無法可靠回填。
     */
    legacyBackfill: {
      attempted: !!raw?.legacyBackfill?.attempted,
      status: asSafeText(raw?.legacyBackfill?.status) || 'unavailable_no_pool_history',
      note: asSafeText(raw?.legacyBackfill?.note)
        || '抽卡歷史未保存 poolId，已停止舊玩家自動補判定；lifetimeDraws 僅自 V3.4.0 起累積。',
    },
  };
}

function normalizePoolUnlockEntry(poolId, entry) {
  const lifetimeDraws = Math.max(0, Math.floor(Number(entry?.lifetimeDraws) || 0));
  return {
    schemaVersion: 1,
    poolId,
    lifetimeDraws,
    unlocked: !!entry?.unlocked,
    rewardClaimed: !!entry?.rewardClaimed,
    animationSeen: !!entry?.animationSeen,
    unlockedAt: typeof entry?.unlockedAt === 'string' ? entry.unlockedAt : null,
  };
}

export function emptyPoolUnlockEntry(poolId) {
  return normalizePoolUnlockEntry(poolId, {});
}

export function normalizeIdempotentGrants(raw) {
  const claimed = Array.isArray(raw?.claimedIds)
    ? raw.claimedIds.filter((id) => typeof id === 'string' && id.trim())
    : [];
  return {
    key: IDEMPOTENT_GRANTS_META_KEY,
    claimedIds: [...new Set(claimed)],
  };
}

export function mergeLifetimeDraws(current, incoming) {
  const a = Math.max(0, Math.floor(Number(current) || 0));
  const b = Math.max(0, Math.floor(Number(incoming) || 0));
  return Math.max(a, b);
}

/** Mutates only the transaction's cloned records; never persists or awaits. */
export function applyUnlockGift({ state, grants, collection, changed, poolId, expansion, allPets, now }) {
  const pet = allPets.find((candidate) => candidate.id === expansion?.rewardPetId);
  if (!pet) throw new Error('缺少解鎖獎勵寵物資料');
  if (!Number.isSafeInteger(FRAGMENT_BY_RARITY[pet.rarity])) throw new Error('解鎖獎勵稀有度無效');
  const grantId = resolveUnlockGrantId(poolId, expansion);
  const entry = state.byPool[poolId] || emptyPoolUnlockEntry(poolId);
  const alreadyClaimed = entry.rewardClaimed || grants.claimedIds.includes(grantId);
  let existing = collection.get(pet.id);
  let isNew = false;
  let fragmentsGained = 0;
  if (!existing) {
    // Preserve the existing missing-pet recovery, never guess lost duplicate fragments.
    existing = createCollectionEntry(pet.id, now);
    existing.obtainedSource = resolveUnlockRewardSource(poolId, expansion);
    collection.set(pet.id, existing);
    changed.add(pet.id);
    isNew = true;
  } else if (!alreadyClaimed) {
    fragmentsGained = FRAGMENT_BY_RARITY[pet.rarity];
    if (!Number.isSafeInteger(fragmentsGained)) throw new Error('解鎖獎勵稀有度無效');
    if (!Number.isSafeInteger(existing.fragments + fragmentsGained)) throw new Error('碎片數量無效');
    existing.fragments += fragmentsGained;
    changed.add(pet.id);
  }
  if (!grants.claimedIds.includes(grantId)) grants.claimedIds.push(grantId);
  entry.unlocked = true;
  entry.rewardClaimed = true;
  entry.unlockedAt = entry.unlockedAt || now;
  state.byPool[poolId] = entry;
  if (alreadyClaimed) return { ok: true, alreadyClaimed: true, petId: pet.id, entry };
  return { ok: true, alreadyClaimed: false, isNew, fragmentsGained, petId: pet.id, entry };
}

export function applyPoolDrawProgress(context, drawCount) {
  if (!Number.isSafeInteger(drawCount) || drawCount < 0) throw new Error('抽卡累積數無效');
  const { state, poolId, expansion, now } = context;
  const entry = state.byPool[poolId] || emptyPoolUnlockEntry(poolId);
  const next = entry.lifetimeDraws + drawCount;
  if (!Number.isSafeInteger(next) || next < entry.lifetimeDraws) throw new Error('抽卡累積數無效');
  entry.lifetimeDraws = next;
  state.byPool[poolId] = entry;
  const justUnlocked = !!expansion && !entry.unlocked && next >= expansion.threshold;
  if (justUnlocked) {
    entry.unlocked = true;
    entry.unlockedAt = entry.unlockedAt || now;
  }
  const reward = expansion && entry.unlocked && !entry.rewardClaimed ? applyUnlockGift(context) : null;
  return { entry, justUnlocked, reward };
}
