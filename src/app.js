/**

 * QuestNote 主程式 — 初始化、資料載入、狀態管理

 */

import { openDB, clearAllData } from './db.js';
import { RELEASE_PROFILE } from './releaseProfile.js';

import { getAllTasks } from './taskService.js';

import { migrateTasks } from './taskMigration.js';

import { sortTasks, getTodayDateString, isCompletedToday } from './taskFilterService.js';

import { loadCategoriesCatalog } from './categoryService.js';

import {

  initWallet,

  getWallet,

  getAvailablePulls,

} from './rewardService.js';

import {

  initGachaStats,

  getGachaStats,

} from './gachaService.js';

import {

  getPoolUnlockState,

  ensurePoolUnlockLegacyBackfillMarked,

} from './poolUnlockService.js';

import {

  syncWithPetDatabase,

  getCollectionProgress,

  getEnrichedCollection,

  getCompanion,

  migrateCollectionNicknames,

} from './collectionService.js';
import {
  initCollectionMilestones,
  getCollectionMilestoneSummary,
} from './collectionMilestoneService.js';

import { getWelcomeCompanionLine } from './companionDialogueService.js';

import { initUserPreferences, getUserPreferences, applyThemeToDocument } from './preferencesService.js';

import {

  initAchievements,

  loadAchievementsCatalog,

  loadTitlesCatalog,

  checkAndUnlockAchievements,

  getAchievementSummary,

} from './achievementService.js';

import { mergeAllPetsWithLore } from './loreService.js';

import {

  loadExpeditionAreas,

  getActiveExpedition,

} from './expeditionService.js';

import { initHabits, getAllHabits, getHabitPageStats } from './habitService.js';
import { initDailyCheckIn, getDailyCheckIn, loadWheelRewards } from './dailyCheckInService.js';
import { initQuestProgress, getQuestSummary } from './questService.js';
import { initExplorationProgress, getExplorationSummary } from './explorationService.js';

import {
  initWorkshop,
  loadMaterials,
  loadCraftables,
  getInventory,
  getWorkshopStats,
  getEnabledCraftables,
  hasCraftableMaterials,
  hasBondItemsInInventory,
  companionLikesAnyGift,
  hasLowMaterials,
} from './workshopService.js';

import { initUI, renderAfterRefresh, applyReduceMotionClass, syncGlobalMailbox, switchView, openGlobalMailbox, getMailboxGiftStatus } from './ui.js';
import { prepareOnboarding, resetOnboardingState } from './onboardingService.js';
import { initOnboarding } from './onboardingController.js';
import { runAppHealthCheck } from './healthCheckService.js';
import { getServiceWorkerRegisterUrl } from './version.js';
import { loadCatalogBundle } from './releaseCatalog.js';
import { preloadCompanionImage, preloadOwnedPetImages } from './imagePreloadService.js';



/** @type {object} 全域 App 狀態 */

const appState = {

  tasks: [],

  wallet: { stardust: 0, adventureEnergy: 0, materials: {} },

  gachaStats: { ssrPity: 0, urPity: 0, totalPulls: 0, tenPullCount: 0 },

  allPets: [],

  poolsData: { pools: [] },

  poolUnlockState: { key: 'poolUnlockState', schemaVersion: 1, byPool: {} },

  seriesCatalog: { series: [] },

  expeditionAreas: [],

  activeExpedition: null,

  collectionProgress: { owned: 0, total: 0 },

  enrichedCollection: [],

  collectionMilestoneSummary: null,

  companion: null,

  companionLine: '',

  todayCompleted: 0,

  availablePulls: 0,

  userPreferences: { reduceMotion: false, theme: 'default' },

  achievementSummary: null,

  categories: [],

  habits: [],

  habitStats: null,

  habitsLoadError: false,

  inventory: { items: {}, itemUsageLogs: {} },

  workshopStats: {
    craftCount: 0,
    giftCount: 0,
    favoriteGiftCount: 0,
  },

  materialsCatalog: [],

  craftablesCatalog: [],

  dailyCheckIn: null,

  questSummary: null,

  explorationSummary: null,

  onReset: resetAllData,

};



/** 上次已知日期，用於偵測跨日 */

let lastKnownDate = getTodayDateString();



async function loadGameData() {
  const [bundle, expeditionAreas] = await Promise.all([
    loadCatalogBundle(),
    loadExpeditionAreas().catch(() => []),
  ]);
  // All content references pass validation before this single state publication.
  const allPets = mergeAllPetsWithLore(bundle.petsData.pets, bundle.loreData);
  Object.assign(appState, { allPets, poolsData: bundle.poolsData,
    seriesCatalog: bundle.seriesCatalog, expeditionAreas });
  await syncWithPetDatabase(appState.allPets);
}

/** 預載首頁陪伴與已擁有寵物圖片（背景執行，不阻斷 UI） */
function warmCriticalPetImages() {
  preloadCompanionImage(appState).catch(() => {});
  preloadOwnedPetImages(appState.enrichedCollection, appState.allPets, 12).catch(() => {});
}



/**
 * 重新載入 App 狀態並刷新 UI
 * @param {{ renderMode?: 'full' | 'current' | string[] }} [options]
 */
async function refreshState(options = {}) {

  const today = getTodayDateString();

  if (today !== lastKnownDate) {

    lastKnownDate = today;

  }



  let habitsLoadError = false;

  const [tasks, wallet, gachaStats, availablePulls, habits, inventory, workshopStats, dailyCheckIn] =

    await Promise.all([

      getAllTasks(),

      getWallet(),

      getGachaStats(),

      getAvailablePulls(),

      getAllHabits().catch((err) => {

        console.error('[QuestNote] 習慣載入失敗:', err);

        habitsLoadError = true;

        return [];

      }),

      getInventory().catch((err) => {

        console.error('[QuestNote] 工坊庫存載入失敗:', err);

        return { items: {}, itemUsageLogs: {} };

      }),

      getWorkshopStats().catch((err) => {

        console.error('[QuestNote] 工坊統計載入失敗:', err);

        return { craftCount: 0, giftCount: 0, favoriteGiftCount: 0 };

      }),

      getDailyCheckIn().catch((err) => {

        console.error('[QuestNote] 每日祝福載入失敗:', err);

        return null;

      }),

    ]);



  const todayCompleted = tasks.filter((t) => isCompletedToday(t, today)).length;



  appState.habitsLoadError = habitsLoadError;

  appState.habits = habits;

  appState.habitStats = getHabitPageStats(habits, today);

  appState.inventory = inventory;

  appState.workshopStats = workshopStats;

  appState.dailyCheckIn = dailyCheckIn;

  appState.tasks = sortTasks(tasks);

  appState.wallet = wallet;

  appState.gachaStats = gachaStats;

  appState.poolUnlockState = await getPoolUnlockState().catch((err) => {

    console.error('[QuestNote] poolUnlockState 載入失敗:', err);

    return { key: 'poolUnlockState', schemaVersion: 1, byPool: {} };

  });

  appState.todayCompleted = todayCompleted;

  appState.availablePulls = availablePulls;

  appState.collectionProgress = await getCollectionProgress(appState.allPets);

  appState.enrichedCollection = await getEnrichedCollection(appState.allPets);

  appState.collectionMilestoneSummary = await getCollectionMilestoneSummary(appState.allPets);

  appState.companion = await getCompanion(appState.allPets);

  appState.activeExpedition = await getActiveExpedition();

  appState.userPreferences = await getUserPreferences();

  appState.companionLine = getWelcomeCompanionLine({

    tasks: appState.tasks,

    todayCompleted: appState.todayCompleted,

    companion: appState.companion,

    wallet: appState.wallet,

    activeExpedition: appState.activeExpedition,

    expeditionAreas: appState.expeditionAreas,

    habits: appState.habits,

    inventory: appState.inventory,

    dailyCheckIn: appState.dailyCheckIn,

    craftables: appState.craftablesCatalog,

    workshopHelpers: {
      hasCraftableMaterials,
      hasBondItemsInInventory,
      companionLikesAnyGift,
      hasLowMaterials,
    },

    isWelcome: true,

  });



  appState.achievementSummary = await getAchievementSummary(appState.allPets);

  appState.questSummary = await getQuestSummary().catch((err) => {
    console.error('[QuestNote] 冒險任務載入失敗:', err);
    return null;
  });

  appState.explorationSummary = await getExplorationSummary().catch((err) => {
    console.error('[QuestNote] 探索度載入失敗:', err);
    return null;
  });



  await renderAfterRefresh(options.renderMode ?? 'current');

  if (!Array.isArray(options.renderMode) || !options.renderMode.includes('gacha')) {
    warmCriticalPetImages();
  }

}



async function resetAllData() {

  await clearAllData();

  await initWallet();

  await initGachaStats();

  await ensurePoolUnlockLegacyBackfillMarked();

  await initUserPreferences();

  await initAchievements();

  await initDailyCheckIn();

  await initQuestProgress();

  await initExplorationProgress();

  await initCollectionMilestones();

  await initWorkshop();

  await resetOnboardingState();

}



export async function runAchievementCheck() {

  const result = await checkAndUnlockAchievements(appState.allPets);

  if (result.newlyUnlocked.length > 0) {

    appState.achievementSummary = await getAchievementSummary(appState.allPets);

  }

  return result;

}



// Waiting workers activate naturally after every previous client closes.



async function registerServiceWorker() {

  if (!('serviceWorker' in navigator)) return;



  try {

    const reg = await navigator.serviceWorker.register(getServiceWorkerRegisterUrl());

    console.log('[QuestNote] SW registered:', reg.scope);



    if (reg.waiting) {

      showUpdateBanner(reg);

    }



    reg.addEventListener('updatefound', () => {

      const newWorker = reg.installing;

      if (!newWorker) return;



      newWorker.addEventListener('statechange', () => {

        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {

          showUpdateBanner(reg);

        }

      });

    });



    document.addEventListener('visibilitychange', () => {

      if (document.visibilityState === 'visible') {

        reg.update().catch(() => {});

        const today = getTodayDateString();

        if (today !== lastKnownDate) {

          lastKnownDate = today;

          refreshState({ renderMode: 'full' }).catch((err) => console.warn('[QuestNote] 跨日刷新失敗:', err));

        }

        // 信箱前景檢查改由 UI 層 visibility listener + 節流處理

      }

    });



    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Never reload during an unsaved edit, draw, restore, or animation.
      showUpdateBanner(reg);
    });

  } catch (err) {

    console.warn('[QuestNote] SW registration failed:', err);

  }

}



function showUpdateBanner(reg) {
  if (document.getElementById('update-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.className = 'update-banner';
  banner.setAttribute('role', 'status');
  banner.innerHTML = '<p class="update-banner__text">新版本已準備。完成目前操作後，關閉所有 QuestNote 分頁與視窗，再重新開啟即可更新。</p><button type="button" class="btn btn--primary btn--sm" id="btn-update-dismiss">知道了</button>';
  document.body.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add('show'));
  document.getElementById('btn-update-dismiss').addEventListener('click', () => banner.remove());
}

async function initApp() {

  const loader = document.getElementById('app-loader');

  const hideLoader = () => loader?.remove();

  let onboardingAtStartup = null;



  try {

    await openDB();

    try {
      onboardingAtStartup = await prepareOnboarding();
    } catch (error) {
      console.warn('[QuestNote] 新手教學狀態無法載入:', error);
    }

    await initUserPreferences();
    appState.userPreferences = await getUserPreferences();
    applyThemeToDocument(appState.userPreferences.theme);
    applyReduceMotionClass(appState.userPreferences?.reduceMotion ?? false);

    // 儘早綁定 UI，確保畫面可互動
    initUI(appState, refreshState, runAchievementCheck);
    hideLoader();



    const migrationResult = await migrateTasks();

    if (migrationResult.error) {

      console.error('[QuestNote] 任務遷移錯誤:', migrationResult.error);

    }



    const habitInit = await initHabits();

    if (!habitInit.success) {

      console.error('[QuestNote] 習慣初始化錯誤:', habitInit.error);

    }



    await initWallet();

    await initGachaStats();

  await ensurePoolUnlockLegacyBackfillMarked();

  await initAchievements();

  await initDailyCheckIn();

  await initQuestProgress();

  await initExplorationProgress();

  await initCollectionMilestones();

  try {
    await loadWheelRewards();
  } catch (err) {
    console.warn('[QuestNote] 轉盤獎勵預載失敗:', err);
  }

  try {

      await initWorkshop();

      appState.materialsCatalog = await loadMaterials();

      appState.craftablesCatalog = await loadCraftables();

    } catch (err) {

      console.error('[QuestNote] 工坊初始化錯誤:', err);

      const { showToast } = await import('./ui.js');

      showToast('工坊資料初始化時發生問題，請稍後再試。', 'error');

    }

    try {

      await migrateCollectionNicknames();

    } catch (err) {

      console.error('[QuestNote] 暱稱 migration 錯誤:', err);

    }

    appState.userPreferences = await getUserPreferences();
    applyThemeToDocument(appState.userPreferences.theme);
    applyReduceMotionClass(appState.userPreferences?.reduceMotion ?? false);

    await loadAchievementsCatalog();

    await loadTitlesCatalog();



    try {

      await loadGameData();

    } catch (err) {

      console.error('[QuestNote] 遊戲資料載入失敗:', err);

      const { showToast } = await import('./ui.js');

      showToast('遊戲資料載入失敗，部分功能可能受影響', 'error');

    }



    try {

      appState.categories = await loadCategoriesCatalog();

    } catch (err) {

      console.error('[QuestNote] 分類載入失敗:', err);

      appState.categories = [];

    }



    if (migrationResult?.error) {

      const { showToast } = await import('./ui.js');

      showToast('任務資料升級時發生錯誤，部分功能可能受影響', 'error');

    }



    if (!habitInit?.success) {

      const { showToast } = await import('./ui.js');

      showToast('習慣資料初始化時發生錯誤，部分功能可能受影響', 'error');

    }



    await refreshState({ renderMode: 'full' });

    if (!RELEASE_PROFILE && location.hostname === 'leotsouo.github.io'
      && location.pathname.startsWith('/questnote-pwa-preview/')
      && new URLSearchParams(location.search).get('perf') === '1') {
      const { startPerfDiagnostics } = await import('./perfDiagnostics.js');
      startPerfDiagnostics(appState, refreshState);
    }



    const startupAchievements = await checkAndUnlockAchievements(appState.allPets);

    if (startupAchievements.newlyUnlocked.length > 0) {

      appState.achievementSummary = await getAchievementSummary(appState.allPets);

      await renderAfterRefresh('current');

    }

    initOnboarding(appState, { switchView, openGlobalMailbox, getMailboxGiftStatus }, onboardingAtStartup);



    // 信箱：主要初始化完成後非阻塞取得（不得阻塞啟動畫面）
    // once per local profile 狀態會在背景同步至 badge
    void syncGlobalMailbox({ force: true, silent: true }).catch((err) => {
      console.warn('[QuestNote] 啟動信箱同步失敗（不影響 App）:', err);
    });

    registerServiceWorker().catch((err) => {

      console.warn('[QuestNote] SW registration failed:', err);

    });

  } catch (err) {

    console.error('[QuestNote] Init failed:', err);

    hideLoader();

    try {

      initUI(appState, refreshState, runAchievementCheck);

    } catch (uiErr) {

      console.error('[QuestNote] UI init failed:', uiErr);

    }

    if (loader) {

      loader.textContent = `載入失敗：${err.message}`;

    }

  }

}



// Release bootstrap imports this module only after the verified worker is ready.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp, { once: true });
else void initApp();

if (typeof window !== 'undefined') {
  window.runAppHealthCheck = runAppHealthCheck;
}


