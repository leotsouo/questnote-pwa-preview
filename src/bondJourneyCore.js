/** 親密度故事與約定的純邏輯；不依賴 DOM 或資料庫。 */
export const BOND_JOURNEY_KEY = 'bondJourney';
export const CHAPTER_LEVELS = [2, 3, 4, 5];
export const CHAPTER_REWARDS = { 2: 30, 3: 50, 4: 70, 5: 100 };
export const HABIT_TARGETS = { 2: 1, 3: 2, 4: 3, 5: 5, 0: 1 };
export const DAILY_COMPANION_REWARD = 20;
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const safeId = (value) => typeof value === 'string' && value.trim().length > 0
  && !['__proto__', 'constructor', 'prototype'].includes(value);
const petId = (value) => safeId(value) && /^pet_[a-z0-9]+$/i.test(value);
const time = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const ids = (value) => Array.isArray(value) && value.every(safeId) && new Set(value).size === value.length;

export function createBondJourney() {
  return { key: BOND_JOURNEY_KEY, schemaVersion: 1, byPet: {}, active: null,
    usedEventKeys: [], dailyClaimDates: [], displayPetId: null };
}

/** Reject malformed backups before a normalizer can lose records or rewards. */
export function validateBondJourney(raw) {
  const errors = [];
  const fail = (message) => errors.push(`bondJourney: ${message}`);
  if (!record(raw)) return ['bondJourney: 必須是物件'];
  if (raw.key !== BOND_JOURNEY_KEY || raw.schemaVersion !== 1) fail('格式版本無效');
  if (!ids(raw.usedEventKeys)) fail('完成紀錄無效');
  if (!ids(raw.dailyClaimDates) || raw.dailyClaimDates.some((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || !time(`${date}T00:00:00Z`) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)) fail('每日領取紀錄無效');
  if (raw.displayPetId !== null && !petId(raw.displayPetId)) fail('展示角色無效');
  if (!record(raw.byPet)) fail('角色進度無效');
  else for (const [id, progress] of Object.entries(raw.byPet)) {
    if (!petId(id) || !record(progress?.chapters)) { fail('角色章節無效'); continue; }
    for (const [level, chapter] of Object.entries(progress.chapters)) {
      if (!CHAPTER_LEVELS.includes(Number(level)) || String(Number(level)) !== level || !record(chapter)
        || !['gentle', 'steady'].includes(chapter.choiceId) || !time(chapter.readAt)
        || (chapter.completedAt !== null && !time(chapter.completedAt))
        || (chapter.claimedAt !== null && (!time(chapter.claimedAt) || !chapter.completedAt))) fail('章節紀錄無效');
      if (chapter?.completedAt && Date.parse(chapter.completedAt) < Date.parse(chapter.readAt)) fail('完成時間早於閱讀時間');
      if (chapter?.claimedAt && Date.parse(chapter.claimedAt) < Date.parse(chapter.completedAt)) fail('領取時間早於完成時間');
      if (Number(level) > 2 && !progress.chapters[Number(level) - 1]?.claimedAt) fail('章節順序無效');
    }
  }
  const a = raw.active;
  if (a !== null) {
    if (!record(a)) { fail('同行約定必須是物件'); return errors; }
    if (!petId(a.petId) || ![0, ...CHAPTER_LEVELS].includes(a.chapter)
      || !['task', 'habit'].includes(a.sourceType) || !safeId(a.sourceId)
      || typeof a.sourceTitle !== 'string' || !time(a.startedAt) || !time(a.observingSince)
      || !['active', 'paused', 'ready'].includes(a.status)
      || a.target !== (a.sourceType === 'task' ? 1 : HABIT_TARGETS[a.chapter])
      || !Number.isInteger(a.progress) || a.progress < 0 || a.progress > a.target
      || !ids(a.eventKeys) || a.eventKeys.length !== a.progress
      || a.eventKeys.some((key) => !Array.isArray(raw.usedEventKeys) || !raw.usedEventKeys.includes(key))
      || a.eventKeys.some((key) => a.sourceType === 'task' ? key !== `task:${a.sourceId}`
        : !key.startsWith(`habit:${a.sourceId}:`) || !/^\d{4}-\d{2}-\d{2}$/.test(key.slice(`habit:${a.sourceId}:`.length)))
      || Date.parse(a.observingSince) < Date.parse(a.startedAt)
      || (a.status === 'ready') !== (a.progress === a.target)) fail('同行約定無效');
    if (a.chapter && (!raw.byPet?.[a.petId]?.chapters?.[a.chapter]
      || raw.byPet[a.petId].chapters[a.chapter].claimedAt
      || Boolean(raw.byPet[a.petId].chapters[a.chapter].completedAt) !== (a.status === 'ready'))) fail('約定章節無效');
    if (a.chapter === 0 && !raw.byPet?.[a.petId]?.chapters?.[5]?.claimedAt) fail('日常同行尚未解鎖');
  }
  if (raw.displayPetId && !raw.byPet?.[raw.displayPetId]?.chapters?.[5]?.claimedAt) fail('紀念物尚未解鎖');
  return errors;
}

export function normalizeBondJourney(raw) {
  if (raw == null) return createBondJourney();
  const errors = validateBondJourney(raw);
  if (errors.length) throw new Error(errors.join('；'));
  return structuredClone(raw);
}

export function chapterIsAvailable(journey, pet, level) {
  return CHAPTER_LEVELS.includes(level) && pet?.owned !== false && (pet?.bondLevel || 1) >= level
    && (level === 2 || Boolean(journey.byPet[pet.id]?.chapters[level - 1]?.claimedAt));
}

/** Reconcile persisted completions, including a completion interrupted by reload. */
export function advanceBondJourney(raw, tasks, habits) {
  const journey = normalizeBondJourney(raw);
  const a = journey.active;
  if (!a || a.status !== 'active') return journey;
  let events = [];
  if (a.sourceType === 'task') {
    const task = tasks.find((item) => item.id === a.sourceId);
    if (task?.completed && !task.isTutorial && time(task.completedAt)) events = [{ key: `task:${task.id}`, at: task.completedAt }];
  } else {
    const habit = habits.find((item) => item.id === a.sourceId);
    if (habit?.isActive && !habit.archivedAt) events = Object.entries(habit.logs || {})
      .filter(([date, log]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && log.completed && time(log.completedAt))
      .map(([date, log]) => ({ key: `habit:${habit.id}:${date}`, at: log.completedAt }));
  }
  events.sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
  for (const event of events) {
    if (Date.parse(event.at) <= Date.parse(a.observingSince) || journey.usedEventKeys.includes(event.key)) continue;
    journey.usedEventKeys.push(event.key);
    a.eventKeys.push(event.key);
    a.progress += 1;
    if (a.progress === a.target) {
      a.status = 'ready';
      if (a.chapter) journey.byPet[a.petId].chapters[a.chapter].completedAt = event.at;
      break;
    }
  }
  return journey;
}

export function getBondSummary(journey, pet, story) {
  const completed = CHAPTER_LEVELS.filter((level) => journey.byPet[pet.id]?.chapters[level]?.claimedAt).length;
  const next = CHAPTER_LEVELS.find((level) => !journey.byPet[pet.id]?.chapters[level]?.claimedAt);
  const active = journey.active?.petId === pet.id ? journey.active : null;
  let hint = story ? `專屬故事 ${completed}/4 章` : '這位夥伴的專屬故事尚未收錄';
  if (active) hint = `${active.status === 'paused' ? '已暫停' : active.status === 'ready' ? '可領取' : '同行中'} · ${active.sourceTitle} ${active.progress}/${active.target}`;
  else if (story && next) hint += (pet.bondLevel || 1) >= next ? ' · 新篇章等你閱讀' : ` · Lv.${next} 解鎖下一章`;
  else if (story) hint += ' · 已解鎖日常同行';
  return { completed, next, active, hint };
}
