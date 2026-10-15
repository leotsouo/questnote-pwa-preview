import { DEMON_TASK_TITLE, needsDemonFinalTask, demonFinalTaskId, demonFinalTaskComplete, assertDemonTaskUpdate } from './demonFinalTaskCore.js';
import { getTodayDateString } from './taskFilterService.js';
import { dbGet, dbMutateRecords, STORES } from './db.js';
import { normalizeInventory } from './workshopService.js';
import { AWAKENING_KEY, normalizePetAwakening, awakeningEvents, advancePetAwakening, beginPetAwakening } from './petAwakeningCore.js';
import { getAwakeningProfile } from './petAwakeningProfiles.js';
import { loadAwakeningCatalog } from './petAwakeningCatalog.js';
import { dailyEncounterReceipt, applyDailyEncounter } from './dailyEncounterCore.js';
import { planEncounterMigration } from './encounterEconomyCore.js';
const stateRead = { store: STORES.META, key: AWAKENING_KEY };
const sourceReads = [{ store: STORES.TASKS, all: true }, { store: STORES.HABITS, all: true }, { store: STORES.EXPEDITIONS, all: true }];
const putState = (s, result = s) => ({ puts: [{ store: STORES.META, value: s }], result });
export async function getPetAwakening() { return normalizePetAwakening(await dbGet(STORES.META, AWAKENING_KEY)); }
export async function syncPetAwakening() {
  return dbMutateRecords([stateRead, ...sourceReads], ([raw, tasks, habits, expeditions]) => {
    const next = advancePetAwakening(raw, awakeningEvents(tasks, habits, expeditions));
    return JSON.stringify(next) === JSON.stringify(raw) || raw == null ? { puts: [], result: next } : putState(next);
  });
}
/** Completion and progress commit together; ordinary edits also retain event deduplication. */
export async function putWithAwakeningProgress(store, value) {
  const events = store === STORES.TASKS ? awakeningEvents([value]) : awakeningEvents([], [value]);
  const date = getTodayDateString();
  return dbMutateRecords([stateRead, { store, key: value.id },
    { store:STORES.META, key:'encounterEconomy' }, { store:STORES.COLLECTION, all:true }], ([raw, current, economy, collection]) => {
    if (store === STORES.TASKS) assertDemonTaskUpdate(current, value);
    const puts = [{ store, value }, ...(raw ? [{ store: STORES.META, value: advancePetAwakening(raw, events) }] : [])];
    const receipt = dailyEncounterReceipt({ source:store === STORES.TASKS ? 'task' : store === STORES.HABITS ? 'habit' : null, current, next:value, date });
    if (receipt) {
      const plan = planEncounterMigration({ economy, collection });
      if (applyDailyEncounter(plan.economy, receipt)) {
        puts.push({ store:STORES.META, value:plan.economy }, ...plan.changedCollection.map(entry => ({ store:STORES.COLLECTION, value:entry })));
      }
    }
    return { puts, result: value };
  });
}
export async function startPetAwakening(petId) {
  if (!(await loadAwakeningCatalog()).pets.some((p) => p.petId === petId)) throw Error('這位夥伴尚未開放覺醒');
  return dbMutateRecords([stateRead, { store: STORES.COLLECTION, key: petId }, { store: STORES.META, key: 'bondJourney' }, ...sourceReads],
    ([raw, pet, journey, tasks, habits, expeditions]) => {
      if (!pet || pet.owned === false || pet.bondLevel < 5 || !journey?.byPet?.[petId]?.chapters?.[5]?.claimedAt) throw Error('親密度 Lv.5 並完成最後一章同行故事後，可接下試煉。');
      const events = awakeningEvents(tasks, habits, expeditions);
      const current = advancePetAwakening(raw, events);
      const keys = [...events.map((e) => e.key), ...tasks.filter((t) => t.rewardClaimed).map((t) => `task:${t.id}`),
        ...habits.flatMap((h) => Object.entries(h.logs || {}).filter(([date, log]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && log.rewardClaimed).map(([date]) => `habit:${h.id}:${date}`))];
      return putState(beginPetAwakening(current, petId, new Date().toISOString(), keys));
    });
}
export async function pausePetAwakening(petId) {
  return dbMutateRecords([stateRead, ...sourceReads], ([raw, tasks, habits, expeditions]) => {
    const s = advancePetAwakening(raw, awakeningEvents(tasks, habits, expeditions));
    if (s.byPet[petId]?.status === 'ready') return putState(s);
    if (s.activePetId !== petId) throw Error('這位夥伴目前沒有進行中的試煉');
    s.byPet[petId].status = 'paused'; s.activePetId = null;
    return putState(s);
  });
}
export async function awakenPet(petId) {
  const entry = (await loadAwakeningCatalog()).pets.find((p) => p.petId === petId);
  if (!entry) throw Error('這位夥伴尚未開放覺醒');
  return dbMutateRecords([stateRead, { store: STORES.META, key: 'inventory' }, { store: STORES.COLLECTION, key: petId },
    { store: STORES.META, key: 'bondJourney' }, ...sourceReads], ([raw, items, pet, journey, tasks, habits, expeditions]) => {
    const s = advancePetAwakening(raw, awakeningEvents(tasks, habits, expeditions));
    const p = s.byPet[petId];
    if (!pet || pet.owned === false || pet.bondLevel < 5 || !journey?.byPet?.[petId]?.chapters?.[5]?.claimedAt || p?.status !== 'ready') throw Error('試煉尚未完成或已經覺醒');
    if (needsDemonFinalTask(petId) && !demonFinalTaskComplete(tasks, petId)) throw Error('請先回答並完成「惡魔的趣味」，才能最終覺醒。');
    const inventory = normalizeInventory(items);
    const profile = getAwakeningProfile(petId);
    if (!profile) throw Error('這位夥伴尚未開放覺醒');
    const count = inventory.items[profile.foodId] || 0;
    if (!Number.isSafeInteger(count) || count < 1) throw Error(`需要一份${profile.foodName}；試煉進度與信物已保留。`);
    inventory.items[profile.foodId] = count - 1;
    const now = new Date(Math.max(Date.now(), Date.parse(p.tokenGrantedAt))).toISOString();
    p.status = 'awakened'; p.awakenedAt = now; p.tokenConsumedAt = now; p.form = 'awakened';
    return { puts: [{ store: STORES.META, value: s }, { store: STORES.META, value: inventory }], result: { state: s, entry } };
  });
}
export async function setAwakeningForm(petId, form) {
  if (!['initial', 'awakened'].includes(form)) throw Error('形態不存在');
  return dbMutateRecords([stateRead], ([raw]) => {
    const s = normalizePetAwakening(raw);
    if (!s.byPet[petId]?.awakenedAt) throw Error('完成覺醒後可切換形態');
    s.byPet[petId].form = form;
    return putState(s);
  });
}

/** One deterministic task per partner; parallel submissions retain the first answer. */
export async function acceptDemonFinalTask(petId, answer) {
  const content = typeof answer === 'string' ? answer.trim() : '';
  if (!content || content.length > 2000) throw Error('請回答一件想完成的事（1 至 2000 字）。');
  if (!needsDemonFinalTask(petId) || !(await loadAwakeningCatalog()).pets.some((p) => p.petId === petId)) throw Error('這位夥伴沒有惡魔的趣味試煉');
  return dbMutateRecords([stateRead, { store: STORES.TASKS, key: demonFinalTaskId(petId) },
    { store: STORES.COLLECTION, key: petId }, { store: STORES.META, key: 'bondJourney' }], ([raw, existing, pet, journey]) => {
    const progress = normalizePetAwakening(raw).byPet[petId];
    if (progress?.status !== 'ready' || !pet || pet.owned === false || pet.bondLevel < 5
      || !journey?.byPet?.[petId]?.chapters?.[5]?.claimedAt) throw Error('完成守諾試煉後，夥伴才會提出最後的問題。');
    if (existing) return { puts: [], result: existing };
    const now = new Date().toISOString();
    const task = { id: demonFinalTaskId(petId), systemTask: 'demon-final', awakeningPetId: petId,
      title: DEMON_TASK_TITLE, content: DEMON_TASK_TITLE + '\n' + content, priority: 'important', type: 'one_time', categoryId: 'general',
      startDate: null, dueDate: null, plannedDate: getTodayDateString(), isPlannedToday: true, plannedTime: null,
      subtasks: [], completed: false, rewardClaimed: false, createdAt: now, updatedAt: now,
      completedAt: null, lastRewardClaimedAt: null };
    return { puts: [{ store: STORES.TASKS, value: task }], result: task };
  });
}
