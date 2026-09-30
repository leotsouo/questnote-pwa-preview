// Count complete UI operations, including the gaps between their DB transactions.
let active = 0;
let locked = false;

export function trackUpdateActivity(callback) {
  return function (...args) {
    // The update controls must not count their own delegated click as gameplay.
    if (args[0]?.target?.closest?.('[data-app-update]')) return callback.apply(this, args);
    if (locked) return;
    active += 1;
    try {
      const result = callback.apply(this, args);
      if (result && typeof result.then === 'function') {
        return Promise.resolve(result).finally(() => { active -= 1; });
      }
      active -= 1;
      return result;
    } catch (error) { active -= 1; throw error; }
  };
}

export function beginUpdate() {
  if (locked || active) return false;
  locked = true;
  return true;
}

export function endUpdate() { locked = false; }
export function hasUpdateActivity() { return active > 0; }
