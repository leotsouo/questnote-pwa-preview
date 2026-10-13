import { dbGet, dbMutateRecords, STORES } from './db.js';
import { normalizeWallet } from './rewardService.js';
import { loadCatalogBundle } from './releaseCatalog.js';
import { getTodayDateString } from './taskFilterService.js';
import { BOND_JOURNEY_KEY, CHAPTER_LEVELS, CHAPTER_REWARDS, HABIT_TARGETS,
  DAILY_COMPANION_REWARD, normalizeBondJourney, chapterIsAvailable, advanceBondJourney } from './bondJourneyCore.js';

let storyCatalog = null;
let loading = null;

export { validateBondStories } from './bondStoryCatalog.js';
import { mergeBondStorySupplements } from './bondStoryCatalog.js';

export async function loadBondStories() {
  if (storyCatalog) return storyCatalog;
  if (!loading) loading = (async () => {
    const response = await fetch(new URL('../data/bond-stories.json', import.meta.url));
    if (!response.ok) throw new Error('夥伴故事暫時無法載入，請稍後重試。');
    const { loreData } = await loadCatalogBundle();
    storyCatalog = mergeBondStorySupplements(await response.json(), loreData);
    return storyCatalog;
  })().finally(() => { loading = null; });
  return loading;
}

export function findBondStory(catalog, petId) {
  return catalog?.stories?.find((story) => story.petId === petId) || null;
}

export async function getBondJourney() {
  return normalizeBondJourney(await dbGet(STORES.META, BOND_JOURNEY_KEY));
}

const journeyRead = { store: STORES.META, key: BOND_JOURNEY_KEY };
const putsJourney = (journey, result = journey) => ({ puts: [{ store: STORES.META, value: journey }], result });
const ownedPet = (saved) => {
  if (!saved || saved.owned === false) throw new Error('請先獲得這位夥伴。');
  return { ...saved, id: saved.petId, owned: true };
};

export async function chooseBondResponse(petId, level, choiceId) {
  const story = findBondStory(await loadBondStories(), petId);
  if (!story || !['gentle', 'steady'].includes(choiceId)) throw new Error('故事回應不存在。');
  return dbMutateRecords([journeyRead, { store: STORES.COLLECTION, key: petId }], ([raw, saved]) => {
    const journey = normalizeBondJourney(raw);
    if (!chapterIsAvailable(journey, ownedPet(saved), level)) throw new Error('請先提升親密度並完成前一章約定。');
    journey.byPet[petId] ||= { chapters: {} };
    if (journey.byPet[petId].chapters[level]) return { puts: [], result: journey };
    journey.byPet[petId].chapters[level] = { choiceId, readAt: new Date().toISOString(), completedAt: null, claimedAt: null };
    return putsJourney(journey);
  });
}

/** Start/replace one global agreement; no retroactive completions. */
export async function startBondAgreement(petId, chapter, sourceType, sourceId, { replace = false } = {}) {
  if (!['task', 'habit'].includes(sourceType) || ![0, ...CHAPTER_LEVELS].includes(chapter)) throw new Error('同行目標無效。');
  if (!findBondStory(await loadBondStories(), petId)) throw new Error('這位夥伴的故事尚未收錄。');
  return dbMutateRecords([journeyRead, { store: STORES.COLLECTION, key: petId },
    { store: STORES.TASKS, all: true }, { store: STORES.HABITS, all: true }], ([raw, saved, tasks, habits]) => {
    const journey = advanceBondJourney(raw, tasks, habits);
    const source = (sourceType === 'task' ? tasks : habits).find((item) => item.id === sourceId);
    const pet = ownedPet(saved);
    if (journey.active?.status === 'ready') throw new Error('請先領取已完成的約定。');
    if (journey.active && (journey.active.petId !== petId || journey.active.chapter !== chapter)) throw new Error('請先暫停並結束目前約定，再開始新的約定。');
    if (journey.active && (!replace || journey.active.status !== 'paused')) throw new Error('請先暫停約定，再更換目標。');
    if (chapter) {
      if (!chapterIsAvailable(journey, pet, chapter) || !journey.byPet[petId]?.chapters[chapter]
        || journey.byPet[petId].chapters[chapter].claimedAt) throw new Error('請先閱讀並回應這一章故事。');
    } else if (pet.bondLevel < 5 || !journey.byPet[petId]?.chapters[5]?.claimedAt) throw new Error('完成 Lv.5 故事後才會解鎖日常同行。');
    if (!chapter && journey.dailyClaimDates.includes(getTodayDateString())) throw new Error('今天的日常同行獎勵已領取，明天可以再同行。');
    if (!source || (sourceType === 'task' ? source.isTutorial || source.completed || journey.usedEventKeys.includes(`task:${sourceId}`)
      : !source.isActive || source.archivedAt)) throw new Error('請選擇尚未完成的任務或有效習慣。');
    const now = new Date().toISOString();
    journey.active = { petId, chapter, sourceType, sourceId, sourceTitle: source.title || source.name || '同行目標',
      target: sourceType === 'task' ? 1 : HABIT_TARGETS[chapter], progress: 0, eventKeys: [],
      startedAt: now, observingSince: now, status: 'active' };
    return putsJourney(journey);
  });
}

export async function syncBondJourney() {
  return dbMutateRecords([journeyRead, { store: STORES.TASKS, all: true }, { store: STORES.HABITS, all: true }],
    ([raw, tasks, habits]) => {
      const journey = advanceBondJourney(raw, tasks, habits);
      return JSON.stringify(raw) === JSON.stringify(journey) ? { puts: [], result: journey } : putsJourney(journey);
    });
}

export async function controlBondAgreement(action) {
  if (!['pause', 'resume', 'end'].includes(action)) throw new Error('約定操作無效。');
  return dbMutateRecords([journeyRead, { store: STORES.TASKS, all: true }, { store: STORES.HABITS, all: true }], ([raw, tasks, habits]) => {
    const journey = advanceBondJourney(raw, tasks, habits);
    const a = journey.active;
    if (!a) throw new Error('目前沒有同行約定。');
    if (a.status === 'ready') throw new Error('請先領取已完成的約定。');
    if (action === 'pause') a.status = 'paused';
    if (action === 'resume' && a.status === 'paused') { a.status = 'active'; a.observingSince = new Date().toISOString(); }
    if (action === 'end') {
      if (a.status !== 'paused') throw new Error('請先暫停約定。');
      journey.active = null;
    }
    return putsJourney(journey);
  });
}

/** Receipt and wallet are committed atomically, including across tabs. */
export async function claimBondAgreement() {
  return dbMutateRecords([journeyRead, { store: STORES.META, key: 'wallet' },
    { store: STORES.TASKS, all: true }, { store: STORES.HABITS, all: true }], ([raw, walletRaw, tasks, habits]) => {
    const journey = advanceBondJourney(raw, tasks, habits);
    const a = journey.active;
    if (!a || a.status !== 'ready') throw new Error('同行目標尚未完成或已經領取。');
    const today = getTodayDateString();
    if (!a.chapter && journey.dailyClaimDates.includes(today)) throw new Error('今天的日常同行獎勵已領取。');
    const amount = a.chapter ? CHAPTER_REWARDS[a.chapter] : DAILY_COMPANION_REWARD;
    const now = new Date().toISOString();
    if (a.chapter) journey.byPet[a.petId].chapters[a.chapter].claimedAt = now;
    else journey.dailyClaimDates.push(today);
    const wallet = normalizeWallet(walletRaw);
    if (!Number.isSafeInteger(wallet.stardust + amount)) throw new Error('星塵數值需要檢查，原始紀錄已保留。');
    wallet.stardust += amount;
    if (a.chapter === 5 && !journey.displayPetId) journey.displayPetId = a.petId;
    journey.active = null;
    return { puts: [{ store: STORES.META, value: journey }, { store: STORES.META, value: wallet }],
      result: { journey, amount, petId: a.petId, chapter: a.chapter } };
  });
}

export async function displayBondKeepsake(petId) {
  return dbMutateRecords([journeyRead], ([raw]) => {
    const journey = normalizeBondJourney(raw);
    if (petId !== null && !journey.byPet[petId]?.chapters[5]?.claimedAt) throw new Error('紀念物尚未解鎖。');
    journey.displayPetId = petId;
    return putsJourney(journey);
  });
}
