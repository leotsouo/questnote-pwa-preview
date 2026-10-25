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
