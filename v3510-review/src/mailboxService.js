/**
 * 全域信箱服務 — QuestNote V3.0.1
 *
 * 現實限制（務必誠實）：
 * - 所有裝置拉取同一份公開 JSON
 * - 補償為 once per local profile（每份本機資料領取一次）
 * - 無法辨識同一真人／跨裝置防重領／真正推播
 *
 * 本模組不直接操作 DOM。
 * Schema 純函式見 mailboxSchema.js（與作者發布工具共用）。
 */
import { openDB, dbGet, dbPut, STORES } from './db.js';
import { APP_VERSION, MAILBOX_RUNTIME_CACHE } from './version.js';
import { normalizeWallet, DEFAULT_MATERIALS } from './rewardService.js';
import { normalizeInventory, DEFAULT_ITEM_IDS, getMaterialName, getItemName } from './workshopService.js';
import { isDebugMode, isAuthorLocalDevMode } from './devService.js';
import {
  MAILBOX_ACTION_VIEWS,
  MAILBOX_REWARD_LIMITS,
  compareAppVersions,
  validateMailboxReward,
  normalizeMailboxAction,
  normalizeMailboxMessage as normalizeMailboxMessageSchema,
  normalizeMailboxPayload as normalizeMailboxPayloadSchema,
  mergeRemoteAndLocalDevMessages,
  __mailboxSchemaTestHelpers,
} from './mailboxSchema.js';

export {
  MAILBOX_ACTION_VIEWS,
  MAILBOX_REWARD_LIMITS,
  compareAppVersions,
  validateMailboxReward,
  normalizeMailboxAction,
};

export const MAILBOX_STATE_KEY = 'globalMailboxState';
export const MAILBOX_JSON_PATH = './data/global-mailbox.json';
export { MAILBOX_RUNTIME_CACHE };
export const MAILBOX_FETCH_TIMEOUT_MS = 7000;
export const MAILBOX_CHECK_THROTTLE_MS = 10 * 60 * 1000;

/** sessionStorage：本機測試信件正文（不進遠端 cache／備份） */
export const DEV_MAILBOX_SESSION_KEY = 'questnote_dev_mailbox_messages';
export const DEV_LOCAL_ANNOUNCEMENT_ID = 'dev-local-announcement-v301';
export const DEV_LOCAL_COMPENSATION_ID = 'dev-local-compensation-v301';

/** Cache Storage 固定相對路徑（寫入時正規化，避免 query string 無限增生） */
const MAILBOX_CACHE_RELATIVE_PATH = 'data/global-mailbox.json';

const TYPE_LABELS = {
  announcement: '公告',
  update: '更新',
  maintenance: '維護',
  compensation: '補償',
};

const WALLET_KEY = 'wallet';
const INVENTORY_KEY = 'inventory';

/** @type {Set<string>} 領取中的 message id（once per local profile 連點防護） */
const mailboxClaimInProgress = new Set();

/** 模組級節流：上次嘗試檢查時間 */
let lastMailboxCheckAt = 0;

/** 記憶體快取（非持久化正文來源，僅本次 session） */
let memoryMailboxPayload = null;
let memoryMailboxFromCache = false;

function debugWarn(...args) {
  if (isDebugMode()) {
    console.warn('[QuestNote Mailbox]', ...args);
  }
}

/**
 * 正規化本機信箱狀態（readIds / claimedIds 分開）
 * once per local profile：claimedIds 以本機 meta 為準
 */
export function normalizeGlobalMailboxState(raw) {
  const empty = {
    key: MAILBOX_STATE_KEY,
    version: 1,
    readIds: [],
    claimedIds: [],
    lastFetchedAt: null,
    lastSeenGeneratedAt: null,
  };
  if (!raw || typeof raw !== 'object') return empty;

  const uniqStrings = (arr) => {
    if (!Array.isArray(arr)) return [];
    const seen = new Set();
    const out = [];
    for (const id of arr) {
      if (typeof id !== 'string' || !id.trim()) continue;
      const trimmed = id.trim();
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      out.push(trimmed);
    }
    return out;
  };

  return {
    key: MAILBOX_STATE_KEY,
    version: Number.isFinite(raw.version) ? raw.version : 1,
    readIds: uniqStrings(raw.readIds),
    claimedIds: uniqStrings(raw.claimedIds),
    lastFetchedAt: typeof raw.lastFetchedAt === 'string' ? raw.lastFetchedAt : null,
    lastSeenGeneratedAt: typeof raw.lastSeenGeneratedAt === 'string' ? raw.lastSeenGeneratedAt : null,
  };
}

export async function getGlobalMailboxState() {
  try {
    const raw = await dbGet(STORES.META, MAILBOX_STATE_KEY);
    return normalizeGlobalMailboxState(raw);
  } catch (err) {
    debugWarn('讀取 mailbox state 失敗，使用空狀態', err);
    return normalizeGlobalMailboxState(null);
  }
}

export async function saveGlobalMailboxState(state) {
  const normalized = normalizeGlobalMailboxState(state);
  await dbPut(STORES.META, normalized);
  return normalized;
}

export function getMailboxTypeLabel(type) {
  return TYPE_LABELS[type] || TYPE_LABELS.announcement;
}

/**
 * 驗證補償 reward（白名單 + 安全上限）— 轉呼叫共用 schema
 */
// validateMailboxReward / normalizeMailboxAction 已自 mailboxSchema re-export

/**
 * 正規化單封信件；無效則回傳 null（不讓整份 fetch 失敗）
 */
export function normalizeMailboxMessage(raw, catalogs = {}, now = Date.now()) {
  return normalizeMailboxMessageSchema(raw, catalogs, now, {
    warn: debugWarn,
    defaultSource: 'remote',
  });
}

/**
 * 正規化遠端 JSON payload
 */
export function normalizeMailboxPayload(raw, catalogs = {}, now = Date.now()) {
  return normalizeMailboxPayloadSchema(raw, catalogs, now, {
    warn: debugWarn,
    defaultSource: 'remote',
  });
}

function isVersionCompatible(message, appVersion = APP_VERSION) {
  if (message.minAppVersion && compareAppVersions(appVersion, message.minAppVersion) < 0) {
    return false;
  }
  if (message.maxAppVersion && compareAppVersions(appVersion, message.maxAppVersion) > 0) {
    return false;
  }
  return true;
}

function isWithinPublishWindow(message, now = Date.now()) {
  if (!message.enabled) return false;
  if (now < message.publishedAtMs) return false;
  if (message.expiresAtMs != null && now > message.expiresAtMs) return false;
  return true;
}

/**
 * 信件對目前使用者的顯示／領取狀態
 * once per local profile：以 claimedIds 判斷是否已領
 */
export function resolveMailboxMessageStatus(message, state, appVersion = APP_VERSION, now = Date.now()) {
  const read = state.readIds.includes(message.id);
  const claimed = state.claimedIds.includes(message.id);
  const versionOk = isVersionCompatible(message, appVersion);
  const windowOk = isWithinPublishWindow(message, now);
  const expired = message.expiresAtMs != null && now > message.expiresAtMs;
  const notYet = now < message.publishedAtMs;

  let claimStatus = null;
  if (message.type === 'compensation') {
    if (message.rewardError) claimStatus = 'invalid';
    else if (claimed) claimStatus = 'claimed';
    else if (expired || (message.enabled && !windowOk && expired)) claimStatus = 'expired';
    else if (!message.enabled || notYet) claimStatus = 'unavailable';
    else if (!versionOk) claimStatus = 'version_mismatch';
    else if (!windowOk) claimStatus = 'unavailable';
    else claimStatus = 'claimable';
  }

  const visible = windowOk && versionOk;
  const unread = visible && !read;
  const claimable = claimStatus === 'claimable';

  return {
    read,
    claimed,
    versionOk,
    windowOk,
    visible,
    unread,
    claimable,
    claimStatus,
    expired,
  };
}

export function getClaimStatusLabel(claimStatus) {
  switch (claimStatus) {
    case 'claimable': return '可領取';
    case 'claimed': return '已領取';
    case 'expired': return '已過期';
    case 'version_mismatch': return '版本不符';
    case 'invalid': return '資料錯誤';
    default: return '';
  }
}

/**
 * 獎勵預覽列（使用材料／道具顯示名稱）
 */
export function formatMailboxRewardPreview(reward) {
  if (!reward) return [];
  const lines = [];
  if (reward.stardust > 0) lines.push({ type: 'stardust', text: `星塵 ×${reward.stardust}` });
  if (reward.adventureEnergy > 0) lines.push({ type: 'energy', text: `冒險能量 ×${reward.adventureEnergy}` });
  for (const [id, amt] of Object.entries(reward.materials || {})) {
    if (amt > 0) {
      lines.push({ type: 'material', text: `${getMaterialName(id) || id} ×${amt}` });
    }
  }
  for (const [id, amt] of Object.entries(reward.items || {})) {
    if (amt > 0) {
      lines.push({ type: 'item', text: `${getItemName(id) || id} ×${amt}` });
    }
  }
  return lines;
}

function buildCatalogSets(materialsCatalog, craftablesCatalog) {
  const materialIds = new Set(Object.keys(DEFAULT_MATERIALS));
  if (Array.isArray(materialsCatalog)) {
    for (const m of materialsCatalog) {
      if (m?.id) materialIds.add(m.id);
    }
  }
  const itemIds = new Set(DEFAULT_ITEM_IDS);
  if (Array.isArray(craftablesCatalog)) {
    for (const c of craftablesCatalog) {
      if (c?.id) itemIds.add(c.id);
    }
  }
  return { materialIds, itemIds };
}

function getMailboxCacheRequest() {
  const base = typeof location !== 'undefined' ? location.href : 'http://localhost/';
  return new Request(new URL(MAILBOX_CACHE_RELATIVE_PATH, base).href);
}

async function putMailboxRuntimeCache(response) {
  if (!('caches' in globalThis)) return;
  try {
    const cache = await caches.open(MAILBOX_RUNTIME_CACHE);
    await cache.put(getMailboxCacheRequest(), response.clone());
  } catch (err) {
    debugWarn('寫入 mailbox runtime cache 失敗', err);
  }
}

async function matchMailboxRuntimeCache() {
  if (!('caches' in globalThis)) return null;
  try {
    const cache = await caches.open(MAILBOX_RUNTIME_CACHE);
    let matched = await cache.match(getMailboxCacheRequest());
    if (matched) return matched;
    const keys = await cache.keys();
    for (const req of keys) {
      const actual = new URL(req.url);
      const expected = new URL(getMailboxCacheRequest().url);
      if (actual.origin === expected.origin && actual.pathname === expected.pathname) {
        matched = await cache.match(req);
        if (matched) return matched;
      }
    }
  } catch (err) {
    debugWarn('讀取 mailbox runtime cache 失敗', err);
  }
  return null;
}

function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, {
    cache: 'no-store',
    signal: controller.signal,
    headers: { Accept: 'application/json' },
  }).finally(() => clearTimeout(timer));
}

/**
 * 取得遠端信箱（Network First + timeout + cache fallback）
 * 失敗不得拋出到阻斷 App；回傳結構化結果
 */
export async function fetchGlobalMailbox(options = {}) {
  const {
    force = false,
    materialsCatalog = null,
    craftablesCatalog = null,
    now = Date.now(),
  } = options;

  if (!force && lastMailboxCheckAt && (now - lastMailboxCheckAt) < MAILBOX_CHECK_THROTTLE_MS) {
    return {
      ok: true,
      fromCache: memoryMailboxFromCache,
      throttled: true,
      payload: memoryMailboxPayload || { schemaVersion: 1, generatedAt: null, messages: [], warnings: [] },
    };
  }

  lastMailboxCheckAt = now;
  const catalogs = buildCatalogSets(materialsCatalog, craftablesCatalog);

  let networkError = null;
  try {
    const bustUrl = `${MAILBOX_JSON_PATH}?t=${now}`;
    const response = await fetchWithTimeout(bustUrl, MAILBOX_FETCH_TIMEOUT_MS);
    if (response.ok) {
      const data = await response.clone().json();
      await putMailboxRuntimeCache(response);
      const payload = normalizeMailboxPayload(data, catalogs, now);
      memoryMailboxPayload = payload;
      memoryMailboxFromCache = false;

      try {
        const state = await getGlobalMailboxState();
        state.lastFetchedAt = new Date(now).toISOString();
        if (payload.generatedAt) state.lastSeenGeneratedAt = payload.generatedAt;
        await saveGlobalMailboxState(state);
      } catch (err) {
        debugWarn('更新 lastFetchedAt 失敗', err);
      }

      return { ok: true, fromCache: false, throttled: false, payload };
    }
    networkError = new Error(`HTTP ${response.status}`);
  } catch (err) {
    networkError = err;
  }

  // Cache fallback
  try {
    const cached = await matchMailboxRuntimeCache();
    if (cached) {
      const data = await cached.json();
      const payload = normalizeMailboxPayload(data, catalogs, now);
      memoryMailboxPayload = payload;
      memoryMailboxFromCache = true;
      return {
        ok: true,
        fromCache: true,
        throttled: false,
        payload,
        networkError: networkError?.message || 'network failed',
      };
    }
  } catch (err) {
    debugWarn('解析 cache 信件失敗', err);
  }

  if (memoryMailboxPayload) {
    return {
      ok: true,
      fromCache: true,
      throttled: false,
      payload: memoryMailboxPayload,
      networkError: networkError?.message || 'network failed',
    };
  }

  return {
    ok: false,
    fromCache: false,
    throttled: false,
    payload: { schemaVersion: 1, generatedAt: null, messages: [], warnings: [] },
    error: networkError?.message || '無法取得信件',
  };
}

/**
 * 強制刷新（略過節流，供手動刷新）
 */
export async function refreshGlobalMailbox(options = {}) {
  return fetchGlobalMailbox({ ...options, force: true });
}

export function shouldCheckMailboxOnForeground(now = Date.now()) {
  if (!lastMailboxCheckAt) return true;
  return (now - lastMailboxCheckAt) >= MAILBOX_CHECK_THROTTLE_MS;
}

export function getLastMailboxCheckAt() {
  return lastMailboxCheckAt;
}

/** 測試／Health Check 用：重置節流（無副作用寫入） */
export function resetMailboxCheckThrottleForTests() {
  lastMailboxCheckAt = 0;
}

/**
 * 依狀態組裝可見信件列表與摘要
 * 在作者本機開發模式會合併 sessionStorage 測試信件（remote 優先）
 */
export function buildMailboxViewModel(payload, state, options = {}) {
  const appVersion = options.appVersion || APP_VERSION;
  const now = options.now || Date.now();
  const filter = options.filter || 'all'; // all | unread | claimable
  const remoteMessages = Array.isArray(payload?.messages) ? payload.messages : [];
  const includeLocalDev = options.includeLocalDev !== false;
  const localMessages = includeLocalDev ? getLocalDevMailboxMessages({ now }) : [];
  const messages = mergeRemoteAndLocalDevMessages(remoteMessages, localMessages);
  const normalizedState = normalizeGlobalMailboxState(state);

  const enriched = messages.map((msg) => {
    const status = resolveMailboxMessageStatus(msg, normalizedState, appVersion, now);
    return { ...msg, status };
  }).filter((m) => m.status.visible);

  const claimable = enriched.filter((m) => m.status.claimable);
  const unread = enriched.filter((m) => m.status.unread && !m.status.claimable);
  const rest = enriched.filter((m) => !m.status.claimable && !m.status.unread);

  const sortGroup = (list) => list.slice().sort((a, b) => {
    const pa = a.priority === 'high' ? 2 : a.priority === 'low' ? 0 : 1;
    const pb = b.priority === 'high' ? 2 : b.priority === 'low' ? 0 : 1;
    if (pb !== pa) return pb - pa;
    return b.publishedAtMs - a.publishedAtMs;
  });

  let ordered = [
    ...sortGroup(claimable),
    ...sortGroup(unread),
    ...sortGroup(rest),
  ];

  if (filter === 'unread') {
    ordered = ordered.filter((m) => m.status.unread);
  } else if (filter === 'claimable') {
    ordered = ordered.filter((m) => m.status.claimable);
  }

  const unreadCount = enriched.filter((m) => m.status.unread).length;
  const claimableCount = claimable.length;

  let defaultFilter = 'all';
  if (claimableCount > 0) defaultFilter = 'claimable';
  else if (unreadCount > 0) defaultFilter = 'unread';

  return {
    messages: ordered,
    allVisible: enriched,
    unreadCount,
    claimableCount,
    defaultFilter,
    totalVisible: enriched.length,
  };
}

export function getMailboxBadgeSummary(viewModel) {
  const unreadCount = viewModel?.unreadCount || 0;
  const claimableCount = viewModel?.claimableCount || 0;
  const unreadDisplay = unreadCount > 99 ? '99+' : String(unreadCount);
  let ariaLabel = '開啟信箱';
  const parts = [];
  if (unreadCount > 0) parts.push(`${unreadCount} 封未讀`);
  if (claimableCount > 0) parts.push(`${claimableCount} 封可領取`);
  if (parts.length) ariaLabel = `開啟信箱，${parts.join('，')}`;
  return {
    unreadCount,
    claimableCount,
    unreadDisplay,
    showUnreadBadge: claimableCount === 0 && unreadCount > 0,
    showClaimHint: claimableCount > 0,
    ariaLabel,
  };
}

export async function markMailboxMessageRead(messageId) {
  if (!messageId || typeof messageId !== 'string') return getGlobalMailboxState();
  const state = await getGlobalMailboxState();
  if (state.readIds.includes(messageId)) return state;
  state.readIds = [...state.readIds, messageId];
  return saveGlobalMailboxState(state);
}

/**
 * 在單一 META transaction 中發放獎勵並寫入 claimedIds
 * once per local profile：以 persisted claimedIds 為 idempotency key
 *
 * 原子性：wallet + inventory + globalMailboxState 皆在 meta store，同一 transaction。
 * 若崩潰發生在 transaction commit 前：整筆 rollback，可再試。
 * 若崩潰發生在 commit 後、UI 更新前：獎勵與 claimed 已一致，不會重複發放。
 */
async function applyMailboxRewardInTransaction(messageId, reward) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.META, 'readwrite');
    const store = tx.objectStore(STORES.META);
    const walletReq = store.get(WALLET_KEY);
    const invReq = store.get(INVENTORY_KEY);
    const stateReq = store.get(MAILBOX_STATE_KEY);

    let walletReady = false;
    let invReady = false;
    let stateReady = false;
    let pendingError = null;
    let processed = false;
    let result = null;

    const process = () => {
      if (processed || !walletReady || !invReady || !stateReady) return;
      processed = true;
      try {
        const state = normalizeGlobalMailboxState(stateReq.result ?? null);
        if (state.claimedIds.includes(messageId)) {
          result = { alreadyClaimed: true, state, wallet: null, inventory: null };
          return;
        }

        const wallet = normalizeWallet(walletReq.result);
        if (reward.stardust > 0) {
          wallet.stardust = (wallet.stardust || 0) + reward.stardust;
        }
        if (reward.adventureEnergy > 0) {
          wallet.adventureEnergy = (wallet.adventureEnergy || 0) + reward.adventureEnergy;
        }
        for (const [id, amt] of Object.entries(reward.materials || {})) {
          if (amt > 0) {
            wallet.materials[id] = (wallet.materials[id] || 0) + amt;
          }
        }

        const inventory = normalizeInventory(invReq.result);
        for (const [id, amt] of Object.entries(reward.items || {})) {
          if (amt > 0) {
            inventory.items[id] = (inventory.items[id] || 0) + amt;
          }
        }

        const nextState = {
          ...state,
          claimedIds: [...state.claimedIds, messageId],
          readIds: state.readIds.includes(messageId)
            ? state.readIds
            : [...state.readIds, messageId],
        };

        store.put(wallet);
        store.put(inventory);
        store.put(nextState);
        result = { alreadyClaimed: false, state: nextState, wallet, inventory };
      } catch (error) {
        pendingError = error;
        try { tx.abort(); } catch { /* ignore */ }
      }
    };

    walletReq.onsuccess = () => { walletReady = true; process(); };
    invReq.onsuccess = () => { invReady = true; process(); };
    stateReq.onsuccess = () => { stateReady = true; process(); };
    walletReq.onerror = () => { pendingError = walletReq.error; };
    invReq.onerror = () => { pendingError = invReq.error; };
    stateReq.onerror = () => { pendingError = stateReq.error; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(pendingError || tx.error || new Error('補償領取 transaction 失敗'));
    tx.onabort = () => reject(pendingError || tx.error || new Error('補償領取 transaction 已中止'));
  });
}

/**
 * 領取補償 — once per local profile（每份本機資料領取一次）
 * 禁止自動領取；必須由 UI 明確呼叫。
 */
export async function claimMailboxReward(message, options = {}) {
  if (!message || typeof message.id !== 'string') {
    return { success: false, error: '信件不存在' };
  }

  if (mailboxClaimInProgress.size > 0) {
    return { success: false, error: '正在領取中，請稍候' };
  }
  if (mailboxClaimInProgress.has(message.id)) {
    return { success: false, error: '正在領取中，請稍候' };
  }

  mailboxClaimInProgress.add(message.id);

  try {
    const now = options.now || Date.now();
    const appVersion = options.appVersion || APP_VERSION;
    const catalogs = buildCatalogSets(options.materialsCatalog, options.craftablesCatalog);

    // 重新驗證（不得只信 UI）
    if (message.type !== 'compensation') {
      return { success: false, error: '此信件不是補償信' };
    }
    if (!message.enabled) {
      return { success: false, error: '此補償目前不可領取' };
    }
    if (!isWithinPublishWindow(message, now)) {
      return { success: false, error: message.expiresAtMs != null && now > message.expiresAtMs
        ? '此補償已過期'
        : '此補償目前不可領取' };
    }
    if (!isVersionCompatible(message, appVersion)) {
      return { success: false, error: '請更新 QuestNote 後再領取' };
    }

    const validated = validateMailboxReward(message.reward, catalogs);
    if (!validated.ok || !validated.reward) {
      return { success: false, error: '此補償資料格式有誤' };
    }

    // 重新讀取 persisted claimedIds
    const persisted = await getGlobalMailboxState();
    if (persisted.claimedIds.includes(message.id)) {
      return { success: false, error: '此補償已領取', alreadyClaimed: true };
    }

    const result = await applyMailboxRewardInTransaction(message.id, validated.reward);
    if (!result) {
      return { success: false, error: '領取失敗，請稍後再試' };
    }
    if (result.alreadyClaimed) {
      return { success: false, error: '此補償已領取', alreadyClaimed: true, state: result.state };
    }

    return {
      success: true,
      // once per local profile
      claimScope: 'once-per-local-profile',
      reward: validated.reward,
      state: result.state,
      wallet: result.wallet,
      inventory: result.inventory,
    };
  } catch (err) {
    return { success: false, error: err?.message || '領取失敗，請稍後再試' };
  } finally {
    mailboxClaimInProgress.delete(message.id);
  }
}

export function isMailboxClaimInProgress(messageId) {
  if (messageId) return mailboxClaimInProgress.has(messageId);
  return mailboxClaimInProgress.size > 0;
}

export async function exportGlobalMailboxState() {
  return getGlobalMailboxState();
}

/* ═══════════════════════════════════════
   本機開發測試信件（sessionStorage）
   - 僅 isAuthorLocalDevMode()
   - 不寫入 MAILBOX_RUNTIME_CACHE
   - 不進入備份
   - 清除測試信件不清除 claimedIds
   ═══════════════════════════════════════ */

function readDevMailboxSessionRaw() {
  if (!isAuthorLocalDevMode()) return [];
  try {
    const raw = sessionStorage.getItem(DEV_MAILBOX_SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDevMailboxSessionRaw(list) {
  if (!isAuthorLocalDevMode()) return;
  try {
    sessionStorage.setItem(DEV_MAILBOX_SESSION_KEY, JSON.stringify(list));
  } catch (err) {
    debugWarn('寫入本機測試信件失敗', err);
  }
}

/**
 * 取得本機測試信件（正式環境永遠回傳空陣列）
 */
export function getLocalDevMailboxMessages(options = {}) {
  if (!isAuthorLocalDevMode()) return [];
  const now = options.now || Date.now();
  const catalogs = buildCatalogSets(options.materialsCatalog, options.craftablesCatalog);
  const rawList = readDevMailboxSessionRaw();
  const out = [];
  for (const item of rawList) {
    const msg = normalizeMailboxMessageSchema(item, catalogs, now, {
      warn: debugWarn,
      defaultSource: 'local-dev',
    });
    if (msg) out.push({ ...msg, source: 'local-dev' });
  }
  return out;
}

function upsertLocalDevMessage(rawMessage) {
  if (!isAuthorLocalDevMode()) {
    return { success: false, error: '僅本機開發環境可用' };
  }
  const list = readDevMailboxSessionRaw().filter((m) => m?.id !== rawMessage.id);
  list.push(rawMessage);
  writeDevMailboxSessionRaw(list);
  return { success: true, message: rawMessage };
}

/** 注入測試公告 */
export function injectLocalDevAnnouncement() {
  const nowIso = new Date().toISOString();
  return upsertLocalDevMessage({
    id: DEV_LOCAL_ANNOUNCEMENT_ID,
    type: 'announcement',
    title: '本機測試公告',
    body: '這是一封只存在於本機開發環境的測試信件。',
    publishedAt: nowIso,
    expiresAt: null,
    priority: 'normal',
    enabled: true,
    minAppVersion: null,
    maxAppVersion: null,
    icon: '🧪',
    reward: null,
    action: null,
    source: 'local-dev',
  });
}

/** 注入測試補償（固定星塵 ×1，走正式 claim 流程） */
export function injectLocalDevCompensation() {
  const nowIso = new Date().toISOString();
  return upsertLocalDevMessage({
    id: DEV_LOCAL_COMPENSATION_ID,
    type: 'compensation',
    title: '本機補償流程測試',
    body: '用來測試補償預覽、領取按鈕與防重複流程。\n固定獎勵：星塵 ×1。',
    publishedAt: nowIso,
    expiresAt: null,
    priority: 'high',
    enabled: true,
    minAppVersion: null,
    maxAppVersion: null,
    icon: '🎁',
    reward: {
      stardust: 1,
      adventureEnergy: 0,
      materials: {},
      items: {},
    },
    action: null,
    source: 'local-dev',
  });
}

/**
 * 清除本機測試信件正文
 * 不清除 claimedIds / readIds / wallet / 遠端快取
 */
export function clearLocalDevMailboxMessages() {
  if (!isAuthorLocalDevMode()) {
    return { success: false, error: '僅本機開發環境可用', cleared: 0 };
  }
  const before = readDevMailboxSessionRaw().length;
  try {
    sessionStorage.removeItem(DEV_MAILBOX_SESSION_KEY);
  } catch {
    writeDevMailboxSessionRaw([]);
  }
  return { success: true, cleared: before };
}

/** Health Check／純函式測試用：不寫入、不領取 */
export function __mailboxTestHelpers() {
  const schema = __mailboxSchemaTestHelpers();
  return {
    ...schema,
    isVersionCompatible,
    isWithinPublishWindow,
    buildCatalogSets,
    DEV_LOCAL_ANNOUNCEMENT_ID,
    DEV_LOCAL_COMPENSATION_ID,
    DEV_MAILBOX_SESSION_KEY,
  };
}
