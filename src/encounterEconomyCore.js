/** Collection economy. Pure transitions; persistence owns the transaction boundary. */
import { createCollectionEntry } from './collectionService.js';
import { resolveEffectivePool } from './poolContentContract.js';
import { getEligiblePetsForPool } from './petPoolFilter.js';
import { validateDailyEncounterReceipt } from './dailyEncounterCore.js';
export const ENCOUNTER_ECONOMY_KEY = 'encounterEconomy';
export const ENCOUNTER_MIGRATION_VERSION = 1;
export const ENCOUNTER_FRAGMENTS_BY_RARITY = Object.freeze({ N:1, R:2, SR:5, SSR:10, UR:20 });
export const INVITATION_COSTS = Object.freeze({ SSR:100, UR:200 });
// Verified against the retired 5/15/30/50 costs, before removing runtime upgrades.
export const LEGACY_STAR_REFUND = Object.freeze({ 1:0, 2:5, 3:20, 4:50, 5:100 });
function amount(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name}資料無效；尚未變更存檔。`);
  return value;
}
export function validateEncounterEconomy(raw) {
  const errors = []; const fail = (message) => errors.push('encounterEconomy: ' + message);
  const record = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
  const date = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
  const integer = (value) => Number.isSafeInteger(value) && value >= 0;
  if (!record(raw)) return ['encounterEconomy: 缺少相遇存檔'];
  for (const key of Object.keys(raw)) if (!['key','schemaVersion','migrationVersion','balance','migrationReceipt','dailyReceipt'].includes(key)) fail('未知欄位 ' + key);
  if (raw.dailyReceipt !== undefined && !validateDailyEncounterReceipt(raw.dailyReceipt)) fail('每日相遇收據無效');
  if (raw.schemaVersion !== 1 || ![0,1].includes(raw.migrationVersion)) fail('版本不相容');
  if (raw.key !== undefined && raw.key !== ENCOUNTER_ECONOMY_KEY) fail('key 不符');
  if (!integer(raw.balance)) fail('餘額無效');
  const receipt = raw.migrationReceipt;
  if (receipt !== null) {
    if (!record(receipt)) fail('轉換收據無效');
    else {
      for (const key of Object.keys(receipt)) if (!['convertedAt','acknowledgedAt','total','items'].includes(key)) fail('未知收據欄位');
      if (raw.migrationVersion !== 1 || !date(receipt.convertedAt) || (receipt.acknowledgedAt !== null && !date(receipt.acknowledgedAt)) || !integer(receipt.total) || !Array.isArray(receipt.items)) fail('轉換收據無效');
      let total = 0; const seen = new Set();
      for (const item of Array.isArray(receipt.items) ? receipt.items : []) {
        if (!record(item) || typeof item.petId !== 'string' || !item.petId || seen.has(item.petId) || !integer(item.leftover) || ![0,5,20,50,100].includes(item.refund) || !integer(item.total) || item.total !== item.leftover + item.refund) { fail('角色轉換明細無效'); continue; }
        for (const key of Object.keys(item)) if (!['petId','leftover','refund','total'].includes(key)) fail('未知明細欄位');
        seen.add(item.petId); total += item.total;
      }
      if (!integer(total) || total !== receipt.total) fail('收據總量不符');
    }
  }
  return errors;
}
export function normalizeEncounterEconomy(raw) {
  if (raw && raw.schemaVersion !== 1) throw new Error('相遇存檔版本不相容；尚未變更存檔。');
  const migrationVersion = raw?.migrationVersion ?? 0;
  if (![0, 1].includes(migrationVersion)) throw new Error('相遇轉換版本不相容；尚未變更存檔。');
  if (raw) { const errors = validateEncounterEconomy(raw); if (errors.length) throw new Error(errors[0]); }
  return { key:ENCOUNTER_ECONOMY_KEY, schemaVersion:1, migrationVersion,
    balance:amount(raw?.balance ?? 0, '相遇碎片'),
    migrationReceipt:raw?.migrationReceipt ? structuredClone(raw.migrationReceipt) : null,
    ...(raw?.dailyReceipt ? { dailyReceipt:structuredClone(raw.dailyReceipt) } : {}) };
}
export function earnEncounterFragments(economy, gained) {
  amount(gained, '相遇碎片獎勵');
  economy.balance = amount(economy.balance + gained, '相遇碎片總量');
}
export function planEncounterMigration({ economy:rawEconomy, collection:rawCollection = [], now = new Date().toISOString() }) {
  const economy = normalizeEncounterEconomy(rawEconomy);
  const collection = structuredClone(rawCollection);
  const changedCollection = []; const items = [];
  for (const entry of collection) {
    if (!entry || typeof entry.petId !== 'string' || !entry.petId) throw new Error('收藏資料無效；相遇轉換尚未執行。');
    if (entry.encounterMigrationVersion === 1) {
      if ((entry.stars ?? 1) !== 1 || (entry.fragments ?? 0) !== 0) throw new Error('角色轉換標記與舊資源矛盾；相遇轉換尚未執行。');
      continue;
    }
    if (entry.encounterMigrationVersion !== undefined && entry.encounterMigrationVersion !== 0) throw new Error('角色轉換版本不相容。');
    if (economy.migrationVersion === 1) throw new Error('相遇存檔含未轉換角色；請先檢查存檔，尚未發放資源。');
    const stars = entry.stars ?? 1; const leftover = amount(entry.fragments ?? 0, '舊角色碎片');
    if (!Object.hasOwn(LEGACY_STAR_REFUND, stars) || !Number.isInteger(stars)) throw new Error('舊星級資料無效；相遇轉換尚未執行。');
    const refund = LEGACY_STAR_REFUND[stars]; const total = amount(leftover + refund, '角色轉換數量');
    const floor = entry.legacySpecialtyFloor ?? 1;
    if (!Number.isInteger(floor) || floor < 1 || floor > 5) throw new Error('舊探險專長資料無效。');
    entry.legacySpecialtyFloor = Math.max(stars, floor);
    entry.encounterMigrationVersion = 1;
    delete entry.stars; delete entry.fragments;
    earnEncounterFragments(economy, total);
    items.push({ petId:entry.petId, leftover, refund, total });
    changedCollection.push(entry);
  }
  if (economy.migrationVersion === 0) {
    economy.migrationVersion = 1;
    economy.migrationReceipt = items.length ? { convertedAt:now, acknowledgedAt:null,
      total:items.reduce((sum, item) => amount(sum + item.total, '轉換總量'), 0), items } : null;
  }
  return { economy, collection, changedCollection };
}

/** Display locked formal expansions, but authorize only effective active candidates. */
export function invitationCandidates(allPets, poolsData, unlockState, collection = []) {
  const owned = new Set(collection.map((entry) => entry.petId || entry.id));
  const rows = new Map();
  for (const pool of (poolsData?.pools || []).filter((row) => row.active)) {
    const all = getEligiblePetsForPool(allPets, resolveEffectivePool(pool, { unlocked:true }));
    const available = new Set(getEligiblePetsForPool(allPets, resolveEffectivePool(pool, unlockState?.byPool?.[pool.id])).map((pet) => pet.id));
    for (const pet of all.filter((pet) => Object.hasOwn(INVITATION_COSTS, pet.rarity))) {
      const isAvailable = available.has(pet.id);
      const row = { pet, owned:owned.has(pet.id), available:isAvailable,
        seriesId:pool.id, seriesName:pool.name,
        reason:isAvailable ? '' : `在${pool.name}累積 ${pool.unlockExpansion.threshold} 次召喚，開啟${pool.unlockExpansion.title}後即可邀請。` };
      if (!rows.has(pet.id) || isAvailable) rows.set(pet.id, row);
    }
  }
  return [...rows.values()];
}
export function planCompanionInvitation({ petId, allPets, poolsData, unlockState, economy:rawEconomy, collection:rawCollection = [], now }) {
  const migration = planEncounterMigration({ economy:rawEconomy, collection:rawCollection, now });
  const row = invitationCandidates(allPets, poolsData, unlockState, migration.collection).find((row) => row.pet.id === petId);
  if (!row) throw new Error('這位夥伴目前不在指定邀請名單中。');
  if (row.owned) throw new Error('這位夥伴已相遇，無須再次邀請。');
  if (!row.available) throw new Error(row.reason);
  const cost = INVITATION_COSTS[row.pet.rarity];
  if (migration.economy.balance < cost) throw new Error(`再累積 ${cost - migration.economy.balance} 枚相遇碎片，就能邀請牠。`);
  migration.economy.balance -= cost;
  const entry = { ...createCollectionEntry(petId, now), obtainedSource:'specified_invitation' };
  migration.collection.push(entry); migration.changedCollection.push(entry);
  return { ...migration, result:{ petId, cost, balance:migration.economy.balance, entry } };
}
