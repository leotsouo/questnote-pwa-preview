/** Awakening progress; pure reducers shared by writers and backup validation. */
export const AWAKENING_KEY = 'petAwakening';
import { AWAKENING_PROFILES, getAwakeningProfile } from './petAwakeningProfiles.js';
export const AWAKENING_PET_IDS = Object.freeze(AWAKENING_PROFILES.flatMap(p=>p.petIds));
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const time = (v) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const unique = (v) => Array.isArray(v) && v.every((s) => typeof s === 'string' && /^(task|habit|expedition):[^\s]+$/.test(s)) && new Set(v).size === v.length;
const ownKeys = (v, allowed) => Object.keys(v).every((k) => allowed.includes(k));
export const awakeningTitleId = (petId) => `title_awakening_${petId}`;

export function createPetAwakening() {
  return { key: AWAKENING_KEY, schemaVersion: 1, byPet: {}, activePetId: null, usedEventKeys: [] };
}

export function validatePetAwakening(raw) {
  const errors = [];
  const fail = (text) => errors.push(`petAwakening: ${text}`);
  if (!object(raw)) return ['petAwakening: 必須是物件'];
  if (!ownKeys(raw, ['key', 'schemaVersion', 'byPet', 'activePetId', 'usedEventKeys'])
    || raw.key !== AWAKENING_KEY || raw.schemaVersion !== 1 || !object(raw.byPet)
    || !unique(raw.usedEventKeys) || (raw.activePetId !== null && !AWAKENING_PET_IDS.includes(raw.activePetId))) {
    return ['petAwakening: 格式或版本無效'];
  }
  const used = new Set(raw.usedEventKeys);
  const attributed = new Set();
  let active = 0;
  for (const [id, p] of Object.entries(raw.byPet)) {
    if (!AWAKENING_PET_IDS.includes(id) || !object(p)) { fail('角色無效'); continue; }
    if (!ownKeys(p, ['startedAt', 'observingSince', 'status', 'eventKeys', 'expeditionKey', 'tokenGrantedAt', 'tokenConsumedAt', 'awakenedAt', 'form'])
      || !time(p.startedAt) || !time(p.observingSince) || Date.parse(p.observingSince) < Date.parse(p.startedAt)
      || !['active', 'paused', 'ready', 'awakened'].includes(p.status)
      || !unique(p.eventKeys) || p.eventKeys.length > 3 || p.eventKeys.some((k) => !/^(task|habit):/.test(k))
      || (p.expeditionKey !== null && (typeof p.expeditionKey !== 'string' || !/^expedition:[^\s]+$/.test(p.expeditionKey)))
      || !['initial', 'awakened'].includes(p.form)) { fail(`${id} 進度無效`); continue; }
    const keys = [...p.eventKeys, ...(p.expeditionKey ? [p.expeditionKey] : [])];
    for (const k of keys) {
      if (!used.has(k) || attributed.has(k)) fail(`${id} 完成事件重複或遺失`);
      attributed.add(k);
    }
    const complete = p.eventKeys.length === 3 && p.expeditionKey !== null;
    if (complete !== ['ready', 'awakened'].includes(p.status)) fail(`${id} 完成狀態矛盾`);
    if (p.status === 'active') { active += 1; if (raw.activePetId !== id) fail('目前角色矛盾'); }
    for (const k of ['tokenGrantedAt', 'tokenConsumedAt', 'awakenedAt']) {
      if (p[k] !== null && (!time(p[k]) || Date.parse(p[k]) < Date.parse(p.startedAt))) fail(`${id} 時間無效`);
    }
    if (complete !== Boolean(p.tokenGrantedAt) || (p.status === 'awakened') !== Boolean(p.awakenedAt)
      || Boolean(p.awakenedAt) !== Boolean(p.tokenConsumedAt) || (p.form === 'initial' && !p.awakenedAt)
      || (p.awakenedAt && (p.tokenConsumedAt !== p.awakenedAt || Date.parse(p.awakenedAt) < Date.parse(p.tokenGrantedAt)))) fail(`${id} 信物或形態狀態矛盾`);
  }
  if ((raw.activePetId === null ? 0 : 1) !== active) fail('進行中角色數量無效');
  return errors;
}

export function normalizePetAwakening(raw) {
  if (raw == null) return createPetAwakening();
  const errors = validatePetAwakening(raw);
  if (errors.length) throw Error(errors.join('；'));
  return structuredClone(raw);
}

export function awakeningEvents(tasks = [], habits = [], expeditions = []) {
  return [
    ...tasks.filter((t) => !t.isTutorial && t.completed && time(t.completedAt)).map((t) => ({ key: `task:${t.id}`, at: t.completedAt })),
    ...habits.filter((h) => h.isActive && !h.archivedAt).flatMap((h) => Object.entries(h.logs || {})
      .filter(([date, log]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && log.completed && time(log.completedAt))
      .map(([date, log]) => ({ key: `habit:${h.id}:${date}`, at: log.completedAt }))),
    ...expeditions.filter((e) => e.claimed && time(e.claimedAt)).map((e) => ({ key: `expedition:${e.id}`, at: e.claimedAt,
      startedAt: e.startedAt, areaId: e.areaId, petIds: e.petIds?.length ? e.petIds : [e.petId] })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.key.localeCompare(b.key));
}

export function advancePetAwakening(raw, events) {
  const state = normalizePetAwakening(raw);
  const id = state.activePetId;
  const p = state.byPet[id];
  if (!p || p.status !== 'active') return state;
  const used = new Set(state.usedEventKeys);
  for (const e of events) {
    if (!time(e.at) || Date.parse(e.at) <= Date.parse(p.observingSince) || used.has(e.key)) continue;
    if (/^(task|habit):/.test(e.key) && p.eventKeys.length < 3) p.eventKeys.push(e.key);
    else if (e.key.startsWith('expedition:') && !p.expeditionKey && e.areaId === getAwakeningProfile(id)?.areaId
      && e.petIds?.includes(id) && time(e.startedAt) && Date.parse(e.startedAt) >= Date.parse(p.startedAt)) p.expeditionKey = e.key;
    else continue;
    state.usedEventKeys.push(e.key); used.add(e.key);
    if (p.eventKeys.length === 3 && p.expeditionKey) {
      p.status = 'ready'; p.tokenGrantedAt = e.at; state.activePetId = null; break;
    }
  }
  return state;
}

export function beginPetAwakening(raw, petId, now, historicalKeys = []) {
  const state = normalizePetAwakening(raw);
  if (!AWAKENING_PET_IDS.includes(petId) || !time(now)) throw Error('覺醒角色或時間無效');
  if (state.activePetId) throw Error('請先暫停目前的覺醒試煉。');
  const existing = state.byPet[petId];
  if (existing && existing.status !== 'paused') throw Error('這位夥伴的試煉已開始或完成。');
  state.usedEventKeys = [...new Set([...state.usedEventKeys, ...historicalKeys])];
  state.byPet[petId] = existing ? { ...existing, status: 'active', observingSince: now } : {
    startedAt: now, observingSince: now, status: 'active', eventKeys: [], expeditionKey: null,
    tokenGrantedAt: null, tokenConsumedAt: null, awakenedAt: null, form: 'awakened',
  };
  state.activePetId = petId;
  return state;
}

export function awakenedTitles(raw) {
  const state = normalizePetAwakening(raw);
  return Object.entries(state.byPet).filter(([, p]) => p.awakenedAt).map(([id]) => awakeningTitleId(id));
}
