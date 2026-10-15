/**
 * 主題卡池首次登場狀態 — V3.3.0
 * 使用既有 STORES.META，不升級 DB_VERSION。
 */
import { dbGet, dbPut, STORES } from './db.js';

const DEBUT_KEY = 'poolDebutSeen';

/**
 * @param {object|null} raw
 */
export function normalizePoolDebutSeen(raw) {
  const seen = Array.isArray(raw?.seenPoolIds)
    ? raw.seenPoolIds.filter((id) => typeof id === 'string' && id.trim())
    : [];
  return {
    key: DEBUT_KEY,
    seenPoolIds: [...new Set(seen)],
  };
}

export async function getPoolDebutSeen() {
  const raw = await dbGet(STORES.META, DEBUT_KEY);
  return normalizePoolDebutSeen(raw);
}

export async function hasSeenPoolDebut(poolId) {
  if (!poolId) return true;
  const data = await getPoolDebutSeen();
  return data.seenPoolIds.includes(poolId);
}

export async function markPoolDebutSeen(poolId) {
  if (!poolId) return getPoolDebutSeen();
  const data = await getPoolDebutSeen();
  if (!data.seenPoolIds.includes(poolId)) {
    data.seenPoolIds.push(poolId);
    await dbPut(STORES.META, data);
  }
  return data;
}

export async function exportPoolDebutSeen() {
  return getPoolDebutSeen();
}
