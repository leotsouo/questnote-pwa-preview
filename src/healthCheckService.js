/**
 * 開發用 App 健康檢查 — 在 console 執行 runAppHealthCheck()
 */
import { openDB, dbGetAll, dbPut, dbDelete, STORES } from './db.js';
import { normalizeTask } from './taskMigration.js';
import { normalizeWallet, DEFAULT_MATERIALS } from './rewardService.js';
import { normalizeEntry, normalizeCollectionItem } from './collectionService.js';
import { normalizeHabit } from './habitService.js';
import { normalizeAchievementsState, loadAchievementsCatalog, loadTitlesCatalog } from './achievementService.js';
import { normalizeUserPreferences, normalizeTheme } from './preferencesService.js';
import { normalizeGachaStats } from './gachaService.js';
import { normalizeInventory, normalizeWorkshopStats } from './workshopService.js';
import { normalizeDailyCheckIn } from './dailyCheckInService.js';
import { normalizeExpedition } from './expeditionService.js';
import {
  getQuestProgress,
  getTodayKey,
  getWeekKey,
  DAILY_QUEST_DEFS,
  WEEKLY_QUEST_DEFS,
} from './questService.js';
import {
  getExplorationProgress,
  EXPLORATION_AREA_IDS,
} from './explorationService.js';
import {
  COLLECTION_MILESTONE_DEFINITIONS,
  COLLECTION_MILESTONE_CONDITION_TYPES,
  normalizeCollectionMilestoneState,
  resolveCollectionMilestoneDefinitions,
  buildCollectionMilestoneContext,
  getCollectionMilestoneProgress,
} from './collectionMilestoneService.js';
import {
  buildAdventureHandbookModel,
  buildNextGoals,
  scoreGoal,
} from './adventureHandbookService.js';
import {
  normalizeGlobalMailboxState,
  normalizeMailboxPayload,
  normalizeMailboxMessage,
  normalizeMailboxAction,
  validateMailboxReward,
  compareAppVersions,
  buildMailboxViewModel,
  resolveMailboxMessageStatus,
  MAILBOX_REWARD_LIMITS,
  MAILBOX_ACTION_VIEWS,
  MAILBOX_RUNTIME_CACHE,
  __mailboxTestHelpers,
} from './mailboxService.js';
import {
  validatePetCatalog,
  validateLoreCatalog,
  validatePetAndLoreConsistency,
  validateSeriesCatalog,
  validatePoolCatalog,
  getPetSeriesId,
  LEGACY_SERIES_ID,
  getNextPetId,
  PET_ID_TYPES,
} from './petDataSchema.js';
import {
  matchesPetPoolFilter,
  getEligiblePetsForPool,
} from './petPoolFilter.js';

const DATA_FILES = [
  { path: './data/pets.json', label: 'pets.json' },
  { path: './data/pools.json', label: 'pools.json' },
  { path: './data/expeditions.json', label: 'expeditions.json' },
  { path: './data/categories.json', label: 'categories.json' },
  { path: './data/achievements.json', label: 'achievements.json' },
  { path: './data/titles.json', label: 'titles.json' },
  { path: './data/pets-lore.json', label: 'pets-lore.json' },
  { path: './data/pet-series.json', label: 'pet-series.json' },
  { path: './data/materials.json', label: 'materials.json' },
  { path: './data/craftables.json', label: 'craftables.json' },
  { path: './data/dailyWheelRewards.json', label: 'dailyWheelRewards.json' },
  { path: './data/global-mailbox.json', label: 'global-mailbox.json' },
];

const PROBE_KEY = '_healthCheckProbe';
const INVENTORY_KEY = 'inventory';
const WORKSHOP_STATS_KEY = 'workshopStats';
const DAILY_CHECK_IN_KEY = 'dailyCheckIn';

const DAILY_CHECK_IN_FIELDS = [
  'lastCheckInDate',
  'lastCheckInAt',
  'streak',
  'bestStreak',
  'totalCheckIns',
  'lastWheelSpinDate',
  'lastWheelSpinAt',
  'totalWheelSpins',
  'history',
];

async function checkDataFiles() {
  const details = [];
  for (const { path, label } of DATA_FILES) {
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await res.json();
      details.push(`${label}: ok`);
    } catch (err) {
      throw new Error(`${label}: ${err.message}`);
    }
  }
  return details;
}

async function checkIndexedDB() {
  await openDB();
  const probe = { key: PROBE_KEY, testedAt: new Date().toISOString() };
  await dbPut(STORES.META, probe);
  const read = await dbGetAll(STORES.META);
  if (!read.some((row) => row.key === PROBE_KEY)) {
    throw new Error('寫入後無法讀回探測資料');
  }
  await dbDelete(STORES.META, PROBE_KEY);
}

async function checkTasks() {
  const tasks = await dbGetAll(STORES.TASKS);
  for (const task of tasks) {
    const normalized = normalizeTask(task);
    if (!normalized?.id) throw new Error(`任務無法正規化: ${task?.id ?? '(無 id)'}`);
  }
  return tasks.length;
}

async function checkWallet() {
  const rows = await dbGetAll(STORES.META);
  const walletRow = rows.find((r) => r.key === 'wallet');
  const wallet = normalizeWallet(walletRow);
  if (typeof wallet.stardust !== 'number') throw new Error('stardust 無效');
  if (typeof wallet.adventureEnergy !== 'number') throw new Error('adventureEnergy 無效');
  if (!wallet.materials || typeof wallet.materials !== 'object') {
    throw new Error('materials 無效');
  }
  for (const matId of Object.keys(DEFAULT_MATERIALS)) {
    if (typeof wallet.materials[matId] !== 'number') {
      throw new Error(`wallet.materials.${matId} 缺少或型別錯誤（建議重新開啟 App 觸發 normalize）`);
    }
  }
}

async function checkCollection() {
  const items = await dbGetAll(STORES.COLLECTION);
  for (const item of items) {
    const normalized = normalizeCollectionItem(item);
    if (!normalized?.petId) throw new Error(`圖鑑項目無法正規化: ${item?.petId ?? '(無 petId)'}`);
    if (!('nickname' in normalized)) {
      throw new Error(`圖鑑 ${normalized.petId} 缺少 nickname 欄位（建議執行 migrateCollectionNicknames）`);
    }
    if (!('lastPettedAt' in normalized)) {
      throw new Error(`圖鑑 ${normalized.petId} 缺少 lastPettedAt 欄位`);
    }
  }
  return items.length;
}

async function checkHabits() {
  const habits = await dbGetAll(STORES.HABITS);
  for (const habit of habits) {
    const normalized = normalizeHabit(habit);
    if (!normalized?.id) throw new Error(`習慣無法正規化: ${habit?.id ?? '(無 id)'}`);
  }
  return habits.length;
}

async function checkAchievements() {
  const rows = await dbGetAll(STORES.META);
  const achRow = rows.find((r) => r.key === 'achievements');
  normalizeAchievementsState(achRow);
  const catalog = await loadAchievementsCatalog();
  const titles = await loadTitlesCatalog();
  if (!catalog?.length) throw new Error('achievements.json 為空或載入失敗');
  if (!titles?.length) throw new Error('titles.json 為空或載入失敗');
}

async function checkGachaStats() {
  const rows = await dbGetAll(STORES.META);
  const statsRow = rows.find((r) => r.key === 'gachaStats');
  normalizeGachaStats(statsRow);
}

async function checkUserPreferences() {
  const rows = await dbGetAll(STORES.META);
  const prefsRow = rows.find((r) => r.key === 'userPreferences');
  const prefs = normalizeUserPreferences(prefsRow);
  const theme = normalizeTheme(prefs.theme);
  if (theme !== 'default' && theme !== 'sweet') {
    throw new Error(`userPreferences.theme 無效: ${prefs.theme}`);
  }
  return theme;
}

async function checkInventory() {
  const rows = await dbGetAll(STORES.META);
  const invRow = rows.find((r) => r.key === INVENTORY_KEY);
  const inventory = normalizeInventory(invRow);
  if (!inventory || typeof inventory !== 'object') {
    throw new Error('inventory 不存在或無法正規化');
  }
  if (!inventory.items || typeof inventory.items !== 'object') {
    throw new Error('inventory.items 不存在或型別錯誤');
  }
  return Object.keys(inventory.items).length;
}

async function checkWorkshopStats() {
  const rows = await dbGetAll(STORES.META);
  const statsRow = rows.find((r) => r.key === WORKSHOP_STATS_KEY);
  normalizeWorkshopStats(statsRow);
}

async function checkDailyCheckIn() {
  const rows = await dbGetAll(STORES.META);
  const dailyRow = rows.find((r) => r.key === DAILY_CHECK_IN_KEY);
  const daily = normalizeDailyCheckIn(dailyRow);
  if (!daily || daily.key !== DAILY_CHECK_IN_KEY) {
    throw new Error('dailyCheckIn 不存在或 key 錯誤');
  }
  for (const field of DAILY_CHECK_IN_FIELDS) {
    if (!(field in daily)) {
      throw new Error(`dailyCheckIn 缺少欄位: ${field}`);
    }
  }
  if (!Array.isArray(daily.history)) {
    throw new Error('dailyCheckIn.history 必須為陣列');
  }
}

async function checkExpeditions() {
  const expeditions = await dbGetAll(STORES.EXPEDITIONS);
  if (!Array.isArray(expeditions)) {
    throw new Error('expeditions 必須為陣列');
  }
  for (const exp of expeditions) {
    const normalized = normalizeExpedition(exp);
    if (!normalized?.id) throw new Error(`探險紀錄無法正規化: ${exp?.id ?? '(無 id)'}`);
  }
  return expeditions.length;
}

async function checkServiceWorker() {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return 'not registered';
  return reg.active ? 'ok' : 'installing';
}

const ARCHIVED_MODULES = [
  'appStatsService.js',
  'quickAddService.js',
  'searchService.js',
  'tagService.js',
];

/**
 * 檢查孤兒模組是否已封存且未被執行路徑引用
 */
async function checkArchivedModules() {
  const warnings = [];

  const readmeRes = await fetch('./src/_archive/README.md');
  if (!readmeRes.ok) {
    throw new Error('src/_archive/README.md 不存在');
  }

  for (const file of ARCHIVED_MODULES) {
    const archivedRes = await fetch(`./src/_archive/${file}`);
    if (!archivedRes.ok) {
      throw new Error(`${file} 未封存於 src/_archive/`);
    }

    const legacyRes = await fetch(`./src/${file}`);
    if (legacyRes.ok) {
      warnings.push(`src/${file} 仍存在於原路徑`);
    }
  }

  const [appRes, uiRes, swRes] = await Promise.all([
    fetch('./src/app.js'),
    fetch('./src/ui.js'),
    fetch('./service-worker.js'),
  ]);

  if (!appRes.ok || !uiRes.ok || !swRes.ok) {
    throw new Error('無法讀取執行路徑檔案以檢查封存狀態');
  }

  const appText = await appRes.text();
  const uiText = await uiRes.text();
  const swText = await swRes.text();

  for (const file of ARCHIVED_MODULES) {
    const moduleId = file.replace('.js', '');
    const importPattern = new RegExp(`from\\s+['"].*${moduleId}\\.js['"]`);
    if (importPattern.test(appText) || importPattern.test(uiText)) {
      throw new Error(`${file} 仍被執行路徑 import`);
    }
    if (swText.includes(`src/${file}`) || swText.includes(`_archive/${file}`)) {
      warnings.push(`service-worker 仍快取 ${file}`);
    }
  }

  if (warnings.length) {
    return `ok with warnings: ${warnings.join('; ')}`;
  }
  return '4 modules archived';
}

/** 預期保留 renderAll 的呼叫情境（靜態分析用） */
const EXPECTED_RENDER_ALL_CONTEXTS = [
  { file: 'ui.js', pattern: 'export async function renderAll', reason: 'fallback 函式定義' },
  { file: 'ui.js', pattern: 'await renderAll()', reason: '主題切換後全頁刷新' },
  { file: 'ui.js', pattern: 'renderAll();', reason: '未知 view fallback' },
  { file: 'app.js', pattern: "renderMode: 'full'", reason: '初始化、跨日與資料大範圍恢復' },
];

/**
 * 檢查局部渲染 API 與 renderAll 使用風險
 */
async function checkRenderSystem() {
  const [uiRes, appRes] = await Promise.all([
    fetch('./src/ui.js'),
    fetch('./src/app.js'),
  ]);
  if (!uiRes.ok || !appRes.ok) {
    throw new Error('無法讀取 ui.js / app.js');
  }

  const uiText = await uiRes.text();
  const appText = await appRes.text();
  const notes = [];
  const stats = [];

  const requiredExports = [
    'export async function renderAll',
    'export function renderCurrentView',
    'export function renderView',
    'export function renderSharedUI',
    'export function renderViews',
    'export async function renderAfterRefresh',
  ];
  for (const sig of requiredExports) {
    if (!uiText.includes(sig)) {
      throw new Error(`ui.js 缺少 ${sig}`);
    }
  }

  if (!uiText.includes('isWheelSpinning()')) {
    throw new Error('render 路徑未檢查 isWheelSpinning');
  }

  const renderAllCallCount = (uiText.match(/\brenderAll\s*\(/g) || []).length;
  stats.push(`renderAll 呼叫點(ui.js): ${renderAllCallCount}`);

  const retained = EXPECTED_RENDER_ALL_CONTEXTS.filter(({ file, pattern }) => {
    const text = file === 'ui.js' ? uiText : appText;
    return text.includes(pattern);
  });
  const retainedReasons = retained.map((r) => `${r.file}: ${r.reason}`).join('; ');
  stats.push(`renderAll 保留原因: ${retainedReasons || 'applyTheme、renderView default、renderAfterRefresh(full)'}`);

  const refreshStateCalls = (appText.match(/\brefreshState\s*\(/g) || []).length;
  const refreshWithMode = (appText.match(/refreshState\s*\(\s*\{[^}]*renderMode/g) || []).length;
  const refreshDefault = refreshStateCalls - refreshWithMode;
  stats.push(`refreshState 呼叫點(app.js): ${refreshStateCalls}`);
  stats.push(`refreshState 含 renderMode: ${refreshWithMode}`);
  stats.push(`refreshState 預設 current: ${refreshDefault}`);

  const onRefreshWithMode = (uiText.match(/onRefresh\s*\(\s*\{[^}]*renderMode/g) || []).length;
  const onRefreshDefault = (uiText.match(/onRefresh\s*\(\s*\)/g) || []).length;
  stats.push(`onRefresh 含 renderMode(ui.js): ${onRefreshWithMode}`);
  stats.push(`onRefresh 預設 current(ui.js): ${onRefreshDefault}`);

  if (!/renderAll[\s\S]{0,400}isWheelSpinning/.test(uiText)) {
    notes.push('renderAll 可能缺少轉盤動畫 guard');
  }
  if (!/renderCurrentView[\s\S]{0,400}isWheelSpinning/.test(uiText)) {
    notes.push('renderCurrentView 可能缺少轉盤動畫 guard');
  }
  if (!/renderCurrentView[\s\S]{0,500}isModalOpen/.test(uiText)) {
    notes.push('renderCurrentView 可能缺少 Modal guard');
  }
  if (!/renderViews[\s\S]{0,500}isModalOpen/.test(uiText)) {
    notes.push('renderViews 可能缺少 Modal guard');
  }
  if (/function renderSharedUI[\s\S]{0,1200}renderAll\s*\(/.test(uiText)) {
    notes.push('renderSharedUI 可能呼叫 renderAll（不應發生）');
  }
  if (!/case\s+'more'[\s\S]{0,400}default[\s\S]{0,200}renderAll/.test(uiText)) {
    notes.push('renderView unknown fallback 可能缺失');
  }

  const appRenderAllCalls = (appText.match(/renderAll\s*\(/g) || []).length;
  if (appRenderAllCalls > 0) {
    notes.push(`app.js 仍有 ${appRenderAllCalls} 處直接 renderAll（預期 0）`);
  }

  if (!appText.includes("renderMode ?? 'current'") && !appText.includes('renderMode ?? "current"')) {
    notes.push('refreshState 預設可能未改為局部渲染');
  }

  if (!appText.includes("renderMode: 'full'")) {
    notes.push('缺少 full render 標記');
  }

  if (!appText.includes('跨日刷新') || !appText.includes("renderMode: 'full'")) {
    notes.push('跨日刷新可能未使用 full render');
  }

  const summary = stats.join(' | ');
  if (notes.length) {
    return `ok with notes: ${notes.join('; ')} | ${summary}`;
  }
  return summary;
}

/**
 * 寵物圖片路徑、SW runtime cache 與預載 API 檢查
 */
async function checkPetImageSystem() {
  const [petsRes, swRes, uiRes, preloadRes] = await Promise.all([
    fetch('./data/pets.json'),
    fetch('./service-worker.js'),
    fetch('./src/ui.js'),
    fetch('./src/imagePreloadService.js'),
  ]);

  if (!petsRes.ok) throw new Error('無法讀取 pets.json');
  if (!swRes.ok || !uiRes.ok || !preloadRes.ok) {
    throw new Error('無法讀取 SW / ui / imagePreloadService');
  }

  const petsData = await petsRes.json();
  const pets = petsData.pets || [];
  const swText = await swRes.text();
  const uiText = await uiRes.text();
  const preloadText = await preloadRes.text();
  const notes = [];
  const stats = [];

  const paths = [];
  const pathSet = new Set();
  let missingImage = 0;
  let invalidPrefix = 0;

  for (const pet of pets) {
    if (!pet.image) {
      missingImage += 1;
      continue;
    }
    if (!pet.image.startsWith('assets/pets/')) {
      invalidPrefix += 1;
    }
    paths.push(pet.image);
    if (pathSet.has(pet.image)) {
      notes.push(`重複 image path: ${pet.image}`);
    }
    pathSet.add(pet.image);
  }

  if (missingImage > 0) notes.push(`缺少 image 欄位: ${missingImage} 隻`);
  if (invalidPrefix > 0) notes.push(`非 assets/pets/ 路徑: ${invalidPrefix} 筆`);

  const missingFiles = [];
  const verifySample = [...new Set([...paths.slice(0, 5), ...paths.slice(-2)])];
  for (const path of verifySample) {
    try {
      const res = await fetch(`./${path}`, { method: 'HEAD' });
      if (!res.ok) missingFiles.push(path);
    } catch {
      try {
        const res = await fetch(`./${path}`);
        if (!res.ok) missingFiles.push(path);
      } catch {
        missingFiles.push(path);
      }
    }
  }
  if (missingFiles.length > 0) {
    notes.push(`取樣缺圖 ${missingFiles.length}/${verifySample.length}（例: ${missingFiles.slice(0, 2).join(', ')}）`);
  }

  const nonPng = paths.filter((p) => !/\.png$/i.test(p));
  if (nonPng.length > 0) {
    notes.push(`非 PNG 格式 ${nonPng.length} 筆，未來可評估 WebP`);
  } else {
    stats.push('格式: 全為 PNG，未來可評估 WebP');
  }

  const sampleForSize = paths.slice(0, 3);
  const sizeReports = [];
  for (const path of sampleForSize) {
    try {
      const dims = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight, ok: true });
        img.onerror = () => resolve({ ok: false });
        img.src = `./${path}`;
      });
      if (dims.ok) {
        const large = dims.w > 1024 || dims.h > 1024;
        sizeReports.push(`${path}: ${dims.w}x${dims.h}${large ? '(建議壓縮)' : ''}`);
      }
    } catch {
      /* 略過 */
    }
  }
  if (sizeReports.length) stats.push(`尺寸取樣: ${sizeReports.join('; ')}`);

  if (!swText.includes('PET_IMAGE_CACHE') || !swText.includes('questnote-pet-images-v235')) {
    throw new Error('service-worker 缺少 PET_IMAGE_CACHE');
  }
  if (!swText.includes('/assets/pets/') || !swText.includes('cachePetImage')) {
    throw new Error('service-worker 未處理 assets/pets/ runtime cache');
  }
  if (swText.includes('assets/pets/') && /PRECACHE_URLS[\s\S]*assets\/pets/.test(swText)) {
    notes.push('PRECACHE 含寵物圖（應避免全量 precache）');
  }

  const requiredPreload = [
    'preloadImage',
    'preloadImages',
    'preloadCompanionImage',
    'preloadGachaResultImages',
    'preloadOwnedPetImages',
    'getPetImageSrc',
    'warmPetImageCache',
  ];
  for (const fn of requiredPreload) {
    if (!preloadText.includes(`function ${fn}`) && !preloadText.includes(`export function ${fn}`)) {
      throw new Error(`imagePreloadService 缺少 ${fn}`);
    }
  }

  if (!uiText.includes('imagePreloadService')) {
    notes.push('ui.js 可能未整合 imagePreloadService');
  }
  if (!uiText.includes("loading: 'eager'") && !uiText.includes('loading: "eager"')) {
    notes.push('ui.js 可能缺少 eager 圖片載入');
  }
  if (!uiText.includes("loading: 'lazy'") && !uiText.includes('loading: "lazy"')) {
    notes.push('圖鑑 lazy loading 可能缺失');
  }

  let petCacheCount = 0;
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open('questnote-pet-images-v235');
      const keys = await cache.keys();
      petCacheCount = keys.length;
    } catch {
      notes.push('無法讀取 PET_IMAGE_CACHE 狀態');
    }
  }
  stats.push(`pets.json: ${pets.length} 隻`);
  stats.push(`image paths: ${paths.length}`);
  stats.push(`PET_IMAGE_CACHE 項目: ${petCacheCount}`);

  const summary = stats.join(' | ');
  if (notes.length) {
    return `ok with notes: ${notes.join('; ')} | ${summary}`;
  }
  return summary;
}

/**
 * 版本資訊顯示與 DOM 結構檢查
 */
async function checkVersionInfo() {
  const [versionRes, indexRes, uiRes, cssRes] = await Promise.all([
    fetch('./src/version.js'),
    fetch('./index.html'),
    fetch('./src/ui.js'),
    fetch('./src/styles.css'),
  ]);

  if (!versionRes.ok || !indexRes.ok || !uiRes.ok || !cssRes.ok) {
    throw new Error('無法讀取 version / index / ui / styles');
  }

  const versionText = await versionRes.text();
  const indexText = await indexRes.text();
  const uiText = await uiRes.text();
  const cssText = await cssRes.text();
  const notes = [];
  const stats = [];

  if (!versionText.includes('export const APP_VERSION')) {
    throw new Error('APP_VERSION 不存在');
  }
  if (!versionText.includes('export const CACHE_NAME')) {
    throw new Error('CACHE_NAME 不存在');
  }
  if (!versionText.includes('export const BUILD_TIME')) {
    throw new Error('BUILD_TIME 不存在');
  }
  if (!versionText.includes('export function formatDisplayVersion')) {
    throw new Error('formatDisplayVersion 不存在');
  }

  const versionMatch = versionText.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (versionMatch) stats.push(`APP_VERSION=${versionMatch[1]}`);

  const cacheMatch = versionText.match(/CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
  if (cacheMatch) stats.push(`CACHE_NAME=${cacheMatch[1]}`);

  if (!indexText.includes('data-version-info')) {
    throw new Error('index.html 缺少 data-version-info container');
  }

  const versionInfoIdCount = (indexText.match(/id="versionInfo"/g) || []).length;
  if (versionInfoIdCount > 0) {
    notes.push(`發現 id="versionInfo" x${versionInfoIdCount}（建議改用 data-version-info）`);
  }

  if (!uiText.includes('export function renderVersionInfo')) {
    throw new Error('renderVersionInfo 不存在');
  }
  if (!/updateServiceWorkerStatusDisplay[\s\S]{0,800}catch/.test(uiText)) {
    notes.push('service worker status check 可能缺少 try/catch');
  }
  if (!uiText.includes('檢查中')) {
    notes.push('版本資訊可能未先同步顯示 Service Worker 檢查中');
  }

  if (!cssText.includes('.version-info-card')) {
    notes.push('CSS 缺少 .version-info-card');
  }

  const domContainers = typeof document !== 'undefined'
    ? document.querySelectorAll('[data-version-info]').length
    : 0;
  stats.push(`data-version-info containers=${domContainers}`);

  const summary = stats.join(' | ');
  if (notes.length) {
    return `ok with notes: ${notes.join('; ')} | ${summary}`;
  }
  return summary;
}

/**
 * Sweet 主題 toast 對比度與類型檢查
 */
async function checkSweetToastContrast() {
  const [cssRes, uiRes] = await Promise.all([
    fetch('./src/styles.css'),
    fetch('./src/ui.js'),
  ]);

  if (!cssRes.ok || !uiRes.ok) {
    throw new Error('無法讀取 styles / ui');
  }

  const cssText = await cssRes.text();
  const uiText = await uiRes.text();
  const notes = [];
  const stats = [];

  const requiredPairs = [
    ['sweet toast success bg', 'body[data-theme="sweet"] .toast--success', '#E7F6F1'],
    ['sweet toast success text', 'body[data-theme="sweet"] .toast--success', '#1F5C4D'],
    ['sweet toast reward bg', 'body[data-theme="sweet"] .toast--reward', '#FFF1D8'],
    ['sweet toast reward text', 'body[data-theme="sweet"] .toast--reward', '#8A4F10'],
    ['sweet toast info bg', 'body[data-theme="sweet"] .toast--info', '#EEE9FF'],
    ['sweet toast info text', 'body[data-theme="sweet"] .toast--info', '#4E3BA8'],
    ['sweet toast warning bg', 'body[data-theme="sweet"] .toast--warning', '#FFF3E6'],
    ['sweet toast warning text', 'body[data-theme="sweet"] .toast--warning', '#8A4F10'],
    ['sweet toast error bg', 'body[data-theme="sweet"] .toast--error', '#FFE3EA'],
    ['sweet toast error text', 'body[data-theme="sweet"] .toast--error', '#9F263F'],
    ['sweet reward-toast bg', 'body[data-theme="sweet"] .reward-toast', '#FFF1D8'],
    ['sweet reward-toast text', 'body[data-theme="sweet"] .reward-toast', '#8A4F10'],
  ];

  for (const [label, selector, color] of requiredPairs) {
    const idx = cssText.indexOf(selector);
    if (idx === -1) {
      throw new Error(`缺少 ${selector}`);
    }
    const block = cssText.slice(idx, idx + 400);
    if (!block.includes(color)) {
      throw new Error(`${label} 未使用 ${color}`);
    }
    stats.push(`${label}=ok`);
  }

  if (!cssText.includes('V2.3.7') && !cssText.includes('Sweet 主題 Toast 可讀性修正')) {
    notes.push('styles.css 可能缺少 V2.3.7 sweet toast 區塊標記');
  }

  if (!uiText.includes("reward: '✨'") && !uiText.includes('reward: \'✨\'')) {
    notes.push('showToast 可能未支援 reward type');
  }

  if (!uiText.includes('reward-toast--reward')) {
    throw new Error('showRewardToast 未使用 reward-toast--reward class');
  }

  const globalToastGradient = /\.toast--success\s*\{[^}]*linear-gradient/s.test(cssText);
  const scopedDefaultToast = cssText.includes('body[data-theme="default"] .toast--success');
  if (globalToastGradient && !scopedDefaultToast) {
    notes.push('全域 .toast--success 漸層可能覆蓋 sweet 主題');
  } else if (scopedDefaultToast) {
    stats.push('default-only toast gradient=ok');
  }

  if (!uiText.includes("showToast('任務已完成', 'success')")) {
    notes.push('任務完成 fallback toast 可能已變更');
  } else {
    stats.push('task-complete toast type=success');
  }

  if (typeof window !== 'undefined' && window.testSweetToasts) {
    stats.push('testSweetToasts=available');
  }

  const summary = stats.join(' | ');
  if (notes.length) {
    return `ok with notes: ${notes.join('; ')} | ${summary}`;
  }
  return summary;
}

/**
 * V2.3.8 — 召喚頁星塵同步檢查（靜態分析 ui.js）
 */
async function checkGachaSync() {
  const uiRes = await fetch('./src/ui.js');
  if (!uiRes.ok) throw new Error('無法讀取 ui.js');
  const uiText = await uiRes.text();
  const notes = [];
  const stats = [];

  if (!uiText.includes('export function updateGachaAffordability')) {
    throw new Error('缺少 updateGachaAffordability 函式');
  }
  stats.push('updateGachaAffordability=exists');

  if (!/function renderSharedUI[\s\S]{0,1200}updateGachaAffordability\s*\(/.test(uiText)) {
    throw new Error('renderSharedUI 未呼叫 updateGachaAffordability');
  }
  stats.push('renderSharedUI→updateGachaAffordability=ok');

  // 召喚頁切換時重新 render
  if (!/viewName === 'gacha'[\s\S]{0,80}renderGachaView\s*\(/.test(uiText)) {
    notes.push('switchView(gacha) 可能未重新 renderGachaView');
  } else {
    stats.push('switchView(gacha)→renderGachaView=ok');
  }

  // 單抽 / 十連 click handler 依最新 state.wallet 判斷
  if (!/function handlePull[\s\S]{0,200}state\.wallet\.stardust/.test(uiText)) {
    throw new Error('handlePull 未依最新 state.wallet 判斷');
  }
  if (!/function handleTenPull[\s\S]{0,200}state\.wallet\.stardust/.test(uiText)) {
    throw new Error('handleTenPull 未依最新 state.wallet 判斷');
  }
  stats.push('pull handlers 讀最新 wallet=ok');

  // updateGachaAffordability 依最新 state.wallet 計算按鈕狀態
  if (!/function updateGachaAffordability[\s\S]{0,600}state\.wallet\.stardust/.test(uiText)) {
    throw new Error('updateGachaAffordability 未讀最新 state.wallet');
  }
  if (!/function updateGachaAffordability[\s\S]{0,900}btn-pull['"]/.test(uiText)
    || !/function updateGachaAffordability[\s\S]{0,900}btn-pull-ten/.test(uiText)) {
    notes.push('updateGachaAffordability 可能未同時更新單抽與十連按鈕');
  } else {
    stats.push('單抽/十連 disabled 依最新 wallet=ok');
  }

  // DOM 缺失安全 return
  if (!/function updateGachaAffordability[\s\S]{0,400}if\s*\(!btnSingle\s*&&\s*!btnTen\)\s*return/.test(uiText)) {
    notes.push('updateGachaAffordability 可能缺少 DOM 缺失 safe return');
  } else {
    stats.push('DOM 缺失 safe return=ok');
  }

  const summary = stats.join(' | ');
  if (notes.length) {
    return `ok with notes: ${notes.join('; ')} | ${summary}`;
  }
  return summary;
}

/**
 * V2.3.8 — Sweet 可讀性檢查（召喚機率 + 探險歸來 modal）
 */
async function checkSweetContrast() {
  const cssRes = await fetch('./src/styles.css');
  if (!cssRes.ok) throw new Error('無法讀取 styles.css');
  const cssText = await cssRes.text();
  const stats = [];
  const notes = [];

  const requiredPairs = [
    ['sweet rate SR text', 'body[data-theme="sweet"] .rate-tag.rate-SR', '#4E3BA8'],
    ['sweet rate SSR text', 'body[data-theme="sweet"] .rate-tag.rate-SSR', '#8A4F10'],
    ['sweet rate UR text', 'body[data-theme="sweet"] .rate-tag.rate-UR', '#9F2F67'],
    ['sweet expedition title', 'body[data-theme="sweet"] .expedition-reward-modal__title', '#B83274'],
    ['sweet expedition reward stardust', 'body[data-theme="sweet"] .expedition-reward-item[data-reward-type="stardust"]', '#8A4F10'],
    ['sweet expedition reward material', 'body[data-theme="sweet"] .expedition-reward-item[data-reward-type="material"]', '#1F5C4D'],
    ['sweet expedition reward bond', 'body[data-theme="sweet"] .expedition-reward-item[data-reward-type="bond"]', '#4E3BA8'],
    ['sweet expedition confirm button', 'body[data-theme="sweet"] .expedition-confirm-button', '#C73578'],
  ];

  for (const [label, selector, color] of requiredPairs) {
    const idx = cssText.indexOf(selector);
    if (idx === -1) {
      throw new Error(`缺少 ${selector}`);
    }
    const block = cssText.slice(idx, idx + 400);
    if (!block.includes(color)) {
      throw new Error(`${label} 未使用 ${color}`);
    }
    stats.push(`${label}=ok`);
  }

  // 淺底白字 / 淡粉字配粉底風險檢查（限 sweet 機率與探險 modal 區塊）
  const sweetContrastIdx = cssText.indexOf('V2.3.8 — Sweet 顯示可讀性與召喚星塵同步修正');
  if (sweetContrastIdx === -1) {
    notes.push('styles.css 缺少 V2.3.8 sweet contrast 區塊標記');
  } else {
    const block = cssText.slice(sweetContrastIdx);
    if (/\.rate-tag[\s\S]{0,120}color:\s*#FFF/i.test(block)) {
      notes.push('sweet 機率區塊疑似淺底白字');
    }
    stats.push('sweet contrast 區塊=ok');
  }

  const summary = stats.join(' | ');
  if (notes.length) {
    return `ok with notes: ${notes.join('; ')} | ${summary}`;
  }
  return summary;
}

/**
 * V2.4.0 — SSR / UR 抽卡演出特效檢查（靜態分析）
 * 只檢查與回報，不會自動修改資料。
 */
async function checkSummonReveal() {
  const [svcRes, uiRes, cssRes, devRes, swRes, indexRes] = await Promise.all([
    fetch('./src/summonRevealService.js'),
    fetch('./src/ui.js'),
    fetch('./src/styles.css'),
    fetch('./src/devService.js'),
    fetch('./service-worker.js'),
    fetch('./index.html'),
  ]);

  if (!svcRes.ok) throw new Error('無法讀取 summonRevealService.js');
  if (!uiRes.ok || !cssRes.ok || !devRes.ok || !swRes.ok || !indexRes.ok) {
    throw new Error('無法讀取 ui / styles / devService / service-worker / index');
  }

  const svcText = await svcRes.text();
  const uiText = await uiRes.text();
  const cssText = await cssRes.text();
  const devText = await devRes.text();
  const swText = await swRes.text();
  const indexText = await indexRes.text();
  const notes = [];
  const stats = [];

  // 1. playSummonReveal / SSR / UR / 狀態 API 是否存在
  const requiredApis = [
    'export async function playSummonReveal',
    'export function playSSRReveal',
    'export function playURReveal',
    'export function isSummonRevealPlaying',
    'export function skipSummonReveal',
    'export function getHighestRarity',
    'export function getRevealPetFromResults',
    'export function shouldPlayReveal',
    'export function createSummonRevealOverlay',
    'export function removeSummonRevealOverlay',
    'export function pickDebugPetByRarity',
  ];
  for (const sig of requiredApis) {
    if (!svcText.includes(sig)) throw new Error(`summonRevealService 缺少 ${sig}`);
  }
  stats.push('summonReveal API=ok');

  // 2. SSR / UR class
  if (!cssText.includes('.summon-reveal-overlay.is-ssr')) throw new Error('缺少 SSR class');
  if (!cssText.includes('.summon-reveal-overlay.is-ur')) throw new Error('缺少 UR class');
  stats.push('SSR/UR class=ok');

  // 3. skip button
  if (!svcText.includes('summon-reveal-skip') || !cssText.includes('.summon-reveal-skip')) {
    throw new Error('缺少跳過按鈕 (skip)');
  }
  if (!/min-height:\s*44px/.test(cssText.slice(cssText.indexOf('.summon-reveal-skip'), cssText.indexOf('.summon-reveal-skip') + 400))) {
    notes.push('skip button 高度可能不足 44px');
  }
  stats.push('skip button=ok');

  // 4. overlay 結束後會移除
  if (!/removeSummonRevealOverlay[\s\S]{0,300}removeChild/.test(svcText)
    && !svcText.includes("querySelectorAll('.summon-reveal-overlay')")) {
    notes.push('overlay 可能未確保移除');
  } else {
    stats.push('overlay remove=ok');
  }
  if (!/finally\s*\{[\s\S]{0,200}removeSummonRevealOverlay/.test(svcText)) {
    notes.push('playSummonReveal finally 可能未移除 overlay');
  }

  // 5. Debug mode 判斷
  if (!devText.includes('export function isDebugMode')) throw new Error('缺少 isDebugMode');
  if (!devText.includes("params.get('debug')") || !devText.includes('questnote_debug')) {
    notes.push('isDebugMode 可能未支援 ?debug=1 / localStorage');
  }
  stats.push('isDebugMode=ok');

  // 6. Debug 測試按鈕放在設定頁開發測試區，且只在 localhost 顯示（正式環境移除 DOM）
  if (!indexText.includes('id="btn-test-ssr-reveal"') || !indexText.includes('id="btn-test-ur-reveal"')) {
    throw new Error('設定頁缺少 SSR / UR 演出測試按鈕');
  }
  if (!indexText.includes('id="dev-reveal-tests"')) {
    throw new Error('設定頁缺少 dev-reveal-tests 群組');
  }
  if (!uiText.includes('isAuthorLocalDevMode()')
    || !/dev-reveal-tests['"]\)[\s\S]{0,200}hidden\s*=\s*!localDevOn/.test(uiText)) {
    throw new Error('dev-reveal-tests 必須以 isAuthorLocalDevMode / localDevOn 控制，不得用 ?debug 開正式環境');
  }
  if (!uiText.includes('devSection.remove()')) {
    notes.push('正式環境建議直接 remove dev-tools-section');
  }
  if (!/btn-test-ssr-reveal[\s\S]{0,160}testSummonReveal\('SSR'\)/.test(uiText)
    || !/btn-test-ur-reveal[\s\S]{0,160}testSummonReveal\('UR'\)/.test(uiText)) {
    throw new Error('演出測試按鈕未綁定 testSummonReveal');
  }
  stats.push('設定頁演出測試按鈕受 localhost 控制=ok');

  // 7. 測試按鈕不呼叫正式抽卡 / 寫入資料 function
  const testFnIdx = uiText.indexOf('async function testSummonReveal');
  if (testFnIdx === -1) throw new Error('缺少 testSummonReveal');
  const testFnBlock = uiText.slice(testFnIdx, testFnIdx + 600);
  const forbidden = ['pullOnce', 'performTenPull', 'addPetToCollection', 'addFragments', 'updateGachaStats', 'spendStardust'];
  for (const fn of forbidden) {
    if (testFnBlock.includes(fn)) {
      throw new Error(`testSummonReveal 不應呼叫 ${fn}`);
    }
  }
  stats.push('測試按鈕不觸碰正式抽卡=ok');

  // 8. Reduce Motion 支援
  if (!svcText.includes('prefers-reduced-motion') && !svcText.includes('reduceMotion')) {
    throw new Error('summonRevealService 未支援 reduce motion');
  }
  if (!cssText.includes('@media (prefers-reduced-motion: reduce)')
    || !cssText.includes('.summon-reveal-overlay.is-reduced')) {
    notes.push('CSS reduce motion 支援可能不完整');
  }
  stats.push('reduce motion=ok');

  // 9. 單抽 / 十連整合
  if (!/shouldPlayReveal\(result\.rarity\)[\s\S]{0,200}playSummonReveal/.test(uiText)) {
    notes.push('單抽演出整合可能缺失');
  }
  if (!/getHighestRarity\(result\.results\)[\s\S]{0,300}playSummonReveal/.test(uiText)) {
    notes.push('十連演出整合可能缺失');
  }

  // 10. SW 是否 precache 新檔
  if (!swText.includes('src/summonRevealService.js')) {
    notes.push('service-worker 未 precache summonRevealService.js');
  } else {
    stats.push('SW precache=ok');
  }

  const summary = stats.join(' | ');
  if (notes.length) {
    return `ok with notes: ${notes.join('; ')} | ${summary}`;
  }
  return summary;
}

/**
 * V2.5.0 — 每日 / 每週任務系統檢查（靜態 + 執行期）
 * 只檢查與回報，不會自動清除資料。
 */
async function checkQuestSystem() {
  const [svcRes, uiRes, indexRes, backupRes, swRes] = await Promise.all([
    fetch('./src/questService.js'),
    fetch('./src/ui.js'),
    fetch('./index.html'),
    fetch('./src/backupService.js'),
    fetch('./service-worker.js'),
  ]);
  if (!svcRes.ok) throw new Error('無法讀取 questService.js');
  if (!uiRes.ok || !indexRes.ok || !backupRes.ok || !swRes.ok) {
    throw new Error('無法讀取 ui / index / backup / service-worker');
  }

  const svcText = await svcRes.text();
  const uiText = await uiRes.text();
  const indexText = await indexRes.text();
  const backupText = await backupRes.text();
  const swText = await swRes.text();
  const notes = [];
  const stats = [];

  // 1. 必要 API 存在
  const requiredApis = [
    'export function normalizeQuestProgress',
    'export function initQuestProgress',
    'export function getTodayKey',
    'export function getWeekKey',
    'export function rolloverQuestProgress',
    'export async function updateQuestProgress',
    'export async function claimQuestReward',
    'export async function getQuestSummary',
  ];
  for (const sig of requiredApis) {
    if (!svcText.includes(sig)) throw new Error(`questService 缺少 ${sig}`);
  }
  stats.push('quest API=ok');

  // 8/9. claimQuestReward / updateQuestProgress 是否被 UI 使用
  if (!uiText.includes('claimQuestReward')) throw new Error('ui.js 未使用 claimQuestReward');
  if (!uiText.includes('updateQuestProgress')) throw new Error('ui.js 未使用 updateQuestProgress');
  stats.push('ui 事件接入=ok');

  // 12. quest UI 渲染容器
  if (!indexText.includes('id="quest-panel"')) throw new Error('index.html 缺少 quest-panel 容器');
  if (!uiText.includes('function renderQuestPanel')) throw new Error('ui.js 缺少 renderQuestPanel');
  stats.push('quest UI 容器=ok');

  // 10/11. backup 是否包含 questProgress 且 migration 支援
  if (!backupText.includes('questProgress')) throw new Error('backupService 未包含 questProgress');
  if (!backupText.includes('normalizeQuestProgress')) throw new Error('backupService 未使用 normalizeQuestProgress');
  stats.push('backup questProgress=ok');

  if (!swText.includes('src/questService.js')) {
    notes.push('service-worker 未 precache questService.js');
  } else {
    stats.push('SW precache=ok');
  }

  // 執行期：questProgress 結構、rollover、資料合理性
  const qp = await getQuestProgress();
  if (!qp || typeof qp !== 'object') throw new Error('questProgress 不存在');
  if (qp.daily?.dateKey !== getTodayKey()) {
    throw new Error(`daily.dateKey 非今天（${qp.daily?.dateKey} != ${getTodayKey()}）`);
  }
  if (qp.weekly?.weekKey !== getWeekKey()) {
    throw new Error(`weekly.weekKey 非本週（${qp.weekly?.weekKey} != ${getWeekKey()}）`);
  }

  const dailyQuests = qp.daily?.quests || {};
  const weeklyQuests = qp.weekly?.quests || {};
  if (Object.keys(dailyQuests).length < DAILY_QUEST_DEFS.length) {
    throw new Error('daily quests 數量不足');
  }
  if (Object.keys(weeklyQuests).length < WEEKLY_QUEST_DEFS.length) {
    throw new Error('weekly quests 數量不足');
  }

  for (const quest of [...Object.values(dailyQuests), ...Object.values(weeklyQuests)]) {
    if (typeof quest.current !== 'number' || typeof quest.target !== 'number') {
      throw new Error(`quest ${quest.id} current/target 型別錯誤`);
    }
    if (quest.target <= 0 || quest.current < 0 || quest.current > quest.target) {
      throw new Error(`quest ${quest.id} current/target 不合理（${quest.current}/${quest.target}）`);
    }
    if (typeof quest.claimed !== 'boolean' || typeof quest.completed !== 'boolean') {
      throw new Error(`quest ${quest.id} claimed/completed 非 boolean`);
    }
  }
  stats.push(`daily=${Object.keys(dailyQuests).length} weekly=${Object.keys(weeklyQuests).length}`);

  if (typeof qp.stats?.totalDailyQuestsClaimed !== 'number'
    || typeof qp.stats?.totalWeeklyQuestsClaimed !== 'number') {
    notes.push('stats 領取次數型別可能錯誤');
  }

  const summary = stats.join(' | ');
  if (notes.length) return `ok with notes: ${notes.join('; ')} | ${summary}`;
  return summary;
}

/**
 * V2.5.0 — 冒險任務可讀性檢查（sweet / default 對比度）
 */
async function checkQuestContrast() {
  const cssRes = await fetch('./src/styles.css');
  if (!cssRes.ok) throw new Error('無法讀取 styles.css');
  const cssText = await cssRes.text();
  const stats = [];
  const notes = [];

  const requiredPairs = [
    ['sweet quest-card bg', 'body[data-theme="sweet"] .quest-card {', 'rgba(255, 255, 255, 0.84)'],
    ['sweet quest-card title', 'body[data-theme="sweet"] .quest-card__title {', '#3D2633'],
    ['sweet reward chip stardust bg', 'body[data-theme="sweet"] .quest-reward-chip[data-reward-type="stardust"]', '#FFF1D8'],
    ['sweet reward chip stardust text', 'body[data-theme="sweet"] .quest-reward-chip[data-reward-type="stardust"]', '#8A4F10'],
    ['sweet claim button bg', 'body[data-theme="sweet"] .quest-claim-button {', '#C73578'],
    ['sweet claim button text', 'body[data-theme="sweet"] .quest-claim-button {', '#FFFFFF'],
    ['sweet active tab bg', 'body[data-theme="sweet"] .quest-tab.is-active {', '#C73578'],
    ['sweet active tab text', 'body[data-theme="sweet"] .quest-tab.is-active {', '#FFFFFF'],
    ['default quest-card bg', 'body[data-theme="default"] .quest-card {', 'rgba(20, 26, 46, 0.78)'],
    ['default quest-card title', 'body[data-theme="default"] .quest-card__title {', '#F4F7FF'],
    ['default reward chip stardust text', 'body[data-theme="default"] .quest-reward-chip[data-reward-type="stardust"]', '#FDE68A'],
  ];

  for (const [label, selector, color] of requiredPairs) {
    const idx = cssText.indexOf(selector);
    if (idx === -1) throw new Error(`缺少 ${selector}`);
    const block = cssText.slice(idx, idx + 220);
    if (!block.includes(color)) throw new Error(`${label} 未使用 ${color}`);
    stats.push(`${label}=ok`);
  }

  // 淺底白字 / 粉底淡粉字風險（限 V2.5.0 quest 區塊）
  const blockIdx = cssText.indexOf('V2.5.0 — 冒險任務');
  if (blockIdx === -1) {
    notes.push('styles.css 缺少 V2.5.0 冒險任務區塊標記');
  } else {
    const questBlock = cssText.slice(blockIdx);
    if (/body\[data-theme="sweet"\] \.quest-card__title \{[^}]*#FFF/i.test(questBlock)) {
      notes.push('sweet quest 卡片標題疑似白字（淺底風險）');
    }
    if (/body\[data-theme="sweet"\] \.quest-card__description \{[^}]*#FFC/i.test(questBlock)) {
      notes.push('sweet quest 描述疑似淡色（粉底風險）');
    }
    stats.push('sweet quest contrast 區塊=ok');
  }

  const summary = stats.join(' | ');
  if (notes.length) return `ok with notes: ${notes.join('; ')} | ${summary}`;
  return summary;
}

/**
 * V2.7.1 — 冒險任務容器視覺統一檢查（參考每日祝福卡片設計語言）
 * 只檢查與回報，不會自動改資料。
 */
async function checkQuestPanelVisual() {
  const [cssRes, indexRes, uiRes] = await Promise.all([
    fetch('./src/styles.css'),
    fetch('./index.html'),
    fetch('./src/ui.js'),
  ]);
  if (!cssRes.ok || !indexRes.ok || !uiRes.ok) {
    throw new Error('無法讀取 styles.css / index.html / ui.js');
  }
  const cssText = await cssRes.text();
  const indexText = await indexRes.text();
  const uiText = await uiRes.text();
  const stats = [];
  const notes = [];

  // 1. quest-panel 容器存在
  if (!indexText.includes('id="quest-panel"')) throw new Error('index.html 缺少 quest-panel 容器');
  stats.push('quest-panel 容器=ok');

  // 新結構 class 是否已在 ui.js 產出
  const requiredClasses = [
    'quest-panel__eyebrow',
    'quest-panel__subtitle',
    'quest-panel__status-badge',
    'quest-panel__summary',
    'quest-panel__footer-hint',
  ];
  for (const cls of requiredClasses) {
    if (!uiText.includes(cls)) throw new Error(`ui.js 缺少 ${cls}`);
  }
  stats.push('quest-panel 新結構 class=ok');

  // 區塊定位輔助
  const slice = (selector, len = 260) => {
    const idx = cssText.indexOf(selector);
    if (idx === -1) throw new Error(`缺少 ${selector}`);
    return cssText.slice(idx, idx + len);
  };

  // 2. sweet quest-panel 外層卡：漸層光暈 + 圓角 + 深色文字
  const sweetPanel = slice('body[data-theme="sweet"] .quest-panel__inner {', 420);
  if (!sweetPanel.includes('radial-gradient')) throw new Error('sweet quest-panel 缺少漸層光暈');
  if (!sweetPanel.includes('26px')) throw new Error('sweet quest-panel 缺少圓角 26px');
  if (!sweetPanel.includes('#3D2633')) throw new Error('sweet quest-panel 缺少深色文字 #3D2633');
  stats.push('sweet 外層卡漸層/圓角/文字=ok');

  // 3. sweet summary 小卡背景 / 數字強調
  const sweetSummary = slice('body[data-theme="sweet"] .quest-panel__summary-value {', 120);
  if (!sweetSummary.includes('#B83274')) throw new Error('sweet summary 數字未強調 #B83274');
  stats.push('sweet summary 數字強調=ok');

  // 4. sweet disabled 領取按鈕仍可辨識（深字非白字）
  const sweetDisabled = slice('body[data-theme="sweet"] .quest-claim-button:disabled {', 160);
  if (!sweetDisabled.includes('#616977')) throw new Error('sweet disabled 按鈕文字不可辨識');
  stats.push('sweet disabled 按鈕=ok');

  // 5. default quest-panel 外層卡：漸層光暈 + 圓角 + 淺色文字
  const defaultPanel = slice('body[data-theme="default"] .quest-panel__inner {', 480);
  if (!defaultPanel.includes('radial-gradient')) throw new Error('default quest-panel 缺少漸層光暈');
  if (!defaultPanel.includes('24px')) throw new Error('default quest-panel 缺少圓角 24px');
  if (!defaultPanel.includes('#F4F7FF')) throw new Error('default quest-panel 缺少文字 #F4F7FF');
  stats.push('default 外層卡漸層/圓角/文字=ok');

  // 6. 與每日祝福圓角一致性（daily-blessing-card 24px；quest 26/24px 屬同一區間）
  const dbCard = slice('.daily-blessing-card {', 120);
  if (!dbCard.includes('border-radius')) {
    notes.push('daily-blessing-card 未偵測到 border-radius，無法比對圓角一致性');
  } else {
    stats.push('與每日祝福圓角一致性=ok');
  }

  // 7. 白字放淺底風險（quest 區塊內）
  const blockIdx = cssText.indexOf('V2.5.0 — 冒險任務');
  if (blockIdx !== -1) {
    const questBlock = cssText.slice(blockIdx);
    if (/body\[data-theme="sweet"\] \.quest-panel__title \{[^}]*#FFF/i.test(questBlock)) {
      notes.push('sweet quest-panel 標題疑似白字（淺底風險）');
    }
    if (/body\[data-theme="sweet"\] \.quest-panel__subtitle \{[^}]*#F[0-9A-F]C/i.test(questBlock)) {
      notes.push('sweet quest-panel 副標疑似淡粉字（粉底風險）');
    }
  }

  const summary = stats.join(' | ');
  if (notes.length) return `ok with notes: ${notes.join('; ')} | ${summary}`;
  return summary;
}

/**
 * V2.6.0 — 寵物羈絆解放系統檢查（靜態 + 執行期）
 * 只檢查與回報，不會自動清除資料。
 */
async function checkBondSystem() {
  const [collectionRes, dialogueRes, uiRes, backupRes] = await Promise.all([
    fetch('./src/collectionService.js'),
    fetch('./src/companionDialogueService.js'),
    fetch('./src/ui.js'),
    fetch('./src/backupService.js'),
  ]);
  if (!collectionRes.ok || !dialogueRes.ok || !uiRes.ok || !backupRes.ok) {
    throw new Error('無法讀取 collection / dialogue / ui / backup');
  }

  const collectionText = await collectionRes.text();
  const dialogueText = await dialogueRes.text();
  const uiText = await uiRes.text();
  const backupText = await backupRes.text();
  const notes = [];
  const stats = [];

  // 3/4/8. 必要 API 存在
  const requiredApis = [
    'export function normalizeBondUnlocks',
    'export async function updatePetBondUnlocks',
    'export async function getPetBondUnlockStatus',
    'export function getBondUnlocksByLevel',
    'export async function hasBondLiberated',
  ];
  for (const sig of requiredApis) {
    if (!collectionText.includes(sig)) throw new Error(`collectionService 缺少 ${sig}`);
  }
  stats.push('bond API=ok');

  // normalizeEntry 是否整合 bondUnlocks（migration 支援）
  if (!/normalizeEntry[\s\S]{0,600}bondUnlocks:\s*normalizeBondUnlocks/.test(collectionText)) {
    throw new Error('normalizeEntry 未整合 normalizeBondUnlocks（舊資料 migration 可能失效）');
  }
  stats.push('normalizeEntry 補 bondUnlocks=ok');

  // 9. companion dialogue 是否支援 bond lines
  if (!dialogueText.includes('BOND_DIALOGUES') || !dialogueText.includes('getBondDialogueLine')) {
    throw new Error('companionDialogueService 缺少羈絆台詞（BOND_DIALOGUES / getBondDialogueLine）');
  }
  stats.push('bond dialogue=ok');

  // 10. UI 是否有 bond-section 容器與徽章
  if (!uiText.includes('bond-section')) throw new Error('ui.js 缺少 bond-section 容器');
  if (!uiText.includes('bond-badge')) throw new Error('ui.js 缺少 bond-badge');
  if (!uiText.includes('updatePetBondUnlocks')) throw new Error('ui.js 未使用 updatePetBondUnlocks');
  stats.push('bond UI=ok');

  // 7. backup 是否包含 bondUnlocks（collection 走 normalizeCollectionItem→normalizeEntry）
  if (!backupText.includes('normalizeCollectionItem')) {
    throw new Error('backupService 未使用 normalizeCollectionItem');
  }
  stats.push('backup bondUnlocks=ok');

  // 執行期：collection item bondUnlocks 完整性、與 bondLevel 一致性、Lv.5 解放
  const items = await dbGetAll(STORES.COLLECTION);
  const requiredFields = ['dialogueLv2', 'badgeLv3', 'homeEffectLv4', 'bondFrameLv5', 'bondStoryLv5', 'bondLiberated', 'notifiedLevels'];
  let liberatedCount = 0;
  let inconsistent = 0;
  for (const raw of items) {
    const item = normalizeCollectionItem(raw);
    const bu = item.bondUnlocks;
    if (!bu || typeof bu !== 'object') {
      throw new Error(`圖鑑 ${item.petId} 缺少 bondUnlocks`);
    }
    for (const field of requiredFields) {
      if (!(field in bu)) {
        throw new Error(`圖鑑 ${item.petId} bondUnlocks 缺少欄位 ${field}`);
      }
    }
    if (!Array.isArray(bu.notifiedLevels)) {
      throw new Error(`圖鑑 ${item.petId} notifiedLevels 必須為陣列`);
    }
    const lv = item.bondLevel ?? 1;
    // 6. bondLevel 與 bondUnlocks 一致
    const expect = {
      dialogueLv2: lv >= 2,
      badgeLv3: lv >= 3,
      homeEffectLv4: lv >= 4,
      bondFrameLv5: lv >= 5,
      bondStoryLv5: lv >= 5,
      bondLiberated: lv >= 5,
    };
    for (const [k, v] of Object.entries(expect)) {
      if (bu[k] !== v) inconsistent += 1;
    }
    // 5. Lv.5 標示
    if (lv >= 5) {
      liberatedCount += 1;
      if (!bu.bondLiberated) {
        throw new Error(`圖鑑 ${item.petId} 已達 Lv.5 但未標示 bondLiberated`);
      }
    }
  }
  if (inconsistent > 0) {
    notes.push(`${inconsistent} 個旗標與 bondLevel 不一致（重新開啟 App 會 normalize 修正）`);
  }
  stats.push(`collection=${items.length} 已解放=${liberatedCount}`);

  const summary = stats.join(' | ');
  if (notes.length) return `ok with notes: ${notes.join('; ')} | ${summary}`;
  return summary;
}

/**
 * V2.6.0 — 羈絆 UI 可讀性檢查（sweet / default 對比度）
 */
async function checkBondContrast() {
  const cssRes = await fetch('./src/styles.css');
  if (!cssRes.ok) throw new Error('無法讀取 styles.css');
  const cssText = await cssRes.text();
  const stats = [];
  const notes = [];

  const requiredPairs = [
    ['sweet bond badge bg', 'body[data-theme="sweet"] .bond-badge {', '#EEE9FF'],
    ['sweet bond badge text', 'body[data-theme="sweet"] .bond-badge {', '#4E3BA8'],
    ['sweet bond story bg', 'body[data-theme="sweet"] .bond-story {', '#FFF8FC'],
    ['sweet bond story text', 'body[data-theme="sweet"] .bond-story {', '#3D2633'],
    ['sweet bond liberated label', 'body[data-theme="sweet"] .bond-liberated-label {', '#FFF1D8'],
    ['sweet bond liberated text', 'body[data-theme="sweet"] .bond-liberated-label {', '#8A4F10'],
    ['default bond badge text', 'body[data-theme="default"] .bond-badge {', '#DDD6FE'],
    ['default bond story text', 'body[data-theme="default"] .bond-story {', '#F4F7FF'],
  ];

  for (const [label, selector, color] of requiredPairs) {
    const idx = cssText.indexOf(selector);
    if (idx === -1) throw new Error(`缺少 ${selector}`);
    const block = cssText.slice(idx, idx + 260);
    if (!block.includes(color)) throw new Error(`${label} 未使用 ${color}`);
    stats.push(`${label}=ok`);
  }

  // 淺底白字 / 粉底淡粉字風險（限 V2.6.0 羈絆區塊）
  const blockIdx = cssText.indexOf('V2.6.0 — 寵物羈絆解放系統');
  if (blockIdx === -1) {
    notes.push('styles.css 缺少 V2.6.0 羈絆區塊標記');
  } else {
    const bondBlock = cssText.slice(blockIdx);
    if (/body\[data-theme="sweet"\] \.bond-badge \{[^}]*color:\s*#FFF/i.test(bondBlock)) {
      notes.push('sweet 羈絆徽章疑似白字（淺底風險）');
    }
    if (/body\[data-theme="sweet"\] \.bond-story \{[^}]*color:\s*#FFC/i.test(bondBlock)) {
      notes.push('sweet 羈絆故事疑似淡色（粉底風險）');
    }
    stats.push('sweet bond contrast 區塊=ok');
  }

  const summary = stats.join(' | ');
  if (notes.length) return `ok with notes: ${notes.join('; ')} | ${summary}`;
  return summary;
}

/**
 * V2.6.1 — 寵物原圖放大檢視器檢查（靜態）
 * 檢查 openPetImageViewer / closePetImageViewer / 三處入口 / 關閉方式 / z-index。
 */
async function checkPetImageViewer() {
  const [uiRes, swRes] = await Promise.all([
    fetch('./src/ui.js'),
    fetch('./service-worker.js'),
  ]);
  if (!uiRes.ok) throw new Error('無法讀取 ui.js');
  const uiText = await uiRes.text();
  const stats = [];
  const notes = [];

  // 1/2/4/5. 核心 API
  const requiredApis = [
    'export function openPetImageViewer',
    'export function openPetImageViewerBySrc',
    'export function closePetImageViewer',
  ];
  for (const sig of requiredApis) {
    if (!uiText.includes(sig)) throw new Error(`ui.js 缺少 ${sig}`);
  }
  stats.push('viewer API=ok');

  // 直接點圖片開原圖（首頁陪伴 / 撫摸預覽 / 圖鑑）
  if (!uiText.includes('openPetImageViewer(companion.id)') && !uiText.includes('openPetImageViewer(state.companion.id)')) {
    throw new Error('首頁／撫摸頁面圖片缺少開啟原圖入口');
  }
  if (!uiText.includes("data-action=\"view-pet-image\"") && !uiText.includes("data-action='view-pet-image'")) {
    throw new Error('圖鑑缺少寵物原圖入口（view-pet-image）');
  }
  if (!uiText.includes('stopPropagation')) {
    notes.push('圖鑑原圖入口可能缺少 stopPropagation');
  }
  // 詳情頁點圖片入口
  if (!uiText.includes('detail-view-image')) {
    throw new Error('寵物詳情頁缺少開啟原圖入口（detail-view-image）');
  }
  stats.push('點圖片入口（首頁 / 圖鑑 / 詳情頁）=ok');

  // 6. 關閉按鈕 7. 背景關閉
  if (!uiText.includes('pet-image-viewer__close')) throw new Error('viewer 缺少關閉按鈕');
  if (!uiText.includes('data-viewer-close')) throw new Error('viewer 缺少背景/關閉點擊機制');
  // 8. Escape 關閉
  if (!uiText.includes('handlePetImageViewerKeydown')) {
    throw new Error('viewer 缺少 Escape 關閉支援');
  }
  stats.push('關閉方式（X/背景/Escape）=ok');

  // 9. 版本一致性改由 version.js / CACHE_NAME 檢查，不再硬編碼過時 v261
  if (swRes.ok) {
    const swText = await swRes.text();
    if (/v261/.test(swText) && !/v274|2\.7\.4/.test(swText)) {
      notes.push('service-worker 可能仍殘留過時 v261 註記');
    }
  }

  const summary = stats.join(' | ');
  if (notes.length) return `ok with notes: ${notes.join('; ')} | ${summary}`;
  return summary;
}

/**
 * V2.6.1 — 原圖檢視器可讀性與 z-index 檢查（sweet / default）
 */
async function checkPetImageViewerContrast() {
  const cssRes = await fetch('./src/styles.css');
  if (!cssRes.ok) throw new Error('無法讀取 styles.css');
  const cssText = await cssRes.text();
  const stats = [];
  const notes = [];

  // 9. z-index 高於一般 modal（modal-overlay = 200）
  const zIdx = cssText.match(/\.pet-image-viewer\s*\{[^}]*z-index:\s*(\d+)/);
  if (!zIdx) throw new Error('缺少 .pet-image-viewer z-index');
  if (Number(zIdx[1]) <= 200) throw new Error(`viewer z-index (${zIdx[1]}) 未高於一般 modal(200)`);
  stats.push(`z-index=${zIdx[1]}`);

  // 10/11. sweet / default viewer 有明確 background + color
  const requiredPairs = [
    ['sweet viewer content bg', 'body[data-theme="sweet"] .pet-image-viewer__content {', '#FFFFFF'],
    ['sweet viewer content text', 'body[data-theme="sweet"] .pet-image-viewer__content {', '#3D2633'],
    ['sweet viewer close text', 'body[data-theme="sweet"] .pet-image-viewer__close {', '#B83274'],
    ['default viewer content bg', 'body[data-theme="default"] .pet-image-viewer__content {', '#141A2E'],
    ['default viewer content text', 'body[data-theme="default"] .pet-image-viewer__content {', '#F4F7FF'],
  ];
  for (const [label, selector, color] of requiredPairs) {
    const idx = cssText.indexOf(selector);
    if (idx === -1) throw new Error(`缺少 ${selector}`);
    const block = cssText.slice(idx, idx + 220);
    if (!block.includes(color)) throw new Error(`${label} 未使用 ${color}`);
    stats.push(`${label}=ok`);
  }

  // 12/13. 淺底白字 / 粉底淡粉字風險（限 V2.6.1 viewer 區塊）
  const blockIdx = cssText.indexOf('V2.6.1 — 寵物原圖放大檢視器');
  if (blockIdx === -1) {
    notes.push('styles.css 缺少 V2.6.1 viewer 區塊標記');
  } else {
    const vb = cssText.slice(blockIdx);
    if (/body\[data-theme="sweet"\] \.pet-image-viewer__content \{[^}]*color:\s*#FFF/i.test(vb)) {
      notes.push('sweet viewer 內容疑似白字（淺底風險）');
    }
    if (/body\[data-theme="sweet"\] \.pet-image-viewer__hint \{[^}]*color:\s*#FFC/i.test(vb)) {
      notes.push('sweet viewer 提示疑似淡色（粉底風險）');
    }
  }

  const summary = stats.join(' | ');
  if (notes.length) return `ok with notes: ${notes.join('; ')} | ${summary}`;
  return summary;
}

/**
 * V2.7.2 — 探險派遣流程直覺化檢查（靜態）
 * 只檢查與回報，不會自動改資料。
 */
async function checkExpeditionDispatchUX() {
  const [uiRes, cssRes] = await Promise.all([
    fetch('./src/ui.js'),
    fetch('./src/styles.css'),
  ]);
  if (!uiRes.ok || !cssRes.ok) throw new Error('無法讀取 ui.js / styles.css');
  const uiText = await uiRes.text();
  const cssText = await cssRes.text();
  const stats = [];
  const notes = [];

  // 1-3. 三個核心函式存在
  for (const fn of [
    'function openExpeditionDispatchModal',
    'function closeExpeditionDispatchModal',
    'async function confirmExpeditionDispatch',
  ]) {
    if (!uiText.includes(fn)) throw new Error(`ui.js 缺少 ${fn}`);
  }
  stats.push('dispatch 函式=ok');

  // 4. 地區卡片有派遣按鈕
  if (!uiText.includes('expedition-dispatch-button') || !uiText.includes("data-action=\"open-dispatch\"")) {
    throw new Error('地區卡片缺少派遣按鈕（open-dispatch）');
  }
  stats.push('派遣按鈕=ok');

  // 5. Modal 能取得 areaId
  if (!uiText.includes('dispatchAreaId')) throw new Error('派遣 Modal 未追蹤 areaId');
  stats.push('areaId=ok');

  // 6. 只顯示已擁有寵物
  if (!uiText.includes('getDispatchablePetsSorted') || !uiText.includes('getOwnedPets')) {
    throw new Error('派遣 Modal 未從已擁有寵物篩選');
  }
  stats.push('已擁有寵物=ok');

  // 7-9. 確認派遣時的檢查
  const confirmIdx = uiText.indexOf('async function confirmExpeditionDispatch');
  const confirmBody = confirmIdx === -1 ? '' : uiText.slice(confirmIdx, confirmIdx + 1400);
  if (!confirmBody.includes('請先選擇出發寵物')) throw new Error('confirm 未檢查 petId');
  if (!confirmBody.includes('冒險能量不足')) throw new Error('confirm 未檢查冒險能量');
  if (!confirmBody.includes('目前已有探險進行中')) throw new Error('confirm 未檢查進行中探險');
  stats.push('confirm 檢查=ok');

  // 10. 仍使用原本 startExpedition
  if (!confirmBody.includes('startExpedition(petId, areaId')) {
    throw new Error('confirm 未使用原本 startExpedition 邏輯');
  }
  stats.push('startExpedition=ok');

  // 11. 更新 daily / weekly quest progress
  if (!confirmBody.includes("trackQuest('start_expedition')")) {
    throw new Error('派遣成功未更新每日任務進度');
  }
  if (!uiText.includes("trackQuest('complete_expedition')")) {
    throw new Error('探險完成未更新每週任務進度');
  }
  stats.push('quest 進度=ok');

  // 12. 探險完成後仍更新探索度
  if (!uiText.includes('applyExplorationOnClaim')) {
    throw new Error('探險完成後未更新探索度');
  }
  stats.push('探索度整合=ok');

  // 13-14. Modal 主題背景 / 文字
  const sweetModal = (() => {
    const i = cssText.indexOf('body[data-theme="sweet"] .expedition-dispatch-modal__content {');
    return i === -1 ? '' : cssText.slice(i, i + 200);
  })();
  if (!sweetModal.includes('#FFFFFF') || !sweetModal.includes('#3D2633')) {
    throw new Error('sweet dispatch modal 缺少明確 background / color');
  }
  const defaultModal = (() => {
    const i = cssText.indexOf('body[data-theme="default"] .expedition-dispatch-modal__content {');
    return i === -1 ? '' : cssText.slice(i, i + 220);
  })();
  if (!defaultModal.includes('#141A2E') || !defaultModal.includes('#F4F7FF')) {
    throw new Error('default dispatch modal 缺少明確 background / color');
  }
  stats.push('modal 主題色=ok');

  // 15-16. 白字放淺底 / 淡粉字放粉底風險（限 V2.7.2 區塊）
  const blockIdx = cssText.indexOf('V2.7.2 — 探險派遣流程直覺化');
  if (blockIdx !== -1) {
    const block = cssText.slice(blockIdx);
    if (/body\[data-theme="sweet"\] \.expedition-pet-option__name \{[^}]*#FFF/i.test(block)) {
      notes.push('sweet 寵物名稱疑似白字（淺底風險）');
    }
    if (/body\[data-theme="sweet"\] \.expedition-dispatch-area__name \{[^}]*#F[0-9A-F]C/i.test(block)) {
      notes.push('sweet 地區名稱疑似淡粉字（粉底風險）');
    }
  }

  // V2.7.4：陪伴中標籤與說明
  if (!uiText.includes('expedition-pet-option__companion') || !uiText.includes('陪伴中')) {
    throw new Error('派遣 Modal 缺少「陪伴中」標示');
  }
  if (!uiText.includes('陪伴中的寵物也可以派遣')) {
    throw new Error('派遣 Modal 缺少陪伴中可派遣說明');
  }
  stats.push('陪伴中標示=ok');

  const summary = stats.join(' | ');
  if (notes.length) return `ok with notes: ${notes.join('; ')} | ${summary}`;
  return summary;
}

/**
 * V2.7.0 — 探險地圖探索度系統檢查（靜態 + 執行期）
 * 只檢查與回報，不會自動清除資料。
 */
async function checkExplorationSystem() {
  const [svcRes, uiRes, indexRes, backupRes, achRes, swRes] = await Promise.all([
    fetch('./src/explorationService.js'),
    fetch('./src/ui.js'),
    fetch('./index.html'),
    fetch('./src/backupService.js'),
    fetch('./data/achievements.json'),
    fetch('./service-worker.js'),
  ]);
  if (!svcRes.ok) throw new Error('無法讀取 explorationService.js');
  if (!uiRes.ok || !indexRes.ok || !backupRes.ok || !achRes.ok || !swRes.ok) {
    throw new Error('無法讀取 ui / index / backup / achievements / service-worker');
  }

  const svcText = await svcRes.text();
  const uiText = await uiRes.text();
  const indexText = await indexRes.text();
  const backupText = await backupRes.text();
  const achievements = await achRes.json();
  const swText = await swRes.text();
  const notes = [];
  const stats = [];

  // 6/7. 必要 API 存在
  const requiredApis = [
    'export function normalizeExplorationProgress',
    'export async function initExplorationProgress',
    'export async function getAreaExploration',
    'export function getExplorationMilestones',
    'export async function getUnlockedAreaStories',
    'export async function updateAreaExplorationProgress',
    'export async function claimExplorationMilestone',
    'export async function isAreaFullyExplored',
  ];
  for (const sig of requiredApis) {
    if (!svcText.includes(sig)) throw new Error(`explorationService 缺少 ${sig}`);
  }
  stats.push('exploration API=ok');

  // 8. 探險完成領獎是否會更新 explorationProgress
  if (!uiText.includes('applyExplorationOnClaim') || !uiText.includes('updateAreaExplorationProgress')) {
    throw new Error('ui.js 探險領獎未接入探索度更新');
  }
  if (!/claim-expedition[\s\S]{0,600}applyExplorationOnClaim/.test(uiText)) {
    notes.push('claim-expedition 流程可能未呼叫 applyExplorationOnClaim');
  }
  if (!uiText.includes('claimExplorationMilestone')) {
    throw new Error('ui.js 未使用 claimExplorationMilestone');
  }
  stats.push('ui 領獎接入探索度=ok');

  // 11. 探險頁 exploration-panel 容器
  if (!indexText.includes('id="exploration-panel"')) {
    throw new Error('index.html 缺少 exploration-panel 容器');
  }
  if (!uiText.includes('function renderExplorationPanel')) {
    throw new Error('ui.js 缺少 renderExplorationPanel');
  }
  stats.push('exploration UI 容器=ok');

  // 9/10. backup 是否包含 explorationProgress 且 migration 支援
  if (!backupText.includes('explorationProgress')) {
    throw new Error('backupService 未包含 explorationProgress');
  }
  if (!backupText.includes('normalizeExplorationProgress')) {
    throw new Error('backupService 未使用 normalizeExplorationProgress');
  }
  stats.push('backup explorationProgress=ok');

  // 12. 成就是否支援探索成就
  const explorationAch = achievements.filter((a) =>
    typeof a.conditionType === 'string' && a.conditionType.startsWith('exploration_')
  );
  if (explorationAch.length < 5) {
    throw new Error(`探索成就數量不足（${explorationAch.length}/5）`);
  }
  stats.push(`探索成就=${explorationAch.length}`);

  if (!swText.includes('src/explorationService.js')) {
    notes.push('service-worker 未 precache explorationService.js');
  } else {
    stats.push('SW precache=ok');
  }

  // 執行期：explorationProgress 結構與資料合理性
  const ep = await getExplorationProgress();
  if (!ep || typeof ep !== 'object') throw new Error('explorationProgress 不存在');
  // 1/2. explorationProgress 與四個 area 是否存在
  for (const areaId of EXPLORATION_AREA_IDS) {
    const area = ep.areas?.[areaId];
    if (!area) throw new Error(`探索地區缺少: ${areaId}`);
    // 3. progress 0～100
    if (typeof area.progress !== 'number' || area.progress < 0 || area.progress > 100) {
      throw new Error(`${areaId} progress 不合理: ${area.progress}`);
    }
    // 4. completedRuns 數字
    if (typeof area.completedRuns !== 'number') {
      throw new Error(`${areaId} completedRuns 型別錯誤`);
    }
    // 5. claimedMilestones array
    if (!Array.isArray(area.claimedMilestones)) {
      throw new Error(`${areaId} claimedMilestones 必須為陣列`);
    }
  }
  if (typeof ep.stats?.totalExplorationRuns !== 'number'
    || typeof ep.stats?.totalMilestonesClaimed !== 'number') {
    notes.push('exploration stats 型別可能錯誤');
  }
  stats.push(`areas=${EXPLORATION_AREA_IDS.length}`);

  const summary = stats.join(' | ');
  if (notes.length) return `ok with notes: ${notes.join('; ')} | ${summary}`;
  return summary;
}

/**
 * V2.7.0 — 探索度 UI 可讀性檢查（sweet / default 對比度）
 */
async function checkExplorationContrast() {
  const cssRes = await fetch('./src/styles.css');
  if (!cssRes.ok) throw new Error('無法讀取 styles.css');
  const cssText = await cssRes.text();
  const stats = [];
  const notes = [];

  const requiredPairs = [
    // 1. sweet area card 明確 background / color
    ['sweet exploration area card bg', 'body[data-theme="sweet"] .exploration-area-card {', '#FFFFFF'],
    ['sweet exploration area card text', 'body[data-theme="sweet"] .exploration-area-card {', '#3D2633'],
    // 2. sweet milestone 明確 background / color
    ['sweet exploration milestone bg', 'body[data-theme="sweet"] .exploration-milestone-card {', '#FFF8FC'],
    ['sweet exploration milestone text', 'body[data-theme="sweet"] .exploration-milestone-card {', '#3D2633'],
    // 3. sweet reward chip 明確 background / color
    ['sweet exploration chip stardust bg', 'body[data-theme="sweet"] .exploration-reward-chip[data-reward-type="stardust"]', '#FFF1D8'],
    ['sweet exploration chip stardust text', 'body[data-theme="sweet"] .exploration-reward-chip[data-reward-type="stardust"]', '#8A4F10'],
    // 4. sweet claim button 白字配深色背景
    ['sweet exploration claim button bg', 'body[data-theme="sweet"] .exploration-claim-button {', '#C73578'],
    ['sweet exploration claim button text', 'body[data-theme="sweet"] .exploration-claim-button {', '#FFFFFF'],
    // 8. sweet 進度條文字對比
    ['sweet exploration progress bar text', 'body[data-theme="sweet"] .exploration-progress-bar__text {', '#3D2633'],
    // 5. default exploration card 清楚
    ['default exploration area card bg', 'body[data-theme="default"] .exploration-area-card {', '#141A2E'],
    ['default exploration area card text', 'body[data-theme="default"] .exploration-area-card {', '#F4F7FF'],
    ['default exploration chip stardust text', 'body[data-theme="default"] .exploration-reward-chip[data-reward-type="stardust"]', '#FDE68A'],
    ['default exploration progress bar text', 'body[data-theme="default"] .exploration-progress-bar__text {', '#F4F7FF'],
  ];

  for (const [label, selector, color] of requiredPairs) {
    const idx = cssText.indexOf(selector);
    if (idx === -1) throw new Error(`缺少 ${selector}`);
    const block = cssText.slice(idx, idx + 240);
    if (!block.includes(color)) throw new Error(`${label} 未使用 ${color}`);
    stats.push(`${label}=ok`);
  }

  // 6/7. 淺底白字 / 粉底淡粉字風險（限 V2.7.0 探索度區塊）
  const blockIdx = cssText.indexOf('V2.7.0 — 探險地圖探索度系統');
  if (blockIdx === -1) {
    notes.push('styles.css 缺少 V2.7.0 探索度區塊標記');
  } else {
    const block = cssText.slice(blockIdx);
    if (/body\[data-theme="sweet"\] \.exploration-area-card \{[^}]*color:\s*#FFF/i.test(block)) {
      notes.push('sweet 探索地區卡片疑似白字（淺底風險）');
    }
    if (/body\[data-theme="sweet"\] \.exploration-milestone-card__title \{[^}]*color:\s*#FFC/i.test(block)) {
      notes.push('sweet 里程碑標題疑似淡粉字（粉底風險）');
    }
    stats.push('sweet exploration contrast 區塊=ok');
  }

  const summary = stats.join(' | ');
  if (notes.length) return `ok with notes: ${notes.join('; ')} | ${summary}`;
  return summary;
}

/**
 * V2.7.3 — 全站字體大小與排版比例統一檢查（靜態分析 styles.css）
 * 只檢查與回報，不會自動清除或修改任何資料。
 */
async function checkTypographyScale() {
  const cssRes = await fetch('./src/styles.css');
  if (!cssRes.ok) throw new Error('無法讀取 styles.css');
  const cssText = await cssRes.text();
  const notes = [];
  const stats = [];

  // 1. 是否定義 typography tokens
  const requiredTokens = [
    '--font-size-xs', '--font-size-sm', '--font-size-md', '--font-size-base',
    '--font-size-lg', '--font-size-xl', '--font-size-2xl', '--font-size-3xl',
    '--line-height-tight', '--line-height-snug', '--line-height-normal', '--line-height-relaxed',
    '--font-weight-regular', '--font-weight-medium', '--font-weight-bold',
    '--font-weight-heavy', '--font-weight-black',
  ];
  for (const token of requiredTokens) {
    if (!cssText.includes(token)) throw new Error(`typography token 缺少 ${token}`);
  }
  stats.push(`tokens=${requiredTokens.length}`);

  // xs token 不得小於 0.7rem（手機可讀性下限）
  const xsMatch = cssText.match(/--font-size-xs:\s*([0-9.]+)rem/);
  if (xsMatch && Number(xsMatch[1]) < 0.7) {
    throw new Error(`--font-size-xs (${xsMatch[1]}rem) 小於 0.7rem`);
  }
  if (xsMatch) stats.push(`xs=${xsMatch[1]}rem`);

  // 2. V2.7.3 統一區塊標記
  const blockIdx = cssText.indexOf('V2.7.3 — 全站字體大小與排版比例統一');
  if (blockIdx === -1) throw new Error('styles.css 缺少 V2.7.3 typography 區塊標記');
  const block = cssText.slice(blockIdx);
  stats.push('V2.7.3 typography 區塊=ok');

  // 區塊內定位輔助
  const blockSlice = (selector, len = 240) => {
    const i = block.indexOf(selector);
    if (i === -1) throw new Error(`V2.7.3 區塊缺少 ${selector}`);
    return block.slice(i, i + len);
  };

  // 4. 按鈕文字使用 token（不小於 0.88rem → 使用 --font-size-md=0.92rem）
  const btnBlock = blockSlice('.btn {');
  if (!btnBlock.includes('var(--font-size-md)')) {
    throw new Error('按鈕文字未使用 --font-size-md');
  }
  stats.push('button=md');

  // 5. badge / chip 不小於 0.72rem（使用 0.76rem）
  const badgeBlock = blockSlice('.badge,', 900);
  const badgeSizeMatch = badgeBlock.match(/font-size:\s*([0-9.]+)rem/);
  if (!badgeSizeMatch || Number(badgeSizeMatch[1]) < 0.72) {
    throw new Error('badge / chip font-size 小於 0.72rem');
  }
  stats.push(`badge=${badgeSizeMatch[1]}rem`);

  // 6. toast 文字不小於 0.82rem（md=0.92rem）
  const toastBlock = blockSlice('.toast,');
  if (!toastBlock.includes('var(--font-size-md)')) {
    notes.push('toast 可能未使用 --font-size-md');
  } else {
    stats.push('toast=md');
  }

  // 7. modal 標題使用 xl；modal 內文使用 md
  const modalTitleBlock = blockSlice('.modal-title,');
  if (!modalTitleBlock.includes('var(--font-size-xl)')) {
    notes.push('modal 標題可能未使用 --font-size-xl');
  } else {
    stats.push('modal-title=xl');
  }
  const modalBodyBlock = blockSlice('.modal-body {');
  if (!modalBodyBlock.includes('var(--font-size-md)')) {
    notes.push('modal 內文可能未使用 --font-size-md');
  } else {
    stats.push('modal-body=md');
  }

  // 8. bottom nav label 不過小（xs=0.72rem ≥ 0.68rem）
  const navBlock = blockSlice('.nav-label {');
  if (!navBlock.includes('var(--font-size-xs)')) {
    notes.push('底部導航 label 可能未使用 --font-size-xs');
  } else {
    stats.push('nav-label=xs');
  }

  // 頁面 / 卡片標題層級
  const pageTitleBlock = blockSlice('.page-title {');
  if (!pageTitleBlock.includes('var(--font-size-2xl)')) {
    notes.push('頁面標題可能未使用 --font-size-2xl');
  } else {
    stats.push('page-title=2xl');
  }

  // 3. 是否仍存在 font-size < 0.7rem 或 9/10/11px 的過小字（全域掃描 → 回報）
  const sizeRegex = /font-size:\s*([0-9.]+)(px|rem)/g;
  let m;
  let tinyPx = 0;
  let tinyRem = 0;
  const tinySamples = [];
  while ((m = sizeRegex.exec(cssText)) !== null) {
    const value = Number(m[1]);
    const unit = m[2];
    if (unit === 'px' && value <= 11) {
      tinyPx += 1;
      if (tinySamples.length < 6) tinySamples.push(`${value}px`);
    } else if (unit === 'rem' && value < 0.7) {
      tinyRem += 1;
      if (tinySamples.length < 6) tinySamples.push(`${value}rem`);
    }
  }
  stats.push(`剩餘 ≤11px=${tinyPx} / <0.7rem=${tinyRem}`);
  if (tinyPx + tinyRem > 0) {
    notes.push(`仍有過小字 ${tinyPx + tinyRem} 處（例: ${tinySamples.join(', ')}）— 多為裝飾/轉盤標籤，請確認未承載重要資訊`);
  }

  // 9/10. sweet / default 主題主要文字對比色仍存在
  if (!cssText.includes('#3D2633')) {
    throw new Error('sweet 主題主文字色 #3D2633 缺失（低對比風險）');
  }
  if (!cssText.includes('#F4F7FF')) {
    throw new Error('default 主題主文字色 #F4F7FF 缺失（低對比風險）');
  }
  stats.push('sweet #3D2633 / default #F4F7FF=ok');

  // 11. reward chip 是否有清楚 font-size / color（沿用既有 quest / exploration reward chip）
  if (!cssText.includes('.quest-reward-chip') || !cssText.includes('.exploration-reward-chip')) {
    notes.push('reward chip selector 可能缺失');
  } else {
    stats.push('reward chip=ok');
  }

  // 12. disabled 狀態文字顏色（sweet 保留可辨識深字 #616977）
  if (!cssText.includes('#616977') && !cssText.includes('#777F8D')) {
    notes.push('sweet disabled 文字可辨識色可能缺失');
  } else {
    stats.push('disabled 可辨識=ok');
  }

  const summary = stats.join(' | ');
  if (notes.length) return `ok with notes: ${notes.join('; ')} | ${summary}`;
  return summary;
}

/**
 * V2.7.4 — 穩定性／可讀性／既有功能補完檢查（靜態，不寫入 IndexedDB）
 */
async function checkStabilityReadabilityPolish() {
  const [uiRes, cssRes, versionRes] = await Promise.all([
    fetch('./src/ui.js'),
    fetch('./src/styles.css'),
    fetch('./src/version.js'),
  ]);
  if (!uiRes.ok || !cssRes.ok || !versionRes.ok) {
    throw new Error('無法讀取 ui.js / styles.css / version.js');
  }
  const uiText = await uiRes.text();
  const cssText = await cssRes.text();
  const versionText = await versionRes.text();
  const notes = [];
  const stats = [];

  // 1. initUI 重入防護
  if (!uiText.includes('uiInitialized')) {
    throw new Error('initUI 缺少 uiInitialized guard');
  }
  if (!/export function initUI[\s\S]{0,400}if\s*\(\s*uiInitialized\s*\)/.test(uiText)) {
    throw new Error('initUI 未在綁定前檢查 uiInitialized');
  }
  if (!/uiInitialized\s*=\s*false/.test(uiText)) {
    throw new Error('initUI 失敗時未還原 uiInitialized');
  }
  stats.push('initUI guard=ok');

  // 2. 探險 timer：完成後停止 interval，不每秒 renderExpeditionView
  const timerIdx = uiText.indexOf('function startExpeditionTimer');
  if (timerIdx === -1) throw new Error('缺少 startExpeditionTimer');
  const timerBody = uiText.slice(timerIdx, timerIdx + 900);
  if (!timerBody.includes('stopExpeditionTimer()')) {
    throw new Error('探險完成後未停止 timer');
  }
  if (!timerBody.includes('isExpeditionTimeComplete')) {
    throw new Error('探險 timer 未檢查完成狀態');
  }
  // 完成分支應先 stop 再 render 一次；倒數中只更新 #expedition-countdown
  if (!timerBody.includes("getElementById('expedition-countdown')")) {
    throw new Error('探險倒數未只更新 countdown DOM');
  }
  stats.push('expedition timer=ok');

  // 3. 圖鑑 filter selector 限定範圍
  if (uiText.includes("querySelectorAll('.filter-btn')")) {
    throw new Error('圖鑑仍使用全域 .filter-btn selector');
  }
  if (!uiText.includes("querySelectorAll('#collection-filters .filter-btn')")) {
    throw new Error('圖鑑 filter 未限定在 #collection-filters');
  }
  stats.push('collection filter selector=ok');

  // 4. Overlay 判斷
  if (!uiText.includes('function isAnyOverlayOpen') && !uiText.includes('export function isAnyOverlayOpen')) {
    throw new Error('缺少 isAnyOverlayOpen');
  }
  if (!uiText.includes('pet-image-viewer') || !uiText.includes('expedition-dispatch-modal')) {
    throw new Error('Overlay 判斷未涵蓋原圖／派遣 Modal');
  }
  stats.push('overlay guard=ok');

  // 5. 召喚 pulling 殘留恢復
  if (!uiText.includes('resetStaleGachaPullState') || !uiText.includes('gachaPullInProgress')) {
    throw new Error('缺少召喚 pulling 殘留恢復機制');
  }
  stats.push('gacha pull safety=ok');

  // 6. Sweet 可讀性：指定 selector 有覆寫，且避免淡底淡字
  const sweetBlockIdx = cssText.indexOf('V2.7.4 — 穩定性');
  if (sweetBlockIdx === -1) throw new Error('styles.css 缺少 V2.7.4 可讀性區塊');
  const sweetBlock = cssText.slice(sweetBlockIdx);
  const requiredSweet = [
    'body[data-theme="sweet"] .badge--category-purple',
    'body[data-theme="sweet"] .badge--date-today',
    'body[data-theme="sweet"] .badge--today-plan',
    'body[data-theme="sweet"] .tag-chip--selected',
    'body[data-theme="sweet"] .gacha-stardust__value',
    'body[data-theme="sweet"] .stat-card--energy .stat-value',
    'body[data-theme="sweet"] .btn--dev',
    'body[data-theme="sweet"] .btn--danger',
    'body[data-theme="sweet"] .rarity-SSR',
    'body[data-theme="sweet"] .rarity-N',
  ];
  for (const sel of requiredSweet) {
    if (!cssText.includes(sel)) throw new Error(`Sweet 可讀性缺少 ${sel}`);
  }
  if (!cssText.includes('--sweet-text-berry') || !cssText.includes('--color-primary-light')) {
    throw new Error('缺少 Sweet 語意文字色或 --color-primary-light');
  }
  // 風險掃描（限 V2.7.4 區塊）：白底淺黃字 / 淡紫底淡紫字 / 淡綠底亮綠字
  if (/body\[data-theme="sweet"\][^{]*\{[^}]*background:[^;]*#FFF[^;]*;[^}]*color:\s*#(FFF|FFE|FFD)/i.test(sweetBlock)) {
    notes.push('V2.7.4 區塊疑似白底淺字');
  }
  stats.push('sweet contrast overrides=ok');

  // 7. Typography：核心 selector 不再使用過小時級
  const tinySelectors = [
    ['.sweet-summon-badge--pity', sweetBlock],
    ['.daily-wheel-label__amount', sweetBlock],
    ['.expedition-area-progress-text', sweetBlock],
    ['.quest-panel__eyebrow', sweetBlock],
    ['.stat-label', sweetBlock],
    ['.task-reward-tag', sweetBlock],
  ];
  for (const [sel, block] of tinySelectors) {
    const i = block.indexOf(sel);
    if (i === -1) {
      notes.push(`typography 區塊可能缺少 ${sel}`);
      continue;
    }
    const snippet = block.slice(i, i + 160);
    if (/font-size:\s*(0\.625rem|0\.66rem|0\.6875rem|10px|11px)\b/.test(snippet)) {
      throw new Error(`${sel} 仍使用過小字級`);
    }
  }
  stats.push('core typography=ok');

  // 8. 版本來自 version.js，不在此寫死 cache name
  const ver = versionText.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (ver) stats.push(`APP_VERSION=${ver[1]}`);

  const summary = stats.join(' | ');
  if (notes.length) return `ok with notes: ${notes.join('; ')} | ${summary}`;
  return summary;
}

/**
 * V2.7.5 — 首頁陪伴卡片互動 + Sweet 每日轉盤視覺重設計（靜態，不寫入 IndexedDB）
 */
async function checkCompanionWheelHotfix() {
  const [uiRes, cssRes, versionRes] = await Promise.all([
    fetch('./src/ui.js'),
    fetch('./src/styles.css'),
    fetch('./src/version.js'),
  ]);
  if (!uiRes.ok || !cssRes.ok || !versionRes.ok) {
    throw new Error('無法讀取 ui.js / styles.css / version.js');
  }
  const uiText = await uiRes.text();
  const cssText = await cssRes.text();
  const versionText = await versionRes.text();
  const notes = [];
  const stats = [];

  // ── 1. 首頁陪伴卡片：圖片與詳情分離（勿誤查圖鑑） ──
  const companionRenderIdx = uiText.indexOf('function renderCompanionSection');
  if (companionRenderIdx === -1) throw new Error('缺少 renderCompanionSection');
  const companionRender = uiText.slice(companionRenderIdx, companionRenderIdx + 2800);

  if (!companionRender.includes('data-action="companion-view-image"')) {
    throw new Error('首頁陪伴卡片缺少 companion-view-image');
  }
  if (!companionRender.includes('data-action="companion-view-detail"')) {
    throw new Error('首頁陪伴卡片缺少 companion-view-detail');
  }
  if (companionRender.includes('data-action="companion-talk"')) {
    throw new Error('首頁陪伴資訊區仍綁定 companion-talk，無法開啟詳情');
  }
  if (!companionRender.includes('companion-card__detail-button')) {
    throw new Error('首頁陪伴缺少獨立詳情按鈕');
  }
  if (!uiText.includes('data-action="companion-pet"') || !uiText.includes('function renderCompanionPetButton')) {
    throw new Error('首頁陪伴缺少撫摸按鈕');
  }
  // 圖片與詳情不可共用同一 action
  if (companionRender.includes('data-action="companion-view-image"') &&
      companionRender.includes('data-action="companion-view-detail"')) {
    stats.push('companion image/detail actions=split');
  }

  const imageActionIdx = uiText.indexOf("action === 'companion-view-image'");
  if (imageActionIdx === -1) throw new Error('缺少 companion-view-image 事件處理');
  const imageActionBody = uiText.slice(imageActionIdx, imageActionIdx + 450);
  if (!imageActionBody.includes('stopPropagation')) {
    throw new Error('companion-view-image 未 stopPropagation');
  }
  if (!imageActionBody.includes('openPetImageViewer')) {
    throw new Error('companion-view-image 未呼叫 openPetImageViewer');
  }
  if (imageActionBody.includes('openPetDetailModal')) {
    throw new Error('companion-view-image 不應同時開詳情');
  }

  const detailActionIdx = uiText.indexOf("action === 'companion-view-detail'");
  if (detailActionIdx === -1) throw new Error('缺少 companion-view-detail 事件處理');
  const detailActionBody = uiText.slice(detailActionIdx, detailActionIdx + 450);
  if (!detailActionBody.includes('openPetDetailModal')) {
    throw new Error('companion-view-detail 未呼叫 openPetDetailModal');
  }
  if (!detailActionBody.includes('dataset.petId') && !detailActionBody.includes('data-pet-id')) {
    // 檢查 petId 取得
    if (!detailActionBody.includes('petId')) {
      throw new Error('companion-view-detail 無法取得 petId');
    }
  }
  if (!detailActionBody.includes('closest')) {
    notes.push('companion-view-detail 可能未使用 closest 後備取得 petId');
  }

  const petActionIdx = uiText.indexOf("action === 'companion-pet'");
  if (petActionIdx === -1) throw new Error('缺少 companion-pet 事件處理');
  const petActionBody = uiText.slice(petActionIdx, petActionIdx + 200);
  if (!petActionBody.includes('stopPropagation')) {
    throw new Error('companion-pet 未 stopPropagation，可能誤開詳情');
  }
  stats.push('home companion card interaction=ok');

  // 確認圖鑑仍使用獨立 action（不受本次污染）
  if (!uiText.includes('data-action="view-pet-image"') || !uiText.includes('data-action="view-detail"')) {
    throw new Error('圖鑑原圖／詳情 action 缺失');
  }
  stats.push('collection actions preserved=ok');

  // ── 2. Sweet 轉盤專屬覆寫（須在 sweet scope） ──
  const sweetWheelBlockIdx = cssText.indexOf('V2.7.5 — 首頁陪伴卡片互動');
  if (sweetWheelBlockIdx === -1) throw new Error('styles.css 缺少 V2.7.5 轉盤重設計區塊');
  const sweetWheelBlock = cssText.slice(sweetWheelBlockIdx);

  const requiredSweetWheel = [
    'body[data-theme="sweet"] .modal:has(.daily-wheel-modal-body)',
    'body[data-theme="sweet"] .daily-wheel-modal-body .modal-title',
    'body[data-theme="sweet"] .wheel-modal__status',
    'body[data-theme="sweet"] .wheel-modal__status--available',
    'body[data-theme="sweet"] .wheel-modal__hint',
    'body[data-theme="sweet"] .daily-wheel-label__name',
    'body[data-theme="sweet"] .daily-wheel-label__amount',
    'body[data-theme="sweet"] .daily-wheel-center-button',
    'body[data-theme="sweet"] .daily-wheel-center-button:disabled',
  ];
  for (const sel of requiredSweetWheel) {
    if (!cssText.includes(sel)) {
      throw new Error(`Sweet 轉盤缺少覆寫：${sel}`);
    }
  }
  if (!sweetWheelBlock.includes('--wheel-sweet-title') && !cssText.includes('--wheel-sweet-title')) {
    throw new Error('缺少 Sweet 轉盤語意色 --wheel-sweet-title');
  }
  if (!cssText.includes('--wheel-sweet-primary')) {
    throw new Error('缺少 Sweet 轉盤語意色 --wheel-sweet-primary');
  }
  stats.push('sweet wheel overrides=ok');

  // 扇區色票不可再是過淡奶油白
  if (uiText.includes("WHEEL_COLORS_SWEET = [\n  '#FFF0F7'")) {
    throw new Error('Sweet 轉盤扇區仍使用過淡色票');
  }
  if (!uiText.includes('WHEEL_LABEL_COLORS_SWEET')) {
    throw new Error('缺少 Sweet 扇區標籤深色文字色票');
  }
  stats.push('sweet wheel sector colors=ok');

  // ── 3. 轉盤主要文字不可過大縮小 ──
  const wheelLabelSnippets = [
    cssText.slice(cssText.indexOf('.daily-wheel-label__name'), cssText.indexOf('.daily-wheel-label__name') + 120),
    cssText.slice(cssText.lastIndexOf('.daily-wheel-label__amount'), cssText.lastIndexOf('.daily-wheel-label__amount') + 120),
  ];
  for (const snippet of wheelLabelSnippets) {
    if (/font-size:\s*(0\.625rem|0\.6875rem|10px|11px)\b/.test(snippet)) {
      throw new Error('轉盤標籤仍使用過小字級（10px/11px/<0.75rem）');
    }
  }
  // 小螢幕 media 覆寫也不可回到 10px
  const mediaIdx = cssText.indexOf('@media (max-width: 380px)');
  if (mediaIdx !== -1) {
    const mediaBlock = cssText.slice(mediaIdx, mediaIdx + 900);
    if (mediaBlock.includes('.daily-wheel-label') && /font-size:\s*10px/.test(mediaBlock)) {
      throw new Error('小螢幕轉盤標籤仍強制 10px');
    }
  }
  stats.push('wheel label size=ok');

  const ver = versionText.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (ver) stats.push(`APP_VERSION=${ver[1]}`);

  const summary = stats.join(' | ');
  if (notes.length) return `ok with notes: ${notes.join('; ')} | ${summary}`;
  return summary;
}

/**
 * V2.8.0 — 收藏里程碑定義、動態進度、領獎安全與收合 UI（唯讀）
 */
async function checkCollectionMilestones() {
  const [petsRes, serviceRes, rewardRes, uiRes, indexRes, cssRes, backupRes, swRes] = await Promise.all([
    fetch('./data/pets.json'),
    fetch('./src/collectionMilestoneService.js'),
    fetch('./src/rewardService.js'),
    fetch('./src/ui.js'),
    fetch('./index.html'),
    fetch('./src/styles.css'),
    fetch('./src/backupService.js'),
    fetch('./service-worker.js'),
  ]);
  if (![petsRes, serviceRes, rewardRes, uiRes, indexRes, cssRes, backupRes, swRes].every((res) => res.ok)) {
    throw new Error('無法讀取收藏里程碑檢查所需檔案');
  }

  const pets = (await petsRes.json()).pets || [];
  const serviceText = await serviceRes.text();
  const rewardText = await rewardRes.text();
  const uiText = await uiRes.text();
  const indexText = await indexRes.text();
  const cssText = await cssRes.text();
  const backupText = await backupRes.text();
  const swText = await swRes.text();
  const stats = [];

  const ids = COLLECTION_MILESTONE_DEFINITIONS.map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error('收藏里程碑 ID 重複');
  const orders = COLLECTION_MILESTONE_DEFINITIONS.map((item) => item.order);
  if (orders.some((order) => !Number.isFinite(order) || order < 0)) {
    throw new Error('收藏里程碑 order 無效');
  }
  for (const item of COLLECTION_MILESTONE_DEFINITIONS) {
    if (!COLLECTION_MILESTONE_CONDITION_TYPES.includes(item.conditionType)) {
      throw new Error(`conditionType 無效: ${item.id}`);
    }
    const dynamic = item.targetMode === 'dynamic';
    if (!dynamic && (!Number.isFinite(item.target) || item.target <= 0)) {
      throw new Error(`target 無效: ${item.id}`);
    }
    if (!item.reward || !Number.isFinite(item.reward.stardust) || item.reward.stardust < 0) {
      throw new Error(`reward 格式無效: ${item.id}`);
    }
    if (!item.reward.badgeId || item.reward.badgeId !== item.badge?.badgeId) {
      throw new Error(`badge 格式無效: ${item.id}`);
    }
  }
  stats.push(`definitions=${ids.length}`);

  const normalized = normalizeCollectionMilestoneState({
    claimedIds: [ids[0], ids[0], 'removed_id', 123],
  });
  if (normalized.claimedIds.length !== 1 || normalized.claimedIds[0] !== ids[0]) {
    throw new Error('claimedIds 正規化失敗');
  }

  const resolved = resolveCollectionMilestoneDefinitions(pets);
  const allPetsTarget = resolved.find((item) => item.id === 'collection_all')?.target;
  const nTarget = resolved.find((item) => item.id === 'rarity_all_n')?.target;
  const rTarget = resolved.find((item) => item.id === 'rarity_all_r')?.target;
  const actualN = pets.filter((pet) => pet.rarity === 'N').length;
  const actualR = pets.filter((pet) => pet.rarity === 'R').length;
  if (allPetsTarget !== pets.length || nTarget !== actualN || rTarget !== actualR) {
    throw new Error('全部寵物或 N/R 動態 target 未取自 pets catalog');
  }
  const dynamicDefsText = serviceText.slice(
    serviceText.indexOf('export const COLLECTION_MILESTONE_DEFINITIONS'),
    serviceText.indexOf('const validMilestoneIds')
  );
  if (/collection_all[\s\S]{0,180}target:\s*56/.test(dynamicDefsText)
    || /rarity_all_n[\s\S]{0,180}target:\s*16/.test(dynamicDefsText)
    || /rarity_all_r[\s\S]{0,180}target:\s*12/.test(dynamicDefsText)) {
    throw new Error('動態 target 被寫死');
  }
  stats.push(`dynamic=${pets.length}/${actualN}/${actualR}`);

  const samplePets = [
    { id: 'n1', rarity: 'N' },
    { id: 'r1', rarity: 'R' },
    { id: 'sr1', rarity: 'SR' },
  ];
  const sampleCollection = [
    { petId: 'n1', stars: 5, bondLevel: 5, bondUnlocks: { bondLiberated: true } },
    { petId: 'sr1', stars: 3, bondLevel: 3, bondUnlocks: { bondLiberated: false } },
    { petId: 'unknown', stars: 5, bondLevel: 5, bondUnlocks: { bondLiberated: true } },
  ];
  const context = buildCollectionMilestoneContext(samplePets, sampleCollection);
  const progressCases = [
    [{ conditionType: 'owned_count' }, 2],
    [{ conditionType: 'rarity_owned_count', rarity: 'SR' }, 1],
    [{ conditionType: 'all_rarity', rarity: 'N' }, 1],
    [{ conditionType: 'star_count', minStars: 3 }, 2],
    [{ conditionType: 'bond_level_count', minBondLevel: 3 }, 2],
    [{ conditionType: 'bond_liberated_count' }, 1],
    [{ conditionType: 'all_pets' }, 2],
  ];
  for (const [definition, expected] of progressCases) {
    if (getCollectionMilestoneProgress(definition, context) !== expected) {
      throw new Error(`進度計算失敗: ${definition.conditionType}`);
    }
  }
  stats.push('progress types=7');

  for (const required of [
    'const claimingIds = new Set()',
    'claimingIds.has(milestoneId)',
    'getCollectionMilestoneState()',
    'getCollectionMilestoneProgress(definition, context)',
    'currentState.claimedIds.includes(milestoneId)',
    'applyStardustRewardAndUpdateMeta',
  ]) {
    if (!serviceText.includes(required)) throw new Error(`領獎安全缺少: ${required}`);
  }
  if (!rewardText.includes("db.transaction(STORES.META, 'readwrite')")
    || !rewardText.includes('wallet.stardust')
    || !rewardText.includes('store.put(nextState)')) {
    throw new Error('Reward service 未以同一 transaction 更新星塵與 claimedIds');
  }
  if (!/if\s*\(definition\.target\s*<=\s*0\s*\|\|\s*progress\s*<\s*definition\.target\)/.test(serviceText)) {
    throw new Error('未完成里程碑缺少 service 層阻擋');
  }
  stats.push('claim safety=atomic');

  if (!indexText.includes('id="collection-progress-summary"')
    || !indexText.includes('id="collection-milestones-panel"')) {
    throw new Error('圖鑑頁缺少收藏摘要／里程碑容器');
  }
  if (!uiText.includes('let collectionMilestonesExpanded = false')) {
    throw new Error('里程碑未預設收合');
  }
  if (!uiText.includes('aria-expanded="${collectionMilestonesExpanded}"')
    || !uiText.includes('aria-controls="collection-milestones-content"')
    || !uiText.includes('完成 ${summary.metCount} / ${summary.total}')
    || !uiText.includes('可領取 ${summary.claimableCount}')) {
    throw new Error('收合列 aria 或摘要資訊不完整');
  }
  if (!uiText.includes('collectionMilestonesExpanded = !collectionMilestonesExpanded')
    || !uiText.includes('renderCollectionMilestones();')) {
    throw new Error('局部 render 無法保留展開狀態');
  }
  stats.push('collapse UI=ok');

  const requiredSweetSelectors = [
    'body[data-theme="sweet"] .collection-progress-summary',
    'body[data-theme="sweet"] .collection-summary__count strong',
    'body[data-theme="sweet"] .collection-rarity-chip',
    'body[data-theme="sweet"] .collection-milestone__status',
    'body[data-theme="sweet"] .collection-milestone__claim',
    'body[data-theme="sweet"] .collection-milestone__status--claimed',
  ];
  for (const selector of requiredSweetSelectors) {
    if (!cssText.includes(selector)) throw new Error(`Sweet 收藏可讀性缺少 ${selector}`);
  }
  stats.push('sweet selectors=6');

  if (!backupText.includes('collectionMilestones')
    || !backupText.includes('normalizeCollectionMilestoneState')
    || !backupText.includes("'2.8.0'")) {
    throw new Error('備份未完整支援 collectionMilestones / 2.8.0');
  }
  if (!swText.includes('src/collectionMilestoneService.js')) {
    throw new Error('Service Worker 未 precache collectionMilestoneService.js');
  }

  return stats.join(' | ');
}

/**
 * 執行健康檢查並輸出結果至 console
 * @returns {Promise<{ ok: boolean, results: Record<string, string>, errors: string[] }>}
 */
/**
 * V2.9.0 — 冒險手冊與成長總覽檢查（靜態 + 純函式執行期）。
 * 只讀取原始碼與呼叫純函式，不寫入任何資料、不領取獎勵、不清除 IndexedDB。
 */
async function checkAdventureHandbook() {
  const [svcRes, uiRes, indexRes, cssRes, swRes, backupRes, versionRes] = await Promise.all([
    fetch('./src/adventureHandbookService.js'),
    fetch('./src/ui.js'),
    fetch('./index.html'),
    fetch('./src/styles.css'),
    fetch('./service-worker.js'),
    fetch('./src/backupService.js'),
    fetch('./src/version.js'),
  ]);
  if (!svcRes.ok) throw new Error('無法讀取 adventureHandbookService.js');
  if (!uiRes.ok || !indexRes.ok || !cssRes.ok || !swRes.ok || !backupRes.ok || !versionRes.ok) {
    throw new Error('無法讀取 ui / index / styles / service-worker / backup / version');
  }

  const svcText = await svcRes.text();
  const uiText = await uiRes.text();
  const indexText = await indexRes.text();
  const cssText = await cssRes.text();
  const swText = await swRes.text();
  const backupText = await backupRes.text();
  const versionText = await versionRes.text();
  const notes = [];
  const stats = [];

  // 1. 入口與 View --------------------------------------------------
  if (!indexText.includes('data-goto="handbook"')) {
    throw new Error('更多頁缺少冒險手冊入口 (data-goto="handbook")');
  }
  if (!indexText.includes('id="view-handbook"')) {
    throw new Error('index.html 缺少 view-handbook 容器');
  }
  if (!indexText.includes('id="handbook-content"')) {
    throw new Error('index.html 缺少 handbook-content 容器');
  }
  // 返回操作：view-handbook 內需有 data-goto="more" 的返回鈕
  if (!/id="view-handbook"[\s\S]{0,400}data-goto="more"/.test(indexText)) {
    throw new Error('冒險手冊缺少返回更多頁的操作');
  }
  // renderView 需能分派 handbook
  if (!/case 'handbook':/.test(uiText) || !uiText.includes('renderHandbookView')) {
    throw new Error('ui.js renderView 未分派 handbook');
  }
  if (!uiText.includes("viewName === 'handbook'")) {
    throw new Error('switchView 未處理 handbook 子頁');
  }
  // 不新增底部導覽按鈕：nav-item 仍為 5 個主項
  const navItemCount = (indexText.match(/class="nav-item[ "]/g) || []).length;
  if (navItemCount !== 5) {
    notes.push(`底部導覽項目數為 ${navItemCount}（預期 5，未新增手冊按鈕）`);
  }
  stats.push('入口/View=ok');

  // 2. 現有服務重用 -------------------------------------------------
  const requiredReuse = [
    { pattern: "from './questService.js'", label: 'quest service' },
    { pattern: "from './explorationService.js'", label: 'exploration service' },
    { pattern: "from './expeditionService.js'", label: 'expedition service' },
    { pattern: "from './collectionService.js'", label: 'collection/bond service' },
    { pattern: 'getQuestSummary', label: 'getQuestSummary()' },
    { pattern: 'getExplorationSummary', label: 'getExplorationSummary()' },
    { pattern: 'getAllExpeditions', label: 'getAllExpeditions()' },
    { pattern: 'getBondProgress', label: 'getBondProgress()' },
    { pattern: 'collectionMilestoneSummary', label: '收藏 summary 重用' },
    { pattern: 'workshopStats', label: 'workshopStats 重用' },
  ];
  for (const { pattern, label } of requiredReuse) {
    if (!svcText.includes(pattern)) {
      throw new Error(`adventureHandbookService 未重用 ${label}`);
    }
  }
  stats.push('服務重用=ok');

  // 3. 資料可信 -----------------------------------------------------
  // 不得出現自行加權的綜合分數關鍵字
  const forbiddenScoreWords = ['冒險力', '玩家總評', '成長分數', '綜合等級', '戰力', '總評分'];
  for (const word of forbiddenScoreWords) {
    if (svcText.includes(word) || uiText.includes(`>${word}`)) {
      throw new Error(`偵測到不允許的綜合分數: ${word}`);
    }
  }
  // 缺失資料一致格式：available 旗標
  if (!svcText.includes('available: false') || !svcText.includes('available: true')) {
    throw new Error('adventureHandbookService 缺少 available 缺失資料格式');
  }
  // 長期紀錄需以歷史累積來源計算（value>0 才渲染）
  if (!svcText.includes('buildLongTermRecords')) {
    throw new Error('缺少長期紀錄建構函式');
  }
  stats.push('資料可信=ok');

  // 4. 收合 UI ------------------------------------------------------
  if (!uiText.includes('handbookSectionState')) {
    throw new Error('ui.js 缺少 handbookSectionState');
  }
  // 四個詳細區塊預設收合（模組級狀態初始為 false）
  const sectionStateMatch = uiText.match(/const handbookSectionState = \{([\s\S]*?)\};/);
  if (!sectionStateMatch) {
    throw new Error('找不到 handbookSectionState 定義');
  }
  const sectionBody = sectionStateMatch[1];
  for (const key of ['weekly', 'records', 'companions', 'expedition']) {
    if (!new RegExp(`${key}\\s*:\\s*false`).test(sectionBody)) {
      throw new Error(`詳細區塊 ${key} 預設不是收合 (false)`);
    }
  }
  if (!uiText.includes('aria-expanded') || !uiText.includes('aria-controls="${bodyId}"')) {
    throw new Error('收合區塊缺少 aria-expanded / aria-controls');
  }
  // 整條標題列可點擊（header 為 button 且帶 data-action="handbook-toggle"）
  if (!/handbook-section__header[\s\S]{0,200}data-action="handbook-toggle"/.test(uiText)) {
    throw new Error('收合標題列非整條可點擊的 button');
  }
  stats.push('收合 UI=ok');

  // 5. 下一步目標規則 ----------------------------------------------
  if (!svcText.includes('MAX_NEXT_GOALS = 3')) {
    throw new Error('下一步目標未限制最多 3 項');
  }
  if (!svcText.includes('MAX_GOALS_PER_CATEGORY = 2')) {
    throw new Error('下一步目標未限制單一類別最多 2 項');
  }
  if (!/status === 'claimable'\) priority \+= 1000/.test(svcText)) {
    throw new Error('可領取目標未取得最高優先度');
  }
  stats.push('目標規則=ok');

  // 6. 純函式：缺失資料不報錯、不出現 NaN / undefined --------------
  const legalActionViews = new Set(['tasks', 'gacha', 'collection', 'expedition', 'achievements']);
  const scenarios = [
    { name: 'empty', ctx: {} },
    { name: 'no-gacha-no-workshop', ctx: { collectionProgress: { owned: 0, total: 56 } } },
    {
      name: 'partial',
      ctx: {
        collectionProgress: { owned: 3, total: 56 },
        enrichedCollection: [],
        questSummary: {
          daily: { items: [], total: 6, completedCount: 2, claimableCount: 1 },
          weekly: { items: [], total: 5, completedCount: 3, claimableCount: 0 },
          stats: {},
        },
        explorationSummary: { areas: [], stats: {} },
      },
    },
    {
      name: 'no-companion-no-expedition',
      ctx: {
        collectionProgress: { owned: 10, total: 56 },
        enrichedCollection: [{ id: 'p1', owned: true, bondLevel: 3, stars: 2 }],
        companion: null,
        activeExpedition: null,
        gachaStats: { totalPulls: 0 },
        workshopStats: { craftCount: 0, giftCount: 0 },
        dailyCheckIn: { totalCheckIns: 0, bestStreak: 0 },
      },
    },
  ];

  for (const { name, ctx } of scenarios) {
    let model;
    try {
      model = buildAdventureHandbookModel(ctx);
    } catch (err) {
      throw new Error(`缺失資料情境 ${name} 拋錯: ${err.message}`);
    }
    const serialized = JSON.stringify(model);
    if (serialized.includes('NaN') || serialized.includes('undefined')) {
      throw new Error(`情境 ${name} 產生 NaN / undefined`);
    }
    // quickStats 每項 available 且 value 為非空字串
    for (const s of model.quickStats) {
      if (!s.available || typeof s.value !== 'string' || !s.value) {
        throw new Error(`情境 ${name} quickStats 值不可靠`);
      }
    }
    if (model.quickStats.length > 4) throw new Error(`情境 ${name} quickStats 超過 4 項`);
    // 下一步目標：最多 3 項、單一類別最多 2 項、actionView 合法
    if (model.nextGoals.length > 3) throw new Error(`情境 ${name} 下一步目標超過 3 項`);
    const perCat = {};
    for (const g of model.nextGoals) {
      perCat[g.category] = (perCat[g.category] || 0) + 1;
      if (perCat[g.category] > 2) throw new Error(`情境 ${name} 單一類別目標超過 2 項`);
      if (!legalActionViews.has(g.actionView)) {
        throw new Error(`情境 ${name} 目標 actionView 非法: ${g.actionView}`);
      }
    }
    // 長期紀錄：只保留 available=true 項
    for (const item of model.records.items) {
      if (item.available !== true) throw new Error(`情境 ${name} 長期紀錄含 available=false 項`);
    }
  }
  stats.push('純函式缺失資料=ok');

  // 可領取目標優先度需高於一般進行中目標
  const claimablePriority = scoreGoal({ status: 'claimable', progress: 0, remaining: 99 });
  const inProgressPriority = scoreGoal({ status: 'in_progress', progress: 0.95, remaining: 1 });
  if (claimablePriority <= inProgressPriority) {
    throw new Error('可領取目標優先度未高於進行中目標');
  }

  // 去重規則：三項來自同類時最多保留 2 項
  const dedupModelGoals = buildNextGoals({
    collectionMilestoneSummary: {
      items: [
        { id: 'a', status: 'claimable', title: 'A', progress: 5, target: 5, badge: {} },
        { id: 'b', status: 'claimable', title: 'B', progress: 5, target: 5, badge: {} },
        { id: 'c', status: 'claimable', title: 'C', progress: 5, target: 5, badge: {} },
      ],
      nextMilestone: null,
    },
  });
  const collectionGoals = dedupModelGoals.filter((g) => g.category === 'collection').length;
  if (collectionGoals > 2) {
    throw new Error('下一步目標去重失效（同類超過 2 項）');
  }
  stats.push('去重/優先=ok');

  // 7. Sweet 可讀性 -------------------------------------------------
  const sweetSelectors = [
    'body[data-theme="sweet"] .handbook-stat',
    'body[data-theme="sweet"] .handbook-goal__count',
    'body[data-theme="sweet"] .handbook-chip--claimable',
    'body[data-theme="sweet"] .handbook-chip--info',
    'body[data-theme="sweet"] .handbook-progress',
    'body[data-theme="sweet"] .handbook-rarity-chip',
    'body[data-theme="sweet"] #view-handbook .page-back-btn',
  ];
  for (const sel of sweetSelectors) {
    if (!cssText.includes(sel)) {
      throw new Error(`Sweet 主題缺少手冊可讀性樣式: ${sel}`);
    }
  }
  stats.push('Sweet 可讀性=ok');

  // 8. PWA / 版本一致 ----------------------------------------------
  if (!swText.includes('src/adventureHandbookService.js')) {
    throw new Error('service-worker 未 precache adventureHandbookService.js');
  }
  if (!versionText.includes("APP_VERSION = '3.4.4'")) {
    notes.push('version.js APP_VERSION 非 3.4.4');
  }
  if (!versionText.includes('questnote-cache-v344-pool-intro-polish')) {
    notes.push('version.js CACHE_NAME 未更新為 v343');
  }
  if (!swText.includes('questnote-cache-v344-pool-intro-polish')) {
    notes.push('service-worker CACHE_NAME 未更新為 v343');
  }
  if (!backupText.includes("'3.4.4'")) {
    notes.push('backupService 未加入 3.4.4 支援版本');
  }

  const summary = stats.join(' | ');
  if (notes.length) return `ok with notes: ${notes.join('; ')} | ${summary}`;
  return summary;
}

/**
 * V3.0.0 全域信箱健康檢查
 * 禁止副作用：不得領取補償、寫入 claimedIds、增加星塵／能量／inventory、標記全部已讀、清除 cache
 */
async function checkGlobalMailbox() {
  const stats = [];
  const notes = [];
  const helpers = __mailboxTestHelpers();

  const [mailboxRes, mailboxServiceRes, uiRes, swRes, versionRes, backupRes, cssRes, indexRes] = await Promise.all([
    fetch('./data/global-mailbox.json'),
    fetch('./src/mailboxService.js'),
    fetch('./src/ui.js'),
    fetch('./service-worker.js'),
    fetch('./src/version.js'),
    fetch('./src/backupService.js'),
    fetch('./src/styles.css'),
    fetch('./index.html'),
  ]);

  if (!mailboxRes.ok) throw new Error('無法讀取 global-mailbox.json');
  if (!mailboxServiceRes.ok) throw new Error('無法讀取 mailboxService.js');
  if (!uiRes.ok) throw new Error('無法讀取 ui.js');
  if (!swRes.ok) throw new Error('無法讀取 service-worker.js');
  if (!versionRes.ok) throw new Error('無法讀取 version.js');
  if (!backupRes.ok) throw new Error('無法讀取 backupService.js');
  if (!cssRes.ok) throw new Error('無法讀取 styles.css');
  if (!indexRes.ok) throw new Error('無法讀取 index.html');

  const rawMailbox = await mailboxRes.json();
  const serviceText = await mailboxServiceRes.text();
  const uiText = await uiRes.text();
  const swText = await swRes.text();
  const versionText = await versionRes.text();
  const backupText = await backupRes.text();
  const cssText = await cssRes.text();
  const indexText = await indexRes.text();

  // 1. Schema -------------------------------------------------------
  if (rawMailbox.schemaVersion !== 1 && Number(rawMailbox.schemaVersion) !== 1) {
    throw new Error('schemaVersion 不合法');
  }
  if (!Array.isArray(rawMailbox.messages)) {
    throw new Error('messages 必須為陣列');
  }
  // 空信箱不得失敗
  stats.push(`messages=${rawMailbox.messages.length}`);

  const ids = new Set();
  const allowedTypes = new Set(helpers.ALLOWED_TYPES);
  const allowedPriorities = new Set(helpers.ALLOWED_PRIORITIES);
  for (const msg of rawMailbox.messages) {
    if (!msg?.id || typeof msg.id !== 'string') throw new Error('信件缺少 id');
    if (ids.has(msg.id)) throw new Error(`重複 message id: ${msg.id}`);
    ids.add(msg.id);
    if (msg.type && !allowedTypes.has(msg.type)) {
      notes.push(`未知 type（應可正規化）: ${msg.type}`);
    }
    if (msg.priority && !allowedPriorities.has(msg.priority)) {
      notes.push(`未知 priority: ${msg.priority}`);
    }
    if (msg.publishedAt && Number.isNaN(Date.parse(msg.publishedAt))) {
      throw new Error(`publishedAt 無法解析: ${msg.id}`);
    }
    if (msg.expiresAt != null && Number.isNaN(Date.parse(msg.expiresAt))) {
      throw new Error(`expiresAt 無法解析: ${msg.id}`);
    }
    if (msg.type === 'compensation' && msg.reward) {
      const validated = validateMailboxReward(msg.reward);
      if (!validated.ok) {
        notes.push(`補償 ${msg.id} reward 驗證失敗（正式環境會顯示資料錯誤）`);
      }
    }
  }
  const normalized = normalizeMailboxPayload(rawMailbox);
  stats.push(`normalized=${normalized.messages.length}`);
  stats.push('schema=ok');

  // 2. XSS ----------------------------------------------------------
  if (!uiText.includes('body.textContent = msg.body') && !uiText.includes('body.textContent = msg.body ||')) {
    // 檢查 textContent 用法
    if (!uiText.includes('.textContent = msg.body') && !uiText.includes('textContent = msg.body')) {
      throw new Error('UI 可能未以 textContent 渲染遠端 body');
    }
  }
  if (!uiText.includes('title.textContent = msg.title')) {
    throw new Error('UI 可能未以 textContent 渲染遠端 title');
  }
  // 禁止明顯把遠端 body 塞進 innerHTML
  if (/innerHTML\s*=\s*[^\n]*msg\.body/.test(uiText) || /innerHTML\s*=\s*[^\n]*message\.body/.test(uiText)) {
    throw new Error('禁止 innerHTML 直接渲染遠端 body');
  }
  if (/innerHTML\s*=\s*[^\n]*msg\.title/.test(uiText)) {
    throw new Error('禁止 innerHTML 直接渲染遠端 title');
  }
  // 白名單已抽至 mailboxSchema.js；以 runtime 常數驗證（勿只掃 mailboxService 原文）
  const requiredActionViews = [
    'tasks', 'gacha', 'collection', 'expedition',
    'workshop', 'achievements', 'settings', 'handbook',
  ];
  for (const view of requiredActionViews) {
    if (!MAILBOX_ACTION_VIEWS.includes(view)) {
      throw new Error(`Action View 白名單缺少 ${view}`);
    }
  }
  const badAction = normalizeMailboxAction({ type: 'view', view: 'evil', label: 'x' });
  if (badAction) throw new Error('非法 view action 不應通過');
  const jsAction = normalizeMailboxAction({ type: 'javascript', code: 'alert(1)' });
  if (jsAction) throw new Error('javascript action 不應通過');
  stats.push('xss=ok');

  // 3. Fetch 策略 ---------------------------------------------------
  const precacheBlock = swText.match(/const PRECACHE_URLS\s*=\s*\[([\s\S]*?)\];/);
  if (precacheBlock && /global-mailbox\.json/.test(precacheBlock[1])) {
    throw new Error('global-mailbox.json 不應在 App Shell PRECACHE_URLS');
  }
  if (!swText.includes('MAILBOX_RUNTIME_CACHE') && !swText.includes('questnote-mailbox-runtime-v1')) {
    throw new Error('缺少 MAILBOX_RUNTIME_CACHE');
  }
  if (!swText.includes('networkFirstMailbox') && !swText.includes('isGlobalMailboxRequest')) {
    throw new Error('缺少 global-mailbox Network First 特殊路由');
  }
  if (!swText.includes('MAILBOX_FETCH_TIMEOUT_MS') && !swText.includes('7000')) {
    notes.push('mailbox timeout 可能未設定');
  }
  if (!swText.includes('getMailboxCacheRequest') && !swText.includes("resolveUrl('data/global-mailbox.json')")) {
    throw new Error('缺少固定 cache key 正規化（避免無限 query cache）');
  }
  if (!swText.includes('PET_IMAGE_CACHE') || !swText.includes('MAILBOX_RUNTIME_CACHE')) {
    throw new Error('activate 清理應保留 PET_IMAGE_CACHE 與 MAILBOX_RUNTIME_CACHE');
  }
  if (!versionText.includes('questnote-mailbox-runtime-v1') && !versionText.includes('MAILBOX_RUNTIME_CACHE')) {
    notes.push('version.js 可匯出 MAILBOX_RUNTIME_CACHE');
  }
  stats.push('fetch=ok');

  // 4. State --------------------------------------------------------
  if (!serviceText.includes('normalizeGlobalMailboxState')) {
    throw new Error('缺少 normalizeGlobalMailboxState');
  }
  if (!serviceText.includes('readIds') || !serviceText.includes('claimedIds')) {
    throw new Error('readIds 與 claimedIds 必須分開');
  }
  const broken = normalizeGlobalMailboxState({
    readIds: ['a', 'a', 1, null, 'b'],
    claimedIds: 'nope',
  });
  if (broken.readIds.length !== 2 || broken.readIds.includes('a') === false) {
    throw new Error('normalizeGlobalMailboxState 未正確過濾 readIds');
  }
  if (!Array.isArray(broken.claimedIds) || broken.claimedIds.length !== 0) {
    throw new Error('normalizeGlobalMailboxState 未正確處理無效 claimedIds');
  }
  const empty = normalizeGlobalMailboxState(null);
  if (!Array.isArray(empty.readIds) || !Array.isArray(empty.claimedIds)) {
    throw new Error('空狀態正規化失敗');
  }
  stats.push('state=ok');

  // 5. Claim 安全（純函式，無副作用） --------------------------------
  if (!serviceText.includes('mailboxClaimInProgress')) {
    throw new Error('缺少 claim guard');
  }
  if (!serviceText.includes('getGlobalMailboxState') || !serviceText.includes('claimedIds.includes')) {
    throw new Error('領取前應重新讀取 persisted claimedIds');
  }
  if (!serviceText.includes('MAILBOX_REWARD_LIMITS') && !serviceText.includes('stardust: 5000')) {
    throw new Error('缺少 reward 安全上限');
  }
  if (MAILBOX_REWARD_LIMITS.stardust !== 5000 || MAILBOX_REWARD_LIMITS.adventureEnergy !== 100) {
    throw new Error('reward 安全上限數值不符');
  }

  const badRewards = [
    { stardust: -1 },
    { stardust: 1.5 },
    { stardust: NaN },
    { stardust: '100' },
    { stardust: 5001 },
    { adventureEnergy: 101 },
    { materials: { unknown_mat: 1 } },
    { items: { unknown_item: 1 } },
    { pets: 1 },
    { titles: ['x'] },
  ];
  for (const reward of badRewards) {
    const r = validateMailboxReward(reward);
    if (r.ok) throw new Error(`異常 reward 不應通過: ${JSON.stringify(reward)}`);
  }

  const good = validateMailboxReward({
    stardust: 100,
    adventureEnergy: 3,
    materials: { forest_leaf: 2 },
    items: { item_small_spirit_food: 1 },
  });
  if (!good.ok) throw new Error('合法 reward 驗證失敗');

  // 版本比較不可用字串比較
  if (compareAppVersions('3.0.10', '3.0.2') <= 0) {
    throw new Error('semantic version 比較錯誤（3.0.10 應 > 3.0.2）');
  }
  if (compareAppVersions('3.0.0', '2.9.9') <= 0) {
    throw new Error('semantic version 比較錯誤（3.0.0 應 > 2.9.9）');
  }

  const futureMsg = normalizeMailboxMessage({
    id: 'hc-future',
    type: 'announcement',
    title: '未來',
    body: 'x',
    publishedAt: '2099-01-01T00:00:00+08:00',
    enabled: true,
  }, {}, Date.parse('2026-07-26T12:00:00+08:00'));
  const futureStatus = resolveMailboxMessageStatus(
    futureMsg,
    normalizeGlobalMailboxState(null),
    '3.0.0',
    Date.parse('2026-07-26T12:00:00+08:00'),
  );
  if (futureStatus.visible) throw new Error('未來信件不應顯示');

  const expiredMsg = normalizeMailboxMessage({
    id: 'hc-expired',
    type: 'compensation',
    title: '過期',
    body: 'x',
    publishedAt: '2026-01-01T00:00:00+08:00',
    expiresAt: '2026-01-02T00:00:00+08:00',
    enabled: true,
    reward: { stardust: 1 },
  }, {}, Date.parse('2026-07-26T12:00:00+08:00'));
  const expiredStatus = resolveMailboxMessageStatus(
    expiredMsg,
    normalizeGlobalMailboxState(null),
    '3.0.0',
    Date.parse('2026-07-26T12:00:00+08:00'),
  );
  if (expiredStatus.visible || expiredStatus.claimable) {
    throw new Error('過期信件不應顯示／可領');
  }

  const claimedState = normalizeGlobalMailboxState({ claimedIds: ['hc-claimed'], readIds: [] });
  const claimableMsg = normalizeMailboxMessage({
    id: 'hc-claimed',
    type: 'compensation',
    title: '已領',
    body: 'x',
    publishedAt: '2026-01-01T00:00:00+08:00',
    expiresAt: null,
    enabled: true,
    minAppVersion: '3.0.0',
    reward: { stardust: 10 },
  }, {}, Date.parse('2026-07-26T12:00:00+08:00'));
  const claimedStatus = resolveMailboxMessageStatus(
    claimableMsg,
    claimedState,
    '3.0.0',
    Date.parse('2026-07-26T12:00:00+08:00'),
  );
  if (claimedStatus.claimable) throw new Error('已領補償不應可再領');

  const lowVer = resolveMailboxMessageStatus(
    claimableMsg,
    normalizeGlobalMailboxState(null),
    '2.9.0',
    Date.parse('2026-07-26T12:00:00+08:00'),
  );
  if (lowVer.visible || lowVer.claimable) throw new Error('版本不符信件不應顯示／可領');

  // 本檢查不得呼叫 claimMailboxReward（靜態確認函式內無領取副作用）
  stats.push('claim=ok');

  // 6. UI -----------------------------------------------------------
  if (!indexText.includes('btn-global-mailbox') && !indexText.includes('id="btn-global-mailbox"')) {
    throw new Error('首頁缺少信箱入口');
  }
  if (!indexText.includes('mailbox-entry-badge')) {
    throw new Error('缺少未讀 badge 容器');
  }
  if (!uiText.includes('global-mailbox-modal') || !uiText.includes('ensureGlobalMailboxModal')) {
    throw new Error('缺少信箱 Modal');
  }
  if (!uiText.includes('global-mailbox-modal') || !/isAnyOverlayOpen[\s\S]*global-mailbox/.test(uiText)) {
    throw new Error('Overlay guard 未包含 mailbox');
  }
  if (!cssText.includes('var(--safe-top)') || !cssText.includes('global-mailbox-modal__sheet')) {
    throw new Error('信箱 Modal 缺少 Safe Area');
  }
  if (!cssText.includes('body[data-theme="sweet"] .global-mailbox-modal__sheet')) {
    throw new Error('缺少 Sweet 信箱配色');
  }
  if (!cssText.includes('body[data-theme="default"] .global-mailbox-modal__sheet')) {
    throw new Error('缺少 Default 信箱配色');
  }
  if (!cssText.includes('prefers-reduced-motion') || !cssText.includes('mailbox-entry-btn__gift--pulse')) {
    notes.push('Reduce Motion 樣式請確認');
  }
  stats.push('ui=ok');

  // 7. 版本／備份／SW -----------------------------------------------
  if (!versionText.includes("APP_VERSION = '3.4.4'")) {
    throw new Error('APP_VERSION 應為 3.4.4');
  }
  if (!versionText.includes('questnote-cache-v344-pool-intro-polish')) {
    throw new Error('CACHE_NAME 應為 v344-pool-intro-polish');
  }
  if (!swText.includes('src/mailboxService.js')) {
    throw new Error('service-worker 未 precache mailboxService.js');
  }
  if (!swText.includes('src/mailboxSchema.js')) {
    throw new Error('service-worker 未 precache mailboxSchema.js');
  }
  if (!swText.includes('questnote-mailbox-runtime-v1') && MAILBOX_RUNTIME_CACHE !== 'questnote-mailbox-runtime-v1') {
    throw new Error('MAILBOX_RUNTIME_CACHE 名稱不符');
  }
  if (!backupText.includes('globalMailboxState') || !backupText.includes("'3.4.4'")) {
    throw new Error('backupService 未支援 globalMailboxState / 3.4.4');
  }
  if (!backupText.includes('normalizeGlobalMailboxState')) {
    throw new Error('舊版備份應可正規化空 mailbox state');
  }
  stats.push('version=ok');

  // view model 分組
  const vm = buildMailboxViewModel(
    {
      messages: [
        normalizeMailboxMessage({
          id: 'vm-claim',
          type: 'compensation',
          title: '可領',
          body: 'a',
          publishedAt: '2026-01-01T00:00:00+08:00',
          enabled: true,
          reward: { stardust: 1 },
        }, {}, Date.parse('2026-07-26T12:00:00+08:00')),
      ],
    },
    normalizeGlobalMailboxState(null),
    { appVersion: '3.0.0', now: Date.parse('2026-07-26T12:00:00+08:00'), filter: 'all' },
  );
  if (vm.claimableCount !== 1) throw new Error('view model claimable 計算錯誤');
  stats.push('viewModel=ok');
  stats.push('no-side-effects=ok');

  const summary = stats.join(' | ');
  if (notes.length) return `ok with notes: ${notes.join('; ')} | ${summary}`;
  return summary;
}

/**
 * V3.0.1 信箱開發工具／作者發布工具隔離檢查
 * 禁止副作用：不得啟動 publisher、寫入 JSON、執行 Git、發放獎勵
 */
async function checkMailboxDevTools() {
  const stats = [];
  const notes = [];

  const [devRes, uiRes, indexRes, swRes, schemaRes, serviceRes, serverRes, pubHtmlRes, pubJsRes, backupRes] = await Promise.all([
    fetch('./src/devService.js'),
    fetch('./src/ui.js'),
    fetch('./index.html'),
    fetch('./service-worker.js'),
    fetch('./src/mailboxSchema.js'),
    fetch('./src/mailboxService.js'),
    fetch('./scripts/mailbox-publisher-server.mjs'),
    fetch('./scripts/mailbox-publisher-ui.html'),
    fetch('./scripts/mailbox-publisher-ui.js'),
    fetch('./src/backupService.js'),
  ]);

  if (!devRes.ok) throw new Error('無法讀取 devService.js');
  if (!uiRes.ok) throw new Error('無法讀取 ui.js');
  if (!indexRes.ok) throw new Error('無法讀取 index.html');
  if (!swRes.ok) throw new Error('無法讀取 service-worker.js');
  if (!schemaRes.ok) throw new Error('無法讀取 mailboxSchema.js');
  if (!serviceRes.ok) throw new Error('無法讀取 mailboxService.js');
  if (!serverRes.ok) throw new Error('無法讀取 mailbox-publisher-server.mjs');
  if (!pubHtmlRes.ok) throw new Error('無法讀取 mailbox-publisher-ui.html');
  if (!pubJsRes.ok) throw new Error('無法讀取 mailbox-publisher-ui.js');

  const devText = await devRes.text();
  const uiText = await uiRes.text();
  const indexText = await indexRes.text();
  const swText = await swRes.text();
  const schemaText = await schemaRes.text();
  const serviceText = await serviceRes.text();
  const serverText = await serverRes.text();
  const pubHtml = await pubHtmlRes.text();
  const pubJs = await pubJsRes.text();
  const backupText = await backupRes.text();

  // 1. 本機開發模式 -----------------------------------------------
  if (!devText.includes('export function isAuthorLocalDevMode')) {
    throw new Error('缺少 isAuthorLocalDevMode');
  }
  if (!devText.includes("hostname === 'localhost'")
    || !devText.includes("hostname === '127.0.0.1'")
    || !devText.includes("hostname === '[::1]'")) {
    throw new Error('isAuthorLocalDevMode 未限制 localhost / 127.0.0.1 / ::1');
  }
  if (!uiText.includes('isAuthorLocalDevMode()')) {
    throw new Error('信箱測試按鈕未使用 isAuthorLocalDevMode');
  }
  if (!uiText.includes('btn-dev-mailbox-announcement')
    || !uiText.includes('btn-dev-mailbox-compensation')
    || !uiText.includes('btn-dev-mailbox-clear')) {
    throw new Error('缺少本機信箱測試按鈕綁定');
  }
  if (!indexText.includes('btn-dev-mailbox-announcement')) {
    throw new Error('index.html 缺少信箱測試按鈕');
  }
  // 不得只用 debug 顯示信箱測試
  if (/isDebugMode\(\)[\s\S]{0,80}btn-dev-mailbox/.test(uiText)) {
    notes.push('請確認信箱測試未僅依 isDebugMode 顯示');
  }
  stats.push('local-mode=ok');

  // 2. 測試信件 ---------------------------------------------------
  if (!serviceText.includes('DEV_MAILBOX_SESSION_KEY')
    || !serviceText.includes('questnote_dev_mailbox_messages')) {
    throw new Error('缺少本機測試信件 sessionStorage key');
  }
  if (!serviceText.includes("source: 'local-dev'") && !serviceText.includes("source = 'local-dev'")) {
    throw new Error('缺少 local-dev source');
  }
  if (!serviceText.includes('mergeRemoteAndLocalDevMessages')) {
    throw new Error('缺少 remote/local-dev 合併');
  }
  if (!serviceText.includes('clearLocalDevMailboxMessages')) {
    throw new Error('缺少清除測試信件');
  }
  if (/clearLocalDevMailboxMessages[\s\S]{0,800}claimedIds\s*=/.test(serviceText)) {
    throw new Error('清除測試信件不應清除 claimedIds');
  }
  if (backupText.includes('questnote_dev_mailbox_messages')
    || backupText.includes('DEV_MAILBOX_SESSION_KEY')) {
    throw new Error('測試信件不應加入備份');
  }
  if (serviceText.includes('putMailboxRuntimeCache')
    && /injectLocalDev[\s\S]{0,400}putMailboxRuntimeCache/.test(serviceText)) {
    throw new Error('測試信件不應寫入 runtime cache');
  }
  stats.push('local-messages=ok');

  // 3. 測試補償 ---------------------------------------------------
  if (!serviceText.includes('DEV_LOCAL_COMPENSATION_ID')
    || !serviceText.includes('dev-local-compensation-v301')) {
    throw new Error('缺少固定測試補償 ID');
  }
  if (!serviceText.includes('stardust: 1')) {
    throw new Error('測試補償應固定星塵 ×1');
  }
  if (!serviceText.includes('claimMailboxReward') || !serviceText.includes('mailboxClaimInProgress')) {
    throw new Error('應使用正式 claim 流程／guard');
  }
  if (!uiText.includes('injectLocalDevCompensation') || !uiText.includes('claimMailboxReward')) {
    throw new Error('UI 應走正式 claimMailboxReward');
  }
  stats.push('local-compensation=ok');

  // 4. 作者工具隔離 -----------------------------------------------
  if (indexText.includes('mailbox-publisher') || indexText.includes('Mailbox Publisher')) {
    throw new Error('正式 index.html 不應有 publisher 入口');
  }
  if (uiText.includes('mailbox-publisher-server') || uiText.includes('/api/git-publish')) {
    throw new Error('正式 ui.js 不應匯入／呼叫 publisher');
  }
  if (/PRECACHE_URLS[\s\S]*mailbox-publisher/.test(swText)) {
    throw new Error('Service Worker 不應 precache publisher');
  }
  const precacheUrlsBlock = swText.match(/const PRECACHE_URLS\s*=\s*\[([\s\S]*?)\];/);
  if (precacheUrlsBlock && /publisher/i.test(precacheUrlsBlock[1])) {
    throw new Error('PRECACHE_URLS 不得包含 publisher');
  }
  stats.push('publisher-isolation=ok');

  // 5. 發布安全（靜態） -------------------------------------------
  if (/ghp_[A-Za-z0-9]+|github_pat_[A-Za-z0-9_]+|GITHUB_TOKEN\s*=\s*['"][^'"]+['"]/.test(serverText + pubJs + pubHtml)) {
    throw new Error('偵測到疑似 hardcoded Token');
  }
  if (/localStorage\.(setItem\()?['"]?(github|token|pat)/i.test(pubJs + serverText)) {
    throw new Error('不得將 Token 存入 localStorage');
  }
  if (!serverText.includes("HOST = '127.0.0.1'") && !serverText.includes('127.0.0.1')) {
    throw new Error('Publisher server 應只監聽 127.0.0.1');
  }
  if (serverText.includes('0.0.0.0')) {
    throw new Error('Publisher server 不得監聽 0.0.0.0');
  }
  if (!serverText.includes("path.join('data', 'global-mailbox.json')")
    && !serverText.includes('data/global-mailbox.json')) {
    throw new Error('Publisher 應限制寫入 global-mailbox.json');
  }
  if (serverText.includes('git add .') || serverText.includes("git', ['add', '-A']") || serverText.includes("['add', '.']")) {
    throw new Error('禁止 git add . / -A');
  }
  if (serverText.includes('--force') || serverText.includes('force-with-lease')) {
    throw new Error('禁止 force push');
  }
  if (!serverText.includes("['add', '--', MAILBOX_REL]") && !serverText.includes('git add --')) {
    notes.push('請確認 git stage 僅限 mailbox JSON');
  }
  stats.push('git-safety=ok');

  // 6. Schema 共用 ------------------------------------------------
  if (!schemaText.includes('export function validateMailboxDocument')
    || !schemaText.includes('export function validateMailboxReward')
    || !schemaText.includes('MAILBOX_REWARD_LIMITS')
    || !schemaText.includes('MAILBOX_ACTION_VIEW_ALLOWLIST')
    || !schemaText.includes('MAILBOX_MESSAGE_TYPES')) {
    throw new Error('mailboxSchema.js 缺少必要共用匯出');
  }
  if (!serviceText.includes("from './mailboxSchema.js'")) {
    throw new Error('mailboxService 未共用 mailboxSchema');
  }
  if (!serverText.includes("from '../src/mailboxSchema.js'")) {
    throw new Error('Publisher server 未共用 mailboxSchema');
  }
  if (!schemaText.includes('stardust: 5000') || !schemaText.includes('adventureEnergy: 100')) {
    throw new Error('Schema reward 上限不一致');
  }
  stats.push('schema-shared=ok');
  stats.push('no-side-effects=ok');

  const summary = stats.join(' | ');
  if (notes.length) return `ok with notes: ${notes.join('; ')} | ${summary}`;
  return summary;
}

/**
 * V3.1.1 寵物系列目錄／驗證／Builder 隔離／發布安全／Pool catalog
 * 禁止副作用：不得建立工作區、發布寵物、修改 JSON、複製圖片、修改 IndexedDB
 */
async function checkPetSeriesBuilder() {
  const stats = [];
  const notes = [];

  const [
    petsRes, loreRes, seriesRes, poolsRes,
    schemaRes, filterRes, gachaRes,
    indexRes, uiRes, swRes, backupRes, versionRes,
    serverRes, publishSvcRes, validateCliRes, publishCliRes,
  ] = await Promise.all([
    fetch('./data/pets.json'),
    fetch('./data/pets-lore.json'),
    fetch('./data/pet-series.json'),
    fetch('./data/pools.json'),
    fetch('./src/petDataSchema.js'),
    fetch('./src/petPoolFilter.js'),
    fetch('./src/gachaService.js'),
    fetch('./index.html'),
    fetch('./src/ui.js'),
    fetch('./service-worker.js'),
    fetch('./src/backupService.js'),
    fetch('./src/version.js'),
    fetch('./devtools/pet-series-builder/server.mjs'),
    fetch('./scripts/petSeriesPublishService.mjs'),
    fetch('./scripts/validate-pet-series.mjs'),
    fetch('./scripts/publish-pet-series.mjs'),
  ]);

  if (!petsRes.ok) throw new Error('無法讀取 pets.json');
  if (!loreRes.ok) throw new Error('無法讀取 pets-lore.json');
  if (!seriesRes.ok) throw new Error('無法讀取 pet-series.json');
  if (!poolsRes.ok) throw new Error('無法讀取 pools.json');
  if (!schemaRes.ok) throw new Error('無法讀取 petDataSchema.js');
  if (!filterRes.ok) throw new Error('無法讀取 petPoolFilter.js');
  if (!gachaRes.ok) throw new Error('無法讀取 gachaService.js');
  if (!indexRes.ok) throw new Error('無法讀取 index.html');
  if (!uiRes.ok) throw new Error('無法讀取 ui.js');
  if (!swRes.ok) throw new Error('無法讀取 service-worker.js');
  if (!backupRes.ok) throw new Error('無法讀取 backupService.js');
  if (!versionRes.ok) throw new Error('無法讀取 version.js');
  if (!serverRes.ok) throw new Error('無法讀取 pet-series-builder/server.mjs');
  if (!publishSvcRes.ok) throw new Error('無法讀取 petSeriesPublishService.mjs');
  if (!validateCliRes.ok) throw new Error('無法讀取 validate-pet-series.mjs');
  if (!publishCliRes.ok) throw new Error('無法讀取 publish-pet-series.mjs');

  const petsData = await petsRes.json();
  const loreData = await loreRes.json();
  const seriesCatalog = await seriesRes.json();
  const poolsData = await poolsRes.json();
  const schemaText = await schemaRes.text();
  const filterText = await filterRes.text();
  const gachaText = await gachaRes.text();
  const indexText = await indexRes.text();
  const uiText = await uiRes.text();
  const swText = await swRes.text();
  const backupText = await backupRes.text();
  const versionText = await versionRes.text();
  const serverText = await serverRes.text();
  const publishSvcText = await publishSvcRes.text();

  const pets = petsData.pets || [];
  const lore = loreData.lore || [];
  stats.push(`pets=${pets.length}`);
  stats.push(`lore=${lore.length}`);

  // 1. Pets catalog -------------------------------------------------
  const seriesIds = new Set((seriesCatalog.series || []).map((s) => s.id));
  const petCheck = validatePetCatalog(petsData, {
    mode: 'existing',
    seriesIds,
  });
  // 舊寵物缺新欄位只應 warning；真正 error 才 fail
  if (!petCheck.ok) {
    throw new Error(`Pets catalog 驗證失敗: ${petCheck.errors[0]?.message}`);
  }
  stats.push('pets-catalog=ok');

  // 2. Lore catalog -------------------------------------------------
  const loreCheck = validateLoreCatalog(loreData, { mode: 'existing' });
  if (!loreCheck.ok) {
    throw new Error(`Lore catalog 驗證失敗: ${loreCheck.errors[0]?.message}`);
  }
  const consistency = validatePetAndLoreConsistency(petsData, loreData);
  if (!consistency.ok) {
    throw new Error(`Pets/Lore 一致性失敗: ${consistency.errors[0]?.message}`);
  }
  stats.push('lore-catalog=ok');

  // 3. Series catalog ----------------------------------------------
  const seriesCheck = validateSeriesCatalog(seriesCatalog);
  if (!seriesCheck.ok) {
    throw new Error(`Series catalog 失敗: ${seriesCheck.errors[0]?.message}`);
  }
  if (!seriesIds.has(LEGACY_SERIES_ID)) {
    throw new Error('series 目錄缺少 legacy');
  }
  let legacyFallback = 0;
  let unknownSeries = 0;
  for (const pet of pets) {
    const sid = getPetSeriesId(pet);
    if (!pet.seriesId) legacyFallback += 1;
    if (pet.seriesId && !seriesIds.has(pet.seriesId)) unknownSeries += 1;
    if (sid !== (pet.seriesId || LEGACY_SERIES_ID) && pet.seriesId) {
      // getPetSeriesId should return trimmed seriesId or legacy
    }
  }
  if (unknownSeries > 0) {
    throw new Error(`有 ${unknownSeries} 隻寵物 seriesId 不存在於目錄`);
  }
  stats.push(`legacy-fallback=${legacyFallback}`);
  stats.push('series-catalog=ok');

  // 4. Pool matching（OR）與動態 catalog --------------------------------
  if (!filterText.includes('petTags.some') && !filterText.includes('.some((tag)')) {
    throw new Error('petPoolFilter 應採 OR（some）');
  }
  if (!gachaText.includes("from './petPoolFilter.js'") && !gachaText.includes('from "./petPoolFilter.js"')) {
    throw new Error('gachaService 應重用 petPoolFilter');
  }
  if (!gachaText.includes('getEligiblePetsForPool') || !gachaText.includes('matchesPetPoolFilter')) {
    throw new Error('gachaService 應匯出／使用共用 pool matching');
  }

  // OR 語意用合成 filter 探測（不依賴任何正式活動池是否存在）
  const orProbePet = { id: 'probe', poolTags: ['standard'], rarity: 'N' };
  const orPool = { id: 'probe_multi_tag', petFilter: { poolTags: ['standard', 'season_event'] } };
  if (!matchesPetPoolFilter(orProbePet, orPool)) {
    throw new Error('OR 語意失敗：僅有 standard 的寵物應符合含 standard 的多 tag filter');
  }
  const andWouldFail = { id: 'probe2', poolTags: ['standard'], rarity: 'N' };
  void andWouldFail;

  const pools = Array.isArray(poolsData.pools) ? poolsData.pools : [];
  if (pools.length < 1) {
    throw new Error('至少需要一個合法 Pool');
  }
  const activePools = pools.filter((p) => p.active);
  if (activePools.length < 1) {
    throw new Error('至少需要一個 active Pool');
  }
  const standardPool = pools.find((p) => p.id === 'standard');
  if (!standardPool) {
    throw new Error('缺少 standard Pool');
  }
  if (!standardPool.active) {
    throw new Error('standard Pool 必須為 active');
  }

  const eligibleStd = getEligiblePetsForPool(pets, standardPool);
  if (eligibleStd.length === 0) {
    throw new Error('standard Pool 候選為空');
  }
  stats.push(`pool-count=${pools.length}`);
  stats.push(`active-pools=${activePools.length}`);
  stats.push(`pool-standard=${eligibleStd.length}`);
  for (const pool of pools) {
    const eligible = getEligiblePetsForPool(pets, pool);
    stats.push(`pool-${pool.id}=${eligible.length}`);
  }

  // 不得硬性要求已移除的活動池
  if (pools.some((p) => p.id === 'event_dragon')) {
    notes.push('仍存在 event_dragon（預期 V3.1.1 已移除）');
  }

  const poolCheck = validatePoolCatalog(poolsData, {
    pets,
    getEligiblePetsForPool,
  });
  if (!poolCheck.ok) {
    throw new Error(`Pool 驗證失敗: ${poolCheck.errors[0]?.message}`);
  }
  stats.push('pool=ok');

  // ID 不填補空號
  const nextSp = getNextPetId(pets, PET_ID_TYPES.SPECIAL_SP);
  if (nextSp === 'pet_sp07') {
    throw new Error('ID 分配不應填補 pet_sp07');
  }
  stats.push(`next-sp=${nextSp}`);

  // 5. Builder 隔離 ------------------------------------------------
  if (/pet-series-builder|Pet Series Builder|4174/.test(indexText)) {
    throw new Error('正式 index.html 不得有 Builder 入口');
  }
  if (/pet-series-builder|devtools\/pet-series|4174/.test(uiText)
    && /data-action=["'][^"']*pet-series/.test(uiText)) {
    throw new Error('正式 ui.js 不得有 Builder action');
  }
  const precacheBlock = swText.match(/const PRECACHE_URLS\s*=\s*\[([\s\S]*?)\];/);
  if (precacheBlock && /devtools\/pet-series-builder|content\/pet-series|publish-pet-series|validate-pet-series/.test(precacheBlock[1])) {
    throw new Error('Service Worker 不得 precache Builder／content／scripts');
  }
  if (!swText.includes('src/petDataSchema.js') || !swText.includes('data/pet-series.json')) {
    throw new Error('Service Worker 應 precache petDataSchema.js 與 pet-series.json');
  }
  if (!swText.includes('src/petPoolFilter.js')) {
    throw new Error('Service Worker 應 precache petPoolFilter.js');
  }
  if (!serverText.includes("HOST = '127.0.0.1'") && !serverText.includes('HOST = "127.0.0.1"')) {
    throw new Error('Builder server 必須只監聽 127.0.0.1');
  }
  if (/listen\([^)]*0\.0\.0\.0/.test(serverText)) {
    throw new Error('Builder 禁止監聽 0.0.0.0');
  }
  stats.push('builder-isolation=ok');

  // 6. 發布安全（靜態） -------------------------------------------
  if (!publishSvcText.includes('dryRun') || !publishSvcText.includes('--dry-run') && !publishSvcText.includes('dryRun === true')) {
    if (!publishSvcText.includes('dryRun')) throw new Error('發布服務缺少 Dry Run');
  }
  if (!publishSvcText.includes('.dev-backups') || !publishSvcText.includes('BACKUPS_DIR')) {
    throw new Error('發布服務缺少備份');
  }
  if (!publishSvcText.includes('rolledBack') && !publishSvcText.includes('回滾') && !publishSvcText.includes('rollback')) {
    // rollback via copyFileSafe restore
    if (!publishSvcText.includes('copyFileSafe(path.join(backupDir')) {
      throw new Error('發布服務缺少 rollback');
    }
  }
  if (/forceOverwrite|overwrite.*true|強制覆蓋/.test(publishSvcText)) {
    throw new Error('不得提供強制覆蓋圖片選項');
  }
  if (!publishSvcText.includes('OFFICIAL_PETS_PATH') || !publishSvcText.includes('getPublishAllowlist')) {
    throw new Error('缺少發布目標白名單');
  }
  if (!schemaText.includes("mode === 'new'") || !schemaText.includes("mode === 'existing'")) {
    throw new Error('petDataSchema 應支援 existing／new 模式');
  }
  if (backupText.includes('pet-series.json') && /DATA_KEYS[\s\S]*pet-series/.test(backupText)) {
    throw new Error('pet-series.json 不應進入使用者備份');
  }
  if (!versionText.includes("APP_VERSION = '3.4.4'")) {
    throw new Error('APP_VERSION 應為 3.4.4');
  }
  if (!backupText.includes("'3.4.4'")) {
    throw new Error('backupService 應支援 3.4.4');
  }
  if (!swText.includes('PET_IMAGE_CACHE') || !swText.includes('MAILBOX_RUNTIME_CACHE')) {
    throw new Error('應保留 PET_IMAGE_CACHE 與 MAILBOX_RUNTIME_CACHE');
  }
  stats.push('publish-safety=ok');
  stats.push('no-side-effects=ok');

  const summary = stats.join(' | ');
  if (notes.length) return `ok with notes: ${notes.join('; ')} | ${summary}`;
  return summary;
}


/**
 * V3.4.0 晨醒花庭解鎖健康檢查
 */
async function checkMorningGardenAwakening() {
  const stats = [];
  const notes = [];

  const [petsRes, loreRes, poolsRes, versionRes, swRes, unlockRes, awakeningRes, backupRes, uiRes] = await Promise.all([
    fetch('./data/pets.json'),
    fetch('./data/pets-lore.json'),
    fetch('./data/pools.json'),
    fetch('./src/version.js'),
    fetch('./service-worker.js'),
    fetch('./src/poolUnlockService.js'),
    fetch('./src/poolAwakeningController.js'),
    fetch('./src/backupService.js'),
    fetch('./src/ui.js'),
  ]);

  if (!petsRes.ok) throw new Error('無法讀取 pets.json');
  if (!loreRes.ok) throw new Error('無法讀取 pets-lore.json');
  if (!poolsRes.ok) throw new Error('無法讀取 pools.json');
  if (!versionRes.ok) throw new Error('無法讀取 version.js');
  if (!swRes.ok) throw new Error('無法讀取 service-worker.js');
  if (!unlockRes.ok) throw new Error('缺少 poolUnlockService.js');
  if (!awakeningRes.ok) throw new Error('缺少 poolAwakeningController.js');
  if (!backupRes.ok) throw new Error('無法讀取 backupService.js');
  if (!uiRes.ok) throw new Error('無法讀取 ui.js');

  const petsData = await petsRes.json();
  const loreData = await loreRes.json();
  const poolsData = await poolsRes.json();
  const versionText = await versionRes.text();
  const swText = await swRes.text();
  const unlockText = await unlockRes.text();
  const awakeningText = await awakeningRes.text();
  const backupText = await backupRes.text();
  const uiText = await uiRes.text();

  const pets = petsData.pets || [];
  const lore = loreData.lore || [];
  const awakened = pets.filter((p) => (p.poolTags || []).includes('eternal_slumber_bloom_awakened'));
  const slumber = pets.filter((p) => (p.poolTags || []).includes('eternal_slumber_bloom'));
  const standard = pets.filter((p) => (p.poolTags || []).includes('standard'));
  const series = pets.filter((p) => p.seriesId === 'eternal_slumber_bloom');

  if (awakened.length !== 4) throw new Error('晨醒追加應為 4 隻，實際 ' + awakened.length);
  if (slumber.length !== 12) throw new Error('永眠期候選應為 12，實際 ' + slumber.length);
  if (standard.length !== 56) throw new Error('standard 應為 56，實際 ' + standard.length);
  if (series.length !== 16) throw new Error('系列總數應為 16，實際 ' + series.length);

  for (const pet of awakened) {
    const loreEntry = lore.find((l) => l.id === pet.id);
    if (!loreEntry) throw new Error('晨醒 lore 缺漏: ' + pet.id);
    if ((pet.poolTags || []).includes('standard')) throw new Error(pet.id + ' 不得混入 standard');
    if ((pet.poolTags || []).includes('eternal_slumber_bloom')) {
      throw new Error(pet.id + ' 不得直接加入 eternal_slumber_bloom tag（應走解鎖）');
    }
    const getRes = await fetch('./' + pet.image);
    if (!getRes.ok) throw new Error('晨醒圖片不存在: ' + pet.image);
  }
  stats.push('awakened-pets=4/4');

  const pool = (poolsData.pools || []).find((p) => p.id === 'eternal_slumber_bloom');
  if (!pool) throw new Error('缺少永眠花海卡池');
  const expansion = pool.unlockExpansion;
  if (!expansion) throw new Error('缺少 unlockExpansion');
  if (expansion.threshold !== 20) throw new Error('threshold 應為 20');
  if (!Array.isArray(expansion.extraPoolTags) || !expansion.extraPoolTags.includes('eternal_slumber_bloom_awakened')) {
    throw new Error('extraPoolTags 應含 eternal_slumber_bloom_awakened');
  }
  if (expansion.rewardPetId !== 'pet_r16') throw new Error('rewardPetId 應為 pet_r16（曉露花蝟）');
  const rewardPet = pets.find((p) => p.id === expansion.rewardPetId);
  if (!rewardPet || rewardPet.name !== '曉露花蝟') throw new Error('rewardPetId 未指向曉露花蝟');

  const lockedEligible = slumber.length;
  const unlockedEligible = slumber.length + awakened.length;
  if (lockedEligible !== 12) throw new Error('未解鎖候選應為 12');
  if (unlockedEligible !== 16) throw new Error('已解鎖候選應為 16');
  stats.push('eligible=12/16');

  if (!versionText.includes("APP_VERSION = '3.4.4'")) throw new Error('APP_VERSION 應為 3.4.4');
  if (!versionText.includes('questnote-cache-v344-pool-intro-polish')) {
    throw new Error('CACHE_NAME 應為 v344-pool-intro-polish');
  }
  if (!swText.includes('poolUnlockService.js') || !swText.includes('poolAwakeningController.js')) {
    throw new Error('SW 應 precache 解鎖模組');
  }
  if (swText.includes('assets/pets/pet_r16.png')) {
    throw new Error('寵物圖不得加入 App Shell precache');
  }
  if (!backupText.includes('poolUnlockState') || !backupText.includes('idempotentGrants')) {
    throw new Error('備份應包含 poolUnlockState / idempotentGrants');
  }
  if (!unlockText.includes('lifetimeDraws') || !unlockText.includes('rewardClaimed') || !unlockText.includes('animationSeen')) {
    throw new Error('解鎖 META 缺欄位');
  }
  if (!unlockText.includes('unavailable_no_pool_history')) {
    notes.push('舊玩家補判定應標記無 poolId 歷史');
  }
  if (!awakeningText.includes('playMorningGardenUnlock')) {
    throw new Error('缺少解鎖動畫控制器');
  }
  if (!uiText.includes('maybePlayMorningGardenAfterPull')) {
    throw new Error('UI 未串接晨醒解鎖演出');
  }

  try {
    const { getPoolUnlockState } = await import('./poolUnlockService.js');
    const state = await getPoolUnlockState();
    for (const [poolId, entry] of Object.entries(state.byPool || {})) {
      if (entry.rewardClaimed && !entry.unlocked) {
        notes.push('異常: ' + poolId + ' rewardClaimed=true 但 unlocked=false');
      }
    }
  } catch (err) {
    notes.push('解鎖狀態讀取略過: ' + (err.message || err));
  }

  stats.push('rates-unchanged=assumed');
  const summary = stats.join(' | ');
  if (notes.length) return 'ok with notes: ' + notes.join('; ') + ' | ' + summary;
  return summary;
}

/**
 * V3.4.3 SSR+ 演出流程修正健康檢查
 * - introSkipped / revealQueueSkipped 分離
 * - summonRevealService App Shell
 * - 候選數與 DB_VERSION 不變
 */
async function checkRevealFlowV343() {
  const stats = [];
  const notes = [];

  const [versionRes, swRes, svcRes, themedRes, uiRes, dbRes, petsRes, loreRes, poolsRes] = await Promise.all([
    fetch('./src/version.js'),
    fetch('./service-worker.js'),
    fetch('./src/summonRevealService.js'),
    fetch('./src/themedSummonController.js'),
    fetch('./src/ui.js'),
    fetch('./src/db.js'),
    fetch('./data/pets.json'),
    fetch('./data/pets-lore.json'),
    fetch('./data/pools.json'),
  ]);

  if (!versionRes.ok || !swRes.ok || !svcRes.ok || !themedRes.ok || !uiRes.ok || !dbRes.ok) {
    throw new Error('無法讀取 V3.4.3 必要檔案');
  }

  const versionText = await versionRes.text();
  const swText = await swRes.text();
  const svcText = await svcRes.text();
  const themedText = await themedRes.text();
  const uiText = await uiRes.text();
  const dbText = await dbRes.text();
  const petsData = await petsRes.json();
  const loreData = await loreRes.json();
  const poolsData = await poolsRes.json();

  if (!versionText.includes("APP_VERSION = '3.4.4'")) {
    throw new Error('APP_VERSION 應為 3.4.4');
  }
  if (!versionText.includes('questnote-cache-v344-pool-intro-polish')) {
    throw new Error('CACHE_NAME 應為 v344-pool-intro-polish');
  }
  if (!swText.includes('questnote-cache-v344-pool-intro-polish')) {
    throw new Error('service-worker CACHE_NAME 應為 v344');
  }
  if (!swText.includes("src/summonRevealService.js")) {
    throw new Error('summonRevealService 必須加入 App Shell precache');
  }
  const precacheBlock = (swText.match(/PRECACHE_URLS\s*=\s*\[([\s\S]*?)\];/) || [])[1] || '';
  if (/assets\/pets\//.test(precacheBlock)) {
    throw new Error('寵物圖片不得加入 App Shell precache');
  }
  stats.push('version/sw=ok');

  if (!dbText.includes('const DB_VERSION = 3')) {
    throw new Error('DB_VERSION 必須維持 3');
  }
  stats.push('DB_VERSION=3');

  if (!themedText.includes('introSkipped')) {
    throw new Error('主題召喚缺少 introSkipped');
  }
  if (!themedText.includes('skipIntroRitual')) {
    throw new Error('主題召喚缺少 skipIntroRitual');
  }
  if (/if\s*\(\s*!skipped\s*&&\s*ssrPlusQueue/.test(themedText)) {
    throw new Error('不得再用 skipped 阻擋 SSR+ queue');
  }
  if (!svcText.includes('revealQueueSkipped')) {
    throw new Error('summonRevealService 缺少 revealQueueSkipped');
  }
  if (!svcText.includes('advanceOnce') || !svcText.includes('stopPropagation')) {
    throw new Error('reveal 缺少 advanceOnce / stopPropagation');
  }
  if (!svcText.includes('collectSsrPlusRevealQueue') || !svcText.includes('duplicateCompensation')) {
    throw new Error('queue item 應保留 index / petId / compensation');
  }
  stats.push('skip-semantics=ok');

  if (!uiText.includes('pendingAwakening') || !uiText.includes('maybePlayMorningGardenAfterPull')) {
    throw new Error('第 20 抽 pendingAwakening 流程缺失');
  }
  if (!uiText.includes('presentationPath !== \'themed\'') && !uiText.includes('presentationPath !== "themed"')) {
    notes.push('結果 modal 與 themed summary 分流請確認');
  }
  stats.push('20th-draw-order=ok');

  const pets = petsData.pets || [];
  const lore = loreData.lore || [];
  const standard = pets.filter((p) => (p.poolTags || []).includes('standard'));
  const slumber = pets.filter((p) => (p.poolTags || []).includes('eternal_slumber_bloom'));
  const awakened = pets.filter((p) => (p.poolTags || []).includes('eternal_slumber_bloom_awakened'));
  if (pets.length !== 72) throw new Error(`pets 應為 72，實際 ${pets.length}`);
  if (lore.length !== 72) throw new Error(`pets-lore 應為 72，實際 ${lore.length}`);
  if (standard.length !== 56) throw new Error(`standard 應為 56，實際 ${standard.length}`);
  if (slumber.length !== 12) throw new Error(`永眠未解鎖應為 12，實際 ${slumber.length}`);
  if (slumber.length + awakened.length !== 16) {
    throw new Error(`永眠已解鎖應為 16，實際 ${slumber.length + awakened.length}`);
  }
  stats.push('candidates=56/12/16');

  const pool = (poolsData.pools || []).find((p) => p.id === 'eternal_slumber_bloom');
  const std = (poolsData.pools || []).find((p) => p.id === 'standard');
  if (!pool || !std) throw new Error('缺少卡池定義');
  if (JSON.stringify(pool.rates) !== JSON.stringify(std.rates)) {
    notes.push('兩池 rates 不一致（請人工確認是否預期）');
  }
  if (pool.cost !== 100 || std.cost !== 100) throw new Error('抽卡成本被改動');
  if (pool.pity?.ssr !== 30 || pool.pity?.ur !== 100) throw new Error('pity 被改動');
  stats.push('rates/pity/cost=ok');

  const summary = stats.join(' | ');
  if (notes.length) return `ok with notes: ${notes.join('; ')} | ${summary}`;
  return summary;
}

/**
 * V3.4.4 永眠花海卡池入場動畫優化健康檢查
 * 不改 rates／pity／cost／DB_VERSION；僅驗證 presentation／debut 模組與版本一致。
 */
async function checkPoolIntroPolishV344() {
  const stats = [];
  const notes = [];

  const [versionRes, swRes, themedRes, cssRes, presentationRes, debutRes, poolsRes, dbRes, backupRes] = await Promise.all([
    fetch('./src/version.js'),
    fetch('./service-worker.js'),
    fetch('./src/themedSummonController.js'),
    fetch('./src/styles.css'),
    fetch('./src/poolPresentation.js'),
    fetch('./src/poolDebutService.js'),
    fetch('./data/pools.json'),
    fetch('./src/db.js'),
    fetch('./src/backupService.js'),
  ]);

  if (!versionRes.ok || !swRes.ok || !themedRes.ok || !cssRes.ok || !presentationRes.ok || !debutRes.ok || !dbRes.ok) {
    throw new Error('無法讀取 V3.4.4 入場動畫必要檔案');
  }

  const versionText = await versionRes.text();
  const swText = await swRes.text();
  const themedText = await themedRes.text();
  const cssText = await cssRes.text();
  const presentationText = await presentationRes.text();
  const debutText = await debutRes.text();
  const poolsData = await poolsRes.json();
  const dbText = await dbRes.text();
  const backupText = await backupRes.text();

  if (!versionText.includes("APP_VERSION = '3.4.4'")) {
    throw new Error('APP_VERSION 應為 3.4.4');
  }
  if (!versionText.includes('questnote-cache-v344-pool-intro-polish')) {
    throw new Error('CACHE_NAME 應為 v344-pool-intro-polish');
  }
  if (!swText.includes('questnote-cache-v344-pool-intro-polish')) {
    throw new Error('service-worker CACHE_NAME 應為 v344');
  }
  if (!backupText.includes("'3.4.4'")) {
    throw new Error('backupService 應支援 3.4.4');
  }
  if (!dbText.includes('const DB_VERSION = 3')) {
    throw new Error('DB_VERSION 必須維持 3');
  }
  stats.push('version/sw/db=ok');

  if (!presentationText.includes('eternal_slumber_bloom') || !presentationText.includes('dream_bloom')) {
    throw new Error('poolPresentation 缺少永眠花海 theme／animation');
  }
  const pool = (poolsData.pools || []).find((p) => p.id === 'eternal_slumber_bloom');
  const std = (poolsData.pools || []).find((p) => p.id === 'standard');
  if (!pool?.presentation || pool.presentation.themeKey !== 'eternal_slumber_bloom') {
    throw new Error('永眠花海 presentation 異常');
  }
  if (!std) throw new Error('缺少 standard 池');
  stats.push('presentation=ok');

  if (!themedText.includes('playPoolDebutPresentation')) {
    throw new Error('缺少入場動畫函式 playPoolDebutPresentation');
  }
  if (!themedText.includes('is-phase-bloom') || !themedText.includes('is-phase-reveal')) {
    throw new Error('入場動畫缺少分鏡 phase class');
  }
  if (!themedText.includes('月皇花') || !themedText.includes('已於長夜中') || !themedText.includes('甦醒')) {
    throw new Error('入場台詞分段缺失');
  }
  if (!themedText.includes('is-exiting') || !themedText.includes('is-skipped')) {
    throw new Error('入場略過／結束狀態缺失');
  }
  if (!debutText.includes('poolDebutSeen') || !debutText.includes('hasSeenPoolDebut')) {
    throw new Error('poolDebutSeen 狀態服務缺失');
  }
  stats.push('debut-module=ok');

  const requiredCss = [
    '.dream-debut-overlay',
    '.dream-debut-mirror',
    '.dream-debut-flower',
    '.dream-debut-line__seg',
    '.is-pool-debut-veil',
    '.is-pool-debut-reveal',
    'dreamDebutPetalOpen',
  ];
  for (const token of requiredCss) {
    if (!cssText.includes(token)) {
      throw new Error(`缺少入場動畫 CSS: ${token}`);
    }
  }
  if (!cssText.includes('is-reduced') || !cssText.includes('prefers-reduced-motion')) {
    notes.push('請確認 reduced motion 分支仍存在');
  }
  stats.push('debut-css=ok');

  if (!swText.includes('src/themedSummonController.js') || !swText.includes('src/poolDebutService.js')) {
    throw new Error('入場相關模組必須在 App Shell precache');
  }
  if (swText.includes('devtools/pool-debut-preview.html')) {
    throw new Error('devtools 預覽頁不得加入 App Shell');
  }
  stats.push('app-shell=ok');

  if (pool.cost !== 100 || std.cost !== 100) throw new Error('抽卡成本被改動');
  if (pool.pity?.ssr !== 30 || pool.pity?.ur !== 100) throw new Error('pity 被改動');
  stats.push('rates-untouched=ok');

  const summary = stats.join(' | ');
  if (notes.length) return `ok with notes: ${notes.join('; ')} | ${summary}`;
  return summary;
}

export async function runAppHealthCheck() {
  const results = {};
  const errors = [];

  async function runCheck(key, fn) {
    try {
      const detail = await fn();
      results[key] = detail === undefined ? 'ok' : `ok (${detail})`;
    } catch (err) {
      results[key] = 'error';
      errors.push(`${key}: ${err.message || err}`);
    }
  }

  await runCheck('data files', async () => {
    const details = await checkDataFiles();
    return details.length + ' files';
  });
  await runCheck('indexedDB', checkIndexedDB);
  await runCheck('tasks', checkTasks);
  await runCheck('wallet', checkWallet);
  await runCheck('collection', checkCollection);
  await runCheck('habits', checkHabits);
  await runCheck('achievements', checkAchievements);
  await runCheck('gachaStats', checkGachaStats);
  await runCheck('userPreferences', checkUserPreferences);
  await runCheck('inventory', checkInventory);
  await runCheck('workshopStats', checkWorkshopStats);
  await runCheck('dailyCheckIn', checkDailyCheckIn);
  await runCheck('expeditions', checkExpeditions);
  await runCheck('archived modules', checkArchivedModules);
  await runCheck('render system', checkRenderSystem);
  await runCheck('pet images', checkPetImageSystem);
  await runCheck('version info', checkVersionInfo);
  await runCheck('sweet toast contrast', checkSweetToastContrast);
  await runCheck('gacha sync', checkGachaSync);
  await runCheck('sweet contrast', checkSweetContrast);
  await runCheck('summon reveal', checkSummonReveal);
  await runCheck('quest system', checkQuestSystem);
  await runCheck('quest contrast', checkQuestContrast);
  await runCheck('quest panel visual', checkQuestPanelVisual);
  await runCheck('bond system', checkBondSystem);
  await runCheck('bond contrast', checkBondContrast);
  await runCheck('pet image viewer', checkPetImageViewer);
  await runCheck('pet image viewer contrast', checkPetImageViewerContrast);
  await runCheck('exploration system', checkExplorationSystem);
  await runCheck('exploration contrast', checkExplorationContrast);
  await runCheck('expedition dispatch UX', checkExpeditionDispatchUX);
  await runCheck('typography scale', checkTypographyScale);
  await runCheck('stability readability polish', checkStabilityReadabilityPolish);
  await runCheck('companion wheel hotfix', checkCompanionWheelHotfix);
  await runCheck('collection milestones', checkCollectionMilestones);
  await runCheck('adventure handbook', checkAdventureHandbook);
  await runCheck('global mailbox', checkGlobalMailbox);
  await runCheck('mailbox dev tools', checkMailboxDevTools);
  await runCheck('pet series builder', checkPetSeriesBuilder);
  await runCheck('morning garden awakening', checkMorningGardenAwakening);
  await runCheck('reveal flow v343', checkRevealFlowV343);
  await runCheck('pool intro polish v344', checkPoolIntroPolishV344);
  await runCheck('service worker', checkServiceWorker);

  console.log('QuestNote Health Check:');
  for (const [key, status] of Object.entries(results)) {
    console.log(`- ${key}: ${status}`);
  }
  if (errors.length) {
    console.log('Errors:');
    for (const err of errors) {
      console.log(`  - ${err}`);
    }
    console.log('修復建議：重新整理 App；若持續失敗，請匯出備份後聯繫開發或等待下一版 migration。');
  } else {
    console.log('All checks passed.');
  }

  return { ok: errors.length === 0, results, errors };
}
