/**
 * Recent runtime errors — the App's own black box.
 *
 * Uncaught errors and unhandled promise rejections are kept in a small ring buffer (memory plus
 * sessionStorage) so that the feedback report (更多 → 回報) and the settings version card can show
 * what actually went wrong on the device. The 2026-10 "Can't find variable: getMailboxCatalogs"
 * report only reached us as a photographed toast; this records the message, where it came from and
 * the App version so the next report carries the facts.
 *
 * Nothing here shows UI or sends data anywhere. Resource load failures (an <img> or stylesheet that
 * could not load) are not errors of the App and are skipped.
 */
import { APP_VERSION } from './version.js';

export const RECENT_ERRORS_KEY = 'questnote:recent-errors';
export const RECENT_ERRORS_LIMIT = 20;
const TEXT_LIMIT = 400;

let entries = [];
let installed = false;

function clip(value, limit = TEXT_LIMIT) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function readStored(storage) {
  try {
    const raw = storage?.getItem(RECENT_ERRORS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry.message === 'string') : [];
  } catch {
    return [];
  }
}

function writeStored(storage) {
  try { storage?.setItem(RECENT_ERRORS_KEY, JSON.stringify(entries)); }
  catch { /* Private mode or quota: memory copy is enough. */ }
}

/** One normalized entry from an Error, a rejection reason or a plain message. */
export function describeError(reason, extra = {}) {
  const error = reason instanceof Error ? reason : null;
  const message = error ? `${error.name}: ${error.message}` : clip(typeof reason === 'string' ? reason : (reason?.message || JSON.stringify(reason) || 'Unknown error'));
  return {
    time: new Date(extra.now ?? Date.now()).toISOString(),
    kind: extra.kind || 'error',
    message: clip(message),
    source: clip(extra.source || '', 200),
    stack: clip(error?.stack || '', TEXT_LIMIT),
    appVersion: APP_VERSION,
  };
}

export function recordError(reason, extra = {}, environment = globalThis) {
  const entry = describeError(reason, extra);
  entries = [...entries, entry].slice(-RECENT_ERRORS_LIMIT);
  writeStored(environment.sessionStorage);
  return entry;
}

export function getRecentErrors() {
  return entries.slice();
}

export function clearRecentErrors(environment = globalThis) {
  entries = [];
  try { environment.sessionStorage?.removeItem(RECENT_ERRORS_KEY); } catch { /* ignore */ }
}

/** Short lines for the settings card and the feedback diagnostics. Newest last. */
export function formatRecentErrors(list = entries, limit = 5) {
  return list.slice(-limit).map((entry) => {
    const when = entry.time.replace('T', ' ').slice(5, 16);
    const where = entry.source ? ` @ ${entry.source}` : '';
    return `${when} ${entry.message}${where}`;
  });
}

/**
 * Listen for uncaught errors and unhandled rejections. Safe to call more than once and in Node
 * (no window: nothing is installed). Stored entries from this session are loaded first.
 */
export function installErrorLog(environment = globalThis) {
  const target = environment.window || environment;
  if (typeof target.addEventListener !== 'function') return false;
  entries = readStored(environment.sessionStorage).slice(-RECENT_ERRORS_LIMIT);
  if (installed) return true;
  installed = true;
  target.addEventListener('error', (event) => {
    // A failed <img>/<link>/<script> load dispatches a plain Event on the element; skip those.
    if (event?.target && event.target !== target && !('error' in event)) return;
    const reason = event?.error || event?.message || 'Script error';
    const source = event?.filename ? `${String(event.filename).split('/').slice(-2).join('/')}:${event.lineno || 0}` : '';
    recordError(reason, { kind: 'error', source }, environment);
  });
  target.addEventListener('unhandledrejection', (event) => {
    recordError(event?.reason ?? 'Unhandled rejection', { kind: 'unhandledrejection' }, environment);
  });
  return true;
}
