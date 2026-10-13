/** Personal race rules. No wallet writes, DOM, or catalog mutations. */
export const DAILY_RACE_KEY = 'dailyRace';
export const RACE_LIMIT = 3;
export const RACE_TRACKS = [
  { name: '雲海星橋', symbol: '☁', line: '雲橋亮起，四位夥伴踏上星光跑道。' },
  { name: '月光森林', symbol: '☾', line: '螢光沿著林間小徑，為每位選手引路。' },
  { name: '極光海岸', symbol: '✦', line: '極光映在潮水上，終點的旗幟迎風展開。' },
];

export function randomRaceIndex(length) {
  if (!Number.isInteger(length) || length < 1 || length > 0xffffffff) throw new Error('選手數量無效');
  const limit = Math.floor(0x100000000 / length) * length;
  const bytes = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(bytes); } while (bytes[0] >= limit);
  return bytes[0] % length;
}

export function racePayout(stake) {
  if (!Number.isSafeInteger(stake) || stake < 5 || stake > 500 || stake % 5) throw new Error('請押 5～500 星塵，以 5 為級距');
  return (stake / 5) * 19;
}

const record = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const id = (v) => typeof v === 'string' && /^pet_[a-z0-9]+$/i.test(v);
function dateKey(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const date = new Date(`${v}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v;
}

export function validateDailyRace(value) {
  const errors = [];
  const fail = () => errors.push('dailyRace: 賽事紀錄無效，原始資料已保留');
  if (!record(value) || value.key !== DAILY_RACE_KEY || value.version !== 1
    || !Array.isArray(value.history) || value.history.length > 90) return ['dailyRace: 賽事資料格式無效'];
  const dates = new Set();
  const checkDay = (day) => {
    if (!record(day) || !dateKey(day.date) || dates.has(day.date) || !Array.isArray(day.rounds) || day.rounds.length !== RACE_LIMIT) { fail(); return; }
    dates.add(day.date);
    for (const round of day.rounds) {
      if (!record(round) || !Number.isInteger(round.track) || round.track < 0 || round.track >= RACE_TRACKS.length
        || !Array.isArray(round.petIds) || round.petIds.length !== 4 || new Set(round.petIds).size !== 4 || !round.petIds.every(id)) { fail(); continue; }
      if (round.result === null) continue;
      const r = round.result;
      if (!record(r) || !round.petIds.includes(r.winnerId) || typeof r.settledAt !== 'string' || !Number.isFinite(Date.parse(r.settledAt))) { fail(); continue; }
      if (r.mode === 'watch') {
        if (r.selectedId !== null || r.stake !== 0 || r.payout !== 0) fail();
      } else if (r.mode === 'bet') {
        try {
          const payout = racePayout(r.stake);
          if (!round.petIds.includes(r.selectedId) || r.payout !== (r.selectedId === r.winnerId ? payout : 0)) fail();
        } catch { fail(); }
      } else fail();
    }
  };
  if (value.day !== null) checkDay(value.day);
  for (const day of value.history) {
    checkDay(day);
    if (!value.day || day?.date >= value.day.date) fail();
  }
  return errors;
}

export function normalizeDailyRace(value) {
  if (value === undefined || value === null) return { key: DAILY_RACE_KEY, version: 1, day: null, history: [] };
  const errors = validateDailyRace(value);
  if (errors.length) throw new Error(errors[0]);
  return structuredClone(value);
}

export function prepareRaceDay(raw, today, pets, randomIndex = randomRaceIndex) {
  const state = normalizeDailyRace(raw);
  if (!dateKey(today)) throw new Error('日期無效');
  if (state.day?.date > today) throw new Error('裝置日期早於最近賽事，請確認日期後再試');
  if (state.day?.date === today) return state;
  const pool = [...new Set(pets.map((pet) => pet.id).filter(id))];
  if (pool.length < 4) throw new Error('夥伴圖鑑尚未載入完成，請稍後再試');
  if (state.day) state.history = [...state.history, state.day].slice(-90);
  const trackOffset = Number(today.replaceAll('-', '')) % RACE_TRACKS.length;
  state.day = { date: today, rounds: Array.from({ length: RACE_LIMIT }, (_, index) => {
    const available = [...pool];
    const petIds = Array.from({ length: 4 }, () => available.splice(randomIndex(available.length), 1)[0]);
    return { track: (trackOffset + index) % RACE_TRACKS.length, petIds, result: null };
  }) };
  return state;
}

/** Caller commits this state and wallet together, before presenting animation. */
export function settleRace(raw, wallet, request, today, now, randomIndex = randomRaceIndex) {
  const state = normalizeDailyRace(raw);
  if (request.date !== today || state.day?.date !== today) throw new Error('日期已變更，請重新開啟今天的賽事');
  if (!Number.isInteger(request.round) || request.round < 0 || request.round >= RACE_LIMIT) throw new Error('今天最多三場賽事');
  const round = state.day.rounds[request.round];
  if (round.result) return { state, wallet, result: round.result, duplicate: true };
  if (!wallet || !Number.isSafeInteger(wallet.stardust) || wallet.stardust < 0) throw new Error('星塵資料無效');
  const watching = request.mode === 'watch';
  if (!watching && request.mode !== 'bet') throw new Error('賽事模式無效');
  if (watching && (request.stake !== 0 || request.selectedId !== null)) throw new Error('觀賽不需下注');
  const stake = watching ? 0 : request.stake;
  const prize = watching ? 0 : racePayout(stake);
  if (!watching && !round.petIds.includes(request.selectedId)) throw new Error('請選擇本場一位夥伴');
  if (wallet.stardust < stake) throw new Error('星塵不足，仍可選擇免費觀賽');
  const winnerId = round.petIds[randomIndex(4)];
  const payout = !watching && winnerId === request.selectedId ? prize : 0;
  const balance = wallet.stardust - stake + payout;
  if (!Number.isSafeInteger(balance) || balance < 0) throw new Error('星塵數值超出可保存範圍');
  round.result = { mode: request.mode, selectedId: watching ? null : request.selectedId,
    stake, payout, winnerId, settledAt: now };
  return { state, wallet: { ...wallet, stardust: balance }, result: round.result, duplicate: false };
}
