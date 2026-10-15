import { dbGet, dbUpdateRecord, dbMutateRecords, STORES } from './db.js';
import { ENCOUNTER_ECONOMY_KEY, normalizeEncounterEconomy, planEncounterMigration, planCompanionInvitation } from './encounterEconomyCore.js';
const economyRead = { store:STORES.META, key:ENCOUNTER_ECONOMY_KEY };
const collectionRead = { store:STORES.COLLECTION, all:true };
function puts(plan) {
  return [{ store:STORES.META, value:plan.economy }, ...plan.changedCollection.map((value) => ({ store:STORES.COLLECTION, value }))];
}
export async function getEncounterEconomy() {
  return normalizeEncounterEconomy(await dbGet(STORES.META, ENCOUNTER_ECONOMY_KEY));
}
export function ensureEncounterMigration() {
  return dbMutateRecords([economyRead, collectionRead], ([economy, collection]) => {
    const plan = planEncounterMigration({ economy, collection });
    return { puts:puts(plan), result:plan.economy };
  });
}
export function inviteCompanion(petId, allPets, poolsData) {
  return dbMutateRecords([economyRead, collectionRead, { store:STORES.META, key:'poolUnlockState' }], ([economy, collection, unlockState]) => {
    const plan = planCompanionInvitation({ petId, allPets, poolsData, unlockState, economy, collection, now:new Date().toISOString() });
    return { puts:puts(plan), result:plan.result };
  });
}
export function acknowledgeEncounterMigration() {
  return dbUpdateRecord(STORES.META, ENCOUNTER_ECONOMY_KEY, (raw) => {
    const economy = normalizeEncounterEconomy(raw);
    if (economy.migrationReceipt && !economy.migrationReceipt.acknowledgedAt) economy.migrationReceipt.acknowledgedAt = new Date().toISOString();
    return economy;
  });
}
