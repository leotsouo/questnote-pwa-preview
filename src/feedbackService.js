/** Feedback content and local drafts. No task/backup data is read or uploaded. */
import { APP_VERSION, BUILD_TIME, CACHE_NAME } from './version.js';
import { RELEASE_PROFILE } from './releaseProfile.js';
import { FEEDBACK_ENDPOINT } from './feedbackConfig.js';

export const FEEDBACK_MARKER = '<!-- questnote-feedback:v2 -->';
export const FEEDBACK_LIMITS = Object.freeze({ title: 100, description: 4000, steps: 2000, expected: 1000 });
const DRAFT_KEY = `questnote-feedback-draft-v1:${new URL('../', import.meta.url).pathname}`;
const PENDING_KEY = `${DRAFT_KEY}:pending`;
const RECEIPT_KEY = `${DRAFT_KEY}:receipt`;
const TYPES = Object.freeze({ bug: '問題回報', suggestion: '功能建議', other: '其他意見' });

export function normalizeFeedback(input = {}) {
  const draft = { type: Object.hasOwn(TYPES, input?.type) ? input.type : 'bug' };
  for (const [key, limit] of Object.entries(FEEDBACK_LIMITS)) {
    draft[key] = typeof input?.[key] === 'string' ? input[key].slice(0, limit) : '';
  }
  draft.includeDiagnostics = input?.includeDiagnostics === true;
  return draft;
}

export function validateFeedback(input) {
  const draft = normalizeFeedback(input);
  if (!draft.title.trim()) return '請填寫回報標題。';
  if (!draft.description.trim()) return '請說明遇到的問題或想法。';
  return '';
}

// Access to localStorage itself can throw in private/restricted browser contexts.
export function loadFeedbackDraft(storage) {
  try { return normalizeFeedback(JSON.parse((storage || globalThis.localStorage).getItem(DRAFT_KEY) || '{}')); }
  catch { return normalizeFeedback(); }
}

export function saveFeedbackDraft(input, storage) {
  try {
    (storage || globalThis.localStorage).setItem(DRAFT_KEY, JSON.stringify(normalizeFeedback(input)));
    return true;
  } catch { return false; }
}

export function clearFeedbackDraft(storage) {
  try { const target = storage || globalThis.localStorage; target.removeItem(DRAFT_KEY); target.removeItem(PENDING_KEY); return true; }
  catch { return false; }
}

export function collectFeedbackDiagnostics(environment = globalThis) {
  const navigator = environment.navigator || {};
  return {
    appVersion: APP_VERSION,
    buildTime: BUILD_TIME,
    cacheName: CACHE_NAME,
    releaseProfile: RELEASE_PROFILE?.profile || 'source',
    artifactId: RELEASE_PROFILE?.artifactId || null,
    userAgent: String(navigator.userAgent || 'unknown').slice(0, 400),
    language: String(navigator.language || 'unknown').slice(0, 40),
    viewport: `${Number(environment.innerWidth) || 0} × ${Number(environment.innerHeight) || 0}`,
    online: navigator.onLine !== false,
    displayMode: environment.matchMedia?.('(display-mode: standalone)')?.matches || navigator.standalone === true ? 'standalone' : 'browser',
    serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
  };
}

export function buildFeedbackReport(input, diagnostics, now = new Date()) {
  const error = validateFeedback(input);
  if (error) throw new Error(error);
  const draft = normalizeFeedback(input);
  const id = globalThis.crypto.randomUUID();
  const title = `[QuestNote ${TYPES[draft.type]}] ${draft.title.trim()}`;
  const parts = [FEEDBACK_MARKER, `回報編號：${id}`, `建立時間：${now.toISOString()}`,
    `類型：${TYPES[draft.type]}`, '', '## 問題或建議', draft.description.trim(), '',
    '## 重現步驟', draft.steps.trim() || '未提供', '',
    '## 預期結果', draft.expected.trim() || '未提供'];
  if (draft.includeDiagnostics) {
    parts.push('', '## 環境資訊', '```json', JSON.stringify(diagnostics, null, 2), '```');
  }
  return { id, title, body: parts.join('\n'), payload: { id, type: draft.type,
    title: draft.title.trim(), description: draft.description.trim(), steps: draft.steps.trim(),
    expected: draft.expected.trim(), diagnostics: draft.includeDiagnostics ? diagnostics : null } };
}

export function savePendingFeedback(draft, report, storage) {
  try { (storage || globalThis.localStorage).setItem(PENDING_KEY, JSON.stringify({ draft: normalizeFeedback(draft), report })); return true; }
  catch { return false; }
}

export function loadPendingFeedback(draft, storage) {
  try {
    const pending = JSON.parse((storage || globalThis.localStorage).getItem(PENDING_KEY));
    if (JSON.stringify(pending?.draft) !== JSON.stringify(normalizeFeedback(draft))
      || pending.report?.payload?.id !== pending.report?.id || !pending.report?.body) return null;
    return pending.report;
  } catch { return null; }
}

export function finishFeedback(id, storage) {
  try {
    const target = storage || globalThis.localStorage;
    target.setItem(RECEIPT_KEY, JSON.stringify({ id, sentAt: new Date().toISOString() }));
    target.removeItem(PENDING_KEY);
    target.removeItem(DRAFT_KEY);
    return true;
  } catch { return false; }
}

export function getFeedbackReceipt(storage) {
  try { return JSON.parse((storage || globalThis.localStorage).getItem(RECEIPT_KEY) || 'null'); }
  catch { return null; }
}

export async function sendFeedback(report, { fetcher = globalThis.fetch, endpoint = FEEDBACK_ENDPOINT, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'omit', referrerPolicy: 'no-referrer', body: JSON.stringify(report.payload), signal: controller.signal });
    if (response.status === 429) throw new Error('回報暫時過於頻繁，請稍後再試。草稿已保留。');
    if (response.status === 409) throw new Error('回報編號發生衝突，請修改內容後重新預覽。');
    if (!response.ok) throw new Error('目前無法送出，請稍後再試。草稿已保留。');
    let result;
    try { result = await response.json(); }
    catch { throw new Error('尚未確認收件，請重試同一份回報。'); }
    if (result.accepted !== true || result.id !== report.id) throw new Error('尚未確認收件，請重試。');
    return result;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('連線中斷或逾時，尚未確認收件。請重試同一份回報，不會重複建立。');
    throw error;
  } finally { clearTimeout(timer); }
}
