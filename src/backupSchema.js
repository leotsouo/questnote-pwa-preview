/** Backup profiles verified against historical exporters; no database or DOM access. */
const BASE_KEYS = ['tasks', 'wallet', 'collection', 'gachaStats', 'expeditions',
  'achievements', 'taskStats', 'userPreferences', 'habits'];
const ADDITIONS = ['inventory', 'workshopStats', 'dailyCheckIn', 'questProgress',
  'explorationProgress', 'collectionMilestones', 'globalMailboxState',
  'poolDebutSeen', 'poolUnlockState', 'idempotentGrants'];
export const SNAPSHOT_KEYS = [...BASE_KEYS, ...ADDITIONS];
// Counts come from actual versioned exports, not inferred release dates.
const LEGACY_PROFILES = {
  '1.8.1': 0,
  '2.1.1': 2, '2.1.2': 2, '2.1.4': 2,
  '2.2': 3, '2.2.7': 3, '2.3.5': 3, '2.3.7': 3,
  '2.6.1': 4, '2.7.3': 5, '2.9.0': 6, '3.0.1': 7,
  '3.4.3': 10, '3.4.4': 10,
};
const LIST_KEYS = new Set(['tasks', 'collection', 'expeditions', 'habits']);
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
// Persisted fields from the historical writers, not catalog pet properties.
// obtainedSource is written by the V3.4 unlock gift, owned/id by legacy adapters.
const COLLECTION_FIELDS = new Set(['petId', 'id', 'owned', 'stars', 'fragments',
  'bondExp', 'bondLevel', 'isCompanion', 'obtainedAt', 'nickname', 'lastPettedAt',
  'bondUnlocks', 'obtainedSource']);
const OLD_COLLECTION_PROFILES = new Set(['1.8.1', '2.1.1', '2.1.2', '2.1.4',
  '2.2', '2.2.7', '2.3.5', '2.3.7']);
// These keys/targets are serialized by every recorded quest/exploration exporter.
// A future change to persistent definitions must add an explicit backup adapter.
const QUEST_TARGETS = {
  daily: { daily_complete_tasks_3: 3, daily_complete_habit_1: 1, daily_pet_companion_1: 1,
    daily_checkin_1: 1, daily_start_expedition_1: 1, daily_craft_or_gift_1: 1 },
  weekly: { weekly_complete_tasks_20: 20, weekly_complete_habits_10: 10,
    weekly_checkin_5: 5, weekly_expedition_5: 5, weekly_gift_5: 5 },
};
const AREA_IDS = ['mist_forest', 'lava_rift', 'machine_ruins', 'astral_rift'];
const COLLECTION_MILESTONE_IDS = ['collection_005', 'collection_010', 'collection_020',
  'collection_030', 'collection_040', 'collection_050', 'collection_all', 'rarity_first_sr',
  'rarity_first_ssr', 'rarity_first_ur', 'rarity_all_n', 'rarity_all_r', 'rarity_sr_5',
  'rarity_ssr_5', 'rarity_ur_3', 'star_first_3', 'star_first_5', 'star_three_5',
  'star_five_3', 'bond_first_lv3', 'bond_first_liberated', 'bond_liberated_5'];

export function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function equalBackupValues(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length
      && a.every((value, i) => equalBackupValues(value, b[i]));
  }
  if (!isRecord(a) || !isRecord(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length
    && keys.every((key) => Object.hasOwn(b, key) && equalBackupValues(a[key], b[key]));
}

/** Validate before normalizers can silently discard or default malformed records. */
export function validateSnapshotData(data, requiredKeys = SNAPSHOT_KEYS, profile = 'current') {
  const errors = [];
  const fail = (path, message) => errors.push(`${path}: ${message}`);
  if (!isRecord(data)) return ['data: 必須是完整備份物件'];
  for (const key of requiredKeys) {
    if (!Object.hasOwn(data, key)) fail(key, '缺少完整備份欄位');
  }
  for (const key of SNAPSHOT_KEYS) {
    if (!Object.hasOwn(data, key)) continue;
    if (LIST_KEYS.has(key) ? !Array.isArray(data[key]) : !isRecord(data[key])) {
      fail(key, LIST_KEYS.has(key) ? '必須是陣列' : '必須是物件');
    }
  }
  const validId = (id) => typeof id === 'string' && id.trim().length > 0
    && !/[\u0000-\u001f]/.test(id) && !FORBIDDEN_KEYS.has(id);
  const scalar = (test, message) => (value, path) => { if (!test(value)) fail(path, message); };
  const text = scalar((value) => typeof value === 'string', '必須是文字');
  const id = scalar(validId, '缺少有效 ID');
  const petId = scalar((value) => validId(value) && /^pet_[a-z0-9]+$/i.test(value), '收藏 ID 無效');
  const bool = scalar((value) => typeof value === 'boolean', '必須是布林值');
  const integer = scalar((value) => Number.isSafeInteger(value) && value >= 0, '必須是非負安全整數');
  const oneOf = (values) => scalar((value) => values.includes(value), '值不在支援範圍');
  const nullable = (check) => (value, path) => { if (value !== null) check(value, path); };
  const timestamp = scalar((value) => typeof value === 'string' && Number.isFinite(Date.parse(value)), '時間格式無效');
  const dateKey = scalar((value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value, '日期格式無效');
  const weekKey = scalar((value) => typeof value === 'string' && /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(value), '週次格式無效');
  const shape = (fields, optional = {}) => (value, path) => {
    if (!isRecord(value)) { fail(path, '必須是物件'); return; }
    for (const [key, check] of Object.entries(fields)) {
      if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, '缺少持久化欄位');
      else check(value[key], `${path}.${key}`);
    }
    for (const [key, check] of Object.entries(optional)) {
      // Existing wheel history writers leave irrelevant itemId/materialId undefined;
      // JSON omits these optional properties when an exported backup is serialized.
      if (Object.hasOwn(value, key) && value[key] !== undefined) check(value[key], `${path}.${key}`);
    }
  };
  const list = (check, unique = false) => (value, path) => {
    if (!Array.isArray(value)) { fail(path, '必須是陣列'); return; }
    if (unique && new Set(value).size !== value.length) fail(path, '陣列包含重複值');
    value.forEach((item, i) => check(item, `${path}[${i}]`));
  };
  const ids = list(id, true);
  const map = (check, keyCheck = id, fixedKeys = null) => (value, path) => {
    if (!isRecord(value)) { fail(path, '必須是物件'); return; }
    if (fixedKeys) {
      for (const key of fixedKeys) if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, '缺少持久化項目');
      for (const key of Object.keys(value)) if (!fixedKeys.includes(key)) fail(`${path}.${key}`, '未識別的持久化項目');
    }
    for (const [key, item] of Object.entries(value)) {
      keyCheck(key, `${path}.${key}`);
      check(item, `${path}.${key}`, key);
    }
  };
  const amounts = map(integer);
  const state = (key, fields, optional = {}) => {
    if (Object.hasOwn(data, key)) shape(fields, { key: oneOf([key]), ...optional })(data[key], key);
  };
  const bondUnlocks = shape({ dialogueLv2: bool, badgeLv3: bool, homeEffectLv4: bool,
    bondFrameLv5: bool, bondStoryLv5: bool, bondLiberated: bool,
    notifiedLevels: list(oneOf([2, 3, 4, 5]), true) });
  const subtask = shape({ id, text, completed: bool, createdAt: timestamp, completedAt: nullable(timestamp) });
  const task = shape({ id, content: text, title: text, priority: oneOf(['normal', 'important', 'urgent']),
    type: oneOf(['one_time', 'repeatable']), categoryId: id, startDate: nullable(dateKey),
    dueDate: nullable(dateKey), isPlannedToday: bool, plannedDate: nullable(dateKey),
    subtasks: list(subtask), completed: bool, rewardClaimed: bool, createdAt: timestamp,
    updatedAt: timestamp, completedAt: nullable(timestamp), lastRewardClaimedAt: nullable(timestamp) });
  const habitLog = (value, path, key) => {
    if (key.startsWith('week_')) {
      dateKey(key.slice(5), path);
      shape({ weeklyRewardClaimed: bool, weeklyGoalMet: bool, claimedAt: timestamp })(value, path);
    } else {
      dateKey(key, path);
      // Undo keeps rewards and cancelledAt but deliberately removes completedAt.
      shape({ completed: bool, rewardClaimed: bool, stardustGiven: integer, bondGiven: integer,
        [value?.completed === false ? 'cancelledAt' : 'completedAt']: timestamp })(value, path);
    }
  };
  const habit = (value, path) => {
    shape({ id, name: text, description: text, frequency: oneOf(['daily', 'weekly']),
      targetPerWeek: value?.frequency === 'weekly' ? oneOf([1, 2, 3, 4, 5, 6, 7]) : oneOf([null]),
      categoryId: id, isActive: bool, createdAt: timestamp, updatedAt: timestamp,
      archivedAt: nullable(timestamp), logs: map(habitLog) })(value, path);
  };
  const collection = (value, path) => {
    const fields = { stars: oneOf([1, 2, 3, 4, 5]), fragments: integer, bondExp: integer,
      bondLevel: oneOf([1, 2, 3, 4, 5]), isCompanion: bool, obtainedAt: timestamp };
    if (profile !== '1.8.1') fields.nickname = nullable(text);
    if (!['1.8.1', '2.1.1', '2.1.2', '2.1.4'].includes(profile)) fields.lastPettedAt = nullable(timestamp);
    if (!OLD_COLLECTION_PROFILES.has(profile)) fields.bondUnlocks = bondUnlocks;
    shape(fields, { petId, id: petId, owned: bool, nickname: nullable(text),
      lastPettedAt: nullable(timestamp), bondUnlocks, obtainedSource: text })(value, path);
    if (isRecord(value)) {
      for (const key of Object.keys(value)) if (!COLLECTION_FIELDS.has(key)) fail(`${path}.${key}`, '收藏不可覆寫 catalog 或包含未知欄位');
    }
  };
  const nonNegativeNumber = scalar((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0, '必須是非負有限數字');
  const expeditionRewards = shape({ stardust: integer, baseStardust: integer, bonusStardust: integer,
    rarityBonus: nonNegativeNumber, bondBonus: nonNegativeNumber, totalBonus: nonNegativeNumber,
    materials: amounts, bondExp: integer, fragmentGained: integer, petId });
  const expedition = shape({ id, petId, areaId: id, durationMinutes: nonNegativeNumber,
    energyCost: integer, startedAt: timestamp, endsAt: timestamp, completed: bool, claimed: bool,
    rewardsPreview: nullable(expeditionRewards), rewardsFinal: nullable(expeditionRewards),
    rewards: nullable(expeditionRewards) });
  const checkRows = (rows, key, path, legacyCollection = false) => {
    if (!Array.isArray(rows)) return;
    const seen = new Set();
    rows.forEach((row, i) => {
      if (!isRecord(row)) { fail(`${path}[${i}]`, '紀錄必須是物件'); return; }
      const id = legacyCollection ? (row.petId ?? row.id) : row[key];
      if (!validId(id)) fail(`${path}[${i}].${key}`, '缺少有效 ID');
      else if (seen.has(id)) fail(`${path}[${i}].${key}`, '重複 ID 會覆蓋資料');
      if (legacyCollection && (!/^pet_[a-z0-9]+$/i.test(id)
        || (row.id !== undefined && row.id !== id))) fail(`${path}[${i}]`, '收藏 ID 無效或互相矛盾');
      seen.add(id);
      ({ tasks: task, habits: habit, collection, expeditions: expedition }[path])?.(row, `${path}[${i}]`);
      if (path === 'tasks' && row.subtasks !== undefined) {
        if (!Array.isArray(row.subtasks)) fail(`${path}[${i}].subtasks`, '必須是陣列');
        else checkRows(row.subtasks, 'id', `${path}[${i}].subtasks`);
      }
      if (path === 'habits' && row.logs !== undefined && !isRecord(row.logs)) {
        fail(`${path}[${i}].logs`, '必須是物件');
      }
      if (path === 'habits' && isRecord(row.logs)) {
        for (const [date, log] of Object.entries(row.logs)) {
          if (!isRecord(log)) fail(`${path}[${i}].logs.${date}`, '紀錄必須是物件');
        }
      }
    });
  };
  checkRows(data.tasks, 'id', 'tasks');
  checkRows(data.habits, 'id', 'habits');
  checkRows(data.expeditions, 'id', 'expeditions');
  checkRows(data.collection, 'petId', 'collection', true);
  const materialKeys = ['forest_leaf', 'lava_core', 'machine_part', 'star_shard',
    ...(profile === '1.8.1' ? [] : ['aurora_ice', 'harvest_charm'])];
  state('wallet', { stardust: integer, adventureEnergy: integer, materials: (value, path) => {
    shape(Object.fromEntries(materialKeys.map((key) => [key, integer])))(value, path);
    amounts(value, path);
  } });
  const poolPity = (value, path) => {
    map(shape({ ssrPity: integer, urPity: integer }))(value, path);
    if (isRecord(value) && !Object.hasOwn(value, 'standard')) fail(`${path}.standard`, '缺少標準池保底');
    if (isRecord(value?.standard) && (value.standard.ssrPity !== data.gachaStats.ssrPity
      || value.standard.urPity !== data.gachaStats.urPity)) fail(path, '標準池與保底鏡像矛盾');
  };
  const gachaFields = { ssrPity: integer, urPity: integer, totalPulls: integer, tenPullCount: integer };
  if (!Object.hasOwn(LEGACY_PROFILES, profile) || LEGACY_PROFILES[profile] === 10) {
    gachaFields.selectedPoolId = nullable(id);
    gachaFields.poolPity = poolPity;
  }
  state('gachaStats', gachaFields, { selectedPoolId: nullable(id), poolPity });
  state('achievements', { unlockedAchievementIds: ids, claimedAchievementIds: ids,
    unlockedTitleIds: ids, equippedTitleId: nullable(id), hasExportedBackup: bool, unseenTitleIds: ids });
  state('taskStats', { hasPlannedTodayEver: bool, hasCreatedSubtaskEver: bool,
    subtasksCompletedTotal: integer, completedBeforeDueTotal: integer });
  state('userPreferences', { reduceMotion: bool,
    ...(['1.8.1', '2.1.1'].includes(profile) ? {} : { theme: oneOf(['default', 'sweet']) }) },
  { theme: oneOf(['default', 'sweet']) });
  state('inventory', { items: amounts,
    itemUsageLogs: map(map(shape({ bondItemsUsed: integer }), petId), dateKey) });
  state('workshopStats', { craftCount: integer, giftCount: integer, favoriteGiftCount: integer,
    firstCraftAt: nullable(timestamp), firstGiftAt: nullable(timestamp), firstFavoriteGiftAt: nullable(timestamp) });
  const rewardBundle = shape({ stardust: integer, adventureEnergy: integer, materials: amounts, items: amounts });
  const wheelReward = (value, path) => {
    shape({ type: oneOf(['stardust', 'adventureEnergy', 'material', 'item']), amount: integer, label: text },
      { materialId: id, itemId: id })(value, path);
    if (value?.type === 'material') shape({ materialId: id })(value, path);
    if (value?.type === 'item') shape({ itemId: id })(value, path);
  };
  state('dailyCheckIn', { lastCheckInDate: nullable(dateKey), lastCheckInAt: nullable(timestamp),
    streak: integer, bestStreak: integer, totalCheckIns: integer, lastWheelSpinDate: nullable(dateKey),
    lastWheelSpinAt: nullable(timestamp), totalWheelSpins: integer, history: list((value, path) => {
      shape({ date: dateKey }, { checkedInAt: timestamp, checkInReward: rewardBundle, wheelReward })(value, path);
      if (isRecord(value)) {
        if (!Object.hasOwn(value, 'checkInReward') && !Object.hasOwn(value, 'wheelReward')) fail(path, '缺少歷史獎勵');
        if (Object.hasOwn(value, 'checkInReward')) shape({ checkedInAt: timestamp })(value, path);
        if (Object.hasOwn(value, 'checkedInAt')) shape({ checkInReward: rewardBundle })(value, path);
      }
    }) });
  const questScope = (scope) => shape({ [scope === 'daily' ? 'dateKey' : 'weekKey']: nullable(scope === 'daily' ? dateKey : weekKey),
    quests: map((value, path, key) => {
      shape({ id: oneOf([key]), type: text, title: text, description: text, current: integer,
        target: oneOf([QUEST_TARGETS[scope][key]]), completed: bool, claimed: bool })(value, path);
      if (value?.current > value?.target) fail(`${path}.current`, '進度超過可保存範圍');
    }, id, Object.keys(QUEST_TARGETS[scope])) });
  state('questProgress', { daily: questScope('daily'), weekly: questScope('weekly'),
    stats: shape({ totalDailyQuestsClaimed: integer, totalWeeklyQuestsClaimed: integer, lastUpdatedAt: nullable(timestamp) }) });
  const storyIds = list(scalar((value) => validId(value) || (typeof value === 'number' && Number.isFinite(value)), '故事 ID 無效'), true);
  state('explorationProgress', { areas: map((value, path, key) => shape({ areaId: oneOf([key]),
    progress: scalar((n) => Number.isInteger(n) && n >= 0 && n <= 100, '探索進度無效'), completedRuns: integer,
    claimedMilestones: list(oneOf([10, 25, 50, 75, 100]), true), unlockedStories: storyIds,
    completedAt: nullable(timestamp), lastExploredAt: nullable(timestamp) })(value, path), id, AREA_IDS),
  unlockedBadges: storyIds, unlockedTitles: storyIds,
  stats: shape({ totalExplorationRuns: integer, totalMilestonesClaimed: integer,
    fullyExploredAreas: integer, lastUpdatedAt: nullable(timestamp) }) });
  // The milestone normalizer filters unknown IDs, while mailbox trims IDs. Reject
  // these inputs before they can be mistaken for a faithful snapshot restoration.
  state('collectionMilestones', { claimedIds: list(oneOf(COLLECTION_MILESTONE_IDS), true), lastUpdatedAt: nullable(timestamp) }, { version: oneOf([1]) });
  const mailboxIds = list(scalar((value) => validId(value) && value === value.trim(), '信件 ID 不可包含前後空白'), true);
  state('globalMailboxState', { readIds: mailboxIds, claimedIds: mailboxIds, lastFetchedAt: nullable(timestamp),
    lastSeenGeneratedAt: nullable(timestamp) }, { version: oneOf([1]) });
  state('poolDebutSeen', { seenPoolIds: ids });
  state('idempotentGrants', { claimedIds: ids });
  state('poolUnlockState', { byPool: map((value, path, key) => shape({ poolId: oneOf([key]),
    lifetimeDraws: integer, unlocked: bool, rewardClaimed: bool, animationSeen: bool,
    unlockedAt: nullable(timestamp) }, { schemaVersion: oneOf([1]) })(value, path)),
  legacyBackfill: shape({ attempted: bool, status: text, note: text }) }, { schemaVersion: oneOf([1]) });
  const visit = (value, path) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      const next = path ? `${path}.${key}` : key;
      if (FORBIDDEN_KEYS.has(key)) fail(next, '不支援的物件鍵值');
      if (typeof item === 'number' && !Number.isFinite(item)) fail(next, '必須是有限數字');
      visit(item, next);
    }
  };
  visit(data, '');
  return errors;
}

/**
 * Validate the committed DB read before export normalizers can discard corruption.
 * An absent meta record is a fresh/older profile default; an existing record must
 * have its writer's complete baseline shape. Row additions are optional because
 * DB_VERSION does not identify the app version that last wrote a particular row.
 * 1.8.1 is the earliest verified stored task/collection shape; earlier shapes are
 * deliberately not guessed. Unknown meta keys are not interpreted as app state.
 */
export function validateStoredSnapshot(snapshot) {
  if (!isRecord(snapshot)) return ['snapshot: 必須是資料庫 snapshot'];
  const errors = [];
  const payload = {};
  for (const key of ['tasks', 'collection', 'expeditions', 'habits', 'meta']) {
    if (!Array.isArray(snapshot[key])) errors.push(`${key}: 缺少 store 陣列`);
    else if (key !== 'meta') payload[key] = snapshot[key];
  }
  const seen = new Set();
  for (const entry of Array.isArray(snapshot.meta) ? snapshot.meta : []) {
    if (!isRecord(entry) || typeof entry.key !== 'string' || !entry.key.trim()
      || FORBIDDEN_KEYS.has(entry.key)) {
      errors.push('meta: 紀錄缺少有效 key');
      continue;
    }
    if (seen.has(entry.key)) errors.push(`meta.${entry.key}: 重複 key`);
    seen.add(entry.key);
    if (SNAPSHOT_KEYS.includes(entry.key) && !LIST_KEYS.has(entry.key)) payload[entry.key] = entry;
  }
  // normalizeExpedition adds the legacy `rewards: null` alias on read; the writer
  // persists rewardsPreview/rewardsFinal but does not write that alias initially.
  if (Array.isArray(payload.expeditions)) payload.expeditions = payload.expeditions.map((entry) =>
    isRecord(entry) && !Object.hasOwn(entry, 'rewards') ? { ...entry, rewards: null } : entry);
  return [...errors, ...validateSnapshotData(payload, [], '1.8.1')];
}

export function validateBackupEnvelope(raw, currentVersion) {
  const warnings = [];
  if (!isRecord(raw) || (raw.appName ?? raw.app) !== 'QuestNote' || raw.version !== 2
    || (raw.app !== undefined && raw.app !== 'QuestNote')) {
    return { valid: false, error: '無法識別此備份格式；原檔未變更，未執行覆蓋。', warnings };
  }
  const version = raw.appVersion;
  const parts = (value) => typeof value === 'string' && /^\d+\.\d+(?:\.\d+)?$/.test(value)
    ? value.split('.').map(Number) : null;
  const actual = parts(version);
  const current = parts(currentVersion);
  if (!actual || actual.some((n, i) => n > (current[i] ?? 0) && actual.slice(0, i).every((v, j) => v === current[j]))) {
    return { valid: false, error: '備份版本未知或較新；請使用相容版本恢復，未執行覆蓋。', warnings };
  }
  const data = raw.data === undefined ? raw : raw.data;
  const additions = LEGACY_PROFILES[version] ?? ADDITIONS.length;
  const required = [...BASE_KEYS, ...ADDITIONS.slice(0, additions)];
  const errors = validateSnapshotData(data, required, version);
  if (isRecord(data)) {
    if (raw.data !== undefined) {
      for (const key of Object.keys(data)) {
        if (Object.hasOwn(raw, key) && !equalBackupValues(raw[key], data[key])) errors.push(`${key}: 外層與 data 內容矛盾`);
      }
    }
    const aliases = [['materials', data.wallet?.materials], ['adventureEnergy', data.wallet?.adventureEnergy],
      ['settings', data.userPreferences],
      ...['unlockedAchievementIds', 'claimedAchievementIds', 'unlockedTitleIds', 'equippedTitleId', 'hasExportedBackup']
        .map((key) => [key, data.achievements?.[key]])];
    for (const [key, value] of aliases) {
      if (Object.hasOwn(data, key) && value !== undefined && !equalBackupValues(data[key], value)) errors.push(`${key}: 備份別名內容矛盾`);
    }
    if (isRecord(data.titles)) {
      for (const key of ['unlockedTitleIds', 'equippedTitleId']) {
        if (Object.hasOwn(data.titles, key) && data.achievements?.[key] !== undefined && !equalBackupValues(data.titles[key], data.achievements[key])) errors.push(`titles.${key}: 備份別名內容矛盾`);
      }
    }
  }
  if (errors.length) return { valid: false, error: `備份驗證失敗：${errors.slice(0, 3).join('；')}`, errors, warnings };
  if (version !== currentVersion) warnings.push(`以完整備份格式讀取 V${version}；僅補齊該格式尚未提供的欄位。`);
  return { valid: true, warnings, profile: version in LEGACY_PROFILES ? version : 'complete-current-shape' };
}
