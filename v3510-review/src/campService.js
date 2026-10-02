import { dbGet, dbMutateRecords, STORES } from './db.js';
import { normalizeWallet } from './rewardService.js';

export const CAMP_KEY = 'campProgress';
export const CAMP_UPGRADES = Object.freeze([
  { level: 1, name: '地圖桌', description: '出發前看見隊伍專長與目標收益。', materials: { forest_leaf: 3 } },
  { level: 2, name: '補給站', description: '每趟固定多帶回 1 份地區素材。', materials: { forest_leaf: 4, harvest_charm: 3, lava_core: 3 } },
  { level: 3, name: '旅途檔案室', description: '每趟多累積 1% 探索度，收錄隊伍旅程。', materials: { machine_part: 4, aurora_ice: 4 } },
  { level: 4, name: '星界觀測台', description: '記錄星界故事，讓資深隊伍的探險更有目標。', materials: { star_shard: 5 } },
]);

export function normalizeCampProgress(raw) {
  return { key: CAMP_KEY, level: Number.isInteger(raw?.level) ? Math.max(0, Math.min(4, raw.level)) : 0,
    upgradedAt: raw?.upgradedAt || null };
}

export async function getCampProgress() {
  return normalizeCampProgress(await dbGet(STORES.META, CAMP_KEY));
}

export async function upgradeCamp() {
  return dbMutateRecords([
    { store: STORES.META, key: CAMP_KEY }, { store: STORES.META, key: 'wallet' },
  ], ([raw, walletRaw]) => {
    const camp = normalizeCampProgress(raw);
    const next = CAMP_UPGRADES[camp.level];
    if (!next) throw new Error('營地已經完成升級');
    const wallet = normalizeWallet(walletRaw);
    for (const [id, amount] of Object.entries(next.materials)) {
      if ((wallet.materials[id] || 0) < amount) throw new Error('升級素材不足');
    }
    for (const [id, amount] of Object.entries(next.materials)) wallet.materials[id] -= amount;
    camp.level = next.level;
    camp.upgradedAt = new Date().toISOString();
    return { puts: [{ store: STORES.META, value: wallet }, { store: STORES.META, value: camp }],
      result: { camp, upgrade: next } };
  });
}
