/**
 * 全域信箱 Schema 純函式 — QuestNote V3.0.1
 *
 * 正式 App 與作者本機發布工具共用。
 * 不依賴 DOM、IndexedDB、Service Worker。
 * 可於 Browser 與 Node ESM 載入。
 */

export const MAILBOX_MESSAGE_TYPES = Object.freeze([
  'announcement',
  'update',
  'maintenance',
  'compensation',
]);

export const MAILBOX_PRIORITIES = Object.freeze(['low', 'normal', 'high']);

export const MAILBOX_ACTION_VIEW_ALLOWLIST = Object.freeze([
  'tasks',
  'gacha',
  'collection',
  'expedition',
  'workshop',
  'achievements',
  'settings',
  'handbook',
]);

/** 別名：與既有 mailboxService 匯出名稱相容 */
export const MAILBOX_ACTION_VIEWS = MAILBOX_ACTION_VIEW_ALLOWLIST;

/** 安全上限：防止 JSON 誤填造成存檔災難（非遊戲平衡建議） */
export const MAILBOX_REWARD_LIMITS = Object.freeze({
  stardust: 5000,
  adventureEnergy: 100,
  material: 999,
  item: 99,
});

/** Node／未載入 catalog 時的 fallback（對齊 rewardService / workshopService） */
export const MAILBOX_FALLBACK_MATERIAL_IDS = Object.freeze([
  'forest_leaf',
  'lava_core',
  'machine_part',
  'star_shard',
  'aurora_ice',
  'harvest_charm',
]);

export const MAILBOX_FALLBACK_ITEM_IDS = Object.freeze([
  'item_small_spirit_food',
  'item_warm_snack',
  'item_stardust_candy',
  'item_fire_meat',
  'item_machine_biscuit',
  'item_astral_honey',
]);

export const MAILBOX_MESSAGE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

const ALLOWED_TYPES = new Set(MAILBOX_MESSAGE_TYPES);
const ALLOWED_PRIORITIES = new Set(MAILBOX_PRIORITIES);
const ALLOWED_ACTION_VIEWS = new Set(MAILBOX_ACTION_VIEW_ALLOWLIST);
const ALLOWED_REWARD_KEYS = new Set(['stardust', 'adventureEnergy', 'materials', 'items']);

/**
 * Semantic version 比較（禁止單純字串比較）
 * @returns {-1|0|1}
 */
export function compareSemanticVersions(a, b) {
  const parse = (v) => {
    if (!v || typeof v !== 'string') return null;
    const parts = v.trim().split('.').map((p) => parseInt(p, 10));
    if (!parts.length || parts.some((n) => Number.isNaN(n))) return null;
    return parts;
  };
  const va = parse(a);
  const vb = parse(b);
  if (!va && !vb) return 0;
  if (!va) return -1;
  if (!vb) return 1;
  const len = Math.max(va.length, vb.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (va[i] ?? 0) - (vb[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

/** 別名 */
export const compareAppVersions = compareSemanticVersions;

export function parseMailboxDate(value) {
  if (value == null) return null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  return t;
}

function isFiniteNonNegInt(n) {
  return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n) && n >= 0;
}

function resolveCatalogSets(catalogs = {}) {
  const materialIds = catalogs.materialIds instanceof Set
    ? catalogs.materialIds
    : new Set(
      Array.isArray(catalogs.materials)
        ? catalogs.materials.map((m) => m?.id).filter(Boolean)
        : MAILBOX_FALLBACK_MATERIAL_IDS,
    );
  const itemIds = catalogs.itemIds instanceof Set
    ? catalogs.itemIds
    : new Set(
      Array.isArray(catalogs.items)
        ? catalogs.items.map((m) => m?.id).filter(Boolean)
        : Array.isArray(catalogs.craftables)
          ? catalogs.craftables.map((m) => m?.id).filter(Boolean)
          : MAILBOX_FALLBACK_ITEM_IDS,
    );
  return { materialIds, itemIds };
}

/**
 * 驗證補償 reward（白名單 + 安全上限）
 * @returns {{ ok: boolean, error?: string, reward?: object|null }}
 */
export function validateMailboxReward(reward, catalogs = {}) {
  if (reward == null) return { ok: true, reward: null };
  if (typeof reward !== 'object' || Array.isArray(reward)) {
    return { ok: false, error: '此補償資料格式有誤' };
  }

  for (const key of Object.keys(reward)) {
    if (!ALLOWED_REWARD_KEYS.has(key)) {
      return { ok: false, error: '此補償資料格式有誤' };
    }
  }

  const { materialIds, itemIds } = resolveCatalogSets(catalogs);
  const out = {
    stardust: 0,
    adventureEnergy: 0,
    materials: {},
    items: {},
  };

  if (reward.stardust !== undefined) {
    if (!isFiniteNonNegInt(reward.stardust)) return { ok: false, error: '此補償資料格式有誤' };
    if (reward.stardust > MAILBOX_REWARD_LIMITS.stardust) {
      return { ok: false, error: '此補償資料格式有誤' };
    }
    out.stardust = reward.stardust;
  }

  if (reward.adventureEnergy !== undefined) {
    if (!isFiniteNonNegInt(reward.adventureEnergy)) return { ok: false, error: '此補償資料格式有誤' };
    if (reward.adventureEnergy > MAILBOX_REWARD_LIMITS.adventureEnergy) {
      return { ok: false, error: '此補償資料格式有誤' };
    }
    out.adventureEnergy = reward.adventureEnergy;
  }

  if (reward.materials !== undefined) {
    if (!reward.materials || typeof reward.materials !== 'object' || Array.isArray(reward.materials)) {
      return { ok: false, error: '此補償資料格式有誤' };
    }
    for (const [id, amt] of Object.entries(reward.materials)) {
      if (!materialIds.has(id)) return { ok: false, error: '此補償資料格式有誤' };
      if (!isFiniteNonNegInt(amt)) return { ok: false, error: '此補償資料格式有誤' };
      if (amt > MAILBOX_REWARD_LIMITS.material) return { ok: false, error: '此補償資料格式有誤' };
      if (amt > 0) out.materials[id] = amt;
    }
  }

  if (reward.items !== undefined) {
    if (!reward.items || typeof reward.items !== 'object' || Array.isArray(reward.items)) {
      return { ok: false, error: '此補償資料格式有誤' };
    }
    for (const [id, amt] of Object.entries(reward.items)) {
      if (!itemIds.has(id)) return { ok: false, error: '此補償資料格式有誤' };
      if (!isFiniteNonNegInt(amt)) return { ok: false, error: '此補償資料格式有誤' };
      if (amt > MAILBOX_REWARD_LIMITS.item) return { ok: false, error: '此補償資料格式有誤' };
      if (amt > 0) out.items[id] = amt;
    }
  }

  return { ok: true, reward: out };
}

export function normalizeMailboxAction(action) {
  if (!action || typeof action !== 'object') return null;
  if (action.type !== 'view') return null;
  if (typeof action.view !== 'string' || !ALLOWED_ACTION_VIEWS.has(action.view)) return null;
  const label = typeof action.label === 'string' && action.label.trim()
    ? action.label.trim().slice(0, 40)
    : '前往查看';
  return { type: 'view', view: action.view, label };
}

export function isValidMailboxMessageId(id) {
  return typeof id === 'string' && id.trim().length > 0 && MAILBOX_MESSAGE_ID_PATTERN.test(id.trim());
}

/**
 * 正規化單封信件；無效則回傳 null
 * @param {object} raw
 * @param {object} [catalogs]
 * @param {number} [now]
 * @param {{ warn?: Function, defaultSource?: 'remote'|'local-dev' }} [options]
 */
export function normalizeMailboxMessage(raw, catalogs = {}, now = Date.now(), options = {}) {
  const warn = typeof options.warn === 'function' ? options.warn : () => {};
  const defaultSource = options.defaultSource === 'local-dev' ? 'local-dev' : 'remote';

  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || !raw.id.trim()) {
    warn('忽略無 id 信件');
    return null;
  }
  const id = raw.id.trim();

  let type = typeof raw.type === 'string' ? raw.type : 'announcement';
  if (!ALLOWED_TYPES.has(type)) {
    warn(`未知信件 type「${type}」，正規化為 announcement`, id);
    type = 'announcement';
  }

  const title = typeof raw.title === 'string' ? raw.title : '';
  const body = typeof raw.body === 'string' ? raw.body : '';
  if (!title.trim()) {
    warn('忽略無標題信件', id);
    return null;
  }

  const publishedAtMs = parseMailboxDate(raw.publishedAt);
  if (publishedAtMs == null) {
    warn('忽略無效 publishedAt', id);
    return null;
  }

  let expiresAtMs = null;
  if (raw.expiresAt != null) {
    expiresAtMs = parseMailboxDate(raw.expiresAt);
    if (expiresAtMs == null) {
      warn('忽略無效 expiresAt 信件', id);
      return null;
    }
  }

  const enabled = raw.enabled === true;
  let priority = typeof raw.priority === 'string' ? raw.priority : 'normal';
  if (!ALLOWED_PRIORITIES.has(priority)) priority = 'normal';

  const minAppVersion = typeof raw.minAppVersion === 'string' ? raw.minAppVersion : null;
  const maxAppVersion = typeof raw.maxAppVersion === 'string' ? raw.maxAppVersion : null;
  const icon = typeof raw.icon === 'string' && raw.icon.trim() ? raw.icon.trim().slice(0, 8) : '📮';

  let reward = null;
  let rewardError = null;
  if (type === 'compensation') {
    const validated = validateMailboxReward(raw.reward, catalogs);
    if (!validated.ok) {
      rewardError = validated.error || '此補償資料格式有誤';
    } else {
      reward = validated.reward;
    }
  }

  const action = normalizeMailboxAction(raw.action);
  const source = raw.source === 'local-dev' || defaultSource === 'local-dev' ? 'local-dev' : 'remote';

  return {
    id,
    type,
    title: title.slice(0, 120),
    body: body.slice(0, 4000),
    publishedAt: raw.publishedAt,
    publishedAtMs,
    expiresAt: raw.expiresAt ?? null,
    expiresAtMs,
    priority,
    enabled,
    minAppVersion,
    maxAppVersion,
    icon,
    reward,
    rewardError,
    action,
    source,
    _now: now,
  };
}

/**
 * 正規化遠端／整份 JSON payload
 */
export function normalizeMailboxPayload(raw, catalogs = {}, now = Date.now(), options = {}) {
  if (!raw || typeof raw !== 'object') {
    return { schemaVersion: 1, generatedAt: null, messages: [], warnings: ['payload 無效'] };
  }
  const schemaVersion = Number(raw.schemaVersion) || 1;
  const generatedAt = typeof raw.generatedAt === 'string' ? raw.generatedAt : null;
  const list = Array.isArray(raw.messages) ? raw.messages : [];
  const seen = new Set();
  const messages = [];
  const warnings = [];
  const warn = (...args) => {
    if (typeof options.warn === 'function') options.warn(...args);
  };

  for (const item of list) {
    const msg = normalizeMailboxMessage(item, catalogs, now, {
      warn,
      defaultSource: options.defaultSource || 'remote',
    });
    if (!msg) continue;
    if (seen.has(msg.id)) {
      warnings.push(`重複 id 已忽略：${msg.id}`);
      warn('重複 message id，忽略後者', msg.id);
      continue;
    }
    seen.add(msg.id);
    messages.push(msg);
  }

  return { schemaVersion, generatedAt, messages, warnings };
}

/**
 * 驗證整份 mailbox 文件（作者工具／Health Check）
 * @returns {{ ok: boolean, errors: string[], warnings: string[], document?: object }}
 */
export function validateMailboxDocument(raw, catalogs = {}) {
  const errors = [];
  const warnings = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['文件必須為物件'], warnings };
  }

  const schemaVersion = Number(raw.schemaVersion);
  if (schemaVersion !== 1) {
    errors.push('schemaVersion 必須為 1');
  }
  if (raw.generatedAt != null && parseMailboxDate(raw.generatedAt) == null) {
    errors.push('generatedAt 無法解析');
  }
  if (!Array.isArray(raw.messages)) {
    errors.push('messages 必須為陣列');
    return { ok: false, errors, warnings };
  }

  const seen = new Set();
  const normalizedMessages = [];

  for (let i = 0; i < raw.messages.length; i += 1) {
    const item = raw.messages[i];
    if (!item || typeof item !== 'object') {
      errors.push(`messages[${i}] 不是物件`);
      continue;
    }
    if (!isValidMailboxMessageId(item.id)) {
      errors.push(`messages[${i}] id 不合法（僅允許英數字、連字號與底線）`);
      continue;
    }
    const id = item.id.trim();
    if (seen.has(id)) {
      errors.push(`重複 message id：${id}`);
      continue;
    }
    seen.add(id);

    if (item.type && !ALLOWED_TYPES.has(item.type)) {
      warnings.push(`${id}: 未知 type，App 會正規化為 announcement`);
    }
    if (item.priority && !ALLOWED_PRIORITIES.has(item.priority)) {
      warnings.push(`${id}: 未知 priority，App 會正規化為 normal`);
    }
    if (parseMailboxDate(item.publishedAt) == null) {
      errors.push(`${id}: publishedAt 無效`);
    }
    if (item.expiresAt != null && parseMailboxDate(item.expiresAt) == null) {
      errors.push(`${id}: expiresAt 無效`);
    }
    if (item.enabled !== true && item.enabled !== false) {
      warnings.push(`${id}: enabled 建議為布林值`);
    }
    if (item.type === 'compensation') {
      const validated = validateMailboxReward(item.reward, catalogs);
      if (!validated.ok) {
        errors.push(`${id}: reward 驗證失敗（${validated.error}）`);
      }
    } else if (item.reward != null) {
      warnings.push(`${id}: 非補償信件含 reward，App 會忽略`);
    }
    if (item.action != null && !normalizeMailboxAction(item.action)) {
      warnings.push(`${id}: action 不合法，App 不會顯示按鈕`);
    }

    const normalized = normalizeMailboxMessage(item, catalogs, Date.now(), { defaultSource: 'remote' });
    if (normalized) normalizedMessages.push(normalized);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    document: {
      schemaVersion: 1,
      generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : null,
      messages: raw.messages,
    },
    normalizedMessages,
  };
}

/**
 * 合併遠端與本機測試信件：相同 ID 時 remote 優先
 */
export function mergeRemoteAndLocalDevMessages(remoteMessages = [], localDevMessages = []) {
  const byId = new Map();
  for (const msg of remoteMessages) {
    if (!msg?.id) continue;
    byId.set(msg.id, { ...msg, source: msg.source || 'remote' });
  }
  for (const msg of localDevMessages) {
    if (!msg?.id) continue;
    if (byId.has(msg.id)) continue; // remote 優先
    byId.set(msg.id, { ...msg, source: 'local-dev' });
  }
  return [...byId.values()];
}

export function __mailboxSchemaTestHelpers() {
  return {
    ALLOWED_TYPES: [...ALLOWED_TYPES],
    ALLOWED_PRIORITIES: [...ALLOWED_PRIORITIES],
    ALLOWED_ACTION_VIEWS: [...ALLOWED_ACTION_VIEWS],
  };
}
