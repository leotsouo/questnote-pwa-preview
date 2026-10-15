import { ensureEncounterMigration, getEncounterEconomy } from './encounterEconomyService.js';
import { LOCAL_ART_PREVIEW } from './localArtPreview.js';
/**

 * QuestNote 主程式 — 初始化、資料載入、狀態管理

 */

import { initAppUpdates } from './updateController.js';
import { openModal, closeModal } from './ui.js';
import { openDB, clearAllData } from './db.js';
import { getReminderState, disableReminders } from './reminderService.js';
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

  setSelectedPoolId,

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

import { initUserPreferences, getUserPreferences, applyThemeToDocument, applyFontSizeToDocument, applyReadingModeToDocument } from './preferencesService.js';

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
import { getRecentExpeditions, isFirstJourneyAvailable } from './expeditionService.js';
import { getCampProgress } from './campService.js';

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

import { initUI, renderAfterRefresh, applyReduceMotionClass, syncGlobalMailbox, switchView, openGlobalMailbox, getMailboxGiftStatus, openTeachingTarget, openTaskForm, showGuidedHome, showToast } from './ui.js';
import { prepareOnboarding, resetOnboardingState } from './onboardingService.js';
import { initOnboarding, openOnboardingEducation } from './onboardingController.js';
import { initGuidedOnboarding } from './guidedOnboardingController.js';
import { runAppHealthCheck } from './healthCheckService.js';
import { getServiceWorkerRegisterUrl } from './version.js';
import { loadCatalogBundle } from './releaseCatalog.js';
import { loadBondStories, syncBondJourney } from './bondJourneyService.js';
import { loadAwakeningCatalog } from './petAwakeningCatalog.js';
import { syncPetAwakening } from './petAwakeningService.js';
import { awakeningPortrait } from './petAwakeningView.js';
import { preloadAwakeningForms } from './petAwakeningScene.js';
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
  recentExpeditions: [],
  campProgress: { level: 0 },
  firstJourneyAvailable: false,

  collectionProgress: { owned: 0, total: 0 },

  enrichedCollection: [],

  collectionMilestoneSummary: null,

  companion: null,

  companionLine: '',

  todayCompleted: 0,

  availablePulls: 0,

  userPreferences: { reduceMotion: false, theme: 'default', fontSize: 'standard' },

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
  for (const pet of appState.enrichedCollection.filter((p) => p.owned && p.bondLevel >= 5)) {
    const entry = appState.awakeningCatalog?.pets.find((p) => p.petId === pet.id);
    if (entry) preloadAwakeningForms(entry, appState.allPets.find((p) => p.id === pet.id)).catch(() => {});
  }
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



  const todayCompleted = tasks.filter((t) => !t.isTutorial && isCompletedToday(t, today)).length;



  appState.habitsLoadError = habitsLoadError;

  appState.habits = habits;

  appState.habitStats = getHabitPageStats(habits, today);

  appState.inventory = inventory;

  appState.workshopStats = workshopStats;

  appState.dailyCheckIn = dailyCheckIn;

  appState.tasks = sortTasks(tasks);

  appState.wallet = wallet;
  appState.encounterEconomy = await getEncounterEconomy();

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
  try {
    appState.bondJourney = await syncBondJourney();
    appState.bondJourneyError = null;
  } catch (error) {
    console.error('[QuestNote] 同行約定載入失敗:', error);
    appState.bondJourneyError = '同行紀錄暫時無法載入，請重試；原始紀錄已保留。';
  }

  try {
    appState.awakeningCatalog = await loadAwakeningCatalog();
    appState.petAwakening = await syncPetAwakening();
    appState.awakeningError = null;
    appState.enrichedCollection = appState.enrichedCollection.map((p) => awakeningPortrait(p, appState.petAwakening, appState.awakeningCatalog));
    appState.companion = awakeningPortrait(appState.companion, appState.petAwakening, appState.awakeningCatalog);
  } catch (error) {
    console.error('[QuestNote] 覺醒紀錄載入失敗:', error);
    appState.awakeningError = error.message;
  }
  appState.activeExpedition = await getActiveExpedition();
  appState.recentExpeditions = await getRecentExpeditions();
  appState.campProgress = await getCampProgress();
  appState.firstJourneyAvailable = await isFirstJourneyAvailable('mist_forest');

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
  const reminderState = await getReminderState();
  if (reminderState.token) await disableReminders();

  await clearAllData();

  await initWallet();
  await ensureEncounterMigration();

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



async function registerServiceWorker() {
  if (LOCAL_ART_PREVIEW) return;
  const options = { showIconGuide: openModal, openBackupSettings: () => {
    closeModal(); switchView('settings');
    document.getElementById('btn-export')?.scrollIntoView({ block: 'center' });
    document.getElementById('btn-export')?.focus({ preventScroll: true });
  } };
  if (!('serviceWorker' in navigator)) { initAppUpdates(null, options); return; }
  try {
    // Keep an existing registration's URL; update() fetches verified new bytes.
    const scope = new URL('../', import.meta.url).href;
    const existing = await navigator.serviceWorker.getRegistration(scope);
    const reg = existing?.scope === scope ? existing
      : await navigator.serviceWorker.register(getServiceWorkerRegisterUrl(), { updateViaCache: 'none' });
    initAppUpdates(reg, options);
    reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      reg.update().catch(() => {});
      const today = getTodayDateString();
      if (today !== lastKnownDate) {
        lastKnownDate = today;
        refreshState({ renderMode: 'full' }).catch((err) => console.warn('[QuestNote] 跨日刷新失敗:', err));
      }
    });
  } catch (err) {
    console.warn('[QuestNote] SW registration failed:', err);
    initAppUpdates(null, options);
  }
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
    applyReadingModeToDocument(appState.userPreferences.readingMode);
    applyThemeToDocument(appState.userPreferences.theme);
    applyFontSizeToDocument(appState.userPreferences.fontSize);
    applyReduceMotionClass(appState.userPreferences?.reduceMotion ?? false);

    // Bind handlers early; expose controls only after save and guide initialization.
    initUI(appState, refreshState, runAchievementCheck);



    const migrationResult = await migrateTasks();

    if (migrationResult.error) {

      console.error('[QuestNote] 任務遷移錯誤:', migrationResult.error);

    }



    const habitInit = await initHabits();

    if (!habitInit.success) {

      console.error('[QuestNote] 習慣初始化錯誤:', habitInit.error);

    }



    await initWallet();
  await ensureEncounterMigration();

    await initGachaStats();
    // First-time players start on standard; a chosen series survives relaunch.
    if (!(await getGachaStats()).selectedPoolId) await setSelectedPoolId('standard');

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
    applyReadingModeToDocument(appState.userPreferences.readingMode);
    applyThemeToDocument(appState.userPreferences.theme);
    applyFontSizeToDocument(appState.userPreferences.fontSize);
    applyReduceMotionClass(appState.userPreferences?.reduceMotion ?? false);

    await loadAchievementsCatalog();

    await loadTitlesCatalog();



    try {

      await loadGameData();
      appState.bondStories = await loadBondStories().catch((error) => {
        console.warn('[QuestNote] 夥伴故事載入失敗:', error);
        return null;
      });

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

    await initGuidedOnboarding(appState, { openTaskForm, showGuidedHome, showToast, refreshState, showPage: (view) => { closeModal(); switchView(view); },
      showEducationHelp: (feature) => { closeModal(); openOnboardingEducation(feature); },
      showGrowthHelp: () => { closeModal(); switchView('guide'); requestAnimationFrame(() => document.querySelector('#guide-growth-title')?.focus()); } });
    initOnboarding(appState, { switchView, openGlobalMailbox, getMailboxGiftStatus, openTeachingTarget, showToast }, onboardingAtStartup);
    hideLoader();



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
      const message = document.createElement('p');
      message.textContent = '載入未完成，請重新載入後再試。';
      const reload = document.createElement('button');
      reload.type = 'button';
      reload.className = 'btn btn--primary';
      reload.textContent = '重新載入';
      reload.addEventListener('click', () => window.location.reload());
      loader.setAttribute('role', 'alert');
      loader.replaceChildren(message, reload);
      document.body.appendChild(loader);
      reload.focus();
    }

  }

}



// Release bootstrap imports this module only after the verified worker is ready.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp, { once: true });
else void initApp();

if (typeof window !== 'undefined') {
  window.runAppHealthCheck = runAppHealthCheck;
}


