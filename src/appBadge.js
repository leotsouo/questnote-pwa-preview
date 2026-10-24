/**
 * Home Screen icon badge: the number of unfinished to-dos.
 * iOS 16.4+ Home Screen web apps grant the Badging API together with notification permission,
 * so a refused call is expected and stays silent.
 */
let lastBadgeCount = null;

export function countUnfinishedTasks(tasks) {
  return (tasks || []).filter((task) => !task.completed && !task.isTutorial).length;
}

/** @returns {Promise<'set'|'cleared'|'unchanged'|'unsupported'|'denied'>} */
export async function syncAppBadge(tasks, nav = globalThis.navigator) {
  if (typeof nav?.setAppBadge !== 'function') return 'unsupported';
  const count = countUnfinishedTasks(tasks);
  if (count === lastBadgeCount) return 'unchanged';
  try {
    if (count > 0) await nav.setAppBadge(count);
    else if (typeof nav.clearAppBadge === 'function') await nav.clearAppBadge();
    else await nav.setAppBadge(0);
  } catch {
    lastBadgeCount = null;
    return 'denied';
  }
  lastBadgeCount = count;
  return count > 0 ? 'set' : 'cleared';
}

export function resetAppBadgeCache() {
  lastBadgeCount = null;
}
