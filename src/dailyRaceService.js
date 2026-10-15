import { dbMutateRecords, STORES } from './db.js';
import { getTodayDateString } from './taskFilterService.js';
import { DAILY_RACE_KEY, prepareRaceDay, settleRace } from './dailyRaceCore.js';

export function getDailyRaces(pets) {
  return dbMutateRecords([{ store: STORES.META, key: DAILY_RACE_KEY }], ([raw]) => {
    const state = prepareRaceDay(raw, getTodayDateString(), pets);
    return { puts: raw?.day?.date === state.day.date ? [] : [{ store: STORES.META, value: state }], result: state };
  });
}

export function playDailyRace(request) {
  return dbMutateRecords([
    { store: STORES.META, key: DAILY_RACE_KEY },
    { store: STORES.META, key: 'wallet' },
  ], ([raw, wallet]) => {
    const update = settleRace(raw, wallet, request, getTodayDateString(), new Date().toISOString());
    return { puts: update.duplicate ? [] : [
      { store: STORES.META, value: update.state },
      { store: STORES.META, value: update.wallet },
    ], result: update };
  });
}
