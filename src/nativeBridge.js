/**
 * Calls into the iOS app's native code. Outside the Capacitor app every call is a no-op,
 * so the PWA keeps working unchanged.
 */
import { buildWidgetSnapshot } from './widgetSnapshot.js';
import { getTodayDateString } from './taskFilterService.js';

const WIDGET_PLUGIN = 'QuestNoteWidgetBridge';
let lastSnapshotJson = null;

function nativeCapacitor(capacitor) {
  return capacitor?.isNativePlatform?.() && typeof capacitor.nativePromise === 'function' ? capacitor : null;
}

/** @returns {Promise<'sent'|'unchanged'|'unavailable'|'failed'>} */
export async function syncNativeWidget(tasks, { capacitor = globalThis.Capacitor, today = getTodayDateString() } = {}) {
  const native = nativeCapacitor(capacitor);
  if (!native) return 'unavailable';
  const snapshot = buildWidgetSnapshot(tasks, today);
  const json = JSON.stringify(snapshot);
  if (json === lastSnapshotJson) return 'unchanged';
  try {
    await native.nativePromise(WIDGET_PLUGIN, 'update', { snapshot });
  } catch {
    lastSnapshotJson = null;
    return 'failed';
  }
  lastSnapshotJson = json;
  return 'sent';
}

export function resetNativeWidgetCache() {
  lastSnapshotJson = null;
}

/** Fired by QuestNoteWidgetBridge.swift when a widget link arrives while the app is running. */
export const WIDGET_LINK_EVENT = 'questnote:widget-link';

/** questnote://tasks, questnote://add, questnote://voice or questnote://task?id=… → what to open; anything else → null. */
export function parseWidgetLink(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'questnote:') return null;
  if (parsed.hostname === 'tasks') return { action: 'tasks' };
  if (parsed.hostname === 'add') return { action: 'add' };
  if (parsed.hostname === 'voice') return { action: 'voice' };
  const taskId = parsed.searchParams.get('id');
  if (parsed.hostname === 'task' && taskId) return { action: 'task', taskId };
  return null;
}

/**
 * The native side keeps the latest widget link until the web app takes it, so a link that
 * launched the app is read here at startup, and later ones when the bridge announces them
 * (or when the app comes back to the foreground, in case that event was missed).
 */
export function listenForWidgetLinks(onLink, { capacitor = globalThis.Capacitor, target = globalThis, doc = globalThis.document } = {}) {
  const native = nativeCapacitor(capacitor);
  if (!native) return false;
  const pull = async () => {
    let result;
    try {
      result = await native.nativePromise(WIDGET_PLUGIN, 'consumeLink', {});
    } catch {
      return;
    }
    const link = parseWidgetLink(result?.url);
    if (link) onLink(link);
  };
  target.addEventListener(WIDGET_LINK_EVENT, () => { void pull(); });
  doc?.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'visible') void pull(); });
  void pull();
  return true;
}
