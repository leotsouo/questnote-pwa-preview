/**
 * 備份與恢復服務 — QuestNote V2.3
 * 支援匯出、驗證、正規化與安全覆蓋恢復
 */
import { normalizeWallet, DEFAULT_MATERIALS } from './rewardService.js';
import { readAllStoresSnapshot, replaceAllStores } from './db.js';
import { normalizeCollectionItem } from './collectionService.js';
import { normalizeGachaStats } from './gachaService.js';
import { normalizeExpedition } from './expeditionService.js';
import { normalizeAchievementsState } from './achievementService.js';
import { normalizeTaskStats } from './taskStatsService.js';
import { normalizeHabit } from './habitService.js';
import { normalizeUserPreferences } from './preferencesService.js';
import { normalizePoolDebutSeen } from './poolDebutService.js';
import { normalizePoolUnlockState, normalizeIdempotentGrants } from './poolUnlockService.js';
import { normalizeInventory, normalizeWorkshopStats } from './workshopService.js';
import { normalizeTask } from './taskMigration.js';
import { getTodayDateString } from './taskFilterService.js';
import { normalizeDailyCheckIn } from './dailyCheckInService.js';
import { normalizeQuestProgress } from './questService.js';
import { normalizeExplorationProgress } from './explorationService.js';
import { normalizeCollectionMilestoneState } from './collectionMilestoneService.js';
import { normalizeGlobalMailboxState } from './mailboxService.js';
import { validateBackupEnvelope, validateSnapshotData, validateStoredSnapshot } from './backupSchema.js';
import { APP_VERSION } from './version.js';

export { APP_VERSION };
const APP_NAME = 'QuestNote';
const WALLET_KEY = 'wallet';
const GACHA_STATS_KEY = 'gachaStats';
const ACHIEVEMENTS_KEY = 'achievements';
const TASK_STATS_KEY = 'taskStats';
const PREFS_KEY = 'userPreferences';

const DATA_KEYS = [
  'tasks',
  'wallet',
  'collection',
  'gachaStats',
  'expeditions',
  'materials',
  'achievements',
  'titles',
  'habits',
  'userPreferences',
  'settings',
  'taskStats',
  'inventory',
  'workshopStats',
  'dailyCheckIn',
  'questProgress',
  'explorationProgress',
  'collectionMilestones',
  'globalMailboxState',
  'poolDebutSeen',
  'poolUnlockState',
  'idempotentGrants',
];

/**
 * 組裝匯出用 data 區塊
 */
function buildDataPayload({
  tasks,
  wallet,
  collection,
  gachaStats,
  expeditions,
  achievements,
  taskStats,
  habits,
  userPreferences,
  inventory,
  workshopStats,
  dailyCheckIn,
  questProgress,
  explorationProgress,
  collectionMilestones,
  globalMailboxState,
  poolDebutSeen,
  poolUnlockState,
  idempotentGrants,
}) {
  const walletData = {
    stardust: wallet.stardust ?? 0,
    adventureEnergy: wallet.adventureEnergy ?? 0,
    materials: wallet.materials ?? { ...DEFAULT_MATERIALS },
  };

  const gachaData = {
    ssrPity: gachaStats.ssrPity ?? 0,
    urPity: gachaStats.urPity ?? 0,
    totalPulls: gachaStats.totalPulls ?? 0,
    tenPullCount: gachaStats.tenPullCount ?? 0,
    selectedPoolId: gachaStats.selectedPoolId ?? null,
    poolPity: gachaStats.poolPity ?? undefined,
  };

  const titles = {
    unlockedTitleIds: achievements.unlockedTitleIds ?? [],
    equippedTitleId: achievements.equippedTitleId ?? null,
  };

  return {
    tasks,
    wallet: walletData,
    collection,
    gachaStats: gachaData,
    expeditions,
    materials: walletData.materials,
    achievements,
    titles,
    habits,
    userPreferences,
    settings: { ...userPreferences },
    taskStats,
    unlockedAchievementIds: achievements.unlockedAchievementIds ?? [],
    claimedAchievementIds: achievements.claimedAchievementIds ?? [],
    unlockedTitleIds: achievements.unlockedTitleIds ?? [],
    equippedTitleId: achievements.equippedTitleId ?? null,
    hasExportedBackup: achievements.hasExportedBackup ?? false,
    adventureEnergy: walletData.adventureEnergy,
    inventory,
    workshopStats,
    dailyCheckIn,
    questProgress,
    explorationProgress,
    collectionMilestones,
    // 備份含 readIds / claimedIds；不含遠端信件正文或 mailbox cache
    // once per local profile：匯入後已領補償不可再領
    globalMailboxState,
    poolDebutSeen,
    poolUnlockState,
    idempotentGrants,
  };
}

/**
 * 匯出完整備份 JSON
 * @returns {Promise<object>}
 */
export async function exportBackup() {
  const snapshot = await readAllStoresSnapshot();
  const snapshotErrors = validateStoredSnapshot(snapshot);
  if (snapshotErrors.length) throw new Error('現有資料需要檢查，未建立可恢復備份：' + snapshotErrors.slice(0, 3).join('；'));
  const meta = Object.fromEntries(snapshot.meta.map((entry) => [entry.key, entry]));
  const normalized = migrateImportedData(normalizePayloadData({ data: {
    ...meta,
    tasks: snapshot.tasks,
    collection: snapshot.collection,
    expeditions: snapshot.expeditions,
    habits: snapshot.habits,
  } }));
  const data = buildDataPayload(normalized);
  const backup = {
    appName: APP_NAME,
    app: APP_NAME,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    version: 2,
    ...data,
    data,
  };
  const validation = validateBackup(backup);
  if (!validation.valid) throw new Error(validation.error);
  return backup;
}

/**
 * 下載 JSON 備份檔
 * @param {object} backup
 * @param {string} [filename]
 */
export function downloadBackupFile(backup, filename) {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 觸發瀏覽器下載備份檔（手動匯出）
 */
export async function downloadBackup() {
  const backup = await exportBackup();
  const date = new Date().toISOString().split('T')[0];
  downloadBackupFile(backup, `questnote-backup-${date}.json`);
  return backup;
}

/**
 * 讀取使用者選擇的 JSON 檔案
 * @param {File} file
 * @returns {Promise<object>}
 */
export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('未選擇檔案'));
      return;
    }

    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.json')) {
      reject(new Error('請選擇 .json 格式的備份檔'));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const text = reader.result;
        if (typeof text !== 'string' || !text.trim()) {
          reject(new Error('備份檔是空的'));
          return;
        }
        const parsed = JSON.parse(text);
        resolve(parsed);
      } catch {
        reject(new Error('JSON 格式錯誤，無法解析備份檔'));
      }
    };

    reader.onerror = () => reject(new Error('讀取備份檔失敗'));
    reader.readAsText(file);
  });
}

/**
 * 從備份物件取出原始資料（支援新舊格式）
 * @param {object} rawBackup
 */
function extractRawData(rawBackup) {
  if (!rawBackup || typeof rawBackup !== 'object') return null;

  if (rawBackup.data && typeof rawBackup.data === 'object') {
    return { ...rawBackup.data };
  }

  const flat = {};
  for (const key of DATA_KEYS) {
    if (rawBackup[key] !== undefined) {
      flat[key] = rawBackup[key];
    }
  }

  if (rawBackup.unlockedAchievementIds !== undefined && !flat.achievements) {
    flat.achievements = {
      unlockedAchievementIds: rawBackup.unlockedAchievementIds,
      claimedAchievementIds: rawBackup.claimedAchievementIds,
      unlockedTitleIds: rawBackup.unlockedTitleIds,
      equippedTitleId: rawBackup.equippedTitleId,
      hasExportedBackup: rawBackup.hasExportedBackup,
    };
  }

  return flat;
}

/**
 * 驗證已知完整備份格式、資料型別及重複表示的一致性
 * @param {object} rawBackup
 */
export function validateBackup(rawBackup) {
  return validateBackupEnvelope(rawBackup, APP_VERSION);
}

/**
 * 合併成就與稱號資料
 */
function mergeAchievementsData(data, rawBackup) {
  const base = data.achievements && typeof data.achievements === 'object' ? { ...data.achievements } : {};

  if (data.titles && typeof data.titles === 'object') {
    base.unlockedTitleIds = data.titles.unlockedTitleIds ?? base.unlockedTitleIds;
    base.equippedTitleId = data.titles.equippedTitleId ?? base.equippedTitleId;
  }

  if (Array.isArray(data.unlockedAchievementIds)) {
    base.unlockedAchievementIds = data.unlockedAchievementIds;
  }
  if (Array.isArray(data.claimedAchievementIds)) {
    base.claimedAchievementIds = data.claimedAchievementIds;
  }
  if (Array.isArray(data.unlockedTitleIds)) {
    base.unlockedTitleIds = data.unlockedTitleIds;
  }
  if (data.equippedTitleId !== undefined) {
    base.equippedTitleId = data.equippedTitleId;
  }
  if (data.hasExportedBackup !== undefined) {
    base.hasExportedBackup = data.hasExportedBackup;
  }

  if (rawBackup?.unlockedAchievementIds && !base.unlockedAchievementIds) {
    base.unlockedAchievementIds = rawBackup.unlockedAchievementIds;
  }

  return base;
}

/**
 * 正規化 wallet 資料
 */
function resolveWallet(data) {
  const walletSource = data.wallet && typeof data.wallet === 'object' ? data.wallet : {};
  return normalizeWallet({
    key: WALLET_KEY,
    stardust: walletSource.stardust ?? 0,
    adventureEnergy: walletSource.adventureEnergy ?? data.adventureEnergy ?? 0,
    materials: walletSource.materials ?? data.materials ?? { ...DEFAULT_MATERIALS },
  });
}

/**
 * 將不同版本格式轉成統一內部格式
 * @param {object} rawBackup
 */
export function normalizeBackupPayload(rawBackup) {
  const validation = validateBackup(rawBackup);
  if (!validation.valid) throw new Error(validation.error);
  return normalizePayloadData(rawBackup);
}

function normalizePayloadData(rawBackup) {
  const data = extractRawData(rawBackup) || {};
  const achievements = mergeAchievementsData(data, rawBackup);
  const wallet = resolveWallet(data);
  const userPreferences = normalizeUserPreferences({
    ...(data.settings && typeof data.settings === 'object' ? data.settings : {}),
    ...(data.userPreferences && typeof data.userPreferences === 'object' ? data.userPreferences : {}),
    key: PREFS_KEY,
  });

  return {
    appVersion: rawBackup.appVersion ?? null,
    exportedAt: rawBackup.exportedAt ?? null,
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
    wallet,
    collection: Array.isArray(data.collection) ? data.collection : [],
    gachaStats: data.gachaStats ?? {},
    expeditions: Array.isArray(data.expeditions) ? data.expeditions : [],
    materials: wallet.materials,
    achievements,
    titles: {
      unlockedTitleIds: achievements.unlockedTitleIds ?? [],
      equippedTitleId: achievements.equippedTitleId ?? null,
    },
    habits: Array.isArray(data.habits) ? data.habits : [],
    userPreferences,
    settings: {
      reduceMotion: userPreferences.reduceMotion,
      theme: userPreferences.theme,
    },
    taskStats: data.taskStats ?? {},
    inventory: normalizeInventory(data.inventory),
    workshopStats: normalizeWorkshopStats(data.workshopStats),
    dailyCheckIn: normalizeDailyCheckIn(data.dailyCheckIn),
    questProgress: normalizeQuestProgress(data.questProgress),
    explorationProgress: normalizeExplorationProgress(data.explorationProgress),
    collectionMilestones: normalizeCollectionMilestoneState(data.collectionMilestones),
    // 舊版備份缺少 mailbox state 時建立空的 readIds / claimedIds
    globalMailboxState: normalizeGlobalMailboxState(data.globalMailboxState),
    poolDebutSeen: normalizePoolDebutSeen(data.poolDebutSeen),
    poolUnlockState: normalizePoolUnlockState(data.poolUnlockState),
    idempotentGrants: normalizeIdempotentGrants(data.idempotentGrants),
  };
}

/**
 * 正規化匯入資料（migration / normalize）
 * @param {object} normalizedBackup
 */
export function migrateImportedData(normalizedBackup) {
  const today = getTodayDateString();

  const tasks = (normalizedBackup.tasks || [])
    .map((task) => normalizeTask(task, today))
    .filter(Boolean);

  const collection = (normalizedBackup.collection || [])
    .map((item) => {
      const petId = item?.petId || item?.id;
      if (!petId) return null;
      return normalizeCollectionItem({
        ...item,
        petId,
        owned: item.owned ?? true,
      });
    })
    .filter(Boolean);

  const habits = (normalizedBackup.habits || [])
    .map((habit) => normalizeHabit(habit))
    .filter(Boolean);

  const expeditions = (normalizedBackup.expeditions || [])
    .map((exp) => normalizeExpedition(exp))
    .filter(Boolean);

  const wallet = normalizeWallet({
    ...normalizedBackup.wallet,
    key: WALLET_KEY,
  });

  const gachaStats = normalizeGachaStats({
    ...normalizedBackup.gachaStats,
    key: GACHA_STATS_KEY,
  });

  const achievements = normalizeAchievementsState({
    ...normalizedBackup.achievements,
    key: ACHIEVEMENTS_KEY,
  });

  const taskStats = normalizeTaskStats({
    ...normalizedBackup.taskStats,
    key: TASK_STATS_KEY,
  });

  const userPreferences = normalizeUserPreferences({
    ...normalizedBackup.userPreferences,
    key: PREFS_KEY,
  });

  const inventory = normalizeInventory(normalizedBackup.inventory);
  const workshopStats = normalizeWorkshopStats(normalizedBackup.workshopStats);
  const dailyCheckIn = normalizeDailyCheckIn(normalizedBackup.dailyCheckIn);
  // Restore the snapshot's dates; normal app reads perform any subsequent rollover.
  const questProgress = normalizeQuestProgress(normalizedBackup.questProgress);
  const explorationProgress = normalizeExplorationProgress(normalizedBackup.explorationProgress);
  const collectionMilestones = normalizeCollectionMilestoneState(normalizedBackup.collectionMilestones);
  const globalMailboxState = normalizeGlobalMailboxState(normalizedBackup.globalMailboxState);
  const poolDebutSeen = normalizePoolDebutSeen(normalizedBackup.poolDebutSeen);
  const poolUnlockState = normalizePoolUnlockState(normalizedBackup.poolUnlockState);
  const idempotentGrants = normalizeIdempotentGrants(normalizedBackup.idempotentGrants);

  return {
    ...normalizedBackup,
    tasks,
    collection,
    habits,
    expeditions,
    wallet,
    gachaStats,
    achievements,
    taskStats,
    userPreferences,
    materials: wallet.materials,
    inventory,
    workshopStats,
    dailyCheckIn,
    questProgress,
    explorationProgress,
    collectionMilestones,
    globalMailboxState,
    poolDebutSeen,
    poolUnlockState,
    idempotentGrants,
  };
}

/**
 * 產生 UI 預覽資料
 * @param {object} normalizedBackup
 * @param {{ fileName?: string, totalPets?: number }} [options]
 */
export function previewBackup(normalizedBackup, options = {}) {
  const tasks = normalizedBackup.tasks || [];
  const habits = normalizedBackup.habits || [];
  const collection = normalizedBackup.collection || [];
  const achievements = normalizedBackup.achievements || {};
  const wallet = normalizedBackup.wallet || {};
  const expeditions = normalizedBackup.expeditions || [];
  const titles = normalizedBackup.titles || {};

  const ownedPets = collection.filter((item) => item.owned !== false).length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const unlockedAchievements = Array.isArray(achievements.unlockedAchievementIds)
    ? achievements.unlockedAchievementIds.length
    : 0;
  const unlockedTitles = Array.isArray(titles.unlockedTitleIds)
    ? titles.unlockedTitleIds.length
    : Array.isArray(achievements.unlockedTitleIds)
      ? achievements.unlockedTitleIds.length
      : 0;

  return {
    fileName: options.fileName || '未知檔案',
    appVersion: normalizedBackup.appVersion || '無版本資訊',
    exportedAt: normalizedBackup.exportedAt || null,
    taskCount: tasks.length,
    completedTaskCount: completedTasks,
    habitCount: habits.length,
    collectionCount: ownedPets,
    totalPets: options.totalPets ?? null,
    stardust: wallet.stardust ?? 0,
    adventureEnergy: wallet.adventureEnergy ?? 0,
    expeditionCount: expeditions.length,
    unlockedAchievementCount: unlockedAchievements,
    unlockedTitleCount: unlockedTitles,
  };
}

/**
 * 產生自動備份檔名
 */
function buildAutoBackupFilename() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `questnote_auto_backup_before_import_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.json`;
}

/**
 * 匯入前自動下載目前資料
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function createAutoBackupBeforeImport() {
  try {
    const backup = await exportBackup();
    downloadBackupFile(backup, buildAutoBackupFilename());
    return { success: true };
  } catch (err) {
    console.error('[QuestNote] 自動備份失敗:', err);
    return { success: false, error: err?.message || '自動備份失敗' };
  }
}

/**
 * 安全覆蓋 IndexedDB 全部資料（單一 transaction）
 * @param {object} migratedData
 */
export async function safeReplaceAllData(migratedData) {
  const errors = validateSnapshotData(migratedData);
  if (errors.length) throw new Error('備份資料不完整或無效：' + errors.slice(0, 3).join('；'));
  await replaceAllStores({
    tasks: migratedData.tasks || [],
    collection: migratedData.collection || [],
    expeditions: migratedData.expeditions || [],
    habits: migratedData.habits || [],
    wallet: migratedData.wallet,
    gachaStats: migratedData.gachaStats,
    achievements: migratedData.achievements,
    taskStats: migratedData.taskStats,
    userPreferences: migratedData.userPreferences,
    inventory: migratedData.inventory,
    workshopStats: migratedData.workshopStats,
    dailyCheckIn: migratedData.dailyCheckIn,
    questProgress: migratedData.questProgress,
    explorationProgress: migratedData.explorationProgress,
    collectionMilestones: migratedData.collectionMilestones,
    globalMailboxState: migratedData.globalMailboxState,
    poolDebutSeen: migratedData.poolDebutSeen,
    poolUnlockState: migratedData.poolUnlockState,
    idempotentGrants: migratedData.idempotentGrants,
  });
}

/**
 * 覆蓋恢復備份到 IndexedDB
 * @param {object} normalizedBackup
 */
export async function restoreBackup(normalizedBackup) {
  // Raw rows in a verified historical envelope still need their legacy adapter.
  const errors = validateSnapshotData(normalizedBackup, undefined, normalizedBackup?.appVersion ?? 'current');
  if (errors.length) throw new Error('備份資料不完整或無效：' + errors.slice(0, 3).join('；'));
  const migrated = migrateImportedData(normalizedBackup);
  await safeReplaceAllData(migrated);
  return migrated;
}

/**
 * 舊版 API 相容
 * @deprecated 請使用 restoreBackup
 */
export async function importBackup(backup) {
  const normalized = normalizeBackupPayload(backup);
  return restoreBackup(normalized);
}
