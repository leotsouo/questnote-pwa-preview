/**
 * UI 渲染與互動邏輯
 */
import {
  createTask,
  updateTask,
  deleteTask,
  toggleTaskComplete,
  addToTodayPlan,
  removeFromTodayPlan,
  toggleSubtaskComplete,
} from './taskService.js';
import { getCategoryById } from './categoryService.js';
import { bindDialogFocus, isTopDialog, rememberDialogFocus, focusDialog, restoreDialogFocus } from './dialogFocus.js';
import {
  getTodayDateString,
  isInTodayPlan,
  isCompletedToday,
  formatDateBadgeText,
  getDateBadgeClass,
  getSubtaskProgress,
  SMART_LISTS,
  filterBySmartList,
  filterByCategory,
  filterCompletedTasksByRange,
  COMPLETED_RANGE_OPTIONS,
  getCompletedRangeEmptyMessage,
  sortTasks,
  getTodayViewSections,
  validateDateRange,
} from './taskFilterService.js';
import { calculateRewardAmount, calculateAdventureEnergyAmount } from './rewardService.js';
import {
  pullOnce,
  performTenPull,
  setSelectedPoolId,
  getPoolPityCounters,
  ensurePoolPity,
} from './gachaService.js';
import {
  upgradeStar,
  setCompanion,
  STAR_UPGRADE_COST,
  getBondProgress,
  setPetNickname,
  clearPetNickname,
  validatePetNickname,
  getNicknameCharUnits,
  NICKNAME_MAX_UNITS,
  petCompanion,
  canPetCompanion,
  getPetCooldownRemaining,
  formatCooldown,
  updatePetBondUnlocks,
  getBondUnlocksByLevel,
} from './collectionService.js';
import {
  COLLECTION_RARITY_ORDER,
  claimCollectionMilestone,
} from './collectionMilestoneService.js';
import { getBondUpLine } from './companionService.js';
import {
  getCompanionDialogue,
  randomBubbleInterval,
  IDLE_THRESHOLD_MS,
} from './companionDialogueService.js';
import { setTheme, applyThemeToDocument, normalizeTheme } from './preferencesService.js';
import {
  pickStatusLine,
  randomStatusInterval,
  EXPEDITION_COMPLETE_MSG,
} from './expeditionStatusService.js';
import { getBondUnlockText } from './loreService.js';
import {
  downloadBackup,
  readBackupFile,
  validateBackup,
  normalizeBackupPayload,
  previewBackup,
  createAutoBackupBeforeImport,
  restoreBackup,
} from './backupService.js';
import {
  APP_VERSION,
  CACHE_NAME,
  BUILD_TIME,
  formatDisplayVersion,
  formatBuildTimeLocal,
} from './version.js';
import {
  getPetImageSrc,
  warmPetImageCache,
  preloadCompanionImage,
  preloadGachaResultImages,
  preloadOwnedPetImages,
  waitForPreloadWithTimeout,
  preloadImage,
} from './imagePreloadService.js';
import { createDeferredRenderGate } from './deferredRenderGate.js';
import { resolveActivePool, resolveDrawCost, normalizeUnlockExpansion, resolvePoolPresentationModel, validatePoolContent } from './poolContentContract.js';
import {
  claimAchievementReward,
  claimAllAchievementRewards,
  equipTitle,
  markTitlesSeen,
  markExportedBackup,
  getAchievementSummary,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  formatAchievementReward,
} from './achievementService.js';
import { isDevMode, isAuthorLocalDevMode, unlockDevTestPets, unlockAllDevPets, grantDevStardust, devForceCompleteExpedition, resetDevDailyBlessing, raiseDevCompanionBond } from './devService.js';
import {
  playSummonReveal,
  playSsrPlusRevealQueue,
  shouldPlayReveal,
  getHighestRarity,
  getRevealPetFromResults,
  isSummonRevealPlaying,
  pickDebugPetByRarity,
} from './summonRevealService.js';
import {
  normalizePoolPresentation,
  shouldUseThemedSummon,
} from './poolPresentation.js';
import {
  hasSeenPoolDebut,
  markPoolDebutSeen,
} from './poolDebutService.js';
import {
  playThemedSummon,
  playPoolDebutPresentation,
  isThemedSummonPlaying,
} from './themedSummonController.js';
import {
  getPoolUnlockEntry,
  ensureUnlockRewardClaimed,
  ensurePoolUnlockLegacyBackfillMarked,
  markUnlockAnimationSeen,
  emptyPoolUnlockEntry,
} from './poolUnlockService.js';
import {
  playPoolUnlock,
  isPoolAwakeningPlaying,
} from './poolAwakeningController.js';
import {
  escapeHtml,
  emptyStateHtml,
  errorStateHtml,
} from './uiHelpers.js';
import {
  startExpedition,
  claimExpeditionRewards,
  checkAreaUnlock,
  isExpeditionTimeComplete,
  getRemainingMs,
  formatRemainingTime,
  isPetOnExpedition,
} from './expeditionService.js';
import {
  createHabit,
  updateHabit,
  archiveHabit,
  completeHabitToday,
  uncompleteHabitToday,
  getTodayHabits,
  getWeeklyHabits,
  getArchivedHabits,
  getHabitPageStats,
  isCompletedToday as isHabitCompletedToday,
  isWeeklyGoalMet,
  getWeeklyCompletionCount,
  getHabitStreak,
  formatStreakLabel,
  getWeekMonday,
  hasWeeklyNearGoal,
} from './habitService.js';
import {
  craftItem,
  useBondItem,
  getCraftingPreview,
  getMaterialInfo,
  getCraftableInfo,
  getMaterialName,
  formatItemEffect,
  getFavoriteBonus,
  getDailyBondItemUsage,
  getEnabledCraftables,
  getMaterialInventory,
  getItemInventory,
  getFutureTagLabels,
  DAILY_BOND_ITEM_LIMIT,
  hasCraftableMaterials,
  hasBondItemsInInventory,
  companionLikesAnyGift,
  hasLowMaterials,
} from './workshopService.js';
import {
  performDailyCheckIn,
  prepareDailyWheelSpin,
  finalizeDailyWheelSpin,
  releaseWheelSpinLock,
  loadWheelRewards,
  hasCheckedInToday,
  hasSpunWheelToday,
  isWheelSpinning,
  calculateCheckInRewards,
  isYesterday,
} from './dailyCheckInService.js';
import { MATERIAL_LABELS } from './expeditionService.js';
import { updateQuestProgress, claimQuestReward } from './questService.js';
import {
  updateAreaExplorationProgress,
  getAreaExplorationIncrement,
  claimExplorationMilestone,
  AREA_EXPLORATION_DEFS,
} from './explorationService.js';
import { getAdventureHandbookSummary } from './adventureHandbookService.js';
import {
  fetchGlobalMailbox,
  refreshGlobalMailbox,
  getGlobalMailboxState,
  buildMailboxViewModel,
  getMailboxBadgeSummary,
  markMailboxMessageRead,
  claimMailboxReward,
  formatMailboxRewardPreview,
  getMailboxTypeLabel,
  getClaimStatusLabel,
  shouldCheckMailboxOnForeground,
  injectLocalDevAnnouncement,
  injectLocalDevCompensation,
  clearLocalDevMailboxMessages,
  getLocalDevMailboxMessages,
} from './mailboxService.js';
import {
  recordOnboardingEvent,
  refreshOnboarding,
  showOnboardingAfterReset,
  dismissOnboardingAfterRestore,
} from './onboardingController.js';

/** 稀有度中文與色彩 */
export const RARITY_LABELS = {
  N: 'N',
  R: 'R',
  SR: 'SR',
  SSR: 'SSR',
  UR: 'UR',
};

export const PRIORITY_LABELS = {
  normal: '普通',
  important: '重要',
  urgent: '緊急',
};

/** App 狀態參考（由 app.js 注入） */
let state = null;
let pendingImportBackup = null;
let pendingImportFileName = '';
let pendingImportWarnings = [];
let onRefresh = null;
let onAchievementCheck = null;
/** initUI 模組級重入防護：成功綁定後不可重複 addEventListener */
let uiInitialized = false;
/** 抽卡請求／演出進行中（比 dataset.pulling 更可靠，避免殘留鎖定） */
let gachaPullInProgress = false;
/** Data is refreshed after a pull, but the hidden collection DOM can wait until entry. */
const collectionRenderGate = createDeferredRenderGate();

/** 抽卡／解鎖視覺流程 session（不寫入 IndexedDB） */
const gachaSessionUi = {
  /** @type {'slumber'|null} 結果關閉前強制永眠期畫面 */
  visualPhaseLock: null,
  pendingAwakening: false,
  pendingAwakeningPoolId: null,
  /** @type {object|null} */
  pendingUnlockProgress: null,
};

/** @type {null|((value?: unknown) => void)} */
let gachaResultCloseResolver = null;
let latestPoolSelection = 0;

function resolveGachaResultWait() {
  if (typeof gachaResultCloseResolver === 'function') {
    const resolve = gachaResultCloseResolver;
    gachaResultCloseResolver = null;
    resolve();
  }
}

function waitNextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

/**
 * 畫面是否顯示晨醒期（與資料 unlocked 分離）
 * @param {object|null|undefined} unlockEntry
 */
function shouldShowAwakenedPresentation(unlockEntry) {
  if (gachaSessionUi.visualPhaseLock === 'slumber') return false;
  if (gachaSessionUi.pendingAwakening) return false;
  if (!unlockEntry?.unlocked) return false;
  if (!unlockEntry.animationSeen) return false;
  return true;
}

function beginPullVisualLock(poolId) {
  const entry = getUnlockEntryForPool(poolId);
  // 尚未看過解鎖動畫時，整段抽卡／結果維持永眠期畫面
  if (!entry.animationSeen) {
    gachaSessionUi.visualPhaseLock = 'slumber';
  }
}

function markPendingAwakening(poolId, unlockProgress) {
  const entry = unlockProgress?.entry || getUnlockEntryForPool(poolId);
  if (!entry?.unlocked || entry.animationSeen) return false;
  gachaSessionUi.pendingAwakening = true;
  gachaSessionUi.pendingAwakeningPoolId = poolId;
  gachaSessionUi.pendingUnlockProgress = unlockProgress || { entry };
  gachaSessionUi.visualPhaseLock = 'slumber';
  return true;
}

function clearPendingAwakening() {
  gachaSessionUi.pendingAwakening = false;
  gachaSessionUi.pendingAwakeningPoolId = null;
  gachaSessionUi.pendingUnlockProgress = null;
  gachaSessionUi.visualPhaseLock = null;
}
let expeditionTimer = null;
let expeditionStatusTimer = null;
let expeditionStatusIndex = -1;
let companionDialogueTimer = null;
let lastCompanionId = null;
let lastCompanionBondLevel = null;
let lastUserActivity = Date.now();
let currentTasksView = 'tasks';
// V2.7.2 派遣 Modal 狀態
let dispatchAreaId = null;
let dispatchSelectedPetId = null;
let dispatchKeydownHandler = null;
let achievementFilter = 'all';
let collectionFilter = 'all';
let collectionSeriesFilter = 'all';
let lastCollectionGridKey = null;
let collectionMilestonesExpanded = false;
let collectionMilestoneFilter = 'claimable';
let collectionMilestonesShowAll = false;
let taskViewMode = 'today';
let activeSmartListId = null;
let taskCategoryFilter = 'all';
let completedSectionCollapsed = true;
let completedRangeFilter = 'completed_1_month';
let archivedHabitsCollapsed = true;
let workshopTab = 'materials';
let questPanelTab = 'daily';
let questPanelCollapsed = true;
const explorationStoryCollapsed = {};
const explorationMilestonesCollapsed = {};
// 地區探索度整體區塊：預設收起（類似首頁功能，保持頁面整潔）
let explorationPanelCollapsed = true;

/** 全域信箱 UI 狀態（正文不持久化；狀態存 meta） */
let mailboxPayload = { schemaVersion: 1, generatedAt: null, messages: [], warnings: [] };
let mailboxStateLocal = null;
let mailboxFromCache = false;
let mailboxFetchFailed = false;
let mailboxFilter = null; // null = 依 defaultFilter
let mailboxSelectedId = null;
let mailboxRefreshing = false;
let mailboxKeydownHandler = null;
let mailboxLastFocus = null;

/** 正式版僅在 debug / localhost 輸出高頻 debug log */
function isUiDebugEnabled() {
  try {
    if (typeof location !== 'undefined') {
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return true;
      if (new URLSearchParams(location.search).get('debug') === '1') return true;
    }
    if (typeof localStorage !== 'undefined' && localStorage.getItem('questnote-debug') === '1') {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function uiDebugLog(...args) {
  if (isUiDebugEnabled()) console.debug(...args);
}
let dailyWheelRewards = null;
let dailyBlessingCollapsed = true;
let dailyBlessingCollapseDay = null;
// 首頁功能中樞：null | 'blessing' | 'quest' | 'titles'（預設全部收合，只顯示圖示）
let homeHubActive = null;
let selectedGiftPetId = null;
let selectedGiftItemId = null;
const expandedTaskIds = new Set();
const recentlyCompletedTaskIds = new Set();

/** 全域 Toast 提示 */
/** 寵物顯示名稱（暱稱優先） */
function petDisplayName(pet) {
  return pet?.displayName || pet?.name || '';
}

/** 寵物原始名稱 */
function petOriginalName(pet) {
  return pet?.originalName || pet?.name || '';
}

/** 有暱稱時顯示「原名：」小字 */
function petOriginalNameHtml(pet) {
  if (!pet?.nickname) return '';
  return `<p class="pet-original-name">原名：${escapeHtml(petOriginalName(pet))}</p>`;
}

/** 圖鑑卡片名稱 HTML */
function petNameBlockHtml(pet, { owned = true, heading = 'h3', className = 'collection-card__name' } = {}) {
  if (!owned) {
    return `<${heading} class="${className}">???</${heading}>`;
  }
  if (pet.nickname) {
    return `
      <${heading} class="${className}">${escapeHtml(petDisplayName(pet))}</${heading}>
      <p class="pet-original-name pet-original-name--sm">原名：${escapeHtml(petOriginalName(pet))}</p>`;
  }
  return `<${heading} class="${className}">${escapeHtml(petDisplayName(pet))}</${heading}>`;
}

function openNicknameModal(petId) {
  const pet = state.enrichedCollection.find((p) => p.id === petId);
  if (!pet) {
    showToast('找不到這隻寵物資料。', 'error');
    return;
  }
  if (!pet.owned) {
    showToast('尚未獲得的寵物無法設定暱稱。', 'warning');
    return;
  }

  const currentNickname = pet.nickname || '';
  const originalName = petOriginalName(pet);
  const maxDisplay = Math.floor(NICKNAME_MAX_UNITS / 2);

  openModal(`
    <div class="nickname-modal">
      <h2 class="modal-title">設定寵物暱稱</h2>
      <div class="nickname-modal__pet">
        ${petImageHtml(pet, { size: 'md' })}
        <p class="nickname-modal__original">原始名稱：${escapeHtml(originalName)}</p>
        ${pet.nickname ? `<p class="nickname-modal__current">目前暱稱：${escapeHtml(pet.nickname)}</p>` : '<p class="nickname-modal__current nickname-modal__current--empty">尚未設定暱稱</p>'}
      </div>
      <label class="nickname-modal__field">
        <span class="nickname-modal__label">暱稱</span>
        <input type="text" id="nickname-input" class="nickname-modal__input" maxlength="24" value="${escapeHtml(currentNickname)}" autocomplete="off" enterkeyhint="done" />
        <span class="nickname-modal__counter" id="nickname-counter">0 / ${maxDisplay}</span>
      </label>
      <p class="nickname-modal__hint">暱稱只會影響顯示名稱，不會改變寵物原始資料。</p>
      <div class="nickname-modal__actions">
        <button type="button" class="btn btn--secondary" id="nickname-cancel">取消</button>
        ${pet.nickname ? '<button type="button" class="btn btn--ghost" id="nickname-clear">清除暱稱</button>' : ''}
        <button type="button" class="btn btn--primary" id="nickname-save">儲存</button>
      </div>
    </div>
  `);

  const input = document.getElementById('nickname-input');
  const counter = document.getElementById('nickname-counter');

  const updateCounter = () => {
    const units = getNicknameCharUnits(input?.value || '');
    const displayUsed = Math.ceil(units / 2);
    if (counter) {
      counter.textContent = `${displayUsed} / ${maxDisplay}`;
      counter.classList.toggle('nickname-modal__counter--over', units > NICKNAME_MAX_UNITS);
    }
  };
  updateCounter();
  input?.addEventListener('input', updateCounter);

  document.getElementById('nickname-cancel')?.addEventListener('click', closeModal);

  document.getElementById('nickname-clear')?.addEventListener('click', async () => {
    const result = await clearPetNickname(petId);
    if (!result.success) {
      showToast(result.message || '暱稱儲存失敗，請稍後再試。', 'error');
      return;
    }
    closeModal();
    await onRefresh({ renderMode: ['collection'] });
    openPetDetailModal(petId);
    showToast('暱稱已清除', 'success');
  });

  document.getElementById('nickname-save')?.addEventListener('click', async () => {
    const value = input?.value ?? '';
    const validation = validatePetNickname(value);
    if (!validation.valid) {
      showToast(validation.error || '暱稱太長，請重新輸入。', 'warning');
      return;
    }
    const result = await setPetNickname(petId, value);
    if (!result.success) {
      showToast(result.message || '暱稱儲存失敗，請稍後再試。', 'error');
      return;
    }
    closeModal();
    await onRefresh({ renderMode: ['collection'] });
    openPetDetailModal(petId);
    showToast(result.cleared ? '暱稱已清除' : '暱稱已更新', 'success');
    if (!result.cleared) {
      const card = document.querySelector(`.collection-card[data-pet-id="${CSS.escape(String(petId))}"]`);
      if (card && !state.userPreferences?.reduceMotion) {
        card.classList.add('collection-card--nickname-glow');
        setTimeout(() => card.classList.remove('collection-card--nickname-glow'), 800);
      }
    }
    await handleAchievementCheckAfterAction();
  });
}

export function showToast(message, type = 'info', duration = 2800) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ', reward: '✨' };
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.innerHTML = `<span class="toast__icon" aria-hidden="true">${icons[type] || icons.info}</span><span class="toast__message">${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/** Sweet 主題 toast 可讀性測試（僅開發模式） */
function bindSweetToastDevTest() {
  if (!isDevMode()) return;
  window.testSweetToasts = function testSweetToasts() {
    showToast('任務完成！星塵 +20', 'success');
    setTimeout(() => showRewardToast(20, 1), 800);
    setTimeout(() => showToast('今天已經完成這項任務', 'info'), 1600);
    setTimeout(() => showToast('材料不足，無法製作', 'warning'), 2400);
    setTimeout(() => showToast('操作失敗，請稍後再試', 'error'), 3200);
  };
}

export function initUI(appState, refreshCallback, achievementCheckCallback) {
  // 狀態參考可更新；事件綁定只允許成功完成一次
  state = appState;
  onRefresh = refreshCallback;
  onAchievementCheck = achievementCheckCallback;

  if (uiInitialized) {
    console.warn('[UI] initUI skipped: already initialized');
    return;
  }

  uiInitialized = true;
  try {
    bindNavigation();
    bindModals();
    bindDelegatedEvents();
    bindActivityTracking();
    bindAchievementClaimAll();
    bindGlobalMailboxEntry();

    document.getElementById('collection-filters')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      collectionFilter = btn.dataset.filter;
      renderCollectionView();
      refreshOnboarding();
    });

    document.getElementById('collection-series-filters')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      collectionSeriesFilter = btn.dataset.seriesFilter || 'all';
      renderCollectionView();
    });

    document.getElementById('gacha-pool-select')?.addEventListener('change', async (e) => {
      const poolId = e.target.value;
      const selection = ++latestPoolSelection;
      if (!poolId || isGachaPullInProgress()) {
        renderGachaPoolSwitcher();
        return;
      }
      try {
        const stats = await setSelectedPoolId(poolId);
        if (selection !== latestPoolSelection) return;
        state.gachaStats = stats;
        renderGachaView();
        maybePlayPoolDebut._fromSwitcher = true;
        await maybePlayPoolDebut(poolId);
      } catch (err) {
        if (selection !== latestPoolSelection) return;
        showToast(err.message || '切換卡池失敗', 'error');
      }
    });

    document.getElementById('gacha-theme-details-btn')?.addEventListener('click', () => {
      const details = document.getElementById('gacha-theme-details');
      const btn = document.getElementById('gacha-theme-details-btn');
      if (!details || !btn) return;
      const open = details.hidden;
      details.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.textContent = open ? '收合詳情' : '卡池詳情';
    });

    document.getElementById('achievement-filters')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      achievementFilter = btn.dataset.achFilter;
      renderAchievementsView();
    });

    document.getElementById('task-view-tabs')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-task-view]');
      if (!btn) return;
      taskViewMode = btn.dataset.taskView;
      activeSmartListId = null;
      document.querySelectorAll('#task-view-tabs .segmented-control__btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.taskView === taskViewMode);
        b.setAttribute('aria-selected', b.dataset.taskView === taskViewMode ? 'true' : 'false');
      });
      renderTasksView();
    });

    document.getElementById('task-category-filters')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      taskCategoryFilter = btn.dataset.catFilter;
      renderTasksView();
    });

    document.getElementById('workshop-tabs')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-workshop-tab]');
      if (!btn) return;
      workshopTab = btn.dataset.workshopTab;
      document.querySelectorAll('#workshop-tabs .segmented-control__btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.workshopTab === workshopTab);
        b.setAttribute('aria-selected', b.dataset.workshopTab === workshopTab ? 'true' : 'false');
      });
      renderWorkshopView();
    });

    renderVersionInfo();
    bindSweetToastDevTest();
  } catch (error) {
    uiInitialized = false;
    throw error;
  }
}

/** 使用事件委派，避免重複渲染後按鈕失效 */
function bindDelegatedEvents() {
  document.getElementById('view-tasks')?.addEventListener('click', async (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const card = target.closest('.task-card');
    const id = card?.dataset.id;
    const action = target.dataset.action;

    if (action === 'home-hub') {
      const hub = target.dataset.hub;
      const willOpen = homeHubActive !== hub;
      homeHubActive = willOpen ? hub : null;
      if (willOpen && hub === 'blessing') {
        dailyBlessingCollapsed = false;
        renderDailyBlessingSection();
      }
      if (willOpen && hub === 'quest') {
        questPanelCollapsed = false;
        renderQuestPanel();
      }
      renderHomeHub();
      return;
    }

    if (action === 'quest-toggle-collapse') {
      questPanelCollapsed = !questPanelCollapsed;
      renderQuestPanel();
      return;
    }

    if (action === 'quest-tab') {
      const scope = target.dataset.scope;
      if (scope && scope !== questPanelTab) {
        questPanelTab = scope;
        renderQuestPanel();
      }
      return;
    }

    if (action === 'claim-quest') {
      const questCard = target.closest('.quest-card');
      const questId = questCard?.dataset.questId;
      const scope = questCard?.dataset.scope;
      if (!questId || !scope || target.disabled) return;
      target.disabled = true;
      const result = await claimQuestReward(questId, scope);
      if (!result.success) {
        showToast(result.error || '領取失敗', 'warning');
        await onRefresh({ renderMode: ['tasks'] });
        return;
      }
      const rewardText = formatDailyRewardBundle(result.reward) || '獎勵';
      const label = scope === 'weekly' ? '每週任務' : '每日任務';
      showToast(`已領取${label}獎勵：${rewardText}`, 'reward', 3200);
      await onRefresh({ renderMode: ['tasks'] });
      await handleAchievementCheckAfterAction();
      return;
    }

    if (action === 'toggle' && id) {
      const cardEl = target.closest('.task-card');
      const taskBefore = state.tasks.find((t) => t.id === id);
      const isCompleting = taskBefore && !taskBefore.completed;

      if (cardEl && isCompleting) {
        cardEl.classList.add('task-card--completing');
        cardEl.classList.add('task-card--done');
        const check = cardEl.querySelector('.task-check');
        if (check) {
          check.classList.add('checked');
          check.textContent = '✓';
        }
        cardEl.querySelector('.task-card__complete-btn')?.remove();
        cardEl.querySelector('.task-card__rewards')?.remove();
      }

      const result = await toggleTaskComplete(id);

      if (isCompleting) {
        recentlyCompletedTaskIds.add(id);
        setTimeout(() => recentlyCompletedTaskIds.delete(id), 2500);

        if (result.reward) {
          showRewardToast(result.reward.amount, result.reward.energy);
        } else {
          showToast('任務已完成', 'success');
        }
      }

      if (isCompleting) {
        await trackQuest('complete_task');
      }

      await onRefresh();

      if (isCompleting && taskViewMode === 'today') {
        requestAnimationFrame(() => {
          document.querySelector(`.task-card[data-id="${CSS.escape(String(id))}"]`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      }

      if (result.reward?.bond?.leveledUp) {
        const bondLine = getBondUpLine(state.companion);
        showBondLevelUpToast(result.reward.bond.newLevel, bondLine);
      }
      if (result.reward?.bond) {
        await notifyBondUnlocks(state.companion?.id);
      }
      await handleAchievementCheckAfterAction();
      if (isCompleting && result.justCompleted) {
        void recordOnboardingEvent('task-completed', { taskId: id });
      }
    } else if (action === 'toggle-subtask' && id) {
      const subtaskId = target.dataset.subtaskId;
      if (!subtaskId) return;
      const result = await toggleSubtaskComplete(id, subtaskId);
      await onRefresh();
      if (result.justCompleted) {
        showToast('子任務完成', 'success', 1800);
      }
      if (result.allSubtasksDone) {
        showToast('子任務都完成了，要完成這個任務嗎？', 'info', 3500);
      }
      await handleAchievementCheckAfterAction();
    } else if (action === 'toggle-expand' && id) {
      if (expandedTaskIds.has(id)) expandedTaskIds.delete(id);
      else expandedTaskIds.add(id);
      renderTasksView();
    } else if (action === 'plan-today' && id) {
      await addToTodayPlan(id);
      await onRefresh();
      showToast('已加入今日計畫', 'success');
      await handleAchievementCheckAfterAction();
    } else if (action === 'unplan-today' && id) {
      await removeFromTodayPlan(id);
      await onRefresh();
      showToast('已移出今日計畫', 'info');
    } else if (action === 'smart-list') {
      activeSmartListId = target.dataset.listId;
      if (target.dataset.listId === 'completed') {
        completedRangeFilter = 'completed_1_month';
      }
      renderTasksView();
    } else if (action === 'smart-list-back') {
      activeSmartListId = null;
      renderTasksView();
    } else if (action === 'completed-range') {
      completedRangeFilter = target.dataset.range;
      renderTasksView();
    } else if (action === 'toggle-completed-section') {
      completedSectionCollapsed = !completedSectionCollapsed;
      renderTasksView();
    } else if (action === 'pick-unscheduled') {
      taskViewMode = 'all';
      taskCategoryFilter = 'all';
      document.querySelectorAll('#task-view-tabs .segmented-control__btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.taskView === 'all');
      });
      renderTasksView();
    } else if (action === 'go-achievements') {
      switchView('achievements');
    } else if (action === 'go-habits') {
      switchView('habits');
    } else if (action === 'toggle-daily-blessing') {
      dailyBlessingCollapsed = !dailyBlessingCollapsed;
      dailyBlessingCollapseDay = getTodayDateString();
      renderDailyBlessingSection();
    } else if (action === 'daily-check-in') {
      await handleDailyCheckIn();
    } else if (action === 'daily-open-wheel') {
      await openDailyWheelModal();
    } else if (action === 'companion-view-image') {
      // 首頁陪伴寵物主圖：直接開原圖 viewer，不開詳情
      e.preventDefault();
      e.stopPropagation();
      const petId =
        target.dataset.petId ||
        target.closest('[data-pet-id]')?.dataset.petId ||
        state?.companion?.id;
      if (petId) openPetImageViewer(petId);
    } else if (action === 'companion-view-detail') {
      // 首頁陪伴卡片非圖片區：開啟寵物詳情
      e.preventDefault();
      e.stopPropagation();
      const petId =
        target.dataset.petId ||
        target.closest('[data-pet-id]')?.dataset.petId ||
        state?.companion?.id;
      if (petId) openPetDetailModal(petId);
    } else if (action === 'companion-pet') {
      e.preventDefault();
      e.stopPropagation();
      await handleCompanionPet();
    } else if (action === 'empty-add-task') {
      openTaskForm();
    } else if (action === 'empty-go-gacha') {
      switchView('gacha');
    } else if (action === 'empty-go-collection') {
      switchView('collection');
    } else if (action === 'edit' && id) {
      openTaskForm(id);
    } else if (action === 'delete' && id) {
      openConfirmModal('刪除任務', '確定要刪除此任務嗎？刪除後無法復原。', async () => {
        await deleteTask(id);
        await onRefresh();
        showToast('任務已刪除', 'success');
      }, { danger: true, confirmLabel: '刪除' });
    }
  });

  document.getElementById('btn-add-task')?.addEventListener('click', () => openTaskForm());

  document.getElementById('view-gacha')?.addEventListener('click', async (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'go-home-daily-blessing') {
      homeHubActive = 'blessing';
      dailyBlessingCollapsed = false;
      switchView('tasks');
      requestAnimationFrame(() => {
        renderDailyBlessingSection();
        renderHomeHub();
        document.getElementById('homeDailyBlessingContainer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } else if (action === 'daily-open-wheel') {
      await openDailyWheelModal();
    }
  });

  document.getElementById('btn-pull')?.addEventListener('click', handlePull);
  document.getElementById('btn-pull-ten')?.addEventListener('click', handleTenPull);

  document.getElementById('view-collection')?.addEventListener('click', async (e) => {
    const milestoneAction = e.target.closest('[data-collection-milestone-action]');
    if (milestoneAction) {
      const action = milestoneAction.dataset.collectionMilestoneAction;
      if (action === 'toggle') {
        collectionMilestonesExpanded = !collectionMilestonesExpanded;
        collectionMilestonesShowAll = false;
        if (collectionMilestonesExpanded) {
          collectionMilestoneFilter =
            (state.collectionMilestoneSummary?.claimableCount ?? 0) > 0
              ? 'claimable'
              : 'in_progress';
        }
        renderCollectionMilestones();
        return;
      }
      if (action === 'filter') {
        collectionMilestoneFilter = milestoneAction.dataset.filter || 'in_progress';
        collectionMilestonesShowAll = false;
        renderCollectionMilestones();
        return;
      }
      if (action === 'show-all') {
        collectionMilestonesShowAll = true;
        renderCollectionMilestones();
        return;
      }
      if (action === 'claim') {
        const milestoneId = milestoneAction.dataset.milestoneId;
        if (!milestoneId || milestoneAction.disabled) return;
        milestoneAction.disabled = true;
        const result = await claimCollectionMilestone(milestoneId, state.allPets || []);
        if (!result.success) {
          showToast(result.error || '收藏里程碑領取失敗', 'warning');
          await onRefresh({ renderMode: ['collection'] });
          return;
        }
        showToast(`已領取「${result.milestone.title}」：星塵 +${result.reward.stardust}`, 'reward', 3200);
        await onRefresh({ renderMode: ['collection', 'tasks'] });
        return;
      }
    }

    const emptyBtn = e.target.closest('[data-action="empty-go-gacha"]');
    if (emptyBtn) {
      switchView('gacha');
      return;
    }

    // 圖鑑寵物圖片 → 原圖 viewer（需擋冒泡，避免同時開詳情）
    const imageBtn = e.target.closest('[data-action="view-pet-image"]');
    if (imageBtn) {
      e.preventDefault();
      e.stopPropagation();
      const petId = imageBtn.dataset.petId || imageBtn.closest('.collection-card')?.dataset.petId;
      if (petId) openPetImageViewer(petId);
      return;
    }

    const detailBtn = e.target.closest('[data-action="view-detail"]');
    if (detailBtn) {
      const card = detailBtn.closest('.collection-card');
      openPetDetailModal(card?.dataset.petId);
      return;
    }

    const setBtn = e.target.closest('[data-action="set-companion"]');
    if (setBtn) {
      const card = setBtn.closest('.collection-card');
      const petId = card?.dataset.petId;
      if (petId) {
        await setCompanion(petId);
        await onRefresh({ renderMode: ['collection', 'tasks'] });
        showToast('已設為陪伴寵物', 'success');
        void recordOnboardingEvent('companion-set', { petId });
      }
      return;
    }

    const btn = e.target.closest('[data-action="upgrade"]');
    if (!btn) return;
    const card = btn.closest('.collection-card');
    const petId = card?.dataset.petId;
    if (!petId) return;

    const pet = state.enrichedCollection.find((p) => p.id === petId);
    const nextStar = (pet?.stars || 1) + 1;
    const cost = STAR_UPGRADE_COST[nextStar];

    const result = await upgradeStar(petId);
    if (result.success) {
      await onRefresh({ renderMode: ['collection', 'tasks'] });
      showToast(`${petDisplayName(pet)} 升級至 ${result.entry.stars} 星！`, 'success');
    } else {
      showToast(result.message || `升星需要 ${cost} 碎片`, 'warning');
    }
  });

  document.getElementById('btn-export')?.addEventListener('click', async () => {
    try {
      await downloadBackup();
      await markExportedBackup();
      await handleAchievementCheckAfterAction();
      showToast('JSON 備份已下載', 'success');
    } catch {
      showToast('匯出失敗，請稍後再試', 'error');
    }
  });

  initImportBackupHandlers();

  document.getElementById('btn-reset')?.addEventListener('click', handleReset);

  document.getElementById('btn-dev-unlock')?.addEventListener('click', handleDevUnlock);

  document.getElementById('btn-dev-unlock-all')?.addEventListener('click', handleDevUnlockAll);

  document.getElementById('btn-dev-stardust')?.addEventListener('click', handleDevStardust);
  document.getElementById('btn-dev-companion-bond')?.addEventListener('click', handleDevCompanionBond);

  document.getElementById('btn-dev-expedition')?.addEventListener('click', handleDevExpedition);
  document.getElementById('btn-dev-daily-blessing')?.addEventListener('click', handleDevResetDailyBlessing);
  document.getElementById('btn-dev-mailbox-announcement')?.addEventListener('click', handleDevMailboxAnnouncement);
  document.getElementById('btn-dev-mailbox-compensation')?.addEventListener('click', handleDevMailboxCompensation);
  document.getElementById('btn-dev-mailbox-clear')?.addEventListener('click', handleDevMailboxClear);

  // 演出測試僅本機綁定；正式環境即使殘留 DOM 也不掛 listener
  if (isAuthorLocalDevMode()) {
    document.getElementById('btn-test-ssr-reveal')?.addEventListener('click', () => testSummonReveal('SSR'));
    document.getElementById('btn-test-ur-reveal')?.addEventListener('click', () => testSummonReveal('UR'));
    document.getElementById('btn-test-ur05-reveal')?.addEventListener('click', () => testSummonRevealByPetId('pet_ur05'));
    document.getElementById('btn-test-ur06-reveal')?.addEventListener('click', () => testSummonRevealByPetId('pet_ur06'));
  }

  document.getElementById('view-expedition')?.addEventListener('click', (e) => {
    const emptyBtn = e.target.closest('[data-action="empty-go-gacha"]');
    if (emptyBtn) {
      switchView('gacha');
      return;
    }
    handleExpeditionClick(e);
  });

  document.getElementById('view-more')?.addEventListener('click', (e) => {
    const item = e.target.closest('[data-goto]');
    if (!item) return;
    switchView(item.dataset.goto);
    if (item.hasAttribute('data-scroll-daily-blessing')) {
      homeHubActive = 'blessing';
      dailyBlessingCollapsed = false;
      requestAnimationFrame(() => {
        renderDailyBlessingSection();
        renderHomeHub();
        document.getElementById('homeDailyBlessingContainer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  });

  document.getElementById('view-workshop')?.addEventListener('click', (e) => {
    handleWorkshopClick(e);
  });

  document.getElementById('view-handbook')?.addEventListener('click', (e) => {
    handleHandbookClick(e);
  });

  document.getElementById('view-guide')?.addEventListener('click', (e) => {
    const backBtn = e.target.closest('[data-goto]');
    if (backBtn) switchView(backBtn.dataset.goto);
  });

  document.getElementById('view-achievements')?.addEventListener('click', async (e) => {
    const backBtn = e.target.closest('[data-goto]');
    if (backBtn) {
      switchView(backBtn.dataset.goto);
      return;
    }

    const titleBtn = e.target.closest('[data-action="open-titles"]');
    if (titleBtn) {
      openTitleManagementModal();
      return;
    }

    const claimAllBtn = e.target.closest('[data-action="claim-all-achievements"]');
    if (claimAllBtn) {
      e.preventDefault();
      await handleClaimAllAchievements();
      return;
    }

    const claimBtn = e.target.closest('[data-action="claim-achievement"]');
    if (claimBtn) {
      const achId = claimBtn.dataset.id;
      if (!achId || claimBtn.disabled) return;
      claimBtn.disabled = true;
      const result = await claimAchievementReward(achId);
      if (result.success) {
        await onRefresh({ renderMode: ['achievements', 'tasks'] });
        showToast(`已領取：${result.achievement.name}`, 'success');
        renderAchievementsView();
      } else {
        showToast(result.error || '領取失敗', 'error');
        claimBtn.disabled = false;
      }
    }
  });

  document.getElementById('view-settings')?.addEventListener('click', async (e) => {
    const backBtn = e.target.closest('[data-goto]');
    if (backBtn) {
      switchView(backBtn.dataset.goto);
      return;
    }

    const themeCard = e.target.closest('[data-action="select-theme"]');
    if (themeCard) {
      const theme = themeCard.dataset.theme;
      if (theme) await applyTheme(theme);
    }
  });

  document.getElementById('achievement-strip')?.addEventListener('click', () => {
    switchView('achievements');
  });
  document.getElementById('achievement-strip')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      switchView('achievements');
    }
  });

  document.getElementById('habit-summary')?.addEventListener('click', () => switchView('habits'));
  document.getElementById('habit-summary')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      switchView('habits');
    }
  });

  document.getElementById('btn-add-habit')?.addEventListener('click', () => openHabitForm());

  document.getElementById('view-habits')?.addEventListener('click', async (e) => {
    const backBtn = e.target.closest('[data-goto]');
    if (backBtn) {
      switchView(backBtn.dataset.goto);
      return;
    }

    const toggleArchived = e.target.closest('[data-action="toggle-archived-habits"]');
    if (toggleArchived) {
      archivedHabitsCollapsed = !archivedHabitsCollapsed;
      renderHabitsView();
      return;
    }

    const target = e.target.closest('[data-action]');
    if (!target) return;

    const card = target.closest('.habit-card');
    const id = card?.dataset.id;
    const action = target.dataset.action;

    if (action === 'habit-complete' && id) {
      const cardEl = target.closest('.habit-card');
      cardEl?.classList.add('habit-card--completing');
      const result = await completeHabitToday(id);
      if (result.success) {
        await trackQuest('complete_habit');
        await onRefresh({ renderMode: ['habits', 'tasks'] });
        renderHabitsView();
        const parts = [];
        if (result.stardustGiven > 0) parts.push(`星塵 +${result.stardustGiven}`);
        if (result.energyGiven > 0) parts.push(`冒險能量 +${result.energyGiven}`);
        if (result.bondGiven > 0) parts.push('親密度 +1');
        if (parts.length > 0) {
          showToast(`習慣完成！${parts.join('、')}`, 'success');
        } else if (result.stardustCapped) {
          showToast('今日習慣星塵已達上限，仍已記錄完成。', 'warning');
        } else {
          showToast('習慣已記錄完成', 'success');
        }
        if (result.bondGiven > 0) {
          await notifyBondUnlocks(state.companion?.id);
        }
        await handleAchievementCheckAfterAction();
      } else {
        cardEl?.classList.remove('habit-card--completing');
        showToast(result.error || '完成失敗', 'error');
      }
    } else if (action === 'habit-uncomplete' && id) {
      const result = await uncompleteHabitToday(id);
      if (result.success) {
        await onRefresh({ renderMode: ['habits', 'tasks'] });
        renderHabitsView();
        showToast('已取消今日完成', 'info');
      } else {
        showToast(result.error || '操作失敗', 'error');
      }
    } else if (action === 'habit-edit' && id) {
      openHabitForm(id);
    } else if (action === 'habit-archive' && id) {
      openConfirmModal('封存習慣', '封存後將不再顯示於今日習慣，紀錄會保留。', async () => {
        const result = await archiveHabit(id);
        if (result.success) {
          await onRefresh({ renderMode: ['habits', 'tasks'] });
          renderHabitsView();
          showToast('習慣已封存', 'success');
          await handleAchievementCheckAfterAction();
        } else {
          showToast(result.error || '封存失敗', 'error');
        }
      });
    } else if (action === 'habit-create-first') {
      openHabitForm();
    }
  });
}

function bindNavigation() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });
}

export function switchView(viewName) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));

  const view = document.getElementById(`view-${viewName}`);
  const navView = viewName === 'achievements' || viewName === 'settings' || viewName === 'habits' || viewName === 'workshop' || viewName === 'handbook' || viewName === 'guide' ? 'more' : viewName;
  const nav = document.querySelector(`.nav-item[data-view="${navView}"]`);
  if (view) view.classList.add('active');
  if (nav) nav.classList.add('active');
  if (viewName === 'guide') window.scrollTo(0, 0);

  trackUserActivity();

  if (viewName === 'expedition') {
    // Rebuild the hidden page with rewards earned since its last render.
    renderExpeditionView();
    startExpeditionTimer();
  } else {
    stopExpeditionTimer();
  }

  if (viewName === 'tasks' && state?.companion) {
    refreshCompanionBubble({ isWelcome: true });
    startCompanionDialogueTimer();
  } else if (viewName !== 'tasks') {
    stopCompanionDialogueTimer();
  }

  if (viewName === 'achievements') {
    markTitlesSeen().then(() => {
      if (state?.achievementSummary) {
        state.achievementSummary.hasUnseenTitles = false;
      }
      renderNavBadges();
    });
    refreshAchievementsView();
  }

  if (viewName === 'habits') {
    renderHabitsView();
  }

  if (viewName === 'collection') collectionRenderGate.flush(renderCollectionView);

  if (viewName === 'workshop') {
    renderWorkshopView();
  }

  if (viewName === 'gacha') {
    renderGachaView();
    const pool = getSelectedGachaPool();
    if (pool?.id) {
      // 進入召喚頁：僅在尚未看過時播完整登場；短轉場留給手動切換
      maybePlayPoolDebut._fromSwitcher = false;
      maybePlayPoolDebut(pool.id).catch(() => {});
    }
  }

  if (viewName === 'settings') {
    renderSettingsView();
  }

  if (viewName === 'more') {
    renderMoreView();
  }

  if (viewName === 'handbook') {
    renderHandbookView();
  }

  if (viewName === 'collection') {
    preloadOwnedPetImages(state?.enrichedCollection, state?.allPets, 12).catch(() => {});
  }

  if (viewName === 'tasks' && state?.companion) {
    preloadCompanionImage(state).catch(() => {});
  }

  currentTasksView = viewName === 'achievements' || viewName === 'settings' || viewName === 'habits' || viewName === 'workshop' || viewName === 'handbook' || viewName === 'guide' || viewName === 'more'
    ? currentTasksView
    : viewName;
  if (viewName === 'tasks' || viewName === 'gacha' || viewName === 'collection' || viewName === 'expedition' || viewName === 'more') {
    currentTasksView = viewName;
  }
  renderNavBadges();
  void recordOnboardingEvent('view-changed', { viewName });
}

function bindModals() {
  bindDialogFocus();
  document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') dismissModal();
  });
  document.getElementById('modal-close')?.addEventListener('click', dismissModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isTopDialog(document.getElementById('modal-overlay'))) {
      e.preventDefault();
      e.stopImmediatePropagation();
      dismissModal();
    }
  });
}

function dismissModal() {
  const overlay = document.getElementById('modal-overlay');
  if (!isTopDialog(overlay)) return;
  // Cancel retains the existing restore-preview callback and DOM.
  const cancel = overlay.querySelector('#confirm-cancel');
  if (cancel) cancel.click();
  else closeModal();
}

export function openModal(contentHtml) {
  const overlay = document.getElementById('modal-overlay');
  const body = document.getElementById('modal-body');
  if (!overlay?.classList.contains('open')) rememberDialogFocus(overlay);
  if (body) body.innerHTML = contentHtml;
  overlay?.classList.add('open');
  document.body.classList.add('modal-open');
  if (body) body.scrollTop = 0;
  focusDialog(overlay);
}

export function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  const wasOpen = overlay?.classList.contains('open');
  overlay?.classList.remove('open');
  if (!document.getElementById('global-mailbox-modal')?.classList.contains('open')) {
    document.body.classList.remove('modal-open');
  }
  if (wasOpen) restoreDialogFocus(overlay);
  if (typeof resolveGachaResultWait === 'function') {
    resolveGachaResultWait();
  }
}

/* ─── V2.6.1 寵物原圖放大檢視器（獨立 overlay，可疊在其他 modal 之上） ─── */

let petImageViewerLastFocus = null;

/**
 * 依 petId 開啟寵物原圖檢視器（自 enrichedCollection / allPets / companion 取資料）。
 * 僅對已獲得且有圖片的寵物開啟。
 * @param {string} petId
 * @param {HTMLElement} [opener] 實際觸發按鈕，供關閉後返回焦點。
 */
export function openPetImageViewer(petId, opener) {
  if (!petId) return;
  const pet =
    (state.enrichedCollection || []).find((p) => p.id === petId) ||
    (state.companion?.id === petId ? state.companion : null) ||
    (state.allPets || []).find((p) => p.id === petId);
  if (!pet) return;
  if (pet.owned === false) {
    showToast('尚未獲得此寵物', 'info');
    return;
  }
  const src = getPetImageSrc(pet);
  if (!src) {
    showToast('這隻寵物沒有可顯示的原圖', 'info');
    return;
  }
  const original = pet.nickname ? petOriginalName(pet) : '';
  openPetImageViewerBySrc(src, petDisplayName(pet), pet.rarity, original, opener, getPetImageSrc(pet, 'stage'));
}

/**
 * 直接以圖片來源開啟寵物原圖檢視器。
 * @param {string} imageSrc 圖片來源
 * @param {string} petName 主名稱（有暱稱時顯示暱稱）
 * @param {string} rarity 稀有度
 * @param {string} [originalName] 副名稱（原名，僅有暱稱時顯示）
 * @param {HTMLElement} [opener] 未指定時沿用目前焦點。
 */
export function openPetImageViewerBySrc(imageSrc, petName, rarity, originalName = '', opener, previewSrc = '') {
  const resolved = getPetImageSrc({ image: imageSrc }) || imageSrc;
  if (!resolved) return;

  // 確保單一實例，先清掉任何殘留的檢視器
  closePetImageViewer();
  petImageViewerLastFocus = opener || document.activeElement;

  const rarityClass = rarity ? `rarity-${rarity}` : '';
  const safeName = escapeHtml(petName || '寵物原圖');
  const overlay = document.createElement('div');
  overlay.className = 'pet-image-viewer';
  overlay.id = 'pet-image-viewer';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', `${petName || '寵物'} 原圖`);
  overlay.innerHTML = `
    <div class="pet-image-viewer__backdrop" data-viewer-close></div>
    <div class="pet-image-viewer__content ${rarityClass}">
      <button class="pet-image-viewer__close" type="button" aria-label="關閉原圖檢視" data-viewer-close>×</button>
      <div class="pet-image-viewer__header">
        <div class="pet-image-viewer__title">${safeName}</div>
        ${originalName ? `<div class="pet-image-viewer__subtitle">原名：${escapeHtml(originalName)}</div>` : ''}
        ${rarity ? `<div class="pet-image-viewer__meta">${escapeHtml(rarity)}</div>` : ''}
      </div>
      <div class="pet-image-viewer__image-frame is-loading">
        <div class="pet-image-viewer__loading" aria-hidden="true">圖片載入中…</div>
        <div class="pet-image-viewer__error" role="alert">圖片暫時無法載入</div>
        <img
          class="pet-image-viewer__image"
          alt="${safeName}"
          decoding="async"
        />
        <div class="pet-image-viewer__preview-note" role="status" aria-live="polite"></div>
      </div>
      <div class="pet-image-viewer__hint">點擊背景或按關閉返回</div>
    </div>`;

  // 只有背景與關閉鈕會關閉；點圖片本身不關閉，避免誤觸
  overlay.addEventListener('click', (e) => {
    if (e.target.closest('[data-viewer-close]')) {
      closePetImageViewer();
    }
  });

  const frame = overlay.querySelector('.pet-image-viewer__image-frame');
  const image = overlay.querySelector('.pet-image-viewer__image');
  const note = overlay.querySelector('.pet-image-viewer__preview-note');
  const preview = previewSrc && previewSrc !== resolved ? previewSrc : resolved;
  let originalStarted = false;
  const loadOriginal = () => {
    if (originalStarted || preview === resolved) return;
    originalStarted = true;
    void preloadImage(resolved, { eager: true }).then(({ ok }) => {
      if (!overlay.isConnected) return;
      if (ok) image.src = resolved;
      else note.textContent = '原圖暫時無法載入，仍可查看預覽圖';
    });
  };
  image.onload = () => {
    frame.classList.remove('is-loading', 'is-error');
    frame.classList.add('is-loaded');
    if (image.src === new URL(resolved, location.href).href) note.textContent = '';
    else loadOriginal();
  };
  image.onerror = () => {
    if (image.src !== new URL(resolved, location.href).href) {
      image.src = resolved;
      return;
    }
    frame.classList.remove('is-loading', 'is-loaded');
    frame.classList.add('is-error');
  };
  image.src = preview;
  if (preview !== resolved) {
    note.textContent = '顯示預覽圖，原圖載入中…';
  }

  document.body.appendChild(overlay);
  document.body.classList.add('is-pet-image-viewer-open');
  // 用 capture 攔截 Escape，確保只關閉 viewer 而不會連帶關掉底層 modal
  document.addEventListener('keydown', handlePetImageViewerKeydown, true);

  requestAnimationFrame(() => {
    overlay.classList.add('is-open');
    overlay.querySelector('.pet-image-viewer__close')?.focus();
  });
}

function handlePetImageViewerKeydown(e) {
  if (e.key !== 'Escape') return;
  if (!isTopDialog(document.getElementById('pet-image-viewer'))) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  closePetImageViewer();
}

/** 關閉寵物原圖檢視器並清理 DOM / body class / 事件 / 焦點 */
export function closePetImageViewer() {
  document.removeEventListener('keydown', handlePetImageViewerKeydown, true);
  const overlay = document.getElementById('pet-image-viewer');
  if (overlay) rememberDialogFocus(overlay, petImageViewerLastFocus);
  if (overlay) overlay.remove();
  document.body.classList.remove('is-pet-image-viewer-open');
  if (petImageViewerLastFocus?.isConnected && typeof petImageViewerLastFocus.focus === 'function') {
    try {
      petImageViewerLastFocus.focus({ preventScroll: true });
    } catch {
      /* 元素可能已不存在 */
    }
  }
  if (overlay) restoreDialogFocus(overlay);
  petImageViewerLastFocus = null;
}

/** 確認彈窗 */
function openConfirmModal(title, message, onConfirm, options = {}) {
  const { confirmLabel = '確定', danger = false, onCancel = null } = options;
  openModal(`
    <div class="confirm-modal${danger ? ' confirm-modal--danger' : ''}">
      <div class="confirm-modal__icon">${danger ? '⚠️' : '❓'}</div>
      <h2 class="modal-title">${escapeHtml(title)}</h2>
      <p class="confirm-modal__text">${escapeHtml(message)}</p>
      <div class="confirm-modal__actions">
        <button class="btn btn--ghost" id="confirm-cancel">取消</button>
        <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" id="confirm-ok">${escapeHtml(confirmLabel)}</button>
      </div>
    </div>
  `);

  document.getElementById('confirm-cancel')?.addEventListener('click', () => {
    closeModal();
    if (typeof onCancel === 'function') onCancel();
  });
  document.getElementById('confirm-ok')?.addEventListener('click', async () => {
    closeModal();
    await onConfirm();
  });
}

/** 寵物圖片含 fallback；preview 模式顯示模糊黑白預覽（未獲得） */
export function petImageHtml(pet, options = {}) {
  const {
    size = 'md',
    preview = false,
    loading = 'lazy',
    eager = false,
    framed = true,
    imageVariant = size === 'lg' ? 'stage' : 'card',
  } = options;
  const cls = `pet-img pet-img--${size}`;
  const src = getPetImageSrc(pet, imageVariant);
  const originalSrc = getPetImageSrc(pet);
  const loadAttr = eager || loading === 'eager' ? 'eager' : loading;
  const onload = "this.classList.add('is-loaded');this.closest('.pet-image-frame')?.classList.remove('is-loading')";
  const onerror = "if(this.dataset.originalSrc&&this.src!==new URL(this.dataset.originalSrc,location.href).href){this.src=this.dataset.originalSrc;return;}this.onerror=null;this.classList.add('is-error');var f=this.closest('.pet-image-frame');if(f){f.classList.remove('is-loading');f.classList.add('is-error');}";
  const fallbackAttr = originalSrc ? ` data-original-src="${escapeHtml(originalSrc)}"` : '';
  const placeholder = framed
    ? `<div class="pet-image-frame pet-image-frame--${size} is-error" role="img" aria-label="圖片暫時無法載入"><span class="pet-image-frame__fallback" aria-hidden="true">?</span></div>`
    : `<div class="${cls} pet-img--placeholder"><span>?</span></div>`;

  if (!src) return placeholder;

  if (preview) {
    return `<div class="pet-img-wrap pet-img-wrap--preview pet-img-wrap--${size} pet-image-frame pet-image-frame--${size} is-loading">
      <img class="${cls} pet-img--preview is-loading" src="${escapeHtml(src)}"${fallbackAttr} alt="" loading="${loadAttr}" decoding="async" onload="${onload}" onerror="${onerror}" />
      <span class="pet-image-frame__fallback" aria-hidden="true">圖片載入中</span>
    </div>`;
  }

  if (!framed) {
    const onErrorLegacy = `if(this.dataset.originalSrc&&this.src!==new URL(this.dataset.originalSrc,location.href).href){this.src=this.dataset.originalSrc;return;}this.onerror=null;this.replaceWith(Object.assign(document.createElement('div'),{className:'${cls} pet-img--placeholder',innerHTML:'<span>?</span>'}))`;
    return `<img class="${cls} is-loading" src="${escapeHtml(src)}"${fallbackAttr} alt="${escapeHtml(petDisplayName(pet))}" loading="${loadAttr}" decoding="async" onload="this.classList.add('is-loaded')" onerror="${onErrorLegacy}" />`;
  }

  return `<div class="pet-image-frame pet-image-frame--${size} is-loading">
    <img class="${cls} is-loading" src="${escapeHtml(src)}"${fallbackAttr} alt="${escapeHtml(petDisplayName(pet))}" loading="${loadAttr}" decoding="async" onload="${onload}" onerror="${onerror}" />
    <span class="pet-image-frame__fallback" aria-hidden="true">圖片載入中</span>
  </div>`;
}

/** 星級顯示 */
export function renderStars(count, max = 5) {
  let html = '<span class="stars">';
  for (let i = 1; i <= max; i++) {
    html += `<span class="star ${i <= count ? 'star--filled' : ''}">★</span>`;
  }
  html += '</span>';
  return html;
}

/** 取得目前 active 的 view 名稱 */
function getCurrentViewName() {
  const active = document.querySelector('.view.active');
  if (active?.id?.startsWith('view-')) {
    return active.id.slice('view-'.length);
  }
  return currentTasksView || 'tasks';
}

/** 跨頁面共用的輕量 UI 更新（不重建整個 view） */
export function renderSharedUI() {
  if (!state) return;
  if (isWheelSpinning()) return;
  uiDebugLog('[Render] renderSharedUI');
  const { wallet, todayCompleted, achievementSummary } = state;
  setText('stat-stardust', wallet.stardust ?? 0);
  setText('stat-energy', wallet.adventureEnergy ?? 0);
  setText('stat-today', todayCompleted);
  setText('stat-pulls', getAvailablePullsForSelectedPool());
  const claimable = achievementSummary?.claimable ?? 0;
  setText('stat-claimable', claimable);
  const claimableCard = document.getElementById('stat-claimable-card');
  if (claimableCard) {
    claimableCard.classList.toggle('stat-card--highlight', claimable > 0);
  }
  setText('gacha-stardust', wallet.stardust ?? 0);
  setText('settings-stardust', wallet.stardust ?? 0);
  setText('settings-energy', wallet.adventureEnergy ?? 0);
  renderAchievementStrip();
  renderHomeHub();
  renderNavBadges();
  updateMailboxEntryBadge();
  updateGachaAffordability();
  renderGachaDailyBlessingEntry();
  maybeRefreshExpeditionBubble();
  refreshOnboarding();
}

/** 渲染指定 view */
export function renderView(viewName) {
  if (!state) return;
  if (isWheelSpinning()) return;
  uiDebugLog('[Render] renderView:', viewName);
  switch (viewName) {
    case 'tasks':
      renderTasksView();
      break;
    case 'gacha':
      renderGachaView();
      break;
    case 'collection':
      renderCollectionView();
      break;
    case 'expedition':
      renderExpeditionView();
      break;
    case 'workshop':
      renderWorkshopView();
      break;
    case 'achievements':
      renderAchievementsView();
      break;
    case 'habits':
      renderHabitsView();
      break;
    case 'settings':
      renderSettingsView();
      break;
    case 'more':
      renderMoreView();
      break;
    case 'handbook':
      renderHandbookView();
      break;
    case 'guide':
      refreshOnboarding();
      break;
    default:
      uiDebugLog('[Render] renderAll fallback (unknown view:', viewName, ')');
      renderAll();
  }
}

/** 僅渲染目前 view + 共用 UI */
export function renderCurrentView() {
  if (!state) return;
  if (isWheelSpinning()) {
    uiDebugLog('[Render] renderCurrentView skipped (wheel spinning)');
    return;
  }
  const viewName = getCurrentViewName();
  uiDebugLog('[Render] renderCurrentView:', viewName);
  if (isModalOpen()) {
    renderSharedUI();
    return;
  }
  renderView(viewName);
  renderSharedUI();
}

/** 刷新多個 view + 共用 UI */
export function renderViews(viewNames) {
  if (!state || isWheelSpinning()) return;
  if (isModalOpen()) {
    uiDebugLog('[Render] renderViews skipped view rebuild (modal open)');
    renderSharedUI();
    return;
  }
  const seen = new Set();
  for (const name of viewNames) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    renderView(name);
  }
  renderSharedUI();
}

/**
 * 資料刷新後的渲染入口
 * @param {'full' | 'current' | string[]} [mode]
 */
export async function renderAfterRefresh(mode = 'current') {
  if (mode === 'full') {
    await renderAll();
    return;
  }
  if (Array.isArray(mode)) {
    renderViews(mode);
    return;
  }
  renderCurrentView();
}

/** 渲染全部畫面（安全 fallback） */
export async function renderAll() {
  if (!state) return;
  if (isWheelSpinning()) {
    uiDebugLog('[Render] renderAll skipped (wheel spinning)');
    return;
  }
  uiDebugLog('[Render] renderAll fallback');
  applyThemeToDocument(state.userPreferences?.theme ?? 'default');
  applyReduceMotionClass(state.userPreferences?.reduceMotion ?? false);
  renderTasksView();
  renderGachaView();
  renderCollectionView();
  renderExpeditionView();
  renderSettingsView();
  renderMoreView();
  renderHandbookView();
  renderWorkshopView();
  renderHabitsView();
  if (document.getElementById('view-achievements')?.classList.contains('active')) {
    renderAchievementsView();
  }
  renderSharedUI();
}

function maybeRefreshExpeditionBubble() {
  if (!state?.companion || currentTasksView !== 'tasks') return;
  const exp = state.activeExpedition;
  if (!exp || !isExpeditionTimeComplete(exp) || exp.claimed) return;
  if (!document.getElementById('companion-bubble-text')) return;
  refreshCompanionBubble();
}

/* ─── 任務頁 ─── */

function renderTasksView() {
  const { tasks, wallet, todayCompleted, companion, companionLine, achievementSummary, categories } = state;
  const today = getTodayDateString();

  setText('stat-stardust', wallet.stardust ?? 0);
  setText('stat-energy', wallet.adventureEnergy ?? 0);
  setText('stat-today', todayCompleted);
  setText('stat-pulls', getAvailablePullsForSelectedPool());

  const claimable = achievementSummary?.claimable ?? 0;
  setText('stat-claimable', claimable);
  const claimableCard = document.getElementById('stat-claimable-card');
  if (claimableCard) {
    claimableCard.classList.toggle('stat-card--highlight', claimable > 0);
  }

  renderAchievementStrip();
  renderDailyBlessingSection();
  renderQuestPanel();
  renderHomeHub();
  renderCompanionSection(companion, companionLine);
  renderTodayPlanSummary(tasks, today);
  renderHabitSummary();
  renderCategoryFilters(categories);

  const catFilterEl = document.getElementById('task-category-filters');
  if (catFilterEl) {
    catFilterEl.hidden = taskViewMode === 'smart' && !activeSmartListId;
  }

  const contentEl = document.getElementById('task-view-content');
  if (!contentEl) return;

  if (taskViewMode === 'today') {
    contentEl.innerHTML = renderTodayView(tasks, today);
  } else if (taskViewMode === 'all') {
    contentEl.innerHTML = renderAllTasksView(tasks, today);
  } else if (taskViewMode === 'smart') {
    contentEl.innerHTML = activeSmartListId
      ? renderSmartListDetail(tasks, activeSmartListId, today)
      : renderSmartListHub(tasks, today);
  }
}

function renderHabitSummary() {
  const el = document.getElementById('habit-summary');
  if (!el) return;

  const stats = state.habitStats;
  if (!stats?.hasHabits) {
    el.hidden = true;
    return;
  }

  el.hidden = false;
  const cta = stats.hasIncompleteToday
    ? '<span class="habit-summary__cta">前往習慣 ›</span>'
    : '';

  el.innerHTML = `
    <div class="habit-summary__inner">
      <div class="habit-summary__stats">
        <div class="habit-summary__row">
          <span class="habit-summary__label">今日習慣</span>
          <span class="habit-summary__value">${stats.todayCompleted} / ${stats.todayTotal}</span>
        </div>
        <div class="habit-summary__row">
          <span class="habit-summary__label">最長連續</span>
          <span class="habit-summary__value">${stats.maxStreak} 天</span>
        </div>
      </div>
      ${cta}
    </div>`;
}

function formatDailyRewardBundle(bundle) {
  if (!bundle) return '';
  const parts = [];
  if (bundle.stardust > 0) parts.push(`星塵 +${bundle.stardust}`);
  if (bundle.adventureEnergy > 0) parts.push(`冒險能量 +${bundle.adventureEnergy}`);
  if (bundle.materials) {
    for (const [id, amt] of Object.entries(bundle.materials)) {
      if (amt > 0) parts.push(`${getMaterialName(id) || MATERIAL_LABELS[id] || id} +${amt}`);
    }
  }
  if (bundle.items) {
    for (const [id, amt] of Object.entries(bundle.items)) {
      if (amt > 0) {
        const info = getCraftableInfo(id);
        parts.push(`${info?.name || id} +${amt}`);
      }
    }
  }
  return parts.join('、');
}

function getProjectedCheckInStreak(daily, today, checkedIn) {
  if (checkedIn) return daily?.streak ?? 0;
  if (daily?.lastCheckInDate && isYesterday(daily.lastCheckInDate, today)) {
    return (daily.streak ?? 0) + 1;
  }
  return 1;
}

function buildDailyRewardPreviewChips(projectedStreak) {
  const base = calculateCheckInRewards(1);
  const full = calculateCheckInRewards(projectedStreak);
  const chips = [];

  chips.push({ icon: '✨', text: `星塵 +${base.stardust}`, bonus: false });
  chips.push({ icon: '⚡', text: `冒險能量 +${base.adventureEnergy}`, bonus: false });

  const extraStardust = full.stardust - base.stardust;
  if (extraStardust > 0) {
    chips.push({ icon: '✨', text: `星塵 +${extraStardust}`, bonus: true });
  }
  const extraEnergy = full.adventureEnergy - base.adventureEnergy;
  if (extraEnergy > 0) {
    chips.push({ icon: '⚡', text: `冒險能量 +${extraEnergy}`, bonus: true });
  }
  if (full.materials) {
    for (const [id, amt] of Object.entries(full.materials)) {
      if (amt > 0) {
        chips.push({
          icon: '💎',
          text: `${getMaterialName(id) || MATERIAL_LABELS[id] || id} +${amt}`,
          bonus: true,
        });
      }
    }
  }
  if (full.items) {
    for (const [id, amt] of Object.entries(full.items)) {
      if (amt > 0) {
        const info = getCraftableInfo(id);
        chips.push({
          icon: '🎁',
          text: `${info?.name || id} +${amt}`,
          bonus: true,
        });
      }
    }
  }
  return chips;
}

function getSevenDayMilestoneProgress(projectedStreak) {
  const target = 7;
  const progress = Math.min(projectedStreak, target);
  const percent = Math.round((progress / target) * 100);
  let label;
  if (projectedStreak >= target) {
    label = projectedStreak === target
      ? '今日達成 7 天連續簽到獎勵！'
      : '已解鎖 7 天連續簽到獎勵';
  } else {
    const remaining = target - projectedStreak;
    label = `距離 7 天獎勵還差 ${remaining} 天`;
  }
  return { percent, label };
}

function showDailyBlessingRewardToast(text) {
  const toast = document.createElement('div');
  toast.className = 'reward-toast reward-toast--daily';
  toast.innerHTML = `<span class="reward-toast__icon">🌙</span><span>${escapeHtml(text)}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function resolveDailyBlessingCollapsed(allDone, today) {
  if (dailyBlessingCollapseDay !== today) {
    dailyBlessingCollapseDay = today;
    // 預設一律折疊，保持頁面整潔（使用者可自行展開）
    dailyBlessingCollapsed = true;
  }
  return dailyBlessingCollapsed;
}

function buildDailyBlessingCardData() {
  const daily = state.dailyCheckIn;
  const today = getTodayDateString();
  const checkedIn = daily ? hasCheckedInToday(daily, today) : false;
  const spun = daily ? hasSpunWheelToday(daily, today) : false;
  const allDone = checkedIn && spun;
  const hasPending = !allDone;
  const collapsed = resolveDailyBlessingCollapsed(allDone, today);
  const streak = daily?.streak ?? 0;
  const bestStreak = daily?.bestStreak ?? 0;
  const projectedStreak = getProjectedCheckInStreak(daily, today, checkedIn);
  const rewardChips = buildDailyRewardPreviewChips(projectedStreak);
  const milestone = getSevenDayMilestoneProgress(projectedStreak);

  const checkInBtnLabel = checkedIn ? '今日已簽到' : '今日簽到';
  const wheelBtnLabel = spun ? '今日已轉盤' : '幸運轉盤';

  let statusBadgeText = '今日已完成';
  let statusBadgeClass = 'daily-status-badge done';
  if (!allDone) {
    statusBadgeClass = 'daily-status-badge';
    if (!checkedIn && !spun) statusBadgeText = '待領取';
    else if (!checkedIn) statusBadgeText = '簽到待領';
    else statusBadgeText = '轉盤待領';
  }

  let footerHint = '今天的祝福已全部領取，明天再來吧～';
  if (!allDone) {
    if (!checkedIn && !spun) footerHint = '完成簽到與轉盤，領取今日全部祝福';
    else if (!checkedIn) footerHint = '轉盤已轉，別忘了領取今日簽到獎勵';
    else footerHint = '簽到完成！記得轉動幸運轉盤喔';
  }

  let compactSummary = `連續 ${streak} 天`;
  if (allDone) {
    compactSummary += ' · 今日已完成';
  } else {
    const pendingParts = [];
    if (!checkedIn) pendingParts.push('簽到');
    if (!spun) pendingParts.push('轉盤');
    compactSummary += ` · 待領取：${pendingParts.join('、')}`;
  }

  const rewardChipsHtml = rewardChips.map((chip) => `
    <span class="daily-reward-chip${chip.bonus ? ' daily-reward-chip--bonus' : ''}">
      <span class="daily-reward-chip__icon" aria-hidden="true">${chip.icon}</span>
      <span class="daily-reward-chip__text">${escapeHtml(chip.text)}</span>
    </span>`).join('');

  const quickActions = collapsed && hasPending
    ? `<div class="daily-blessing-card__quick-actions">
        ${!checkedIn ? '<button type="button" class="btn btn--secondary btn--sm daily-blessing-card__quick-btn" data-action="daily-check-in">簽到</button>' : ''}
        ${!spun ? '<button type="button" class="btn btn--primary btn--sm daily-blessing-card__quick-btn" data-action="daily-open-wheel">轉盤</button>' : ''}
      </div>`
    : '';

  const html = `
    <div class="daily-blessing-card${collapsed ? ' daily-blessing-card--collapsed' : ''}${hasPending ? ' daily-blessing-card--pending' : ''}">
      <header class="daily-blessing-card__header">
        <button type="button" class="daily-blessing-card__toggle" data-action="toggle-daily-blessing" aria-expanded="${!collapsed}">
          <span class="daily-blessing-card__icon daily-blessing-card__icon--default" aria-hidden="true">✦</span>
          <span class="daily-blessing-card__icon daily-blessing-card__icon--sweet" aria-hidden="true">🌸</span>
          <span class="daily-blessing-card__header-main">
            <span class="daily-blessing-title">每日祝福</span>
            <span class="daily-blessing-subtitle daily-blessing-subtitle--default">冒險者每日補給</span>
            <span class="daily-blessing-subtitle daily-blessing-subtitle--sweet">每日小祝福</span>
            <span class="daily-blessing-card__compact-summary">${escapeHtml(compactSummary)}</span>
          </span>
          <span class="${statusBadgeClass}">${escapeHtml(statusBadgeText)}</span>
          <span class="daily-blessing-card__chevron" aria-hidden="true">${collapsed ? '▼' : '▲'}</span>
        </button>
        ${quickActions}
      </header>

      <div class="daily-blessing-card__body" ${collapsed ? 'hidden' : ''}>
        <section class="daily-streak-section" aria-label="連續簽到">
          <div class="daily-streak-row">
            <div class="daily-streak-stat">
              <span class="daily-streak-stat__label">連續簽到</span>
              <span class="daily-streak-stat__value">連續簽到 <span class="daily-streak-number">${streak}</span> 天</span>
            </div>
            <div class="daily-streak-stat">
              <span class="daily-streak-stat__label">最高紀錄</span>
              <span class="daily-streak-stat__value">最高紀錄 ${bestStreak} 天</span>
            </div>
          </div>
          <div class="daily-milestone-progress">
            <div class="daily-milestone-progress__header">
              <span class="daily-milestone-progress__label">${escapeHtml(milestone.label)}</span>
              <span class="daily-milestone-progress__value">${Math.min(projectedStreak, 7)} / 7</span>
            </div>
            <div class="progress-bar daily-milestone-progress__bar">
              <div class="progress-bar__fill daily-milestone-progress__fill" style="width: ${milestone.percent}%"></div>
            </div>
          </div>
        </section>

        <section class="daily-reward-preview" aria-label="今日獎勵預覽">
          <h3 class="daily-reward-preview__title">今日獎勵預覽</h3>
          <div class="daily-reward-preview__chips">
            ${rewardChipsHtml}
          </div>
        </section>

        <div class="daily-blessing-card__actions">
          <button type="button" class="btn btn--secondary daily-blessing-card__btn"
            data-action="daily-check-in" ${checkedIn ? 'disabled' : ''}>
            ${escapeHtml(checkInBtnLabel)}
          </button>
          <button type="button" class="btn btn--primary daily-blessing-card__btn"
            data-action="daily-open-wheel" ${spun ? 'disabled' : ''}>
            ${escapeHtml(wheelBtnLabel)}
          </button>
        </div>

        <p class="daily-blessing-card__footer">${escapeHtml(footerHint)}</p>
      </div>
    </div>`;

  return { html, hasPending, allDone, checkedIn, spun, compactSummary, statusBadgeText };
}

/* ─── 冒險任務（每日 / 每週） ─── */

/** 依獎勵 bundle 建立顯示用 chip 清單 */
function buildQuestRewardChips(reward) {
  const chips = [];
  if (!reward) return chips;
  if (reward.stardust > 0) {
    chips.push({ type: 'stardust', label: `星塵 +${reward.stardust}` });
  }
  if (reward.adventureEnergy > 0) {
    chips.push({ type: 'energy', label: `冒險能量 +${reward.adventureEnergy}` });
  }
  if (reward.materials) {
    for (const [id, amt] of Object.entries(reward.materials)) {
      if (amt > 0) {
        chips.push({ type: 'material', label: `${getMaterialName(id) || MATERIAL_LABELS[id] || id} +${amt}` });
      }
    }
  }
  if (reward.items) {
    for (const [id, amt] of Object.entries(reward.items)) {
      if (amt > 0) {
        const info = getCraftableInfo(id);
        chips.push({ type: 'item', label: `${info?.name || id} +${amt}` });
      }
    }
  }
  return chips;
}

function buildQuestCardHtml(quest) {
  const percent = quest.target > 0
    ? Math.min(100, Math.round((quest.current / quest.target) * 100))
    : 0;

  let cardStateClass = '';
  let badgeClass = 'quest-status-badge--progress';
  let badgeText = '進行中';
  let btnText = '進行中';
  let btnDisabled = true;
  if (quest.status === 'claimable') {
    cardStateClass = ' is-complete';
    badgeClass = 'quest-status-badge--claimable';
    badgeText = '可領取';
    btnText = '領取';
    btnDisabled = false;
  } else if (quest.status === 'claimed') {
    cardStateClass = ' is-claimed';
    badgeClass = 'quest-status-badge--claimed';
    badgeText = '已領取';
    btnText = '已領取';
    btnDisabled = true;
  }

  const chips = buildQuestRewardChips(quest.reward)
    .map((chip) => `<span class="quest-reward-chip" data-reward-type="${chip.type}">${escapeHtml(chip.label)}</span>`)
    .join('');

  return `
    <div class="quest-card${cardStateClass}" data-quest-id="${escapeHtml(quest.id)}" data-scope="${escapeHtml(quest.scope)}">
      <div class="quest-card__head">
        <span class="quest-card__title">${escapeHtml(quest.title)}</span>
        <span class="quest-status-badge ${badgeClass}">${badgeText}</span>
      </div>
      <p class="quest-card__description">${escapeHtml(quest.description)}</p>
      <div class="quest-card__progress">
        <div class="quest-card__progress-bar">
          <div class="quest-card__progress-fill" style="width:${percent}%"></div>
        </div>
        <span class="quest-card__progress-text">${quest.current} / ${quest.target}</span>
      </div>
      ${chips ? `<div class="quest-card__rewards">${chips}</div>` : ''}
      <button
        type="button"
        class="quest-claim-button"
        data-action="claim-quest"
        ${btnDisabled ? 'disabled' : ''}
      >${btnText}</button>
    </div>`;
}

function renderQuestPanel() {
  const el = document.getElementById('quest-panel');
  if (!el) return;

  const summary = state.questSummary;
  if (!summary) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  el.hidden = false;

  const scope = questPanelTab === 'weekly' ? 'weekly' : 'daily';
  const activeData = scope === 'weekly' ? summary.weekly : summary.daily;

  const totalClaimable = summary.totalClaimable ?? 0;

  // 狀態 badge：有獎勵可領 / 今日已完成 / 今日進行中
  let statusText = '今日進行中';
  let statusClass = 'quest-panel__status-badge--progress';
  if (totalClaimable > 0) {
    statusText = '有獎勵可領';
    statusClass = 'quest-panel__status-badge--claimable';
  } else if (summary.daily.total > 0 && summary.daily.completedCount >= summary.daily.total) {
    statusText = '今日已完成';
    statusClass = 'quest-panel__status-badge--done';
  }

  const collapsed = questPanelCollapsed;
  el.classList.toggle('quest-panel--collapsed', collapsed);

  const listHtml = activeData.items.length > 0
    ? activeData.items.map(buildQuestCardHtml).join('')
    : '<p class="quest-empty">目前沒有可顯示的任務。</p>';

  el.innerHTML = `
    <div class="quest-panel__inner${collapsed ? ' quest-panel--collapsed' : ''}${totalClaimable > 0 ? ' quest-panel--pending' : ''}">
      <header class="quest-panel__header-wrap">
        <button
          type="button"
          class="quest-panel__header"
          data-action="quest-toggle-collapse"
          aria-expanded="${!collapsed}"
          aria-controls="quest-panel-body"
        >
          <span class="quest-panel__icon" aria-hidden="true">🗺️</span>
          <span class="quest-panel__header-main">
            <span class="quest-panel__eyebrow">每日 / 每週挑戰</span>
            <span class="quest-panel__title">冒險任務</span>
            <span class="quest-panel__subtitle">完成每日與每週挑戰，累積冒險獎勵</span>
          </span>
          <span class="quest-panel__status-badge ${statusClass}">${statusText}</span>
          <span class="quest-panel__collapse-icon" aria-hidden="true">${collapsed ? '▼' : '▲'}</span>
        </button>
      </header>
      <div class="quest-panel__body" id="quest-panel-body" ${collapsed ? 'hidden' : ''}>
        <div class="quest-panel__summary">
          <div class="quest-panel__summary-item">
            <span class="quest-panel__summary-label">每日完成</span>
            <span class="quest-panel__summary-value">${summary.daily.completedCount} / ${summary.daily.total}</span>
          </div>
          <div class="quest-panel__summary-item">
            <span class="quest-panel__summary-label">每週完成</span>
            <span class="quest-panel__summary-value">${summary.weekly.completedCount} / ${summary.weekly.total}</span>
          </div>
          <div class="quest-panel__summary-item">
            <span class="quest-panel__summary-label">可領取</span>
            <span class="quest-panel__summary-value">${totalClaimable}</span>
          </div>
        </div>
        <div class="quest-panel__tabs" role="tablist" aria-label="冒險任務分頁">
          <button type="button" class="quest-tab${scope === 'daily' ? ' is-active' : ''}" data-action="quest-tab" data-scope="daily" role="tab" aria-selected="${scope === 'daily'}">
            每日${summary.daily.claimableCount > 0 ? ` <span class="quest-tab__dot" aria-hidden="true"></span>` : ''}
          </button>
          <button type="button" class="quest-tab${scope === 'weekly' ? ' is-active' : ''}" data-action="quest-tab" data-scope="weekly" role="tab" aria-selected="${scope === 'weekly'}">
            每週${summary.weekly.claimableCount > 0 ? ` <span class="quest-tab__dot" aria-hidden="true"></span>` : ''}
          </button>
        </div>
        <div class="quest-list quest-panel__list">${listHtml}</div>
        <p class="quest-panel__footer-hint">完成挑戰可以獲得星塵、材料與道具</p>
      </div>
    </div>`;
}

/**
 * 依行為事件更新冒險任務進度，並於任務完成時提示。
 * 失敗時不影響原本操作（僅 console warn）。
 */
async function trackQuest(eventType, amount = 1) {
  try {
    const result = await updateQuestProgress(eventType, amount);
    if (result?.newlyCompleted?.length) {
      for (const { quest } of result.newlyCompleted) {
        showToast(`冒險任務完成：${quest.title}`, 'success', 2600);
      }
    }
  } catch (err) {
    console.warn('[QuestNote] 冒險任務進度更新失敗:', err);
  }
}

function renderDailyBlessingSection() {
  const homeEl = document.getElementById('homeDailyBlessingContainer');
  if (!homeEl) return;

  const { html, hasPending } = buildDailyBlessingCardData();
  homeEl.innerHTML = html;

  if (hasPending) {
    homeEl.classList.add('daily-blessing-section--pending');
  } else {
    homeEl.classList.remove('daily-blessing-section--pending');
  }

  renderGachaDailyBlessingEntry();
}

function renderGachaDailyBlessingEntry() {
  const el = document.getElementById('gacha-daily-blessing-entry');
  if (!el) return;

  const { allDone, checkedIn, spun, compactSummary, statusBadgeText } = buildDailyBlessingCardData();

  let statusClass = 'daily-blessing-gacha-entry__status';
  if (allDone) statusClass += ' daily-blessing-gacha-entry__status--done';

  el.innerHTML = `
    <div class="daily-blessing-gacha-entry__card card">
      <div class="daily-blessing-gacha-entry__main">
        <span class="daily-blessing-gacha-entry__icon" aria-hidden="true">✦</span>
        <div class="daily-blessing-gacha-entry__text">
          <span class="daily-blessing-gacha-entry__title">每日祝福</span>
          <span class="daily-blessing-gacha-entry__summary">${escapeHtml(compactSummary)}</span>
        </div>
        <span class="${statusClass}">${escapeHtml(statusBadgeText)}</span>
      </div>
      <div class="daily-blessing-gacha-entry__actions">
        ${!checkedIn ? '<button type="button" class="btn btn--secondary btn--sm" data-action="go-home-daily-blessing">前往簽到</button>' : ''}
        ${!spun ? '<button type="button" class="btn btn--primary btn--sm" data-action="daily-open-wheel">幸運轉盤</button>' : ''}
        ${allDone ? '<button type="button" class="btn btn--ghost btn--sm" data-action="go-home-daily-blessing">查看紀錄</button>' : ''}
      </div>
    </div>`;
}

async function handleDailyCheckIn() {
  if (isWheelSpinning()) return;
  const result = await performDailyCheckIn();
  if (!result.success) {
    showToast(result.error || '簽到失敗', result.error?.includes('已經') ? 'info' : 'error');
    return;
  }
  const rewardText = formatDailyRewardBundle(result.rewards);
  const today = getTodayDateString();
  const willBeAllDone = hasSpunWheelToday(
    { ...state.dailyCheckIn, lastCheckInDate: today },
    today
  );
  if (willBeAllDone) dailyBlessingCollapsed = true;
  await trackQuest('daily_checkin');
  await onRefresh({ renderMode: ['tasks', 'gacha'] });
  showDailyBlessingRewardToast(`簽到成功！獲得 ${rewardText}`);
  if (result.streak >= 3) {
    showToast(`連續簽到 ${result.streak} 天！`, 'success');
  }
  await handleAchievementCheckAfterAction();
}

const WHEEL_CX = 150;
const WHEEL_CY = 150;
const WHEEL_R = 140;
const WHEEL_LABEL_R = 82;

const WHEEL_COLORS_DEFAULT = [
  '#2A1F4A', '#18304A', '#2B2340', '#3A2A18',
  '#1F3A35', '#251F3F', '#18364A', '#3A2030',
];

/** Sweet 轉盤扇區：交錯莓果／金／紫／薄荷／藍／珊瑚，避免整盤淡粉 */
const WHEEL_COLORS_SWEET = [
  '#E8A6BE', '#F3C979', '#B9A6E8', '#9ECFBE',
  '#9FC4DF', '#ECA5A5', '#E8B8D0', '#D4C4F0',
];

/** Sweet 扇區標籤文字色（依扇區明度選擇深色） */
const WHEEL_LABEL_COLORS_SWEET = [
  '#4A2E3B', '#684516', '#3F315F', '#245547',
  '#294E68', '#4A2E3B', '#4A2E3B', '#3F315F',
];

function polarToCartesian(cx, cy, r, angleDeg) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function describeArcSector(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M', cx, cy,
    'L', start.x, start.y,
    'A', r, r, 0, largeArcFlag, 0, end.x, end.y,
    'Z',
  ].join(' ');
}

function truncateWheelLabel(text, maxLen = 8) {
  const chars = Array.from(text || '');
  return chars.length <= maxLen ? chars.join('') : chars.slice(0, maxLen).join('');
}

function getWheelShortLabel(reward) {
  const amount = reward.amount ?? 1;
  const amtStr = `+${amount}`;

  if (reward.type === 'stardust') {
    return { name: '星塵', amount: amtStr };
  }
  if (reward.type === 'adventureEnergy') {
    return { name: '能量', amount: amtStr };
  }
  if (reward.type === 'material') {
    const matNames = {
      forest_leaf: '嫩葉',
      lava_core: '熔岩',
      machine_part: '齒輪',
      star_shard: '星界',
    };
    const name = matNames[reward.materialId];
    if (name) return { name, amount: amtStr };
  }
  if (reward.type === 'item' && reward.itemId === 'item_small_spirit_food') {
    return { name: '靈食', amount: amtStr };
  }

  const label = reward.label || '';
  const plusMatch = label.match(/^(.+?)\s*(\+\d+)\s*$/);
  if (plusMatch) {
    return {
      name: truncateWheelLabel(plusMatch[1].trim(), 8),
      amount: plusMatch[2],
    };
  }
  return { name: truncateWheelLabel(label, 8), amount: amtStr };
}

function getWheelSectorColors() {
  return isSweetTheme() ? WHEEL_COLORS_SWEET : WHEEL_COLORS_DEFAULT;
}

function getWheelSectorStroke() {
  return isSweetTheme() ? '#D4A0B8' : 'rgba(244, 247, 255, 0.16)';
}

function getWheelLabelFill(index) {
  if (!isSweetTheme()) return '';
  return WHEEL_LABEL_COLORS_SWEET[index % WHEEL_LABEL_COLORS_SWEET.length];
}

function buildWheelSvgHtml(rewards) {
  const count = rewards.length || 8;
  const seg = 360 / count;
  const colors = getWheelSectorColors();
  const stroke = getWheelSectorStroke();

  const sectors = rewards.map((reward, i) => {
    const startAngle = i * seg;
    const endAngle = startAngle + seg;
    const midAngle = startAngle + seg / 2;
    const path = describeArcSector(WHEEL_CX, WHEEL_CY, WHEEL_R, startAngle, endAngle);
    const short = getWheelShortLabel(reward);
    const labelPoint = polarToCartesian(WHEEL_CX, WHEEL_CY, WHEEL_LABEL_R, midAngle);
    let textRotation = midAngle;
    if (midAngle > 90 && midAngle < 270) {
      textRotation = midAngle + 180;
    }
    const labelFill = getWheelLabelFill(i);
    const fillAttr = labelFill ? ` fill="${labelFill}"` : '';

    return `
      <path class="daily-wheel-sector" d="${path}" fill="${colors[i % colors.length]}" stroke="${stroke}" stroke-width="1.5"/>
      <g class="daily-wheel-label-group" transform="translate(${labelPoint.x.toFixed(2)}, ${labelPoint.y.toFixed(2)}) rotate(${textRotation.toFixed(2)})">
        <text class="daily-wheel-label" text-anchor="middle" dominant-baseline="middle"${fillAttr}>
          <tspan x="0" dy="-0.35em" class="daily-wheel-label__name">${escapeHtml(short.name)}</tspan>
          <tspan x="0" dy="1.15em" class="daily-wheel-label__amount">${escapeHtml(short.amount)}</tspan>
        </text>
      </g>`;
  }).join('');

  return `
    <svg class="daily-wheel-svg" viewBox="0 0 300 300" aria-hidden="true">
      <circle class="daily-wheel-outer-ring" cx="${WHEEL_CX}" cy="${WHEEL_CY}" r="${WHEEL_R}" fill="none"/>
      ${sectors}
    </svg>`;
}

function buildWheelDiscHtml(rewards) {
  const previewItems = rewards.map((r) =>
    `<li class="daily-wheel-preview__item">${escapeHtml(r.label)}</li>`
  ).join('');

  return `
    <div class="daily-wheel-stage">
      <div class="daily-wheel-wrapper">
        <div class="daily-wheel-pointer" aria-hidden="true"></div>
        <div class="daily-wheel-rotor" id="daily-wheel-rotor">
          ${buildWheelSvgHtml(rewards)}
        </div>
        <button type="button" class="daily-wheel-center-button" id="daily-wheel-start" aria-label="轉動轉盤">開始</button>
      </div>
    </div>
    <ul class="daily-wheel-preview" aria-label="轉盤獎勵清單">
      ${previewItems}
    </ul>`;
}

function waitForWheelRotorTransition(rotor, fallbackMs) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      rotor.removeEventListener('transitionend', onEnd);
      clearTimeout(timer);
      resolve();
    };
    const onEnd = (event) => {
      if (event.target !== rotor || event.propertyName !== 'transform') return;
      finish();
    };
    rotor.addEventListener('transitionend', onEnd);
    const timer = setTimeout(finish, fallbackMs);
  });
}

async function animateDailyWheel(rewardIndex, segmentCount) {
  const rotor = document.getElementById('daily-wheel-rotor');
  const startBtn = document.getElementById('daily-wheel-start');
  if (!rotor) return;

  const reduceMotion = state.userPreferences?.reduceMotion ?? false;
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.textContent = '轉動';
  }

  const extraSpins = reduceMotion ? 1 : 3 + Math.floor(Math.random() * 2);
  const rotation = computeWheelRotationDeg(rewardIndex, segmentCount, extraSpins);

  rotor.style.transition = reduceMotion
    ? 'transform 300ms ease-out'
    : 'transform 2800ms cubic-bezier(0.12, 0.72, 0.18, 1)';

  void rotor.offsetHeight;
  const transformValue = `translate3d(0, 0, 0) rotate(${rotation}deg)`;
  rotor.style.setProperty('--wheel-rotation', `${rotation}deg`);
  rotor.style.transform = transformValue;

  const fallbackMs = reduceMotion ? 400 : 3000;
  await waitForWheelRotorTransition(rotor, fallbackMs);

  if (startBtn) startBtn.textContent = '已轉';
}

function computeWheelRotationDeg(rewardIndex, segmentCount, extraSpins = 4) {
  const seg = 360 / segmentCount;
  const targetMidAngle = rewardIndex * seg + seg / 2;
  const jitter = (Math.random() - 0.5) * (seg * 0.2);
  return extraSpins * 360 + (360 - targetMidAngle + jitter);
}

async function openDailyWheelModal() {
  const daily = state.dailyCheckIn;
  const today = getTodayDateString();
  if (daily && hasSpunWheelToday(daily, today)) {
    showToast('今天已經轉過幸運轉盤了，明天再來吧。', 'info');
    return;
  }

  const rewards = dailyWheelRewards || await loadWheelRewards();
  dailyWheelRewards = rewards;
  const canSpin = !(daily && hasSpunWheelToday(daily, today));

  openModal(`
    <div class="wheel-modal daily-wheel-modal-body">
      <h2 class="modal-title">每日幸運轉盤</h2>
      <p class="wheel-modal__status ${canSpin ? 'wheel-modal__status--available' : 'wheel-modal__status--done'}">${canSpin ? '今天還可以轉 1 次' : '今天已經轉過了'}</p>
      <div class="wheel-container" id="daily-wheel-container">
        ${buildWheelDiscHtml(rewards)}
      </div>
      <p class="wheel-modal__hint">轉盤結果由系統先決定，動畫僅為展示效果。</p>
    </div>
  `);

  if (!canSpin) return;

  const startBtn = document.getElementById('daily-wheel-start');
  startBtn?.addEventListener('click', async () => {
    if (startBtn.disabled || isWheelSpinning()) return;
    startBtn.disabled = true;

    const prep = await prepareDailyWheelSpin();
    if (!prep.success) {
      showToast(prep.error || '無法轉盤', 'info');
      releaseWheelSpinLock();
      startBtn.disabled = false;
      return;
    }

    let wheelSpinFinished = false;
    const finishWheelSpin = async () => {
      if (wheelSpinFinished) return;
      wheelSpinFinished = true;

      const result = await finalizeDailyWheelSpin(prep.reward);
      if (!result.success) {
        showToast(result.error || '轉盤結算失敗', 'error');
        releaseWheelSpinLock();
        startBtn.disabled = false;
        return;
      }
      closeModal();
      dailyBlessingCollapsed = true;
      await onRefresh({ renderMode: ['tasks', 'gacha'] });
      showDailyBlessingRewardToast(`獲得：${prep.reward.label}`);
      await handleAchievementCheckAfterAction();
    };

    try {
      await animateDailyWheel(prep.rewardIndex, prep.segmentCount);
      await finishWheelSpin();
    } catch (err) {
      console.error('[QuestNote] 轉盤錯誤:', err);
      releaseWheelSpinLock();
      showToast('轉盤發生錯誤，請稍後再試', 'error');
      startBtn.disabled = false;
    }
  });
}

function renderTodayPlanSummary(tasks, today) {
  const el = document.getElementById('today-plan-summary');
  if (!el) return;

  const plannedIncomplete = tasks.filter((t) => !t.completed && isInTodayPlan(t, today));
  const plannedDone = tasks.filter((t) => isInTodayPlan(t, today) && isCompletedToday(t, today));
  const plannedTotal = plannedIncomplete.length + plannedDone.length;
  const overdue = tasks.filter((t) => !t.completed && t.dueDate && t.dueDate < today);

  const planValue = plannedTotal === 0
    ? '0 件'
    : plannedDone.length > 0
      ? `${plannedDone.length} / ${plannedTotal} 件`
      : `${plannedTotal} 件`;

  el.innerHTML = `
    <div class="today-plan-summary__inner">
      <div class="today-plan-summary__stat">
        <span class="today-plan-summary__label">今日計畫</span>
        <span class="today-plan-summary__value">${planValue}</span>
      </div>
      ${overdue.length > 0 ? `<div class="today-plan-summary__stat today-plan-summary__stat--warn">
        <span class="today-plan-summary__label">逾期</span>
        <span class="today-plan-summary__value">${overdue.length} 件</span>
      </div>` : ''}
    </div>`;
}

function renderCategoryFilters(categories) {
  const el = document.getElementById('task-category-filters');
  if (!el || !categories?.length) return;

  const btns = [
    `<button type="button" class="filter-btn ${taskCategoryFilter === 'all' ? 'active' : ''}" data-cat-filter="all">全部</button>`,
    ...categories.map(
      (c) => `<button type="button" class="filter-btn ${taskCategoryFilter === c.id ? 'active' : ''}" data-cat-filter="${c.id}">${formatCategoryLabel(c)}</button>`
    ),
  ];
  el.innerHTML = btns.join('');
  el.hidden = taskViewMode === 'smart' && !activeSmartListId;
}

function formatCategoryLabel(category) {
  return escapeHtml(category?.name || '一般');
}

function applyCategoryFilter(tasks) {
  return filterByCategory(tasks, taskCategoryFilter);
}

function renderCollapsibleTaskSection(title, taskList, collapsed = completedSectionCollapsed) {
  if (!taskList.length) return '';
  const arrow = collapsed ? '▶' : '▼';
  return `
    <section class="task-section completed-section page-section ${collapsed ? 'collapsed' : ''}">
      <button type="button" class="section-toggle" data-action="toggle-completed-section" aria-expanded="${!collapsed}">
        ${arrow} ${escapeHtml(title)} <span class="section-count">${taskList.length}</span>
      </button>
      <div class="task-list">${taskList.map(renderTaskCard).join('')}</div>
    </section>`;
}

function renderTaskListSection(title, taskList, emptyHtml = '') {
  if (!taskList.length) return emptyHtml;
  return `
    <section class="task-section page-section">
      <h2 class="section-title">${escapeHtml(title)} <span class="section-count">${taskList.length}</span></h2>
      <div class="task-list">${taskList.map(renderTaskCard).join('')}</div>
    </section>`;
}

function renderTodayView(tasks, today) {
  const filtered = applyCategoryFilter(tasks);
  const sections = getTodayViewSections(filtered, today);

  const plannedEmpty = sections.plannedIncomplete.length === 0
    ? emptyStateHtml(
        '📅',
        '今天還沒有安排任務',
        '挑 1～3 件最重要的事，讓你的夥伴陪你完成。',
        '從待排程任務選擇',
        'pick-unscheduled'
      )
    : '';

  let html = renderTaskListSection('今日計畫', sections.planned, plannedEmpty);
  html += renderTaskListSection('今天到期', sections.dueToday);
  html += renderTaskListSection('逾期未完成', sections.overdue,
    sections.overdue.length === 0 && taskCategoryFilter !== 'all' ? '' :
    sections.overdue.length === 0 ? emptyStateHtml('✓', '沒有逾期任務', '目前節奏保持得不錯。') : ''
  );
  html += renderCollapsibleTaskSection('今日已完成', sections.completedToday);

  if (!html.trim()) {
    return emptyStateHtml('📋', '目前沒有待辦任務', '新增一個小任務，讓你的夥伴開始累積能量吧。', '新增任務', 'empty-add-task');
  }
  return html;
}

function renderAllTasksView(tasks, today) {
  const filtered = applyCategoryFilter(tasks);
  const incomplete = sortTasks(filtered.filter((t) => !t.completed), today);

  const categoryEmpty = taskCategoryFilter !== 'all' && incomplete.length === 0;

  if (categoryEmpty) {
    return emptyStateHtml(
      '📂',
      '這個分類還沒有任務',
      '新增任務時可以把它放進這個分類。',
      '新增任務',
      'empty-add-task'
    );
  }

  return renderTaskListSection('進行中', incomplete,
    incomplete.length === 0
      ? emptyStateHtml('📋', '目前沒有待辦任務', '新增一個小任務，讓你的夥伴開始累積能量吧。', '新增任務', 'empty-add-task')
      : ''
  );
}

function renderSmartListHub(tasks, today) {
  const cards = SMART_LISTS.map((list) => {
    const count = filterBySmartList(list.id, tasks, today).length;
    return `
      <button type="button" class="smart-list-card card" data-action="smart-list" data-list-id="${list.id}">
        <span class="smart-list-card__icon" aria-hidden="true">${list.icon}</span>
        <div class="smart-list-card__body">
          <h3 class="smart-list-card__title">${escapeHtml(list.name)}</h3>
          <p class="smart-list-card__desc">${escapeHtml(list.desc)}</p>
        </div>
        <span class="smart-list-card__count">${count}</span>
        <span class="smart-list-card__arrow">›</span>
      </button>`;
  }).join('');

  return `<div class="smart-list-hub">${cards}</div>`;
}

function renderCompletedRangeFilter(tasks) {
  const rangeBtns = COMPLETED_RANGE_OPTIONS.map((opt) => {
    const count = filterCompletedTasksByRange(tasks, opt.id).length;
    const active = completedRangeFilter === opt.id;
    return `<button type="button" class="segmented-control__btn ${active ? 'active' : ''}" data-action="completed-range" data-range="${opt.id}" aria-pressed="${active}">${escapeHtml(opt.label)} <span class="section-count">${count}</span></button>`;
  }).join('');

  return `
    <div class="completed-range-filter">
      <div class="segmented-control completed-range-filter__control" role="group" aria-label="已完成時間篩選">
        ${rangeBtns}
      </div>
    </div>`;
}

function renderSmartListDetail(tasks, listId, today) {
  const list = SMART_LISTS.find((l) => l.id === listId);
  if (!list) return '';

  let filtered = filterBySmartList(listId, tasks, today);
  if (listId === 'completed') {
    filtered = filterCompletedTasksByRange(filtered, completedRangeFilter);
  }
  filtered = applyCategoryFilter(filtered);
  const sorted = sortTasks(filtered, today);

  const emptyMessages = {
    today: ['這裡目前沒有任務', '狀態很好，沒有需要處理的項目。'],
    due_soon: ['這裡目前沒有任務', '狀態很好，沒有需要處理的項目。'],
    overdue: ['沒有逾期任務', '目前節奏保持得不錯。'],
    urgent: ['這裡目前沒有任務', '狀態很好，沒有需要處理的項目。'],
    important: ['這裡目前沒有任務', '狀態很好，沒有需要處理的項目。'],
    no_date: ['這裡目前沒有任務', '狀態很好，沒有需要處理的項目。'],
    has_subtasks: ['這裡目前沒有任務', '可以把大型任務拆成幾個小步驟。'],
    completed: getCompletedRangeEmptyMessage(completedRangeFilter),
  };
  const [emptyTitle, emptyDesc] = emptyMessages[listId] || ['這裡目前沒有任務', '狀態很好，沒有需要處理的項目。'];

  const rangeFilterHtml = listId === 'completed' ? renderCompletedRangeFilter(tasks) : '';

  return `
    <div class="smart-list-detail">
      <button type="button" class="btn btn--ghost btn--sm smart-list-back" data-action="smart-list-back">‹ 智慧清單</button>
      <h2 class="section-title">${list.icon} ${escapeHtml(list.name)}</h2>
      <p class="section-desc">${escapeHtml(list.desc)}</p>
      ${rangeFilterHtml}
      ${sorted.length === 0
        ? emptyStateHtml(list.icon, emptyTitle, emptyDesc)
        : `<div class="task-list">${sorted.map(renderTaskCard).join('')}</div>`
      }
    </div>`;
}

function renderTaskCard(task) {
  const today = getTodayDateString();
  const priorityClass = `priority-${task.priority}`;
  const stardust = calculateRewardAmount(task);
  const energy = calculateAdventureEnergyAmount(task);
  const category = getCategoryById(task.categoryId || 'general', state.categories);
  const catClass = `badge--category badge--category-${category?.color || 'gray'}`;
  const dateClass = getDateBadgeClass(task, today);
  const dateText = formatDateBadgeText(task, today);
  const inPlan = isInTodayPlan(task, today);
  const subProgress = getSubtaskProgress(task);
  const isExpanded = expandedTaskIds.has(task.id);
  const hasSubtasks = subProgress.total > 0;

  let doneInfo = '';
  if (task.completed && task.completedAt) {
    doneInfo = `<p class="task-card__done-info">已完成 ${formatDateTime(task.completedAt)}${task.rewardClaimed || task.lastRewardClaimedAt ? ' · 已領取獎勵' : ''}</p>`;
  }

  const justCompleted = recentlyCompletedTaskIds.has(task.id);

  const subtasksHtml = hasSubtasks ? `
    <div class="task-card__subtasks ${isExpanded ? 'task-card__subtasks--open' : ''}">
      <div class="task-card__subtask-progress">
        <div class="progress-bar progress-bar--subtask">
          <div class="progress-bar__fill" style="width:${subProgress.percent}%"></div>
        </div>
        <span class="task-card__subtask-count">${subProgress.done} / ${subProgress.total}</span>
      </div>
      ${isExpanded ? `
        <ul class="subtask-list">
          ${(task.subtasks || []).map((s) => `
            <li class="subtask-item ${s.completed ? 'subtask-item--done' : ''}">
              <button type="button" class="subtask-check ${s.completed ? 'checked' : ''}" data-action="toggle-subtask" data-subtask-id="${escapeHtml(s.id)}" aria-label="完成子任務">
                ${s.completed ? '✓' : ''}
              </button>
              <span class="subtask-text">${escapeHtml(s.text)}</span>
            </li>
          `).join('')}
        </ul>
      ` : ''}
    </div>
  ` : '';

  const planBadge = inPlan
    ? `<span class="badge badge--today-plan">${task.completed ? '今日完成' : '今日'}</span>`
    : '';

  const planBtn = !task.completed
    ? inPlan
      ? `<button class="btn btn--ghost btn--sm" data-action="unplan-today">移出今日</button>`
      : `<button class="btn btn--ghost btn--sm" data-action="plan-today">加入今日</button>`
    : '';

  const expandBtn = hasSubtasks
    ? `<button class="btn btn--ghost btn--sm" data-action="toggle-expand">${isExpanded ? '收合' : '展開'}</button>`
    : '';

  const preview = task.content.split('\n').slice(1).filter((line) => line.trim()).slice(0, 2).join(' ');

  return `
    <article class="task-card card-animate ${priorityClass} ${task.completed ? 'task-card--done' : ''} ${justCompleted ? 'task-card--just-done' : ''}" data-id="${escapeHtml(task.id)}">
      <div class="task-card__header">
        <button class="task-check ${task.completed ? 'checked' : ''}" data-action="toggle" aria-label="完成任務">
          ${task.completed ? '✓' : ''}
        </button>
        <div class="task-card__meta">
          <span class="badge ${catClass}">${formatCategoryLabel(category)}</span>
          <span class="badge ${priorityClass}">${PRIORITY_LABELS[task.priority]}</span>
          <span class="badge ${dateClass}">${escapeHtml(dateText)}</span>
          ${planBadge}
        </div>
      </div>
      <h3 class="task-card__title">${escapeHtml(task.title)}</h3>
      ${preview ? `<p class="task-card__preview">${escapeHtml(preview)}</p>` : ''}
      ${subtasksHtml}
      ${
        !task.completed
          ? `<div class="task-card__rewards">
              <span class="task-reward-tag task-reward-tag--stardust">✦ ${stardust} 星塵</span>
              <span class="task-reward-tag task-reward-tag--energy">⚡ ${energy} 能量</span>
            </div>`
          : doneInfo
      }
      <div class="task-card__actions">
        ${
          !task.completed
            ? `<button class="btn btn--primary btn--sm task-card__complete-btn" data-action="toggle" aria-label="完成任務">完成</button>`
            : ''
        }
        ${planBtn}
        ${expandBtn}
        <button class="btn btn--ghost btn--sm" data-action="edit">編輯</button>
        <button class="btn btn--ghost btn--sm btn--danger" data-action="delete">刪除</button>
      </div>
    </article>`;
}

function openTaskForm(taskId = null) {
  const task = taskId ? state.tasks.find((t) => t.id === taskId) : null;
  const isEdit = !!task;
  const today = getTodayDateString();
  const categories = state.categories || [];
  const inPlan = task ? isInTodayPlan(task, today) : false;
  const subtasks = task?.subtasks || [];

  const categoryOptions = categories.map(
    (c) => `<option value="${c.id}" ${(task?.categoryId || 'general') === c.id ? 'selected' : ''}>${formatCategoryLabel(c)}</option>`
  ).join('');

  const subtaskListHtml = subtasks.map((s, i) => `
    <div class="subtask-form-item" data-index="${i}">
      <input type="text" class="form-input subtask-form-input" value="${escapeHtml(s.text)}" placeholder="子任務內容" maxlength="200" />
      <button type="button" class="btn btn--ghost btn--sm btn--danger subtask-form-remove" data-index="${i}" aria-label="刪除子任務">×</button>
    </div>
  `).join('');

  openModal(`
    <h2 class="modal-title">${isEdit ? '編輯任務' : '新增任務'}</h2>
    <form id="task-form" class="form task-form">
      <label class="form-label" for="task-content">任務內容</label>
      <textarea id="task-content" class="form-textarea" rows="4" placeholder="第一行將自動成為標題…" required>${task ? escapeHtml(task.content) : ''}</textarea>

      <label class="form-label" for="task-category">分類</label>
      <select id="task-category" class="form-select">${categoryOptions}</select>

      <label class="form-label">重要程度</label>
      <div class="segmented-control" id="task-priority-group">
        <button type="button" class="segmented-control__btn ${(!task || task.priority === 'normal') ? 'active' : ''}" data-value="normal">普通</button>
        <button type="button" class="segmented-control__btn segmented-control__btn--important ${task?.priority === 'important' ? 'active' : ''}" data-value="important">重要</button>
        <button type="button" class="segmented-control__btn segmented-control__btn--urgent ${task?.priority === 'urgent' ? 'active' : ''}" data-value="urgent">緊急</button>
      </div>
      <input type="hidden" id="task-priority" value="${task?.priority || 'normal'}" />

      ${!isEdit ? '<p class="form-hint">當天臨時任務可略過開始日與截止日；勾選「加入今日計畫」即可安排今天要做的事。</p>' : ''}

      <div class="form-row">
        <div class="form-field">
          <label class="form-label" for="task-start-date">開始日</label>
          <input type="date" id="task-start-date" class="form-input" value="${escapeHtml(task?.startDate || '')}" />
        </div>
        <div class="form-field">
          <label class="form-label" for="task-due-date">截止日</label>
          <input type="date" id="task-due-date" class="form-input" value="${escapeHtml(task?.dueDate || '')}" />
        </div>
      </div>
      <p class="form-error" id="task-date-error" hidden>開始日不可晚於截止日</p>

      <label class="settings-toggle form-toggle" for="task-plan-today">
        <span class="settings-toggle__text">
          <span class="settings-toggle__label">加入今日計畫</span>
          <span class="settings-toggle__desc">標記為今天打算完成的任務</span>
        </span>
        <input type="checkbox" id="task-plan-today" class="settings-toggle__input" ${inPlan ? 'checked' : ''} />
        <span class="settings-toggle__switch" aria-hidden="true"></span>
      </label>

      <label class="form-label">子任務</label>
      <div id="subtask-form-list" class="subtask-form-list">${subtaskListHtml}</div>
      <p class="form-hint subtask-form-empty" id="subtask-form-empty" ${subtasks.length ? 'hidden' : ''}>這個任務還沒有子任務，可以把大型任務拆成幾個小步驟。</p>
      <div class="subtask-form-add">
        <input type="text" id="subtask-new-input" class="form-input" placeholder="輸入子任務內容" maxlength="200" />
        <button type="button" class="btn btn--secondary btn--sm" id="subtask-add-btn">新增子任務</button>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="form-cancel">取消</button>
        <button type="submit" class="btn btn--primary">${isEdit ? '儲存' : '新增'}</button>
      </div>
    </form>
  `);

  document.getElementById('form-cancel')?.addEventListener('click', closeModal);

  document.querySelectorAll('#task-priority-group .segmented-control__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#task-priority-group .segmented-control__btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('task-priority').value = btn.dataset.value;
    });
  });

  const formSubtasks = [...subtasks];

  function renderSubtaskFormList() {
    const list = document.getElementById('subtask-form-list');
    const emptyHint = document.getElementById('subtask-form-empty');
    if (!list) return;
    list.innerHTML = formSubtasks.map((s, i) => `
      <div class="subtask-form-item" data-index="${i}">
        <input type="text" class="form-input subtask-form-input" value="${escapeHtml(s.text)}" placeholder="子任務內容" maxlength="200" data-index="${i}" />
        <button type="button" class="btn btn--ghost btn--sm btn--danger subtask-form-remove" data-index="${i}" aria-label="刪除子任務">×</button>
      </div>
    `).join('');
    if (emptyHint) emptyHint.hidden = formSubtasks.length > 0;

    list.querySelectorAll('.subtask-form-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.index);
        formSubtasks.splice(idx, 1);
        renderSubtaskFormList();
      });
    });
    list.querySelectorAll('.subtask-form-input').forEach((input) => {
      input.addEventListener('input', () => {
        const idx = Number(input.dataset.index);
        if (formSubtasks[idx]) formSubtasks[idx].text = input.value;
      });
    });
  }

  document.getElementById('subtask-add-btn')?.addEventListener('click', () => {
    const input = document.getElementById('subtask-new-input');
    const text = input?.value.trim();
    if (!text) {
      showToast('子任務文字不可為空', 'warning');
      return;
    }
    formSubtasks.push({ text, completed: false });
    if (input) input.value = '';
    renderSubtaskFormList();
  });

  document.getElementById('subtask-new-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('subtask-add-btn')?.click();
    }
  });

  renderSubtaskFormList();

  document.getElementById('task-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = document.getElementById('task-content').value.trim();
    const priority = document.getElementById('task-priority').value;
    const categoryId = document.getElementById('task-category').value;
    const startDate = document.getElementById('task-start-date').value || null;
    const dueDate = document.getElementById('task-due-date').value || null;
    const planToday = document.getElementById('task-plan-today').checked;
    const dateError = document.getElementById('task-date-error');

    if (!content) {
      showToast('請輸入任務內容', 'warning');
      return;
    }

    const dateCheck = validateDateRange(startDate, dueDate);
    if (!dateCheck.valid) {
      if (dateError) {
        dateError.textContent = dateCheck.message;
        dateError.hidden = false;
      }
      showToast(dateCheck.message, 'error');
      return;
    }
    if (dateError) dateError.hidden = true;

    const subtaskInputs = document.querySelectorAll('#subtask-form-list .subtask-form-input');
    const finalSubtasks = formSubtasks.map((s, i) => ({
      id: s.id,
      text: (subtaskInputs[i]?.value || s.text || '').trim(),
      completed: s.completed ?? false,
      createdAt: s.createdAt,
      completedAt: s.completedAt ?? null,
    })).filter((s) => s.text);

    for (const s of finalSubtasks) {
      if (!s.text) {
        showToast('子任務文字不可為空', 'warning');
        return;
      }
    }

    const payload = {
      content,
      priority,
      categoryId,
      startDate,
      dueDate,
      planToday,
      subtasks: finalSubtasks,
    };

    let createdTask = null;
    try {
      if (isEdit) {
        const todayStr = getTodayDateString();
        await updateTask(taskId, {
          content,
          priority,
          categoryId,
          startDate,
          dueDate,
          subtasks: finalSubtasks,
          isPlannedToday: planToday,
          plannedDate: planToday ? todayStr : null,
        });
        showToast('任務已更新', 'success');
      } else {
        createdTask = await createTask(payload);
        showToast('任務已新增', 'success');
      }
      closeModal();
      await onRefresh();
      await handleAchievementCheckAfterAction();
      if (createdTask) {
        void recordOnboardingEvent('task-created', { taskId: createdTask.id });
      }
    } catch (err) {
      showToast(err.message || '儲存失敗', 'error');
    }
  });
}

/** 設定首頁中樞圖示的提示紅點 */
function setHomeHubDot(hub, on) {
  const dot = document.querySelector(`[data-hub-dot="${hub}"]`);
  if (dot) dot.hidden = !on;
}

/**
 * 渲染首頁功能中樞（每日祝福 / 冒險任務 / 稱號）。
 * 以圖示代表三塊功能，點開才展開對應區塊，預設全部收合以節省首頁空間。
 * 需在 renderDailyBlessingSection / renderQuestPanel / renderAchievementStrip 之後呼叫，
 * 以便最後套用各區塊的顯示 / 隱藏。
 */
function renderHomeHub() {
  const hub = document.getElementById('home-hub');
  if (!hub) return;

  hub.dataset.active = homeHubActive || '';

  // 提示紅點：每日祝福待完成 / 冒險任務可領 / 稱號有可領成就
  let blessingPending = false;
  try {
    blessingPending = buildDailyBlessingCardData().hasPending;
  } catch {
    blessingPending = false;
  }
  const questClaimable = (state?.questSummary?.totalClaimable ?? 0) > 0;
  const titlesClaimable = (state?.achievementSummary?.claimable ?? 0) > 0;
  setHomeHubDot('blessing', blessingPending);
  setHomeHubDot('quest', questClaimable);
  setHomeHubDot('titles', titlesClaimable);

  hub.querySelectorAll('.home-hub__icon').forEach((btn) => {
    const isActive = btn.dataset.hub === homeHubActive;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-expanded', isActive ? 'true' : 'false');
  });

  const blessingEl = document.getElementById('homeDailyBlessingContainer');
  const questEl = document.getElementById('quest-panel');
  const stripEl = document.getElementById('achievement-strip');
  if (blessingEl) blessingEl.style.display = homeHubActive === 'blessing' ? '' : 'none';
  if (questEl) questEl.style.display = homeHubActive === 'quest' ? '' : 'none';
  if (stripEl) stripEl.style.display = homeHubActive === 'titles' ? '' : 'none';
}

/** 渲染首頁成就 / 稱號摘要條 */
function renderAchievementStrip() {
  const strip = document.getElementById('achievement-strip');
  if (!strip) return;

  const summary = state.achievementSummary;
  if (!summary?.catalogLoaded) {
    strip.innerHTML = `
      <div class="achievement-strip__inner">
        <span class="achievement-strip__icon" aria-hidden="true">🏅</span>
        <div class="achievement-strip__text">
          <p class="achievement-strip__title">成就系統</p>
          <p class="achievement-strip__desc">成就資料暫時無法載入，請重新整理</p>
        </div>
      </div>`;
    return;
  }

  const titleText = summary.equippedTitle
    ? `稱號：${summary.equippedTitle.name}`
    : '尚未設定稱號';
  const titleEmptyClass = summary.equippedTitle ? '' : ' achievement-strip__title--empty';

  const claimable = summary.claimable ?? 0;
  const recent = summary.recentUnlocked?.[0];
  let subText = '';
  if (claimable > 0) {
    subText = `可領取成就：${claimable} 個`;
  } else if (recent) {
    subText = `最近解鎖：${recent.name}`;
  } else {
    subText = '完成任務可以解鎖更多成就。';
  }

  strip.innerHTML = `
    <div class="achievement-strip__inner">
      <span class="achievement-strip__icon">🏅</span>
      <div class="achievement-strip__text">
        <p class="achievement-strip__title${titleEmptyClass}">${escapeHtml(titleText)}</p>
        <p class="achievement-strip__desc">${escapeHtml(subText)}</p>
      </div>
      ${claimable > 0 ? '<span class="achievement-strip__badge" aria-hidden="true"></span>' : ''}
      <span class="achievement-strip__arrow">›</span>
    </div>`;
}

/** 渲染陪伴寵物區塊 */
function renderCompanionPetButton(companion) {
  const canPet = canPetCompanion(companion);
  const remaining = getPetCooldownRemaining(companion);
  const btnLabel = canPet ? '撫摸' : (remaining > 0 ? `還要 ${formatCooldown(remaining)}` : '冷卻中');
  const cooldownHint = canPet
    ? ''
    : `<p class="companion-card__cooldown">撫摸冷卻中，${escapeHtml(formatCooldown(remaining))}後可再次撫摸</p>`;

  return `
    <div class="companion-card__pet-row">
      <button type="button" class="btn btn--secondary btn--sm companion-pet-btn" data-action="companion-pet" ${canPet ? '' : 'disabled'}>${escapeHtml(btnLabel)}</button>
      ${cooldownHint}
    </div>`;
}

const PET_COMFORT_LINES = {
  N: ['牠開心地蹭了蹭你的手。', '牠看起來精神變好了。'],
  R: ['牠開心地蹭了蹭你的手。', '牠看起來精神變好了。'],
  SR: ['牠安靜地靠近你，似乎更信任你了。', '牠接受了你的撫摸。'],
  SSR: ['牠微微低下頭，默許了你的靠近。', '牠的氣息變得溫和了一些。'],
  UR: ['牠短暫收起威壓，接受了你的觸碰。', '星光在牠身旁輕輕流動。'],
};

function getPetComfortLine(companion) {
  const pool = PET_COMFORT_LINES[companion?.rarity] || PET_COMFORT_LINES.N;
  return pool[Math.floor(Math.random() * pool.length)];
}

function playHomeCompanionPetEffect() {
  const card = document.querySelector('.companion-card');
  const img = document.querySelector('.companion-card__image');
  triggerComfortVibration();
  if (!state?.userPreferences?.reduceMotion) {
    card?.classList.add('companion-card--bounce', 'companion-card--pet-glow');
    img?.classList.add('companion-img--bounce');
    setTimeout(() => {
      card?.classList.remove('companion-card--bounce', 'companion-card--pet-glow');
      img?.classList.remove('companion-img--bounce');
    }, 650);
  }
}

async function handleCompanionPet() {
  if (!state?.companion) {
    showToast('尚未設定陪伴寵物。', 'warning');
    return;
  }

  try {
    const result = await petCompanion();
    if (!result.success) {
      showToast(result.message, 'warning', 3500);
      await onRefresh();
      return;
    }

    playHomeCompanionPetEffect();
    showToast('你輕輕摸了摸牠，親密度 +5', 'success', 2800);
    if (result.leveledUp) {
      setTimeout(() => {
        const bondLine = getBondUpLine(state.companion);
        showBondLevelUpToast(result.newLevel, bondLine);
      }, 400);
    }

    await trackQuest('pet_companion');
    await onRefresh();
    if (result.leveledUp) {
      await notifyBondUnlocks(state.companion?.id);
    }
    const comfortLine = getPetComfortLine(state.companion);
    setCompanionBubbleText(comfortLine, true);
  } catch (err) {
    showToast(err.message || '撫摸失敗', 'error');
  }
}

/** 渲染陪伴寵物區塊 */
function renderCompanionSection(companion, defaultLine) {
  const section = document.getElementById('companion-section');
  if (!section) return;

  if (!companion) {
    lastCompanionId = null;
    lastCompanionBondLevel = null;
    stopCompanionDialogueTimer();
    section.innerHTML = emptyStateHtml(
      '🐾',
      '尚未選擇陪伴寵物',
      '去圖鑑選一隻夥伴，讓牠陪你完成任務。',
      '前往圖鑑',
      'empty-go-collection'
    );
    return;
  }

  const sameCompanion =
    lastCompanionId === companion.id &&
    lastCompanionBondLevel === (companion.bondLevel ?? 1) &&
    section.querySelector('.companion-card');
  lastCompanionId = companion.id;
  lastCompanionBondLevel = companion.bondLevel ?? 1;

  if (sameCompanion) {
    updateCompanionBondDisplay(companion);
    updateCompanionImageIfNeeded(companion);
    return;
  }

  warmPetImageCache(getPetImageSrc(companion, 'stage')).catch(() => {});

  const progress = getBondProgress(companion.bondExp ?? 0, companion.bondLevel ?? 1);
  const rarityClass = escapeHtml(`rarity-${companion.rarity}`);
  const equippedTitle = state.achievementSummary?.equippedTitle;
  const titleHtml = equippedTitle
    ? `<p class="companion-card__player-title">稱號：${escapeHtml(equippedTitle.name)}</p>`
    : '';
  const petBtnHtml = renderCompanionPetButton(companion);

  const bondState = companion.bondUnlockState || {};
  const bondCardClasses = [
    bondState.homeEffectLv4 ? 'has-bond-effect' : '',
    bondState.bondLiberated ? 'is-bond-liberated' : '',
  ].filter(Boolean).join(' ');
  const bondEffectHtml = bondState.homeEffectLv4
    ? '<div class="companion-bond-effect is-active" aria-hidden="true"></div>'
    : '';
  const bondBadge = bondBadgeHtml(companion);

  section.innerHTML = `
    <div class="companion-wrap">
      <div class="companion-bubble companion-bubble--visible" id="companion-bubble" aria-live="polite">
        <p class="companion-bubble__text" id="companion-bubble-text">${escapeHtml(defaultLine)}</p>
      </div>
      <article class="companion-card card ${rarityClass} companion-card--breathe ${bondCardClasses}" data-pet-id="${escapeHtml(companion.id)}">
        <div class="companion-card__glow"></div>
        ${bondEffectHtml}
        ${bondBadge ? `<div class="companion-card__bond-badge">${bondBadge}</div>` : ''}
        <button type="button" class="companion-card__image companion-pet-image-button" data-action="companion-view-image" data-pet-id="${escapeHtml(companion.id)}" aria-label="查看 ${escapeHtml(petDisplayName(companion))} 原圖">
          ${petImageHtml(companion, { size: 'lg', loading: 'eager', eager: true, framed: true })}
        </button>
        <div class="companion-card__body">
          <button type="button" class="companion-card__detail-button" data-action="companion-view-detail" data-pet-id="${escapeHtml(companion.id)}" aria-label="查看陪伴寵物詳情">
            <div class="companion-card__header">
              <div class="companion-card__name-wrap">
                <span class="companion-card__name">${escapeHtml(petDisplayName(companion))}</span>
                ${petOriginalNameHtml(companion)}
              </div>
              <span class="badge badge--rarity ${rarityClass}">${escapeHtml(companion.rarity)}</span>
            </div>
            ${titleHtml}
            ${renderStars(companion.stars ?? 1)}
            <div class="companion-bond">
              <div class="companion-bond__label">
                <span>親密度 Lv.${companion.bondLevel ?? 1}</span>
                <span>${progress.current}/${progress.max || 'MAX'}</span>
              </div>
              <div class="progress-bar progress-bar--bond">
                <div class="progress-bar__fill" style="width:${progress.percent}%"></div>
              </div>
            </div>
            <p class="companion-card__detail-hint">查看詳情</p>
          </button>
          ${petBtnHtml}
          <p class="companion-card__hint">點資訊區看詳情 · 點圖片可看原圖</p>
        </div>
      </article>
    </div>`;

  startCompanionDialogueTimer();
}

/** 輕柔震動（撫摸 / 餵食成功） */
function triggerComfortVibration() {
  if (state?.userPreferences?.reduceMotion) return;
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate([12, 40, 18]);
    } catch {
      /* 部分瀏覽器不支援 */
    }
  }
}

/** 在預覽區跳出愛心 */
function spawnCompanionHearts(container, count = 4) {
  if (!container || state?.userPreferences?.reduceMotion) return;
  const symbols = ['💜', '💗', '❤️', '✨'];
  for (let i = 0; i < count; i += 1) {
    const heart = document.createElement('span');
    heart.className = 'companion-heart-float';
    heart.textContent = symbols[i % symbols.length];
    heart.style.left = `${28 + Math.random() * 44}%`;
    heart.style.animationDelay = `${i * 0.1}s`;
    heart.setAttribute('aria-hidden', 'true');
    container.appendChild(heart);
    setTimeout(() => heart.remove(), 1400);
  }
}

/** 撫摸 / 餵食成功的視覺回饋 */
function playCompanionComfortEffect() {
  const heartsEl = document.getElementById('companion-preview-hearts');
  const frame = document.querySelector('.companion-image-preview__frame');
  triggerComfortVibration();
  spawnCompanionHearts(heartsEl);
  if (frame && !state?.userPreferences?.reduceMotion) {
    frame.classList.add('companion-image-preview__frame--comfort');
    setTimeout(() => frame.classList.remove('companion-image-preview__frame--comfort'), 650);
  }
}

function buildCompanionFeedSection(companion) {
  const inventory = state.inventory || { items: {} };
  const itemCounts = getItemInventory(inventory);
  const bondItems = (state.craftablesCatalog || []).filter(
    (c) =>
      (c.type === 'bond_item' || c.type === 'favorite_bond_item') &&
      (itemCounts[c.id] || 0) > 0
  );
  const today = getTodayDateString();
  const dailyUsed = getDailyBondItemUsage(companion.id, today, inventory);
  const atLimit = dailyUsed >= DAILY_BOND_ITEM_LIMIT;
  const progress = getBondProgress(companion.bondExp ?? 0, companion.bondLevel ?? 1);

  if (bondItems.length === 0) {
    return `
      <section class="companion-preview-feed card">
        <h3 class="companion-preview-feed__title">餵食</h3>
        <p class="companion-preview-feed__empty">目前沒有親密度道具。<br>可到「更多 → 工坊」用探險材料製作。</p>
      </section>
      <p class="companion-preview-bond">親密度 Lv.${companion.bondLevel ?? 1} · ${progress.current}/${progress.max || 'MAX'}</p>`;
  }

  const options = bondItems
    .map((item) => {
      const stock = itemCounts[item.id] || 0;
      const fav = getFavoriteBonus(item, companion).isFavorite;
      const favMark = fav ? ' ★喜好' : '';
      return `<option value="${item.id}">${escapeHtml(item.name)} ×${stock}${favMark}</option>`;
    })
    .join('');

  return `
    <section class="companion-preview-feed card">
      <h3 class="companion-preview-feed__title">餵食</h3>
      <p class="companion-preview-feed__daily">今日已餵 ${dailyUsed} / ${DAILY_BOND_ITEM_LIMIT}</p>
      <label class="companion-preview-feed__picker">
        <span class="companion-preview-feed__label">工坊食物</span>
        <select id="companion-feed-select" class="companion-preview-feed__select">${options}</select>
      </label>
      <button type="button" class="btn btn--primary btn--block" id="companion-feed-btn" ${atLimit ? 'disabled' : ''}>餵食</button>
      ${atLimit ? '<p class="companion-preview-feed__limit">今天這隻寵物已經收到足夠多禮物了，明天再來吧。</p>' : ''}
    </section>
    <p class="companion-preview-bond">親密度 Lv.${companion.bondLevel ?? 1} · ${progress.current}/${progress.max || 'MAX'}</p>`;
}

function buildCompanionPetButtonHtml(companion) {
  const canPet = canPetCompanion(companion);
  const remaining = getPetCooldownRemaining(companion);
  const btnLabel = canPet ? '撫摸' : (remaining > 0 ? `還要 ${formatCooldown(remaining)}` : '冷卻中');
  return `<button type="button" class="btn btn--secondary btn--block" id="companion-pet-btn" ${canPet ? '' : 'disabled'}>${escapeHtml(btnLabel)}</button>`;
}

function bindCompanionPreviewInteractions(companion) {
  const stage = document.getElementById('companion-preview-stage');
  const img = stage?.querySelector('.companion-image-preview__img--interactive');
  const petBtn = document.getElementById('companion-pet-btn');
  const feedBtn = document.getElementById('companion-feed-btn');

  const onPet = async (e) => {
    e?.stopPropagation();
    if (!canPetCompanion(companion)) {
      const remaining = getPetCooldownRemaining(companion);
      showToast(`牠剛剛已經被摸過了，還要 ${formatCooldown(remaining)}才能再次撫摸。`, 'warning', 3500);
      return;
    }
    try {
      const result = await petCompanion();
      if (!result.success) {
        showToast(result.message, 'warning', 3500);
        return;
      }
      playCompanionComfortEffect();
      showToast('你輕輕摸了摸牠，親密度 +5', 'success', 2800);
      if (result.leveledUp) {
        setTimeout(() => showToast(`親密度提升到 Lv.${result.newLevel}`, 'success', 2800), 400);
      }
      await trackQuest('pet_companion');
      await onRefresh({ renderMode: ['tasks'] });
      if (result.leveledUp) {
        await notifyBondUnlocks(companion.id);
      }
      const updated = state.companion;
      if (updated) {
        openCompanionImageModal(updated);
      }
      const comfortLine = getPetComfortLine(updated || companion);
      setCompanionBubbleText(comfortLine, true);
    } catch (err) {
      showToast(err.message || '撫摸失敗', 'error');
    }
  };

  // 點圖片放大原圖；撫摸改由下方「撫摸」按鈕觸發
  img?.addEventListener('click', (e) => {
    e.stopPropagation();
    openPetImageViewer(companion.id);
  });
  petBtn?.addEventListener('click', onPet);

  feedBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (feedBtn.disabled) return;
    const select = document.getElementById('companion-feed-select');
    const itemId = select?.value;
    if (!itemId) {
      showToast('請先選擇要餵食的食物', 'warning');
      return;
    }
    try {
      const result = await useBondItem(itemId, companion.id, state.allPets);
      if (!result.success) {
        showToast(result.message, 'warning');
        return;
      }
      playCompanionComfortEffect();
      await trackQuest('gift_pet');
      await onRefresh({ renderMode: ['tasks', 'workshop'] });
      const updated = state.companion;
      if (updated) {
        openCompanionImageModal(updated);
      }
      if (result.isFavorite) {
        showToast(`牠很喜歡這份禮物！親密度 +${result.bondExp}`, 'success', 3200);
      } else {
        showToast(`親密度提升 +${result.bondExp}`, 'success');
      }
      if (result.leveledUp) {
        setTimeout(() => showToast(`親密度提升到 Lv.${result.newLevel}`, 'success', 2800), 400);
        await notifyBondUnlocks(companion.id);
      }
      await handleAchievementCheckAfterAction();
    } catch (err) {
      showToast(err.message || '餵食失敗', 'error');
    }
  });
}

function openCompanionImageModal(companion) {
  if (!companion?.image) return;

  const src = getPetImageSrc(companion);
  warmPetImageCache(src).catch(() => {});

  const rarityClass = `rarity-${companion.rarity}`;
  const onError = `this.onerror=null;this.classList.add('companion-image-preview__img--error')`;
  const onload = "this.classList.add('is-loaded');this.closest('.pet-image-frame')?.classList.remove('is-loading')";
  const feedSection = buildCompanionFeedSection(companion);

  openModal(`
    <div class="companion-image-preview ${rarityClass}">
      <div class="companion-image-preview__stage" id="companion-preview-stage">
        <div class="companion-preview-hearts" id="companion-preview-hearts" aria-hidden="true"></div>
        <div class="companion-image-preview__frame pet-image-frame pet-image-frame--lg is-loading">
          <img
            class="companion-image-preview__img companion-image-preview__img--interactive is-loading"
            src="${src}"
            alt="${escapeHtml(petDisplayName(companion))}"
            loading="eager"
            decoding="async"
            onload="${onload}"
            onerror="${onError}"
          />
          <span class="pet-image-frame__fallback" aria-hidden="true">圖片載入中</span>
        </div>
      </div>
      <h2 class="companion-image-preview__name">${escapeHtml(petDisplayName(companion))}</h2>
      ${petOriginalNameHtml(companion)}
      <div class="companion-image-preview__meta">
        <span class="badge badge--rarity ${rarityClass}">${companion.rarity}</span>
        ${renderStars(companion.stars ?? 1)}
      </div>
      <div class="companion-preview-actions">
        ${buildCompanionPetButtonHtml(companion)}
      </div>
      ${feedSection}
      <p class="companion-image-preview__hint">點圖片放大原圖 · 按撫摸與夥伴互動 · 餵食使用工坊食物</p>
    </div>
  `);

  bindCompanionPreviewInteractions(companion);
}

/** 陪伴寵物未變時只更新圖片 src（避免整卡重建） */
function updateCompanionImageIfNeeded(companion) {
  const img = document.querySelector('.companion-card__image img');
  const src = getPetImageSrc(companion, 'stage');
  if (!img || !src) return;

  const currentSrc = img.getAttribute('src') || '';
  if (currentSrc === src) return;

  const frame = img.closest('.pet-image-frame');
  frame?.classList.add('is-loading');
  frame?.classList.remove('is-error');
  img.classList.remove('is-loaded', 'is-error');
  img.classList.add('is-loading');
  img.setAttribute('src', src);
  warmPetImageCache(src).catch(() => {});
}

function updateCompanionBondDisplay(companion) {
  const progress = getBondProgress(companion.bondExp ?? 0, companion.bondLevel ?? 1);
  const labels = document.querySelector('.companion-bond__label');
  if (labels) {
    const spans = labels.querySelectorAll('span');
    if (spans[0]) spans[0].textContent = `親密度 Lv.${companion.bondLevel ?? 1}`;
    if (spans[1]) spans[1].textContent = `${progress.current}/${progress.max || 'MAX'}`;
  }
  const fill = document.querySelector('.companion-bond .progress-bar__fill');
  if (fill) fill.style.width = `${progress.percent}%`;

  const petRow = document.querySelector('.companion-card__pet-row');
  if (petRow) {
    const canPet = canPetCompanion(companion);
    const remaining = getPetCooldownRemaining(companion);
    const btnLabel = canPet ? '撫摸' : (remaining > 0 ? `還要 ${formatCooldown(remaining)}` : '冷卻中');
    const btn = petRow.querySelector('.companion-pet-btn');
    if (btn) {
      btn.textContent = btnLabel;
      btn.disabled = !canPet;
    }
    let cooldownEl = petRow.querySelector('.companion-card__cooldown');
    if (!canPet) {
      const hint = `撫摸冷卻中，${formatCooldown(remaining)}後可再次撫摸`;
      if (cooldownEl) {
        cooldownEl.textContent = hint;
      } else {
        cooldownEl = document.createElement('p');
        cooldownEl.className = 'companion-card__cooldown';
        cooldownEl.textContent = hint;
        petRow.appendChild(cooldownEl);
      }
    } else if (cooldownEl) {
      cooldownEl.remove();
    }
  }
}

function buildDialogueContext(overrides = {}) {
  const isIdle = Date.now() - lastUserActivity >= IDLE_THRESHOLD_MS;
  return {
    tasks: state.tasks,
    todayCompleted: state.todayCompleted,
    companion: state.companion,
    wallet: state.wallet,
    activeExpedition: state.activeExpedition,
    expeditionAreas: state.expeditionAreas,
    habits: state.habits || [],
    inventory: state.inventory,
    dailyCheckIn: state.dailyCheckIn,
    craftables: state.craftablesCatalog || [],
    workshopHelpers: {
      hasCraftableMaterials,
      hasBondItemsInInventory,
      companionLikesAnyGift,
      hasLowMaterials,
    },
    isIdle,
    ...overrides,
  };
}

/* ═══════════════════════════════════════
   V3.0.0 全域信箱 UI
   遠端 title/body 一律 textContent，禁止 innerHTML 直接渲染遠端文字
   補償：once per local profile（每份本機資料領取一次）
   ═══════════════════════════════════════ */

function getMailboxCatalogs() {
  return {
    materialsCatalog: state?.materialsCatalog || [],
    craftablesCatalog: state?.craftablesCatalog || [],
  };
}

function getMailboxViewModel(filterOverride) {
  const filter = filterOverride ?? mailboxFilter ?? 'all';
  return buildMailboxViewModel(mailboxPayload, mailboxStateLocal || { readIds: [], claimedIds: [] }, {
    filter,
    appVersion: APP_VERSION,
  });
}

export function getMailboxGiftStatus(messageId) {
  if (mailboxStateLocal?.claimedIds?.includes(messageId)) return 'claimed';
  const gift = getMailboxViewModel('all').allVisible.find((message) => message.id === messageId);
  if (gift) return gift.status?.claimable ? 'claimable' : 'unavailable';
  return mailboxFetchFailed || mailboxPayload?.messages?.length ? 'unavailable' : 'unknown';
}

function updateMailboxEntryBadge() {
  const btn = document.getElementById('btn-global-mailbox');
  const badge = document.getElementById('mailbox-entry-badge');
  const gift = document.getElementById('mailbox-entry-gift');
  if (!btn || !badge || !gift) return;

  const vm = buildMailboxViewModel(mailboxPayload, mailboxStateLocal || { readIds: [], claimedIds: [] }, {
    filter: 'all',
    appVersion: APP_VERSION,
  });
  const summary = getMailboxBadgeSummary(vm);

  btn.setAttribute('aria-label', summary.ariaLabel);

  // 禮物圖示：僅在有可領取補償時顯示；否則必須隱藏，避免誤以為還有未讀
  if (summary.showClaimHint) {
    gift.hidden = false;
    gift.removeAttribute('hidden');
    gift.classList.add('mailbox-entry-btn__gift--pulse');
    badge.hidden = true;
    badge.setAttribute('hidden', '');
    badge.textContent = '';
  } else if (summary.showUnreadBadge) {
    gift.hidden = true;
    gift.setAttribute('hidden', '');
    gift.classList.remove('mailbox-entry-btn__gift--pulse');
    badge.hidden = false;
    badge.removeAttribute('hidden');
    badge.textContent = summary.unreadDisplay;
  } else {
    gift.hidden = true;
    gift.setAttribute('hidden', '');
    gift.classList.remove('mailbox-entry-btn__gift--pulse');
    badge.hidden = true;
    badge.setAttribute('hidden', '');
    badge.textContent = '';
  }
}

/**
 * 非阻塞同步信箱（啟動／前景／手動刷新）
 * 失敗不得阻斷 App
 */
export async function syncGlobalMailbox(options = {}) {
  const { force = false, silent = true } = options;
  try {
    if (!force && !shouldCheckMailboxOnForeground() && mailboxPayload?.messages?.length >= 0 && mailboxStateLocal) {
      // 仍允許僅用記憶體更新 badge
      updateMailboxEntryBadge();
      return { ok: true, throttled: true };
    }

    const catalogs = getMailboxCatalogs();
    const result = force
      ? await refreshGlobalMailbox(catalogs)
      : await fetchGlobalMailbox({ ...catalogs, force: false });

    mailboxPayload = result.payload || mailboxPayload;
    mailboxFromCache = !!result.fromCache;
    mailboxFetchFailed = result.ok === false;
    mailboxStateLocal = await getGlobalMailboxState();
    updateMailboxEntryBadge();
    refreshOnboarding();

    if (document.getElementById('global-mailbox-modal')?.classList.contains('open')) {
      renderGlobalMailboxModal();
    }
    return result;
  } catch (err) {
    console.warn('[QuestNote] 信箱同步失敗（不影響其他功能）:', err);
    if (!silent) showToast('目前無法取得信件，請稍後再試', 'info');
    updateMailboxEntryBadge();
    return { ok: false, error: err?.message };
  }
}

function bindGlobalMailboxEntry() {
  document.getElementById('btn-global-mailbox')?.addEventListener('click', () => {
    openGlobalMailbox();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void syncGlobalMailbox({ force: false, silent: true });
    }
  });
}

function ensureGlobalMailboxModal() {
  let modal = document.getElementById('global-mailbox-modal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'global-mailbox-modal';
  modal.className = 'global-mailbox-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', '信箱');

  const backdrop = document.createElement('div');
  backdrop.className = 'global-mailbox-modal__backdrop';
  backdrop.dataset.action = 'mailbox-close';

  const sheet = document.createElement('div');
  sheet.className = 'global-mailbox-modal__sheet';

  const header = document.createElement('div');
  header.className = 'global-mailbox-modal__header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'global-mailbox-modal__title-wrap';
  const title = document.createElement('h2');
  title.className = 'global-mailbox-modal__title';
  title.id = 'mailbox-modal-title';
  title.textContent = '信箱';
  const unread = document.createElement('span');
  unread.className = 'global-mailbox-modal__unread';
  unread.id = 'mailbox-modal-unread';
  titleWrap.append(title, unread);

  const actions = document.createElement('div');
  actions.className = 'global-mailbox-modal__actions';
  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'global-mailbox-modal__icon-btn';
  refreshBtn.id = 'mailbox-refresh-btn';
  refreshBtn.dataset.action = 'mailbox-refresh';
  refreshBtn.setAttribute('aria-label', '刷新信箱');
  refreshBtn.textContent = '↻';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'global-mailbox-modal__icon-btn';
  closeBtn.dataset.action = 'mailbox-close';
  closeBtn.setAttribute('aria-label', '關閉信箱');
  closeBtn.textContent = '✕';
  actions.append(refreshBtn, closeBtn);
  header.append(titleWrap, actions);

  const offline = document.createElement('p');
  offline.className = 'global-mailbox-modal__offline';
  offline.id = 'mailbox-offline-hint';
  offline.hidden = true;
  offline.textContent = '目前為離線內容';

  const filters = document.createElement('div');
  filters.className = 'global-mailbox-modal__filters';
  filters.id = 'mailbox-filters';
  filters.setAttribute('role', 'tablist');
  filters.setAttribute('aria-label', '信件篩選');

  const body = document.createElement('div');
  body.className = 'global-mailbox-modal__body';
  body.id = 'mailbox-modal-body';

  sheet.append(header, offline, filters, body);
  modal.append(backdrop, sheet);
  document.body.appendChild(modal);

  modal.addEventListener('click', handleMailboxModalClick);
  return modal;
}

function handleMailboxModalClick(e) {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const action = t.dataset.action;

  if (action === 'mailbox-close') {
    closeGlobalMailbox();
    return;
  }
  if (action === 'mailbox-refresh') {
    void handleMailboxRefresh();
    return;
  }
  if (action === 'mailbox-filter') {
    mailboxFilter = t.dataset.filter || 'all';
    mailboxSelectedId = null;
    renderGlobalMailboxModal();
    return;
  }
  if (action === 'mailbox-open-message') {
    const id = t.dataset.messageId;
    if (!id) return;
    void openMailboxMessageDetail(id);
    return;
  }
  if (action === 'mailbox-back-list') {
    mailboxSelectedId = null;
    renderGlobalMailboxModal();
    return;
  }
  if (action === 'mailbox-claim') {
    const id = t.dataset.messageId;
    if (!id) return;
    void handleMailboxClaim(id, t);
    return;
  }
  if (action === 'mailbox-action-view') {
    const view = t.dataset.view;
    if (!view) return;
    closeGlobalMailbox();
    switchView(view);
  }
}

async function handleMailboxRefresh() {
  if (mailboxRefreshing) return;
  mailboxRefreshing = true;
  const btn = document.getElementById('mailbox-refresh-btn');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('is-loading');
  }
  try {
    const result = await syncGlobalMailbox({ force: true, silent: false });
    if (!result.ok && !mailboxPayload?.messages?.length) {
      showToast('目前無法取得信件，請稍後再試', 'info');
    } else if (result.fromCache) {
      showToast('目前為離線內容', 'info', 2200);
    }
  } finally {
    mailboxRefreshing = false;
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
    renderGlobalMailboxModal();
  }
}

export async function openGlobalMailbox({ focusClaimableId = null } = {}) {
  mailboxLastFocus = document.activeElement;
  ensureGlobalMailboxModal();
  mailboxSelectedId = null;

  if (!mailboxStateLocal) {
    try {
      mailboxStateLocal = await getGlobalMailboxState();
    } catch {
      mailboxStateLocal = { readIds: [], claimedIds: [] };
    }
  }

  const vm = getMailboxViewModel('all');
  if (mailboxFilter == null) {
    mailboxFilter = vm.defaultFilter;
  }
  const focusedGift = vm.allVisible.find((message) => message.id === focusClaimableId && message.status?.claimable);
  if (focusedGift) {
    mailboxFilter = 'claimable';
    mailboxSelectedId = focusedGift.id;
  }

  const modal = document.getElementById('global-mailbox-modal');
  rememberDialogFocus(modal);
  modal?.classList.add('open');
  document.body.classList.add('global-mailbox-open', 'modal-open');
  renderGlobalMailboxModal();

  mailboxKeydownHandler = (e) => {
    if (e.key === 'Escape' && isTopDialog(modal)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (mailboxSelectedId) {
        mailboxSelectedId = null;
        renderGlobalMailboxModal();
        focusDialog(modal);
      } else {
        closeGlobalMailbox();
      }
    }
  };
  document.addEventListener('keydown', mailboxKeydownHandler);

  // 開啟時輕量同步（不阻塞 UI）
  void syncGlobalMailbox({ force: false, silent: true });

  requestAnimationFrame(() => {
    (focusedGift
      ? document.querySelector('.mailbox-detail__claim-btn')
      : document.getElementById('mailbox-refresh-btn'))?.focus();
  });
}

export function closeGlobalMailbox() {
  const modal = document.getElementById('global-mailbox-modal');
  modal?.classList.remove('open');
  document.body.classList.remove('global-mailbox-open');
  if (!document.getElementById('modal-overlay')?.classList.contains('open')) {
    document.body.classList.remove('modal-open');
  }
  if (mailboxKeydownHandler) {
    document.removeEventListener('keydown', mailboxKeydownHandler);
    mailboxKeydownHandler = null;
  }
  mailboxSelectedId = null;
  if (mailboxLastFocus && typeof mailboxLastFocus.focus === 'function') {
    try { mailboxLastFocus.focus(); } catch { /* ignore */ }
  }
  mailboxLastFocus = null;
  restoreDialogFocus(modal);
  updateMailboxEntryBadge();
}

function formatMailboxDate(iso) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('zh-Hant-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return String(iso).slice(0, 16);
  }
}

function renderGlobalMailboxModal() {
  const modal = document.getElementById('global-mailbox-modal');
  if (!modal?.classList.contains('open')) return;

  const vmAll = buildMailboxViewModel(mailboxPayload, mailboxStateLocal || { readIds: [], claimedIds: [] }, {
    filter: 'all',
    appVersion: APP_VERSION,
  });
  const activeFilter = mailboxFilter || vmAll.defaultFilter || 'all';
  mailboxFilter = activeFilter;
  const vm = buildMailboxViewModel(mailboxPayload, mailboxStateLocal || { readIds: [], claimedIds: [] }, {
    filter: activeFilter,
    appVersion: APP_VERSION,
  });

  const unreadEl = document.getElementById('mailbox-modal-unread');
  if (unreadEl) {
    unreadEl.textContent = vmAll.unreadCount > 0 ? `未讀 ${vmAll.unreadCount}` : '未讀 0';
  }

  const offline = document.getElementById('mailbox-offline-hint');
  if (offline) offline.hidden = !mailboxFromCache;

  const filters = document.getElementById('mailbox-filters');
  if (filters) {
    filters.replaceChildren();
    const chips = [
      { id: 'all', label: '全部' },
      { id: 'unread', label: '未讀' },
      { id: 'claimable', label: '可領取' },
    ];
    for (const chip of chips) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mailbox-filter-chip' + (activeFilter === chip.id ? ' is-active' : '');
      btn.dataset.action = 'mailbox-filter';
      btn.dataset.filter = chip.id;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', activeFilter === chip.id ? 'true' : 'false');
      btn.textContent = chip.label;
      filters.appendChild(btn);
    }
  }

  const body = document.getElementById('mailbox-modal-body');
  if (!body) return;
  body.replaceChildren();

  if (mailboxSelectedId) {
    const msg = findMailboxMessageById(mailboxSelectedId);
    if (msg) {
      body.appendChild(buildMailboxDetailElement(msg));
      return;
    }
    mailboxSelectedId = null;
  }

  if (!vm.messages.length) {
    const empty = document.createElement('div');
    empty.className = 'mailbox-empty';
    const icon = document.createElement('div');
    icon.className = 'mailbox-empty__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = mailboxFetchFailed && !(mailboxPayload?.messages?.length) ? '📭' : '📭';
    const title = document.createElement('p');
    title.className = 'mailbox-empty__title';
    const desc = document.createElement('p');
    desc.className = 'mailbox-empty__desc';

    if (mailboxFetchFailed && !(mailboxPayload?.messages?.length)) {
      title.textContent = '目前無法取得信件，請稍後再試';
      desc.textContent = '連線恢復後可手動刷新';
    } else if (activeFilter !== 'all') {
      title.textContent = '這個分類目前沒有信件';
      desc.textContent = '試試切換其他篩選';
    } else {
      title.textContent = '目前沒有新信件';
      desc.textContent = '更新公告與補償會出現在這裡';
    }
    empty.append(icon, title, desc);
    body.appendChild(empty);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'mailbox-list';
  for (const msg of vm.messages) {
    list.appendChild(buildMailboxListItem(msg));
  }
  body.appendChild(list);
}

function buildMailboxListItem(msg) {
  const li = document.createElement('li');
  li.className = 'mailbox-list-item'
    + (msg.status?.unread ? ' is-unread' : '')
    + (msg.status?.claimable ? ' is-claimable' : '');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'mailbox-list-item__btn';
  btn.dataset.action = 'mailbox-open-message';
  btn.dataset.messageId = msg.id;

  const icon = document.createElement('span');
  icon.className = 'mailbox-list-item__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = msg.icon || '📮';

  const main = document.createElement('span');
  main.className = 'mailbox-list-item__main';

  const title = document.createElement('span');
  title.className = 'mailbox-list-item__title';
  title.textContent = msg.title;

  const meta = document.createElement('span');
  meta.className = 'mailbox-list-item__meta';

  const typeChip = document.createElement('span');
  typeChip.className = `mailbox-type-chip mailbox-type-chip--${msg.type}`;
  typeChip.textContent = getMailboxTypeLabel(msg.type);

  const date = document.createElement('span');
  date.className = 'mailbox-list-item__date';
  date.textContent = formatMailboxDate(msg.publishedAt);

  meta.append(typeChip, date);

  if (msg.source === 'local-dev' && isAuthorLocalDevMode()) {
    const testChip = document.createElement('span');
    testChip.className = 'mailbox-type-chip mailbox-type-chip--local-dev';
    testChip.textContent = '本機測試';
    meta.appendChild(testChip);
  }

  if (msg.status?.claimStatus) {
    const claimChip = document.createElement('span');
    claimChip.className = `mailbox-claim-chip mailbox-claim-chip--${msg.status.claimStatus}`;
    claimChip.textContent = getClaimStatusLabel(msg.status.claimStatus);
    meta.appendChild(claimChip);
  }

  main.append(title, meta);

  const marks = document.createElement('span');
  marks.className = 'mailbox-list-item__marks';
  if (msg.status?.unread) {
    const dot = document.createElement('span');
    dot.className = 'mailbox-list-item__unread-dot';
    dot.setAttribute('aria-label', '未讀');
    marks.appendChild(dot);
  }
  if (msg.status?.claimable) {
    const gift = document.createElement('span');
    gift.className = 'mailbox-list-item__gift';
    gift.setAttribute('aria-hidden', 'true');
    gift.textContent = '🎁';
    marks.appendChild(gift);
  }

  btn.append(icon, main, marks);
  li.appendChild(btn);
  return li;
}

function buildMailboxDetailElement(msg) {
  // 重新解析狀態（單封，避免把其他 local-dev 併進來干擾）
  const vm = buildMailboxViewModel(
    { messages: [msg] },
    mailboxStateLocal || { readIds: [], claimedIds: [] },
    { filter: 'all', appVersion: APP_VERSION, includeLocalDev: false },
  );
  const status = vm.allVisible[0]?.status || msg.status || {};

  const wrap = document.createElement('div');
  wrap.className = 'mailbox-detail';

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'mailbox-detail__back';
  back.dataset.action = 'mailbox-back-list';
  back.textContent = '← 返回列表';

  const head = document.createElement('div');
  head.className = 'mailbox-detail__head';
  const icon = document.createElement('span');
  icon.className = 'mailbox-detail__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = msg.icon || '📮';
  const title = document.createElement('h3');
  title.className = 'mailbox-detail__title';
  title.textContent = msg.title;
  head.append(icon, title);

  const meta = document.createElement('div');
  meta.className = 'mailbox-detail__meta';
  const typeChip = document.createElement('span');
  typeChip.className = `mailbox-type-chip mailbox-type-chip--${msg.type}`;
  typeChip.textContent = getMailboxTypeLabel(msg.type);
  const date = document.createElement('span');
  date.className = 'mailbox-detail__date';
  date.textContent = formatMailboxDate(msg.publishedAt);
  meta.append(typeChip, date);

  if (msg.source === 'local-dev' && isAuthorLocalDevMode()) {
    const testChip = document.createElement('span');
    testChip.className = 'mailbox-type-chip mailbox-type-chip--local-dev';
    testChip.textContent = '本機測試';
    meta.appendChild(testChip);
  }

  if (status.claimStatus) {
    const claimChip = document.createElement('span');
    claimChip.className = `mailbox-claim-chip mailbox-claim-chip--${status.claimStatus}`;
    claimChip.textContent = getClaimStatusLabel(status.claimStatus);
    meta.appendChild(claimChip);
  }

  const body = document.createElement('p');
  body.className = 'mailbox-detail__body';
  body.textContent = msg.body || '';

  wrap.append(back, head, meta, body);

  if (msg.type === 'compensation') {
    const rewardBox = document.createElement('div');
    rewardBox.className = 'mailbox-reward-preview';
    const rewardTitle = document.createElement('p');
    rewardTitle.className = 'mailbox-reward-preview__title';
    rewardTitle.textContent = '獎勵預覽';
    rewardBox.appendChild(rewardTitle);

    if (status.claimStatus === 'invalid' || msg.rewardError) {
      const err = document.createElement('p');
      err.className = 'mailbox-reward-preview__error';
      err.textContent = '此補償資料格式有誤';
      rewardBox.appendChild(err);
    } else {
      const lines = formatMailboxRewardPreview(msg.reward);
      if (!lines.length) {
        const empty = document.createElement('p');
        empty.className = 'mailbox-reward-preview__empty';
        empty.textContent = '此補償沒有可領取的獎勵內容';
        rewardBox.appendChild(empty);
      } else {
        const ul = document.createElement('ul');
        ul.className = 'mailbox-reward-preview__list';
        for (const line of lines) {
          const li = document.createElement('li');
          li.textContent = line.text;
          ul.appendChild(li);
        }
        rewardBox.appendChild(ul);
      }
    }
    wrap.appendChild(rewardBox);

    if (status.claimable) {
      const claimBtn = document.createElement('button');
      claimBtn.type = 'button';
      claimBtn.className = 'btn btn--primary mailbox-detail__claim-btn';
      claimBtn.dataset.action = 'mailbox-claim';
      claimBtn.dataset.messageId = msg.id;
      claimBtn.textContent = '領取補償';
      wrap.appendChild(claimBtn);
      const note = document.createElement('p');
      note.className = 'mailbox-detail__claim-note';
      note.textContent = '每份本機資料領取一次';
      wrap.appendChild(note);
    }
  }

  if (msg.action?.type === 'view' && msg.action.view) {
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'btn btn--secondary mailbox-detail__action-btn';
    actionBtn.dataset.action = 'mailbox-action-view';
    actionBtn.dataset.view = msg.action.view;
    actionBtn.textContent = msg.action.label || '前往查看';
    wrap.appendChild(actionBtn);
  }

  return wrap;
}

function findMailboxMessageById(messageId) {
  if (!messageId) return null;
  const vm = buildMailboxViewModel(mailboxPayload, mailboxStateLocal || { readIds: [], claimedIds: [] }, {
    filter: 'all',
    appVersion: APP_VERSION,
  });
  return vm.allVisible.find((m) => m.id === messageId)
    || (mailboxPayload.messages || []).find((m) => m.id === messageId)
    || getLocalDevMailboxMessages(getMailboxCatalogs()).find((m) => m.id === messageId)
    || null;
}

async function openMailboxMessageDetail(messageId) {
  mailboxSelectedId = messageId;
  try {
    mailboxStateLocal = await markMailboxMessageRead(messageId);
  } catch (err) {
    console.warn('[QuestNote] 標記已讀失敗:', err);
  }
  renderGlobalMailboxModal();
  updateMailboxEntryBadge();
}

async function handleMailboxClaim(messageId, btnEl) {
  if (!messageId) return;
  if (btnEl) btnEl.disabled = true;

  const msg = findMailboxMessageById(messageId);
  if (!msg) {
    showToast('信件不存在', 'warning');
    if (btnEl) btnEl.disabled = false;
    return;
  }

  const result = await claimMailboxReward(msg, {
    ...getMailboxCatalogs(),
    appVersion: APP_VERSION,
  });

  if (!result.success) {
    showToast(result.error || '領取失敗', 'warning');
    if (btnEl) btnEl.disabled = false;
    // 重新讀狀態
    try { mailboxStateLocal = await getGlobalMailboxState(); } catch { /* ignore */ }
    renderGlobalMailboxModal();
    updateMailboxEntryBadge();
    return;
  }

  mailboxStateLocal = result.state;
  if (result.wallet && state) state.wallet = result.wallet;
  if (result.inventory && state) state.inventory = result.inventory;

  showToast('補償已領取', 'reward', 2800);
  renderSharedUI();
  renderGlobalMailboxModal();
  updateMailboxEntryBadge();
  void recordOnboardingEvent('mailbox-claimed', { messageId });
}

/**
 * 是否有任何全畫面 Modal / Overlay 開啟（含寵物原圖、派遣選單、信箱）。
 * 局部渲染遇到 Overlay 時應跳過重建目前 view。
 */
export function isAnyOverlayOpen() {
  return Boolean(
    document.querySelector('#modal-overlay.open') ||
    document.querySelector('#pet-image-viewer') ||
    document.querySelector('#expedition-dispatch-modal') ||
    document.querySelector('#global-mailbox-modal.open') ||
    document.body.classList.contains('is-pet-image-viewer-open') ||
    document.body.classList.contains('expedition-dispatch-open') ||
    document.body.classList.contains('global-mailbox-open')
  );
}

/** @deprecated 名稱保留相容；實際等同 isAnyOverlayOpen() */
function isModalOpen() {
  return isAnyOverlayOpen();
}

function setCompanionBubbleText(text, animate = true) {
  const bubbleText = document.getElementById('companion-bubble-text');
  if (!bubbleText) return;

  if (!animate) {
    bubbleText.textContent = text;
    return;
  }

  bubbleText.classList.add('companion-bubble__text--changing');
  setTimeout(() => {
    bubbleText.textContent = text;
    bubbleText.classList.remove('companion-bubble__text--changing');
    bubbleText.classList.add('companion-bubble__text--show');
    setTimeout(() => bubbleText.classList.remove('companion-bubble__text--show'), 350);
  }, 180);
}

function refreshCompanionBubble(overrides = {}) {
  if (!state?.companion) return;
  const line = getCompanionDialogue(buildDialogueContext(overrides));
  setCompanionBubbleText(line, !overrides.isWelcome);
}

function showCompanionDialogue() {
  const card = document.querySelector('.companion-card');
  const img = document.querySelector('.companion-card__image');
  if (!state.companion) return;

  trackUserActivity();
  refreshCompanionBubble();
  card?.classList.add('companion-card--bounce');
  img?.classList.add('companion-img--bounce');
  setTimeout(() => {
    card?.classList.remove('companion-card--bounce');
    img?.classList.remove('companion-img--bounce');
  }, 500);
  scheduleCompanionDialogueTimer();
}

function scheduleCompanionDialogueTimer() {
  stopCompanionDialogueTimer();
  if (!state?.companion || currentTasksView !== 'tasks') return;

  companionDialogueTimer = setTimeout(() => {
    if (!isModalOpen() && state?.companion && currentTasksView === 'tasks') {
      refreshCompanionBubble();
    }
    scheduleCompanionDialogueTimer();
  }, randomBubbleInterval());
}

function startCompanionDialogueTimer() {
  if (state?.companion && currentTasksView === 'tasks') {
    scheduleCompanionDialogueTimer();
  }
}

function stopCompanionDialogueTimer() {
  if (companionDialogueTimer) {
    clearTimeout(companionDialogueTimer);
    companionDialogueTimer = null;
  }
}

function bindActivityTracking() {
  const track = () => trackUserActivity();
  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach((evt) => {
    document.addEventListener(evt, track, { passive: true });
  });
}

function trackUserActivity() {
  lastUserActivity = Date.now();
}

export function applyReduceMotionClass(enabled) {
  document.body.classList.toggle('reduce-motion', !!enabled);
}

/**
 * 套用美術風格主題
 * @param {string} theme
 * @param {{ silent?: boolean, skipSave?: boolean }} [options]
 */
export async function applyTheme(theme, options = {}) {
  const { silent = false, skipSave = false } = options;
  const valid = normalizeTheme(theme);
  const previous = state?.userPreferences?.theme ?? document.body.dataset.theme ?? 'default';

  applyThemeToDocument(valid);

  if (!skipSave) {
    const prefs = await setTheme(valid);
    if (state) state.userPreferences = prefs;
  } else if (state) {
    state.userPreferences = { ...state.userPreferences, theme: valid };
  }

  if (state) {
    applyReduceMotionClass(state.userPreferences?.reduceMotion ?? false);
    await renderAll();
  } else {
    renderThemePickerState(valid);
  }

  if (!silent && previous !== valid) {
    showToast('主題已切換', 'success');
  }

  return valid;
}

function renderThemePickerState(activeTheme) {
  const theme = normalizeTheme(activeTheme);
  document.querySelectorAll('[data-action="select-theme"]').forEach((card) => {
    const cardTheme = card.dataset.theme;
    const isActive = cardTheme === theme;
    card.classList.toggle('theme-card--active', isActive);
    card.setAttribute('aria-checked', isActive ? 'true' : 'false');
  });
  document.querySelectorAll('[data-theme-badge]').forEach((badge) => {
    badge.hidden = badge.dataset.themeBadge !== theme;
  });
}

function renderNavBadges() {
  if (!state) return;

  const { wallet, activeExpedition, companion, achievementSummary } = state;
  const expeditionComplete =
    activeExpedition && isExpeditionTimeComplete(activeExpedition) && !activeExpedition.claimed;
  const stardust = wallet?.stardust ?? 0;
  const claimable = achievementSummary?.claimable ?? 0;
  const hasUnseenTitles = achievementSummary?.hasUnseenTitles ?? false;
  const habitIncomplete = state.habitStats?.hasIncompleteToday ?? false;
  const habitNearGoal = hasWeeklyNearGoal(state.habits || []);

  setNavBadge('expedition', !!expeditionComplete, 'alert');
  setNavBadge('gacha', getGachaAffordability().canTen, 'hint');
  setNavBadge('collection', !companion, 'hint');
  setNavBadge('more', claimable > 0 || hasUnseenTitles || habitIncomplete || habitNearGoal, 'alert');

  const moreBadge = document.getElementById('more-achievements-badge');
  if (moreBadge) {
    moreBadge.hidden = !(claimable > 0 || hasUnseenTitles);
  }

  const habitsBadge = document.getElementById('more-habits-badge');
  if (habitsBadge) {
    habitsBadge.hidden = !(habitIncomplete || habitNearGoal);
  }
}

function setNavBadge(view, show, type = 'alert') {
  const nav = document.querySelector(`.nav-item[data-view="${view}"]`);
  if (!nav) return;

  let badge = nav.querySelector('.nav-badge');
  if (show) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = `nav-badge nav-badge--${type}`;
      badge.setAttribute('aria-hidden', 'true');
      nav.appendChild(badge);
    }
    badge.className = `nav-badge nav-badge--${type}`;
    badge.hidden = false;
  } else if (badge) {
    badge.hidden = true;
  }
}

function showBondLevelUpToast(level, customLine = null) {
  const toast = document.createElement('div');
  toast.className = 'reward-toast reward-toast--bond';
  const msg = customLine
    ? escapeHtml(customLine)
    : `你的夥伴提升到親密度 <strong>Lv.${level}</strong>！`;
  toast.innerHTML = `<span class="reward-toast__icon">💜</span><span>${msg}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ─── V2.6.0 寵物羈絆解放 ─── */

/** 各等級解鎖提示文字 */
const BOND_UNLOCK_MESSAGES = {
  2: '羈絆提升！解鎖親近台詞',
  3: '羈絆提升！解鎖羈絆徽章',
  4: '羈絆提升！解鎖首頁陪伴特效',
  5: '羈絆解放！解鎖羈絆外框與故事',
};

/** 下一個解鎖提示文字 */
const BOND_NEXT_UNLOCK = {
  1: '下一個解鎖：Lv.2 親近台詞',
  2: '下一個解鎖：Lv.3 羈絆徽章',
  3: '下一個解鎖：Lv.4 首頁陪伴特效',
  4: '下一個解鎖：Lv.5 羈絆外框與故事',
  5: '羈絆已完全解放',
};

/** 已解鎖項目顯示名稱 */
const BOND_UNLOCK_ITEM_LABELS = {
  dialogueLv2: '親近台詞',
  badgeLv3: '羈絆徽章',
  homeEffectLv4: '首頁陪伴特效',
  bondFrameLv5: '羈絆外框',
  bondStoryLv5: '羈絆故事',
};

/** 羈絆故事：通用開頭 + 依稀有度段落 */
const BOND_STORY_INTRO =
  '經過長時間的陪伴，牠已經不只是被召喚而來的夥伴，而是願意與你一起完成每一天目標的同行者。';

const BOND_STORY_BY_RARITY = {
  N: '牠在日常陪伴中慢慢信任你，成為最穩定的小夥伴。',
  R: '牠在日常陪伴中慢慢信任你，成為最穩定的小夥伴。',
  SR: '牠開始主動回應你的努力，像是在提醒你不要放棄。',
  SSR: '牠身上的力量因你們的羈絆而更加穩定，彷彿願意守護你的每個重要時刻。',
  UR: '傳說級靈獸真正認可了你。從此，牠不只是被召喚的存在，而是與你並肩前行的命運夥伴。',
};

function getBondStoryText(rarity) {
  return BOND_STORY_BY_RARITY[rarity] || BOND_STORY_BY_RARITY.N;
}

/** 取得羈絆徽章 HTML（Lv.3 以上顯示；Lv.5 顯示羈絆解放） */
function bondBadgeHtml(pet) {
  const bondLevel = pet?.bondLevel ?? 0;
  if (!pet?.owned || bondLevel < 3) return '';
  if (bondLevel >= 5) {
    return '<span class="bond-badge is-liberated" aria-label="羈絆解放">羈絆解放</span>';
  }
  return `<span class="bond-badge" aria-label="羈絆 Lv.${bondLevel}">羈絆 Lv.${bondLevel}</span>`;
}

/** 顯示羈絆解鎖提示（Lv.5 使用更醒目樣式，皆為輕量 toast，不干擾操作） */
function showBondUnlockToast(level) {
  const message = BOND_UNLOCK_MESSAGES[level];
  if (!message) return;
  const liberated = level >= 5;
  const toast = document.createElement('div');
  toast.className = `bond-unlock-toast${liberated ? ' bond-unlock-toast--liberated' : ''}`;
  toast.setAttribute('role', 'status');
  const icon = liberated ? '🌟' : '💠';
  toast.innerHTML = `<span class="bond-unlock-toast__icon" aria-hidden="true">${icon}</span><span class="bond-unlock-toast__text">${escapeHtml(message)}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 320);
  }, liberated ? 3800 : 3000);
}

/**
 * 檢查指定寵物是否有新的羈絆解鎖，並依序顯示提示。
 * notifiedLevels 由 updatePetBondUnlocks 維護，不會重複彈出。
 * @param {string} petId
 */
async function notifyBondUnlocks(petId) {
  if (!petId) return;
  try {
    const { newlyUnlockedLevels } = await updatePetBondUnlocks(petId);
    if (!newlyUnlockedLevels?.length) return;
    newlyUnlockedLevels.forEach((lv, i) => {
      setTimeout(() => showBondUnlockToast(lv), 700 + i * 800);
    });
  } catch (err) {
    console.warn('[QuestNote] 羈絆解鎖檢查失敗:', err);
  }
}

function showRewardToast(amount, energy = 0) {
  const toast = document.createElement('div');
  toast.className = 'reward-toast reward-toast--reward';
  let text = `<span class="reward-toast__icon">✨</span><span class="reward-toast__message">獲得 <strong class="toast-highlight">${amount}</strong> 星塵！</span>`;
  if (energy > 0) {
    text += `<span class="reward-toast__energy">＋<strong class="toast-highlight">${energy}</strong> 冒險能量</span>`;
  }
  toast.innerHTML = text;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, energy > 0 ? 3000 : 2500);
}

/* ─── 召喚頁 ─── */

function getSelectedGachaPool() {
  try {
    const pool = resolveActivePool(state?.poolsData, state?.gachaStats?.selectedPoolId);
    if (!pool) return null;
    return validatePoolContent({ pools: [pool] }, { pets: state?.allPets || [] }).ok ? pool : null;
  } catch {
    return null;
  }
}

function getAvailablePullsForSelectedPool() {
  const pool = getSelectedGachaPool();
  return pool ? Math.floor((state?.wallet?.stardust || 0) / resolveDrawCost(pool, 1)) : 0;
}

function renderGachaUnavailable() {
  for (const id of ['gacha-pool-content', 'gacha-theme-stage', 'gacha-awakening-panel', 'gacha-theme-details', 'gacha-theme-details-btn']) {
    const element = document.getElementById(id);
    if (element) element.hidden = true;
  }
  const panel = document.getElementById('gacha-panel');
  panel?.removeAttribute('data-pool-theme');
  panel?.removeAttribute('data-pool-phase');
  const name = document.getElementById('gacha-pool-name');
  if (name) { name.hidden = false; name.textContent = '目前沒有可用的召喚卡池'; }
  for (const id of ['gacha-cost', 'gacha-ten-cost', 'gacha-ssr-pity', 'gacha-ur-pity']) setText(id, '—');
  setText('gacha-stardust', state?.wallet?.stardust ?? 0);
  document.getElementById('gacha-rates')?.replaceChildren();
  for (const id of ['gacha-ssr-bar', 'gacha-ur-bar']) {
    const bar = document.getElementById(id);
    if (bar) bar.style.width = '0%';
  }
  for (const [id, label] of [['btn-pull', '召喚 1 次'], ['btn-pull-ten', '召喚 10 次']]) {
    const button = document.getElementById(id);
    if (button) { button.disabled = true; button.textContent = label; delete button.dataset.pulling; }
  }
  for (const id of ['gacha-hint-single', 'gacha-hint-ten']) {
    const hint = document.getElementById(id);
    if (hint) hint.hidden = true;
  }
  renderGachaPoolSwitcher();
}

function renderGachaPoolSwitcher() {
  const switcher = document.getElementById('gacha-pool-switcher');
  const select = document.getElementById('gacha-pool-select');
  if (!switcher || !select) return;

  const activePools = (Array.isArray(state?.poolsData?.pools) ? state.poolsData.pools : []).filter((pool) => pool?.active === true && typeof pool.id === 'string');
  if (activePools.length <= 1) {
    switcher.hidden = true;
    return;
  }

  const selectedId = getSelectedGachaPool()?.id;
  switcher.hidden = false;
  select.innerHTML = activePools
    .map((pool) => `<option value="${escapeHtml(pool.id)}" ${pool.id === selectedId ? 'selected' : ''}>${escapeHtml(pool.name)}</option>`)
    .join('');
}

function renderGachaView() {
  const pool = getSelectedGachaPool();
  if (!pool) { renderGachaUnavailable(); return; }

  const stats = ensurePoolPity(state.gachaStats || {}, pool.id);
  const pityCounters = getPoolPityCounters(stats, pool.id);
  const pity = pool.pity || { ssr: 30, ur: 100 };
  const stardust = state.wallet.stardust ?? 0;
  const singleCost = resolveDrawCost(pool, 1);

  renderGachaPoolSwitcher();
  renderGachaThemeStage(pool);
  setText('gacha-pool-name', pool.name);
  setText('gacha-stardust', stardust);
  setText('gacha-cost', singleCost);
  setText('gacha-ten-cost', resolveDrawCost(pool, 10));
  setText('gacha-ssr-pity', `${pityCounters.ssrPity}/${pity.ssr}`);
  setText('gacha-ur-pity', `${pityCounters.urPity}/${pity.ur}`);

  const ssrBar = document.getElementById('gacha-ssr-bar');
  const urBar = document.getElementById('gacha-ur-bar');
  if (ssrBar) ssrBar.style.width = `${Math.min(100, (pityCounters.ssrPity / pity.ssr) * 100)}%`;
  if (urBar) urBar.style.width = `${Math.min(100, (pityCounters.urPity / pity.ur) * 100)}%`;

  const ratesEl = document.getElementById('gacha-rates');
  if (ratesEl && pool.rates) {
    ratesEl.innerHTML = Object.entries(pool.rates)
      .map(
        ([r, rate]) =>
          `<span class="rate-tag rate-${r}" data-rarity="${r}"><span class="rate-tag__label">${RARITY_LABELS[r]}</span> <span class="rate-tag__value">${(rate * 100).toFixed(0)}%</span></span>`
      )
      .join('');
  }

  resetStaleGachaPullState();
  updateGachaAffordability();

  renderGachaDailyBlessingEntry();
}

/**
 * Debug：保證播放指定稀有度演出，且不影響任何正式抽卡資料。
 * 不呼叫 draw / gacha / addPetToCollection / addFragments / updateGachaStats / spendStardust。
 * @param {'SSR'|'UR'} rarity
 */
async function testSummonReveal(rarity) {
  if (!isAuthorLocalDevMode()) return;
  if (isSummonRevealPlaying()) return;
  const pet = pickDebugPetByRarity(rarity, state?.allPets);
  await playSummonReveal({
    rarity,
    pet,
    mode: 'debug',
    results: [],
    reduceMotion: state?.userPreferences?.reduceMotion ?? false,
  });
  showToast(`${rarity} 演出測試完成，未消耗星塵`, 'info');
}

/**
 * Debug：依寵物 ID 播放 SSR+ 出場（雙 UR 專屬動畫驗證）。
 * 不消耗星塵、不寫入收藏／保底。
 * @param {string} petId
 */
async function testSummonRevealByPetId(petId) {
  if (!isAuthorLocalDevMode()) return;
  if (isSummonRevealPlaying() || isThemedSummonPlaying()) return;
  const pet = (state?.allPets || []).find((p) => p?.id === petId) || null;
  if (!pet) {
    showToast(`找不到寵物 ${petId}`, 'warning');
    return;
  }
  const rarity = pet.rarity === 'SSR' || pet.rarity === 'UR' ? pet.rarity : 'UR';
  await playSummonReveal({
    rarity,
    pet,
    mode: 'debug',
    results: [],
    reduceMotion: state?.userPreferences?.reduceMotion ?? false,
  });
  showToast(`${pet.name || petId} 演出測試完成，未消耗星塵`, 'info');
}

/** 是否有真正進行中的抽卡（模組旗標或演出） */
function isGachaPullInProgress() {
  return gachaPullInProgress || isSummonRevealPlaying() || isThemedSummonPlaying() || isPoolAwakeningPlaying();
}

function getUnlockEntryForPool(poolId) {
  const byPool = state.poolUnlockState?.byPool || {};
  return byPool[poolId] || emptyPoolUnlockEntry(poolId);
}

/**
 * 抽卡結果確認後：若剛解鎖或尚有未播放解鎖動畫，播放晨醒花庭演出。
 */
async function maybePlayMorningGardenAfterPull(pool, unlockProgress) {
  const expansion = normalizeUnlockExpansion(pool);
  if (!expansion) return;
  let entry = unlockProgress?.entry || getUnlockEntryForPool(pool.id);
  if (!entry?.unlocked) { clearPendingAwakening(); return; }
  try {
    const reward = await ensureUnlockRewardClaimed(pool.id, expansion, state.allPets);
    if (!reward?.ok) throw new Error(reward?.error || '無法確認解鎖獎勵');
    entry = reward.entry || await getPoolUnlockEntry(pool.id);
    state.poolUnlockState = { ...(state.poolUnlockState || {}), byPool: { ...(state.poolUnlockState?.byPool || {}), [pool.id]: entry } };
    if (!entry.unlocked || !entry.rewardClaimed || entry.animationSeen) return;
    await waitNextFrame();
    const model = resolvePoolPresentationModel(pool, state.allPets, entry);
    const outcome = await playPoolUnlock({ model, reduceMotion: state.userPreferences?.reduceMotion ?? false });
    if (outcome?.seen) {
      const latest = await markUnlockAnimationSeen(pool.id);
      state.poolUnlockState = { ...(state.poolUnlockState || {}), byPool: { ...(state.poolUnlockState?.byPool || {}), [pool.id]: latest } };
    }
  } catch (err) {
    console.warn('[PoolAwakening] 解鎖狀態尚未完成，可重新進入卡池重試', err);
    showToast('解鎖獎勵確認失敗，稍後可重新進入卡池重試', 'warning');
  } finally {
    clearPendingAwakening();
  }
}

/** Resume is independent of theme and debut state. */
async function maybeResumeMorningGarden(poolId) {
  if (isGachaPullInProgress()) return;
  const pool = getSelectedGachaPool();
  if (!pool || pool.id !== poolId || !normalizeUnlockExpansion(pool)) return;
  try {
    await ensurePoolUnlockLegacyBackfillMarked();
    const entry = await getPoolUnlockEntry(poolId);
    state.poolUnlockState = { ...(state.poolUnlockState || {}), byPool: { ...(state.poolUnlockState?.byPool || {}), [poolId]: entry } };
    if (entry.unlocked && (!entry.rewardClaimed || !entry.animationSeen)) {
      markPendingAwakening(poolId, { entry });
      await maybePlayMorningGardenAfterPull(pool, { entry });
      renderGachaView();
    }
  } catch (err) {
    console.warn('[PoolAwakening] resume 略過', err);
  }
}

/**
 * 主題卡池首次／短轉場登場演出（純 UI，不抽卡）
 * @param {string} poolId
 */
async function maybePlayPoolDebut(poolId) {
  const pool = getSelectedGachaPool();
  if (!pool || pool.id !== poolId || isGachaPullInProgress() || maybePlayPoolDebut._inflight) return;
  const presentation = normalizePoolPresentation(pool);
  maybePlayPoolDebut._inflight = true;
  try {
    if (shouldUseThemedSummon(pool)) {
      const seen = await hasSeenPoolDebut(poolId);
      if (!seen || maybePlayPoolDebut._fromSwitcher) {
        await playPoolDebutPresentation({
          poolName: pool.name, presentation,
          full: !seen, reduceMotion: state.userPreferences?.reduceMotion ?? false,
        });
        if (!seen) await markPoolDebutSeen(poolId);
      }
    }
  } catch (err) {
    console.warn('[PoolDebut] 登場演出略過', err);
  } finally {
    maybePlayPoolDebut._inflight = false;
    maybePlayPoolDebut._fromSwitcher = false;
  }
  await maybeResumeMorningGarden(poolId);
}

/**
 * 渲染主題卡池主畫面（無 presentation 時隱藏）
 * @param {object} pool
 */
function renderGachaThemeStage(pool) {
  const panel = document.getElementById('gacha-panel');
  const stage = document.getElementById('gacha-theme-stage');
  const poolNameEl = document.getElementById('gacha-pool-name');
  const unlockEntry = getUnlockEntryForPool(pool?.id);
  const model = resolvePoolPresentationModel(pool, state.allPets, unlockEntry, { visualLocked: !shouldShowAwakenedPresentation(unlockEntry) });
  const presentation = model.presentation;
  const themeAttr = model.cssTheme;
  const expansion = model.unlock?.expansion;
  // 畫面 phase 與資料 unlocked 分離：結果／動畫完成前維持永眠期
  const awakened = model.awakened;

  if (panel) {
    if (themeAttr) panel.dataset.poolTheme = themeAttr;
    else panel.removeAttribute('data-pool-theme');
    if (awakened) panel.dataset.poolPhase = 'awakened';
    else if (themeAttr) panel.dataset.poolPhase = 'slumber';
    else panel.removeAttribute('data-pool-phase');
  }

  if (!stage) return;

  const content = document.getElementById('gacha-pool-content');
  if (content) content.hidden = !presentation && !expansion;
  stage.hidden = !presentation;
  stage.classList.toggle('is-awakened', awakened);
  if (poolNameEl) poolNameEl.hidden = false;

  const setElText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text || '';
  };

  setElText('gacha-theme-badge', presentation?.badge);
  setElText('gacha-theme-name', pool.name || '');
  if (awakened) {
    setElText('gacha-theme-eyebrow', `${expansion.title}已解鎖`);
    setElText('gacha-theme-tagline', expansion?.unlockMessage);
  } else {
    setElText('gacha-theme-eyebrow', presentation?.eyebrow);
    setElText('gacha-theme-tagline', presentation?.tagline);
  }

  const { hero } = model;
  const dawnHero = model.heroes.find((pet) => pet.id !== hero?.id) || null;
  const heroImg = document.getElementById('gacha-theme-hero-img');
  const heroFigure = document.getElementById('gacha-theme-hero');
  if (heroFigure) heroFigure.hidden = !hero;
  if (!hero && heroImg) {
    heroImg.classList.add('is-loading');
    heroImg.removeAttribute('src');
    delete heroImg.dataset.src;
  }
  const dualHost = document.getElementById('gacha-theme-dual-hero');
  if (awakened && dualHost && hero && dawnHero) {
    dualHost.hidden = false;
    dualHost.replaceChildren();
    for (const pet of [hero, dawnHero]) {
      const fig = document.createElement('figure');
      fig.className = 'gacha-theme-dual__item';
      const img = document.createElement('img');
      img.alt = pet.title || pet.name || '';
      img.decoding = 'async';
      const src = getPetImageSrc(pet, 'stage');
      if (src) {
        img.onerror = () => {
          img.onerror = null;
          const original = getPetImageSrc(pet);
          if (original && original !== src) img.src = original;
        };
        img.src = src;
        preloadImage(src, { eager: true }).catch(() => {});
      }
      const cap = document.createElement('figcaption');
      cap.textContent = pet.title || pet.name || '';
      fig.append(img, cap);
      dualHost.appendChild(fig);
    }
    if (heroImg) heroImg.closest('.gacha-theme-hero')?.classList.add('is-dimmed');
  } else if (dualHost) {
    dualHost.hidden = true;
    dualHost.replaceChildren();
    if (heroImg) heroImg.closest('.gacha-theme-hero')?.classList.remove('is-dimmed');
  }

  if (hero && heroImg) {
    const src = getPetImageSrc(hero, 'stage');
    if (src && heroImg.dataset.src !== src) {
      // The same element serves every pool. Hide its previous decoded bitmap
      // before updating the copy, then reveal only the current request.
      heroImg.classList.add('is-loading');
      heroImg.dataset.src = src;
      heroImg.onload = () => {
        if (heroImg.dataset.src === src) heroImg.classList.remove('is-loading');
      };
      heroImg.onerror = () => {
        if (heroImg.dataset.src !== src) return;
        heroImg.onerror = null;
        const original = getPetImageSrc(hero);
        if (original && original !== src) heroImg.src = original;
        else heroImg.classList.add('is-loading');
      };
      heroImg.src = src;
      preloadImage(src, { eager: true }).catch(() => {});
    } else if (!src) {
      heroImg.classList.add('is-loading');
      heroImg.removeAttribute('src');
      delete heroImg.dataset.src;
    }
    heroImg.classList.add('is-silhouette');
    heroImg.alt = hero.title || hero.rarity || '限定大獎';
  }
  setElText('gacha-theme-hero-rarity', hero?.rarity || 'UR');
  setElText('gacha-theme-hero-name', hero?.title || '');
  setElText('gacha-theme-hero-title', '');
  const heroTitleEl = document.getElementById('gacha-theme-hero-title');
  if (heroTitleEl) heroTitleEl.hidden = true;

  const featuredHost = document.getElementById('gacha-theme-featured');
  if (featuredHost) {
    featuredHost.replaceChildren();
    const featureList = model.featured;
    featureList.forEach((pet) => {
      const item = document.createElement('div');
      item.className = 'gacha-theme-featured__item';
      const img = document.createElement('img');
      img.className = 'gacha-theme-featured__img is-silhouette';
      img.alt = pet.title || pet.rarity || '焦點夥伴';
      img.decoding = 'async';
      const src = getPetImageSrc(pet, 'card');
      if (src) {
        img.onerror = () => {
          img.onerror = null;
          const original = getPetImageSrc(pet);
          if (original && original !== src) img.src = original;
        };
        img.src = src;
        preloadImage(src, { eager: true }).catch(() => {});
      }
      const meta = document.createElement('div');
      const rarity = document.createElement('span');
      rarity.className = 'gacha-theme-featured__rarity';
      rarity.textContent = pet.rarity || 'SSR';
      const title = document.createElement('span');
      title.className = 'gacha-theme-featured__name';
      title.textContent = pet.title || pet.name || '';
      meta.append(rarity, title);
      item.append(img, meta);
      featuredHost.appendChild(item);
    });
  }

  const eligible = model.eligiblePets;
  setElText(
    'gacha-theme-meta',
    awakened
      ? `候選角色 ${eligible.length} 隻 · ${expansion.title}已解鎖`
      : `候選角色 ${eligible.length} 隻${presentation?.candidateNote ? ' · ' + presentation.candidateNote : ''}`,
  );

  // 晨醒花庭進度／鎖定預覽
  const awakening = document.getElementById('gacha-awakening-panel');
  if (awakening && expansion) {
    awakening.hidden = false;
    const threshold = expansion.threshold;
    const draws = unlockEntry.lifetimeDraws || 0;
    const pct = Math.min(100, Math.round((draws / threshold) * 100));
    setElText('gacha-awakening-title', expansion.title);
    if (awakened) {
      setElText('gacha-awakening-progress', model.unlock.progressText);
      setElText('gacha-awakening-desc', expansion.unlockMessage);
      setElText('gacha-awakening-counts', `候選角色：${eligible.length}`);
    } else {
      setElText('gacha-awakening-progress', model.unlock.progressText);
      setElText(
        'gacha-awakening-desc',
        model.unlock.description,
      );
      setElText('gacha-awakening-counts', model.unlock.countsText);
    }
    const fill = document.getElementById('gacha-awakening-fill');
    if (fill) {
      fill.style.width = `${awakened ? 100 : pct}%`;
      fill.classList.toggle('is-complete', awakened);
    }
    const preview = document.getElementById('gacha-awakening-preview');
    if (preview) {
      preview.replaceChildren();
      preview.setAttribute('aria-label', `${expansion.presentation.candidateLabel}預覽`);
      for (const pet of model.unlock.previewPets) {
        const meta = pet;
        const item = document.createElement('div');
        item.className = 'gacha-awakening-preview__item' + (awakened ? ' is-unlocked' : ' is-locked');
        const img = document.createElement('img');
        img.alt = `${meta.rarity} ${meta.name}`;
        img.decoding = 'async';
        if (pet) {
          const src = getPetImageSrc(pet);
          if (src) img.src = src;
        }
        const label = document.createElement('span');
        label.textContent = `${meta.rarity} ${meta.name}`;
        item.append(img, label);
        preview.appendChild(item);
      }
    }
    const rateNote = document.getElementById('gacha-awakening-rate-note');
    if (rateNote) {
      rateNote.textContent = awakened
        ? '解鎖後各稀有度總機率不變。新增角色會與同稀有度角色依現行規則共同分配該稀有度機率。'
        : `解鎖後各稀有度總機率不變。新增角色會與同稀有度角色依現行規則共同分配該稀有度機率。固定贈送${model.unlock.rewardPet.name}不算抽卡、不推進保底。`;
    }
  } else if (awakening) {
    awakening.hidden = true;
  }

  const details = document.getElementById('gacha-theme-details');
  const detailsBtn = document.getElementById('gacha-theme-details-btn');
  if (details) {
    details.hidden = true;
    const pity = pool.pity || { ssr: 30, ur: 100 };
    const stats = ensurePoolPity(state.gachaStats || {}, pool.id);
    const counters = getPoolPityCounters(stats, pool.id);
    const rates = pool.rates || {};
    const rateText = ['N', 'R', 'SR', 'SSR', 'UR']
      .map((r) => `${r} ${((rates[r] || 0) * 100).toFixed(0)}%`)
      .join(' · ');

    details.replaceChildren();
    const dl = document.createElement('dl');
    const rows = [
      ['單抽成本', `${model.costs.single} 星塵`],
      ['十連成本', `${model.costs.ten} 星塵`],
      ['稀有度機率', rateText],
      ['SSR 保底', `${pity.ssr} 抽`],
      ['UR 保底', `${pity.ur} 抽`],
      ['目前 SSR 保底進度', `${counters.ssrPity}/${pity.ssr}`],
      ['目前 UR 保底進度', `${counters.urPity}/${pity.ur}`],
      ['候選角色', `${eligible.length} 隻`],
      ['池別說明', (awakened ? expansion.presentation.detailsNote : presentation?.detailsNote) || '依卡池設定篩選候選角色'],
      ['重複補償', '沿用現行碎片規則'],
      ['解鎖後機率', '各稀有度總機率不變；同稀有度依現行規則共同分配'],
    ];
    rows.forEach(([dtText, ddText]) => {
      const dt = document.createElement('dt');
      dt.textContent = dtText;
      const dd = document.createElement('dd');
      dd.textContent = ddText;
      dl.append(dt, dd);
    });
    details.appendChild(dl);
  }
  if (detailsBtn) {
    detailsBtn.hidden = !presentation;
    detailsBtn.setAttribute('aria-expanded', 'false');
    detailsBtn.textContent = '卡池詳情';
  }
}

/**
 * 抽卡後播放展示層（主題動畫或 SSR+ reveal queue）；失敗則 fallback。
 * 不得重抽或再次扣款。
 * @returns {Promise<'themed'|'legacy'|'none'>} 實際走的展示路徑
 */
async function playPostPullPresentation({ pool, mode, results, singleResult }) {
  const reduceMotion = state.userPreferences?.reduceMotion ?? false;
  const list = Array.isArray(results) ? results : singleResult ? [singleResult] : [];

  if (shouldUseThemedSummon(pool)) {
    try {
      const outcome = await playThemedSummon({
        animationKey: normalizePoolPresentation(pool).animationKey,
        poolName: pool.name,
        results: list,
        mode,
        reduceMotion,
      });
      if (outcome?.ok && !outcome.fallback) {
        return 'themed';
      }
      // 主題動畫失敗：退回 SSR+ queue（若有）再進結果 modal
      try {
        await playSsrPlusRevealQueue({ results: list, reduceMotion });
      } catch (revealErr) {
        console.warn('[ThemedSummon] SSR+ reveal fallback skipped', revealErr);
      }
      return 'legacy';
    } catch (err) {
      console.warn('[ThemedSummon] fallback to legacy reveal/modal', err);
    }
  }

  // standard 池：有 SSR+ 則依原始順序自動播完整 queue
  try {
    const queueOutcome = await playSsrPlusRevealQueue({
      results: list,
      reduceMotion,
    });
    if (queueOutcome?.played > 0) return 'legacy';
  } catch (err) {
    console.warn('[SummonReveal] queue fallback，改播最高稀有單張', err);
    const highestRarity = singleResult?.rarity ?? getHighestRarity(list);
    if (shouldPlayReveal(highestRarity)) {
      const revealPet = singleResult?.pet ?? getRevealPetFromResults(list, highestRarity);
      await playSummonReveal({
        rarity: highestRarity,
        pet: revealPet,
        mode,
        results: list,
        reduceMotion,
      });
      return 'legacy';
    }
  }
  return 'none';
}

/**
 * 進入召喚頁／render 時清除殘留 pulling 鎖定。
 * 不可在真正抽卡進行中強制解除。
 */
function resetStaleGachaPullState() {
  if (isGachaPullInProgress()) return;
  const btnSingle = document.getElementById('btn-pull');
  const btnTen = document.getElementById('btn-pull-ten');
  if (btnSingle?.dataset.pulling === '1') {
    delete btnSingle.dataset.pulling;
  }
  if (btnTen?.dataset.pulling === '1') {
    delete btnTen.dataset.pulling;
  }
}

/**
 * 依最新 state.wallet 更新召喚按鈕狀態與星塵顯示（不重建召喚頁）。
 * 找不到召喚按鈕（不在召喚頁 / DOM 未就緒）時安全 return。
 */
export function updateGachaAffordability() {
  if (!state?.wallet) return;

  const btnSingle = document.getElementById('btn-pull');
  const btnTen = document.getElementById('btn-pull-ten');
  if (!btnSingle && !btnTen) return;

  resetStaleGachaPullState();

  const pool = getSelectedGachaPool();
  if (!pool) { renderGachaUnavailable(); return; }
  const singleCost = resolveDrawCost(pool, 1);
  const tenCost = resolveDrawCost(pool, 10);
  const stardust = state.wallet.stardust ?? 0;
  const canSingle = stardust >= singleCost;
  const canTen = stardust >= tenCost;

  setText('gacha-stardust', stardust);

  const hintSingle = document.getElementById('gacha-hint-single');
  const hintTen = document.getElementById('gacha-hint-ten');

  // 抽卡進行中時（按鈕標記 pulling）不覆蓋「召喚中…」狀態
  const pulling = isGachaPullInProgress();
  if (btnSingle && btnSingle.dataset.pulling !== '1') {
    btnSingle.disabled = pulling || !canSingle;
    btnSingle.textContent = '召喚 1 次';
  }
  if (btnTen && btnTen.dataset.pulling !== '1') {
    btnTen.disabled = pulling || !canTen;
    btnTen.textContent = '召喚 10 次';
  }

  const poolSelect = document.getElementById('gacha-pool-select');
  if (poolSelect && poolSelect.dataset.pulling !== '1') {
    poolSelect.disabled = pulling;
  }

  if (hintSingle) {
    if (!canSingle) {
      hintSingle.textContent = '星塵不足，完成任務可以獲得星塵。';
      hintSingle.hidden = false;
    } else {
      hintSingle.hidden = true;
    }
  }

  if (hintTen) {
    if (!canTen) {
      hintTen.textContent = `10 連抽需要 ${tenCost} 星塵。`;
      hintTen.hidden = false;
    } else {
      hintTen.hidden = true;
    }
  }
}

async function handlePull() {
  const pool = getSelectedGachaPool();
  if (!pool) { renderGachaUnavailable(); return; }
  const cost = resolveDrawCost(pool, 1);

  if ((state.wallet.stardust ?? 0) < cost) {
    showToast('星塵不足，完成任務可以獲得星塵', 'warning');
    updateGachaAffordability();
    return;
  }

  if (isGachaPullInProgress()) return;

  const btn = document.getElementById('btn-pull');
  const poolSelect = document.getElementById('gacha-pool-select');
  gachaPullInProgress = true;
  beginPullVisualLock(pool?.id);
  if (btn) {
    btn.dataset.pulling = '1';
    btn.disabled = true;
    btn.textContent = '召喚中…';
  }
  if (poolSelect) poolSelect.disabled = true;

  try {
    const result = await pullOnce(state.allPets, state.poolsData, pool?.id);
    if (result.unlockProgress?.entry) {
      state.poolUnlockState = {
        ...(state.poolUnlockState || { key: 'poolUnlockState', schemaVersion: 1, byPool: {} }),
        byPool: {
          ...(state.poolUnlockState?.byPool || {}),
          [pool.id]: result.unlockProgress.entry,
        },
      };
      markPendingAwakening(pool.id, result.unlockProgress);
    }

    const preloadPromise = preloadGachaResultImages(result);
    collectionRenderGate.markDirty();
    await Promise.all([
      onRefresh({ renderMode: ['gacha'] }),
      waitForPreloadWithTimeout(preloadPromise, 600),
    ]);

    const presentationPath = await playPostPullPresentation({
      pool,
      mode: 'single',
      singleResult: result,
      results: [result],
    });

    const pending = gachaSessionUi.pendingAwakening;
    if (presentationPath !== 'themed') {
      await showPullResultAndWait(result, { pendingAwakening: pending });
    }

    if (pending) {
      await maybePlayMorningGardenAfterPull(pool, result.unlockProgress);
    } else {
      clearPendingAwakening();
    }

    showToast('召喚成功！', 'success', 2000);
    await handleAchievementCheckAfterAction();
    void recordOnboardingEvent('summon-completed');
  } catch (err) {
    clearPendingAwakening();
    showToast(err.message || '召喚失敗', 'error');
  } finally {
    gachaPullInProgress = false;
    const btn = document.getElementById('btn-pull');
    if (btn) delete btn.dataset.pulling;
    if (poolSelect) poolSelect.disabled = false;
    renderGachaView();
    btn?.focus?.();
  }
}

async function handleTenPull() {
  const pool = getSelectedGachaPool();
  if (!pool) { renderGachaUnavailable(); return; }
  const tenCost = resolveDrawCost(pool, 10);
  if ((state.wallet.stardust ?? 0) < tenCost) {
    showToast(`10 連抽需要 ${tenCost} 星塵`, 'warning');
    updateGachaAffordability();
    return;
  }

  if (isGachaPullInProgress()) return;

  const btn = document.getElementById('btn-pull-ten');
  const poolSelect = document.getElementById('gacha-pool-select');
  gachaPullInProgress = true;
  beginPullVisualLock(pool?.id);
  if (btn) {
    btn.dataset.pulling = '1';
    btn.disabled = true;
    btn.textContent = '召喚中…';
  }
  if (poolSelect) poolSelect.disabled = true;

  try {
    const result = await performTenPull(state.allPets, state.poolsData, pool?.id);
    if (!result.success) {
      clearPendingAwakening();
      showToast(result.error || '10 連抽失敗', 'warning');
      return;
    }

    if (result.unlockProgress?.entry) {
      state.poolUnlockState = {
        ...(state.poolUnlockState || { key: 'poolUnlockState', schemaVersion: 1, byPool: {} }),
        byPool: {
          ...(state.poolUnlockState?.byPool || {}),
          [pool.id]: result.unlockProgress.entry,
        },
      };
      markPendingAwakening(pool.id, result.unlockProgress);
    }

    const preloadPromise = preloadGachaResultImages(result.results);
    collectionRenderGate.markDirty();
    await Promise.all([
      onRefresh({ renderMode: ['gacha'] }),
      waitForPreloadWithTimeout(preloadPromise, 600),
    ]);

    const presentationPath = await playPostPullPresentation({
      pool,
      mode: 'ten',
      results: result.results,
    });

    const pending = gachaSessionUi.pendingAwakening;
    if (presentationPath !== 'themed') {
      await showTenPullResultAndWait(result, { pendingAwakening: pending });
    }

    if (pending) {
      await maybePlayMorningGardenAfterPull(pool, result.unlockProgress);
    } else {
      clearPendingAwakening();
    }

    showToast('10 連抽完成！', 'success', 2000);
    await handleAchievementCheckAfterAction();
    void recordOnboardingEvent('summon-completed');
  } catch (err) {
    clearPendingAwakening();
    showToast(err.message || '10 連抽失敗', 'error');
  } finally {
    gachaPullInProgress = false;
    const btn = document.getElementById('btn-pull-ten');
    if (btn) delete btn.dataset.pulling;
    if (poolSelect) poolSelect.disabled = false;
    renderGachaView();
    btn?.focus?.();
  }
}

function isSweetTheme() {
  return normalizeTheme(state?.userPreferences?.theme) === 'sweet';
}

function getGachaAffordability() {
  const pool = getSelectedGachaPool();
  const stardust = state?.wallet?.stardust ?? 0;
  const singleCost = pool ? resolveDrawCost(pool, 1) : null;
  const tenCost = pool ? resolveDrawCost(pool, 10) : null;
  return { pool, singleCost, tenCost, stardust, canSingle: !!pool && stardust >= singleCost, canTen: !!pool && stardust >= tenCost };
}

function sweetSummonRarityBadge(rarity, extraClass = '') {
  return `<span class="sweet-summon-badge sweet-summon-badge--rarity ${extraClass}" data-rarity="${rarity}">${rarity}</span>`;
}

function sweetSummonStatusBadge(isNew, amount) {
  if (isNew) {
    return '<span class="sweet-summon-badge sweet-summon-badge--new">NEW</span>';
  }
  return `<span class="sweet-summon-badge sweet-summon-badge--fragment">碎片 +${amount}</span>`;
}

function sweetSummonRarityDesc(rarity) {
  const labels = { N: '普通夥伴', R: '稀有夥伴', SR: '超稀有夥伴', SSR: '極稀有夥伴', UR: '傳說夥伴' };
  return labels[rarity] || rarity;
}

function upgradeSingleResultImage(pet) {
  const image = document.querySelector('.summon-result-single__frame .pet-img');
  const stageSrc = getPetImageSrc(pet, 'stage');
  const cardSrc = getPetImageSrc(pet, 'card');
  if (!image || !stageSrc || stageSrc === cardSrc) return;
  void preloadImage(stageSrc, { eager: true }).then(({ ok }) => {
    if (ok && image.isConnected && document.querySelector('.summon-result-single__frame .pet-img') === image) {
      image.src = stageSrc;
    }
  });
}

function renderSweetSinglePullResult(result, options = {}) {
  const { pet, isNew, fragmentsGained, rarity, triggeredPity } = result;
  const pendingAwakening = !!options.pendingAwakening;
  const title = pet.title ? escapeHtml(pet.title) : '';
  const statusLabel = isNew ? '初次相遇' : '再次相遇';

  openModal(`
    <div class="sweet-summon-result sweet-summon-result--single summon-result-single" data-rarity="${rarity}" data-pending-awakening="${pendingAwakening ? '1' : '0'}">
      <header class="sweet-summon-result__header summon-result-single__header">
        <p class="sweet-summon-result__eyebrow">召喚結果</p>
        ${sweetSummonRarityBadge(rarity)}
        ${triggeredPity ? '<p class="sweet-summon-result__pity">保底觸發</p>' : ''}
      </header>

      <div class="sweet-summon-result__scroll summon-result-single__body">
        <section class="sweet-summon-showcase summon-result-single__showcase" data-rarity="${rarity}" aria-label="召喚寵物展示">
          <div class="sweet-summon-showcase__frame summon-result-single__frame">
            ${petImageHtml(pet, { size: 'lg', loading: 'eager', eager: true, imageVariant: 'card' })}
          </div>
          <p class="summon-result-single__status">${statusLabel}</p>
          <h3 class="sweet-summon-showcase__name summon-result-single__name">${escapeHtml(pet.name)}</h3>
          ${title ? `<p class="summon-result-single__title">${title}</p>` : ''}
          <div class="sweet-summon-showcase__badges summon-result-single__badges">
            ${isNew
              ? '<span class="sweet-summon-badge sweet-summon-badge--status sweet-summon-badge--status-new">NEW</span>'
              : `<span class="sweet-summon-badge sweet-summon-badge--status sweet-summon-badge--status-dup">碎片 +${fragmentsGained}</span>`}
          </div>
          ${pet.summonLine ? `<p class="sweet-summon-showcase__line">「${escapeHtml(pet.summonLine)}」</p>` : ''}
        </section>
      </div>

      ${pendingAwakening
        ? `<footer class="sweet-summon-result__actions sweet-summon-result__actions--continue">
            <button type="button" class="sweet-summon-btn sweet-summon-btn--primary" id="pull-close" data-action="result-continue">繼續</button>
          </footer>`
        : `<footer class="sweet-summon-result__actions">
            <button type="button" class="sweet-summon-btn sweet-summon-btn--ghost" id="pull-close">關閉</button>
          </footer>`}
    </div>
  `);

  upgradeSingleResultImage(pet);
  bindGachaResultButtons('pull-close');
}

function renderSweetTenPullResult(result) {
  const { results, summary } = result;

  const cardsHtml = results
    .map(
      (r, i) => `
      <article class="sweet-summon-grid-card" data-rarity="${r.rarity}" style="animation-delay:${i * 0.05}s">
        <div class="sweet-summon-grid-card__media">${petImageHtml(r.pet, { size: 'sm', loading: 'eager', eager: true })}</div>
        <div class="sweet-summon-grid-card__body">
          ${sweetSummonRarityBadge(r.rarity)}
          <p class="sweet-summon-grid-card__name">${escapeHtml(r.pet.name)}</p>
          <div class="sweet-summon-grid-card__footer">
            ${sweetSummonStatusBadge(r.isNew, r.duplicateFragments)}
            ${r.triggeredPity ? '<span class="sweet-summon-badge sweet-summon-badge--pity">保底</span>' : ''}
          </div>
        </div>
      </article>`
    )
    .join('');

  openModal(`
    <div class="sweet-summon-result sweet-summon-result--ten" data-highest-rarity="${summary.highestRarity}">
      <header class="sweet-summon-result__header">
        <div class="sweet-summon-result__header-row">
          <p class="sweet-summon-result__eyebrow">十連召喚結果</p>
          ${sweetSummonRarityBadge(summary.highestRarity, 'sweet-summon-badge--highest')}
        </div>
        <h2 class="sweet-summon-result__title">今天的召喚成果</h2>
      </header>

      <div class="sweet-summon-result__scroll">
        <section class="sweet-summon-summary" aria-label="十連召喚摘要">
          <div class="sweet-summon-summary__item sweet-summon-summary__item--new">
            <span class="sweet-summon-summary__label">新夥伴</span>
            <span class="sweet-summon-summary__value">${summary.newCount}</span>
          </div>
          <div class="sweet-summon-summary__item sweet-summon-summary__item--dup">
            <span class="sweet-summon-summary__label">重複</span>
            <span class="sweet-summon-summary__value">${summary.duplicateCount}</span>
          </div>
          <div class="sweet-summon-summary__item sweet-summon-summary__item--frag">
            <span class="sweet-summon-summary__label">碎片</span>
            <span class="sweet-summon-summary__value">+${summary.totalFragments}</span>
          </div>
          <div class="sweet-summon-summary__item sweet-summon-summary__item--highest">
            <span class="sweet-summon-summary__label">最高稀有</span>
            <span class="sweet-summon-summary__value">${summary.highestRarity}</span>
          </div>
        </section>

        <div class="sweet-summon-grid" role="list" aria-label="十連召喚卡片">${cardsHtml}</div>
      </div>

      <footer class="sweet-summon-result__actions">
        <button type="button" class="sweet-summon-btn sweet-summon-btn--ghost" id="ten-pull-close">關閉</button>
      </footer>
    </div>
  `);

  bindGachaResultButtons('ten-pull-close');
}

function defaultSummonRarityBadge(rarity, extraClass = '') {
  return `<span class="default-summon-badge default-summon-badge--rarity ${extraClass}" data-rarity="${rarity}">${rarity}</span>`;
}

function defaultSummonStatusBadge(isNew, amount) {
  if (isNew) {
    return '<span class="default-summon-badge default-summon-badge--new">NEW</span>';
  }
  return `<span class="default-summon-badge default-summon-badge--fragment">碎片 +${amount}</span>`;
}

function defaultSummonRarityDesc(rarity) {
  const labels = { N: '普通夥伴', R: '稀有夥伴', SR: '超稀有夥伴', SSR: '極稀有夥伴', UR: '傳說夥伴' };
  return labels[rarity] || rarity;
}

function defaultSummonRarityHint(rarity) {
  if (rarity === 'UR') return '<p class="default-summon-showcase__hint default-summon-showcase__hint--ur">傳說夥伴</p>';
  if (rarity === 'SSR') return '<p class="default-summon-showcase__hint default-summon-showcase__hint--ssr">稀有夥伴</p>';
  return '';
}

function renderDefaultSinglePullResult(result, options = {}) {
  const { pet, isNew, fragmentsGained, rarity, triggeredPity } = result;
  const pendingAwakening = !!options.pendingAwakening;
  const title = pet.title ? escapeHtml(pet.title) : '';
  const statusLabel = isNew ? '初次相遇' : '再次相遇';

  openModal(`
    <div class="default-summon-result default-summon-result--single summon-result-single" data-rarity="${rarity}" data-pending-awakening="${pendingAwakening ? '1' : '0'}">
      <header class="default-summon-result__header summon-result-single__header">
        <p class="default-summon-result__eyebrow">召喚結果</p>
        ${defaultSummonRarityBadge(rarity)}
        ${triggeredPity ? '<p class="default-summon-result__pity">保底觸發</p>' : ''}
      </header>

      <div class="default-summon-result__scroll summon-result-single__body">
        <section class="default-summon-showcase summon-result-single__showcase" data-rarity="${rarity}" aria-label="召喚祭壇展示">
          <div class="default-summon-showcase__altar" aria-hidden="true"></div>
          ${defaultSummonRarityHint(rarity)}
          <div class="default-summon-showcase__frame summon-result-single__frame">
            ${petImageHtml(pet, { size: 'lg', loading: 'eager', eager: true, imageVariant: 'card' })}
          </div>
          <p class="summon-result-single__status">${statusLabel}</p>
          <h3 class="default-summon-showcase__name summon-result-single__name">${escapeHtml(pet.name)}</h3>
          ${title ? `<p class="summon-result-single__title">${title}</p>` : ''}
          <div class="default-summon-showcase__badges summon-result-single__badges">
            ${isNew
              ? '<span class="default-summon-badge default-summon-badge--status default-summon-badge--status-new">NEW</span>'
              : `<span class="default-summon-badge default-summon-badge--status default-summon-badge--status-dup">碎片 +${fragmentsGained}</span>`}
          </div>
          ${pet.summonLine ? `<p class="default-summon-showcase__line">「${escapeHtml(pet.summonLine)}」</p>` : ''}
        </section>
      </div>

      ${pendingAwakening
        ? `<footer class="default-summon-result__actions default-summon-result__actions--continue">
            <button type="button" class="default-summon-btn default-summon-btn--primary" id="pull-close" data-action="result-continue">繼續</button>
          </footer>`
        : `<footer class="default-summon-result__actions">
            <button type="button" class="default-summon-btn default-summon-btn--ghost" id="pull-close">關閉</button>
          </footer>`}
    </div>
  `);

  upgradeSingleResultImage(pet);
  bindGachaResultButtons('pull-close');
}

function renderDefaultTenPullResult(result) {
  const { results, summary } = result;

  const cardsHtml = results
    .map(
      (r, i) => `
      <article class="default-summon-grid-card" data-rarity="${r.rarity}" style="animation-delay:${i * 0.05}s">
        <div class="default-summon-grid-card__media">${petImageHtml(r.pet, { size: 'sm', loading: 'eager', eager: true })}</div>
        <div class="default-summon-grid-card__body">
          ${defaultSummonRarityBadge(r.rarity)}
          <p class="default-summon-grid-card__name">${escapeHtml(r.pet.name)}</p>
          <div class="default-summon-grid-card__footer">
            ${defaultSummonStatusBadge(r.isNew, r.duplicateFragments)}
            ${r.triggeredPity ? '<span class="default-summon-badge default-summon-badge--pity">保底</span>' : ''}
          </div>
        </div>
      </article>`
    )
    .join('');

  openModal(`
    <div class="default-summon-result default-summon-result--ten" data-highest-rarity="${summary.highestRarity}">
      <header class="default-summon-result__header">
        <div class="default-summon-result__header-row">
          <p class="default-summon-result__eyebrow">十連召喚結果</p>
          ${defaultSummonRarityBadge(summary.highestRarity, 'default-summon-badge--highest')}
        </div>
        <h2 class="default-summon-result__title">召喚儀式完成</h2>
      </header>

      <div class="default-summon-result__scroll">
        <section class="default-summon-summary" aria-label="十連召喚摘要">
          <div class="default-summon-summary__item default-summon-summary__item--new">
            <span class="default-summon-summary__label">新夥伴</span>
            <span class="default-summon-summary__value">${summary.newCount}</span>
          </div>
          <div class="default-summon-summary__item default-summon-summary__item--dup">
            <span class="default-summon-summary__label">重複</span>
            <span class="default-summon-summary__value">${summary.duplicateCount}</span>
          </div>
          <div class="default-summon-summary__item default-summon-summary__item--frag">
            <span class="default-summon-summary__label">碎片</span>
            <span class="default-summon-summary__value">+${summary.totalFragments}</span>
          </div>
          <div class="default-summon-summary__item default-summon-summary__item--highest">
            <span class="default-summon-summary__label">最高稀有</span>
            <span class="default-summon-summary__value">${summary.highestRarity}</span>
          </div>
        </section>

        <div class="default-summon-grid" role="list" aria-label="十連召喚卡片">${cardsHtml}</div>
      </div>

      <footer class="default-summon-result__actions">
        <button type="button" class="default-summon-btn default-summon-btn--ghost" id="ten-pull-close">關閉</button>
      </footer>
    </div>
  `);

  bindGachaResultButtons('ten-pull-close');
}

function bindGachaResultButtons(closeId = 'pull-close') {
  const finish = () => {
    closeModal();
  };

  document.getElementById(closeId)?.addEventListener('click', (e) => {
    e.preventDefault();
    finish();
  });

  document.querySelector('[data-action="result-continue"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    finish();
  });

}

function showPullResult(result, options = {}) {
  if (isSweetTheme()) {
    renderSweetSinglePullResult(result, options);
    return;
  }
  renderDefaultSinglePullResult(result, options);
}

function showTenPullResult(result, options = {}) {
  if (isSweetTheme()) {
    renderSweetTenPullResult(result);
  } else {
    renderDefaultTenPullResult(result);
  }
  if (options.pendingAwakening) {
    const footer = document.querySelector('.sweet-summon-result__actions, .default-summon-result__actions');
    if (footer) {
      footer.classList.add('summon-result-actions--continue');
      footer.replaceChildren();
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'ten-pull-close';
      btn.dataset.action = 'result-continue';
      btn.className = isSweetTheme()
        ? 'sweet-summon-btn sweet-summon-btn--primary'
        : 'default-summon-btn default-summon-btn--primary';
      btn.textContent = '繼續';
      footer.appendChild(btn);
      bindGachaResultButtons('ten-pull-close');
    }
  }
}

/** 開啟單抽結果並等待使用者關閉／繼續 */
function showPullResultAndWait(result, options = {}) {
  return new Promise((resolve) => {
    gachaResultCloseResolver = resolve;
    showPullResult(result, options);
  });
}

/** 開啟十連結果並等待使用者關閉／繼續 */
function showTenPullResultAndWait(result, options = {}) {
  return new Promise((resolve) => {
    gachaResultCloseResolver = resolve;
    showTenPullResult(result, options);
  });
}

/* ─── 圖鑑頁 ─── */

function renderCollectionProgressSummary() {
  const container = document.getElementById('collection-progress-summary');
  if (!container) return;
  const summary = state.collectionMilestoneSummary;
  const context = summary?.context;
  if (!summary || !context) {
    container.innerHTML = '<p class="collection-summary__empty">收藏進度載入中…</p>';
    return;
  }

  const owned = Math.max(0, context.ownedCount ?? 0);
  const percent = Math.min(100, Math.max(0, summary.completionRate ?? 0));
  const next = summary.nextMilestone;
  const nextText = next
    ? `下一目標：收集 ${next.target} 隻寵物`
    : '下一目標：已完成全部收藏目標';
  const remainingText = next ? `還差 ${Math.max(0, next.target - owned)} 隻` : '完整圖鑑已達成';
  const rarityChips = COLLECTION_RARITY_ORDER.map((rarity) => {
    const rarityOwned = context.rarityOwned?.[rarity] ?? 0;
    const rarityTotal = context.rarityTotals?.[rarity] ?? 0;
    return `<span class="collection-rarity-chip collection-rarity-chip--${rarity.toLowerCase()}">
      <strong>${rarity}</strong> ${rarityOwned}/${rarityTotal}
    </span>`;
  }).join('');

  container.innerHTML = `
    <div class="collection-summary__header">
      <h2 class="collection-summary__title">下一個收藏目標</h2>
    </div>
    <div class="collection-summary__progress" role="progressbar" aria-label="總收藏完成率 ${percent}%" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
      <span class="collection-summary__progress-fill" style="width:${percent}%"></span>
    </div>
    <div class="collection-summary__next">
      <span>${escapeHtml(nextText)}</span>
      <strong>${escapeHtml(remainingText)}</strong>
    </div>
    <div class="collection-summary__rarities" aria-label="各稀有度收藏數">${rarityChips}</div>`;
}

function sortCollectionMilestones(items) {
  const statusRank = { claimable: 0, in_progress: 1, claimed: 2 };
  return [...items].sort((a, b) => {
    const rankDiff = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
    if (rankDiff !== 0) return rankDiff;
    if (a.status === 'in_progress' && b.status === 'in_progress' && a.percent !== b.percent) {
      return b.percent - a.percent;
    }
    return a.order - b.order;
  });
}

function collectionMilestoneCardHtml(item) {
  const statusLabel = item.status === 'claimable'
    ? '可領取'
    : item.status === 'claimed'
      ? '✓ 已完成'
      : '進行中';
  const actionHtml = item.status === 'claimable'
    ? `<button type="button" class="collection-milestone__claim" data-collection-milestone-action="claim" data-milestone-id="${escapeHtml(item.id)}">領取</button>`
    : `<span class="collection-milestone__status collection-milestone__status--${item.status}">${statusLabel}</span>`;
  return `
    <article class="collection-milestone collection-milestone--${item.status}" data-milestone-id="${escapeHtml(item.id)}">
      <span class="collection-milestone__icon" aria-hidden="true">${escapeHtml(item.badge?.icon || '🏅')}</span>
      <div class="collection-milestone__body">
        <h3 class="collection-milestone__title">${escapeHtml(item.title)}</h3>
        <p class="collection-milestone__description">${escapeHtml(item.description)}</p>
        <p class="collection-milestone__progress">${item.progress} / ${item.target}<span>星塵 +${item.reward?.stardust ?? 0}</span></p>
      </div>
      <div class="collection-milestone__action">${actionHtml}</div>
    </article>`;
}

function renderCollectionMilestones() {
  const panel = document.getElementById('collection-milestones-panel');
  if (!panel) return;
  const summary = state.collectionMilestoneSummary;
  if (!summary) {
    panel.innerHTML = '<p class="collection-summary__empty">收藏里程碑載入中…</p>';
    return;
  }

  const filterLabels = {
    in_progress: '進行中',
    claimable: '可領取',
    claimed: '已完成',
  };
  const items = sortCollectionMilestones(summary.items || []);
  const filtered = items.filter((item) => item.status === collectionMilestoneFilter);
  const visible = collectionMilestonesShowAll ? filtered : filtered.slice(0, 5);
  const emptyText = collectionMilestoneFilter === 'claimable'
    ? '目前沒有可領取的里程碑'
    : collectionMilestoneFilter === 'claimed'
      ? '目前還沒有已領取的里程碑'
      : '目前沒有進行中的里程碑';
  const filterButtons = Object.entries(filterLabels).map(([filter, label]) => {
    const count = items.filter((item) => item.status === filter).length;
    const selected = filter === collectionMilestoneFilter;
    return `<button type="button" class="collection-milestone-filter${selected ? ' is-active' : ''}" data-collection-milestone-action="filter" data-filter="${filter}" role="tab" aria-selected="${selected}">${label} ${count}</button>`;
  }).join('');

  panel.innerHTML = `
    <button type="button" class="collection-milestones-toggle" data-collection-milestone-action="toggle" aria-expanded="${collectionMilestonesExpanded}" aria-controls="collection-milestones-content">
      <span class="collection-milestones-toggle__title">收藏里程碑</span>
      <span class="collection-milestones-toggle__meta">完成 ${summary.metCount} / ${summary.total}　可領取 ${summary.claimableCount}</span>
      <span class="collection-milestones-toggle__arrow" aria-hidden="true">⌄</span>
    </button>
    <div id="collection-milestones-content" class="collection-milestones-content" ${collectionMilestonesExpanded ? '' : 'hidden'}>
      <div class="collection-milestone-filters" role="tablist" aria-label="里程碑狀態">${filterButtons}</div>
      <div class="collection-milestone-list">
        ${visible.length
          ? visible.map(collectionMilestoneCardHtml).join('')
          : `<div class="collection-milestone-empty"><strong>${emptyText}</strong><span>繼續抽卡與培養寵物吧</span></div>`}
      </div>
      ${filtered.length > 5 && !collectionMilestonesShowAll
        ? `<button type="button" class="collection-milestones-more" data-collection-milestone-action="show-all">顯示更多（${filtered.length - 5}）</button>`
        : ''}
    </div>`;
}

function getPetSeriesKey(pet) {
  return (typeof pet?.seriesId === 'string' && pet.seriesId.trim()) ? pet.seriesId.trim() : 'legacy';
}

function renderCollectionSeriesFilters() {
  const bar = document.getElementById('collection-series-filters');
  if (!bar) return;

  const seriesList = [...(state.seriesCatalog?.series || [])]
    .filter((s) => s && s.enabled !== false)
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

  const enriched = state.enrichedCollection || [];
  const buttons = [
    { id: 'all', name: '全部系列' },
    ...seriesList.map((s) => ({ id: s.id, name: s.name })),
  ];

  bar.innerHTML = buttons.map((item) => {
    let label = item.name;
    if (item.id !== 'all') {
      const seriesPets = enriched.filter((p) => getPetSeriesKey(p) === item.id);
      const owned = seriesPets.filter((p) => p.owned).length;
      label = `${item.name} ${owned}/${seriesPets.length}`;
    }
    const active = collectionSeriesFilter === item.id ? 'active' : '';
    return `<button type="button" class="filter-btn ${active}" data-series-filter="${escapeHtml(item.id)}">${escapeHtml(label)}</button>`;
  }).join('');
}

function renderCollectionView() {
  renderCollectionProgressSummary();
  renderCollectionMilestones();
  renderCollectionSeriesFilters();

  // 限定 #collection-filters，避免清掉成就／任務分類 filter 的 active
  const filterBtns = document.querySelectorAll('#collection-filters .filter-btn');
  filterBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter === collectionFilter);
  });

  const enriched = state.enrichedCollection || [];
  let filtered = enriched;

  if (collectionSeriesFilter !== 'all') {
    filtered = filtered.filter((p) => getPetSeriesKey(p) === collectionSeriesFilter);
  }

  if (collectionFilter === 'owned') {
    filtered = filtered.filter((p) => p.owned);
  } else if (collectionFilter === 'unowned') {
    filtered = filtered.filter((p) => !p.owned);
  } else if (collectionFilter !== 'all') {
    filtered = filtered.filter((p) => p.rarity === collectionFilter);
  }

  const { owned, total } = state.collectionProgress;
  const rate = total > 0 ? Math.round((owned / total) * 100) : 0;

  setText('collection-count', `${owned}/${total}`);
  setText('collection-rate', `${rate}%`);

  const companionEl = document.getElementById('collection-companion');
  if (companionEl) {
    if (state.companion) {
      companionEl.innerHTML = `
        <div>${petImageHtml(state.companion, { size: 'sm' })}</div>
        <div>
          <p class="collection-companion__label">目前陪伴寵物</p>
          <p class="collection-companion__name">${escapeHtml(petDisplayName(state.companion))}</p>
          ${state.companion.nickname ? `<p class="pet-original-name pet-original-name--sm">原名：${escapeHtml(petOriginalName(state.companion))}</p>` : ''}
          ${bondBadgeHtml(state.companion)}
        </div>
        <span class="badge badge--rarity rarity-${state.companion.rarity}">${state.companion.rarity}</span>`;
      companionEl.classList.remove('collection-companion--empty');
    } else {
      companionEl.innerHTML = '<p class="collection-companion--empty">尚未設定陪伴寵物</p>';
    }
  }

  const grid = document.getElementById('collection-grid');
  if (grid) {
    if (owned === 0 && (collectionFilter === 'all' || collectionFilter === 'unowned') && collectionSeriesFilter === 'all') {
      grid.innerHTML = emptyStateHtml(
        '📖',
        '圖鑑還是空的',
        '完成任務獲得星塵後，就可以召喚第一隻夥伴。',
        '前往召喚',
        'empty-go-gacha'
      );
      lastCollectionGridKey = null;
    } else if (filtered.length === 0) {
      grid.innerHTML = emptyStateHtml('🔍', '沒有符合的寵物', '試試其他稀有度、系列或獲得狀態篩選。');
      lastCollectionGridKey = null;
    } else {
      const gridKey = `${collectionSeriesFilter}|${collectionFilter}|${filtered.map((p) => `${p.id}:${p.owned}:${p.fragments}:${p.stars}:${p.isCompanion}:${p.bondLevel || 0}:${p.nickname || ''}`).join(',')}`;
      if (gridKey !== lastCollectionGridKey || !grid.querySelector('.collection-card')) {
        let ownedEagerCount = 0;
        grid.innerHTML = filtered
          .map((pet) => {
            const eager = pet.owned && ownedEagerCount < 12;
            if (eager) ownedEagerCount += 1;
            return renderCollectionCard(pet, { eager });
          })
          .join('');
        lastCollectionGridKey = gridKey;
        preloadOwnedPetImages(filtered.filter((p) => p.owned), [], 12).catch(() => {});
      }
    }
  }
  collectionRenderGate.clear();
}

function renderCollectionCard(pet, imageOptions = {}) {
  const { eager = false } = imageOptions;
  const owned = pet.owned;
  const rarityClass = `rarity-${pet.rarity}`;
  const imgOpts = owned
    ? { size: 'md', loading: eager ? 'eager' : 'lazy', eager }
    : { size: 'md', preview: true, loading: 'lazy' };
  const liberated = owned && (pet.bondLevel ?? 0) >= 5;
  const bondBadge = bondBadgeHtml(pet);
  // 已獲得：圖片獨立 button 開原圖；資訊區獨立 button 開詳情（避免巢狀 button）
  const imageBlock = owned
    ? `<button type="button" class="collection-card__image-btn" data-action="view-pet-image" data-pet-id="${pet.id}" aria-label="查看 ${escapeHtml(petDisplayName(pet))} 原圖">
         <div class="collection-card__image">
           ${petImageHtml(pet, imgOpts)}
           ${bondBadge ? `<div class="collection-card__bond-badge">${bondBadge}</div>` : ''}
         </div>
       </button>`
    : `<div class="collection-card__image">
         ${petImageHtml(pet, imgOpts)}
       </div>`;
  return `
    <article class="collection-card ${owned ? '' : 'collection-card--locked'} ${rarityClass} ${liberated ? 'is-bond-liberated' : ''}" data-pet-id="${pet.id}">
      ${owned ? imageBlock : ''}
      <button type="button" class="collection-card__tap" data-action="view-detail" aria-label="查看詳情">
        ${owned ? '' : imageBlock}
        <div class="collection-card__info">
          ${petNameBlockHtml(pet, { owned, heading: 'h3', className: 'collection-card__name' })}
          ${owned && pet.title ? `<p class="collection-card__title">${escapeHtml(pet.title)}</p>` : ''}
          <span class="badge badge--rarity ${rarityClass}">${pet.rarity}</span>
          ${
            owned
              ? `${renderStars(pet.stars)}<div class="collection-card__meta"><span class="fragments">碎片 ${pet.fragments}</span><span class="fragments">親密度 Lv.${pet.bondLevel || 1}</span></div>`
              : '<span class="locked-label">未獲得 · 點擊預覽</span>'
          }
        </div>
      </button>
      ${owned ? '<div class="collection-card__actions">' : ''}
      ${
        owned && !pet.isCompanion
          ? `<button type="button" class="btn btn--sm btn--companion" data-action="set-companion">設為陪伴</button>`
          : owned ? '<span class="collection-card__state">陪伴中</span>' : ''
      }
      ${
        owned && pet.stars < 5
          ? `<button type="button" class="btn btn--sm btn--upgrade" data-action="upgrade">升星</button>`
          : owned ? '<span class="collection-card__state">已達最高星級</span>' : ''
      }
      ${owned ? '</div>' : ''}
    </article>`;
}

/** 圖鑑詳情彈窗 */
function openPetDetailModal(petId) {
  const pet = state.enrichedCollection.find((p) => p.id === petId);
  if (!pet) return;

  const owned = pet.owned;
  const rarityClass = `rarity-${pet.rarity}`;
  const bondLevel = pet.bondLevel ?? 0;
  const bondLiberated = owned && bondLevel >= 5;

  let bondStatusSection = '';
  if (owned) {
    const st = pet.bondUnlockState || {};
    const unlockedItems = getBondUnlocksByLevel(bondLevel)
      .filter((k) => BOND_UNLOCK_ITEM_LABELS[k])
      .map((k) => BOND_UNLOCK_ITEM_LABELS[k]);
    const unlockedHtml = unlockedItems.length
      ? unlockedItems.map((t) => `<span class="bond-status-card__chip">${escapeHtml(t)}</span>`).join('')
      : '<span class="bond-status-card__chip bond-status-card__chip--none">尚未解鎖羈絆內容</span>';
    const nextHint = BOND_NEXT_UNLOCK[Math.min(Math.max(bondLevel, 1), 5)];
    const liberatedLabel = st.bondLiberated
      ? '<span class="bond-liberated-label">羈絆解放</span>'
      : '';
    const storyHtml = bondLevel >= 5
      ? `<div class="bond-story is-unlocked">
           <p class="bond-story__intro">${escapeHtml(BOND_STORY_INTRO)}</p>
           <p class="bond-story__rarity">${escapeHtml(getBondStoryText(pet.rarity))}</p>
         </div>`
      : '<div class="bond-story is-locked"><p>親密度達到 Lv.5 後解鎖羈絆故事。</p></div>';
    bondStatusSection = `
      <section class="bond-section">
        <div class="bond-section__title-row">
          <h3 class="bond-section__title">羈絆狀態</h3>
          ${liberatedLabel}
        </div>
        <div class="bond-status-card ${st.bondLiberated ? 'is-unlocked' : 'is-locked'}">
          <p class="bond-status-card__level">目前親密度 Lv.${bondLevel || 1}</p>
          <div class="bond-status-card__chips">${unlockedHtml}</div>
          <p class="bond-status-card__next">${escapeHtml(nextHint)}</p>
        </div>
        <h3 class="bond-section__title bond-section__title--story">羈絆故事</h3>
        ${storyHtml}
      </section>`;
  }

  let bondSection = '';
  if (owned && pet.bondUnlocks && Object.keys(pet.bondUnlocks).length > 0) {
    const levels = [2, 3, 4, 5];
    bondSection = `
      <section class="pet-detail__bond">
        <h3 class="pet-detail__subtitle">親密度解鎖</h3>
        <ul class="bond-unlock-list">
          ${levels
            .map((lv) => {
              const text = getBondUnlockText(pet, lv);
              if (!text) return '';
              const unlocked = bondLevel >= lv;
              return `<li class="bond-unlock ${unlocked ? 'bond-unlock--open' : ''}">
                <span class="bond-unlock__lv">Lv.${lv}</span>
                <span class="bond-unlock__text">${unlocked ? escapeHtml(text) : '???'}</span>
              </li>`;
            })
            .join('')}
        </ul>
      </section>`;
  }

  const personalityTags =
    pet.personality?.length > 0
      ? pet.personality.map((p) => `<span class="tag">${escapeHtml(p)}</span>`).join('')
      : '';

  const nicknameSection = owned
    ? `
      <section class="pet-detail__nickname card">
        <h3 class="pet-detail__subtitle">暱稱</h3>
        ${
          pet.nickname
            ? `<p class="pet-detail__display-name">${escapeHtml(petDisplayName(pet))}</p>
               <p class="pet-original-name">原名：${escapeHtml(petOriginalName(pet))}</p>`
            : `<p class="pet-detail__display-name">${escapeHtml(petOriginalName(pet))}</p>
               <p class="pet-detail__nickname-empty">尚未設定暱稱</p>`
        }
        <div class="pet-detail__nickname-actions">
          <button type="button" class="btn btn--secondary btn--sm" data-action="edit-nickname" data-pet-id="${pet.id}">${pet.nickname ? '修改暱稱' : '設定暱稱'}</button>
          ${pet.nickname ? `<button type="button" class="btn btn--ghost btn--sm" data-action="clear-nickname" data-pet-id="${pet.id}">清除暱稱</button>` : ''}
        </div>
      </section>`
    : '';

  openModal(`
    <div class="pet-detail pet-detail-card ${rarityClass} ${bondLiberated ? 'is-bond-liberated' : ''}">
      <div class="pet-detail__hero">
        ${owned
          ? `<button type="button" class="pet-detail-image-button" data-action="detail-view-image" data-pet-id="${pet.id}" aria-label="查看 ${escapeHtml(petDisplayName(pet))} 原圖">
               ${petImageHtml(pet, { size: 'lg', loading: 'eager', eager: true })}
             </button>`
          : petImageHtml(pet, { size: 'lg', preview: true, loading: 'lazy' })}
      </div>
      ${owned ? '<p class="pet-detail__image-hint">點擊圖片查看原圖</p>' : ''}
      <h2 class="pet-detail__name">${owned ? escapeHtml(petDisplayName(pet)) : '???'}</h2>
      ${owned && pet.nickname ? `<p class="pet-original-name pet-original-name--center">原名：${escapeHtml(petOriginalName(pet))}</p>` : ''}
      ${owned && pet.title ? `<p class="pet-detail__title">${escapeHtml(pet.title)}</p>` : ''}
      <div class="pet-detail__badges">
        <span class="badge badge--rarity ${rarityClass}">${pet.rarity}</span>
        ${pet.element ? `<span class="badge badge--element">${escapeHtml(pet.element)}</span>` : ''}
      </div>
      ${personalityTags ? `<div class="pet-detail__tags">${personalityTags}</div>` : ''}
      ${owned ? renderStars(pet.stars) : ''}
      ${owned ? `<p class="pet-detail__bond-lv">親密度 Lv.${bondLevel || 1}</p>` : ''}
      <p class="pet-detail__desc">${escapeHtml(pet.description)}</p>
      ${owned && pet.lore ? `<p class="pet-detail__lore">${escapeHtml(pet.lore)}</p>` : ''}
      ${!owned ? '<p class="pet-detail__locked">召喚解鎖後，可閱讀完整背景與親密度故事。</p>' : ''}
      ${bondStatusSection}
      ${bondSection}
      ${nicknameSection}
      ${
        owned && !pet.isCompanion
          ? `<button class="btn btn--companion btn--block" data-action="set-companion-detail" data-pet-id="${pet.id}">設為陪伴</button>`
          : ''
      }
      ${owned && pet.isCompanion ? '<p class="companion-badge companion-badge--detail">目前陪伴中</p>' : ''}
    </div>
  `);

  document.querySelector('[data-action="detail-view-image"]')?.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.petId;
    if (id) openPetImageViewer(id, e.currentTarget);
  });

  document.querySelector('[data-action="set-companion-detail"]')?.addEventListener('click', async (e) => {
    const id = e.target.dataset.petId;
    if (id) {
      await setCompanion(id);
      closeModal();
      await onRefresh({ renderMode: ['collection', 'tasks'] });
      showToast('已設為陪伴寵物', 'success');
      void recordOnboardingEvent('companion-set', { petId: id });
    }
  });

  document.querySelector('[data-action="edit-nickname"]')?.addEventListener('click', (e) => {
    const id = e.target.dataset.petId;
    if (id) openNicknameModal(id);
  });

  document.querySelector('[data-action="clear-nickname"]')?.addEventListener('click', async (e) => {
    const id = e.target.dataset.petId;
    if (!id) return;
    const result = await clearPetNickname(id);
    if (!result.success) {
      showToast(result.message || '暱稱儲存失敗，請稍後再試。', 'error');
      return;
    }
    closeModal();
    await onRefresh({ renderMode: ['collection'] });
    openPetDetailModal(id);
    showToast('暱稱已清除', 'success');
  });
}

/* ─── 探險頁 ─── */

function getOwnedPets() {
  return (state.enrichedCollection || []).filter((p) => p.owned);
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDuration(minutes) {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h} 小時 ${m} 分` : `${h} 小時`;
  }
  return `${minutes} 分鐘`;
}

function renderExpeditionView() {
  if (!state) return;

  const { wallet, expeditionAreas, activeExpedition } = state;
  const ownedPets = getOwnedPets();
  const hasActive = !!activeExpedition;
  const isComplete = activeExpedition && isExpeditionTimeComplete(activeExpedition);

  // 冒險能量卡片
  const energyEl = document.getElementById('expedition-energy');
  const energy = wallet.adventureEnergy ?? 0;
  if (energyEl) {
    energyEl.classList.toggle('expedition-energy--low', energy === 0);
    energyEl.innerHTML = `
      <div class="expedition-energy__header">
        <span class="expedition-energy__icon">⚡</span>
        <div>
          <p class="expedition-energy__label">冒險能量</p>
          <p class="expedition-energy__value">${energy}</p>
        </div>
      </div>
      ${
        energy === 0
          ? `<p class="expedition-energy__warning"><strong>冒險能量不足</strong><br>完成有效任務可以獲得冒險能量。</p>`
          : '<p class="expedition-energy__hint">完成任務可以獲得冒險能量</p>'
      }`;
  }

  // 進行中探險
  const activeEl = document.getElementById('expedition-active');
  if (activeEl) {
    if (!activeExpedition) {
      activeEl.innerHTML = '';
      stopExpeditionStatusRotation();
    } else {
      const pet = state.enrichedCollection.find((p) => p.id === activeExpedition.petId);
      const area = expeditionAreas.find((a) => a.id === activeExpedition.areaId);
      const remaining = getRemainingMs(activeExpedition);
      const complete = isExpeditionTimeComplete(activeExpedition);

      activeEl.innerHTML = `
        <article class="expedition-active-card card expedition-active-card--area-${area?.id || 'mist_forest'} ${complete ? 'expedition-active-card--ready' : 'expedition-active-card--glow'}">
          <div class="expedition-active-card__fx" aria-hidden="true"></div>
          <span class="expedition-status-badge ${complete ? 'expedition-status-badge--ready' : 'expedition-status-badge--active'}">${complete ? '可領取' : '進行中'}</span>
          <h2 class="section-title">進行中探險</h2>
          <div class="expedition-active-card__body">
            <div class="expedition-active-card__pet">
              <div class="expedition-active-card__pet-img ${complete ? 'expedition-pet-img--complete' : 'expedition-pet-img--float'}">
                ${pet ? petImageHtml(pet, { size: 'md' }) : ''}
              </div>
              <div>
                <p class="expedition-active-card__name">${pet ? escapeHtml(petDisplayName(pet)) : '未知寵物'}</p>
                ${pet?.nickname ? `<p class="pet-original-name pet-original-name--sm">原名：${escapeHtml(petOriginalName(pet))}</p>` : ''}
                <p class="expedition-active-card__area">${area ? escapeHtml(area.name) : ''}</p>
                <p class="expedition-active-card__status-label">${complete ? '探索完成' : '探索日誌'}</p>
              </div>
            </div>
            ${
              complete
                ? `<p class="expedition-complete-msg">${EXPEDITION_COMPLETE_MSG}</p>
                   <button class="btn btn--primary btn--block expedition-claim-btn expedition-claim-btn--glow" data-action="claim-expedition" data-id="${escapeHtml(activeExpedition.id)}">領取獎勵</button>`
                : `<p class="expedition-status-log" id="expedition-status-log"></p>
                   <div class="expedition-countdown-row">
                     <span class="expedition-pulse-dot" aria-hidden="true"></span>
                     <p class="expedition-countdown" id="expedition-countdown">${formatRemainingTime(remaining)}</p>
                   </div>
                   <p class="expedition-countdown__label">剩餘時間</p>`
            }
          </div>
        </article>`;

      if (!complete && area?.id) {
        startExpeditionStatusRotation(area.id);
      } else {
        stopExpeditionStatusRotation();
      }
    }
  }

  // 探索地圖探索度面板
  renderExplorationPanel();

  // 探險地區（V2.7.2：先選地區，點派遣開 Modal）
  const areasEl = document.getElementById('expedition-areas');
  if (areasEl) {
    const explorationMap = {};
    for (const a of state.explorationSummary?.areas || []) {
      explorationMap[a.areaId] = a;
    }

    areasEl.innerHTML = `
      <h2 class="section-title">探險地區</h2>
      <p class="expedition-map__hint">選擇想探索的地區，點「派遣探險」挑選夥伴出發。</p>
      <div class="expedition-map expedition-area-grid">
        ${expeditionAreas
          .map((area) => renderExpeditionAreaCard(area, {
            hasActive,
            energy,
            ownedPets,
            exploration: explorationMap[area.id] || null,
          }))
          .join('')}
      </div>`;
  }

  // 寵物選擇已移至派遣 Modal，清空舊容器
  const petsEl = document.getElementById('expedition-pets');
  if (petsEl) petsEl.innerHTML = '';
}

/** V2.7.2 探險地區卡片（含探索度、派遣按鈕，點按鈕開派遣 Modal） */
function renderExpeditionAreaCard(area, { hasActive, energy, ownedPets, exploration }) {
  const { unlocked, hint } = checkAreaUnlock(area, ownedPets);
  const locked = !unlocked;
  const mat = area.rewards.material;
  const lowEnergy = energy < area.energyCost;

  let statusLabel = '可派遣';
  let statusClass = 'expedition-area-card__status--ready';
  let btnLabel = '派遣探險';
  let btnDisabled = false;
  if (locked) {
    statusLabel = '未解鎖';
    statusClass = 'expedition-area-card__status--locked';
    btnLabel = '未解鎖';
    btnDisabled = true;
  } else if (hasActive) {
    statusLabel = '探險進行中';
    statusClass = 'expedition-area-card__status--busy';
    btnLabel = '探險進行中';
    btnDisabled = true;
  } else if (lowEnergy) {
    statusLabel = '能量不足';
    statusClass = 'expedition-area-card__status--locked';
    btnLabel = '能量不足';
    btnDisabled = true;
  }

  const exploreBadge = exploration
    ? `<span class="expedition-explore-badge">探索度 ${exploration.progress}%</span>`
    : '';

  const progressBlock = exploration
    ? `<div class="expedition-area-card__progress">
         <div class="expedition-area-progress-bar" role="progressbar" aria-valuenow="${exploration.progress}" aria-valuemin="0" aria-valuemax="100">
           <div class="expedition-area-progress-fill" style="width: ${exploration.progress}%;"></div>
           <span class="expedition-area-progress-text">${exploration.progress}%</span>
         </div>
         <p class="expedition-area-card__next">${
           exploration.fullyExplored
             ? '已完全探索'
             : exploration.nextMilestone
               ? `下一個里程碑：${exploration.nextMilestone.percent}% ${escapeHtml(exploration.nextMilestone.title)}`
               : '—'
         }</p>
       </div>`
    : '';

  return `
    <article class="expedition-area-card card expedition-area-card--${area.id} ${locked ? 'expedition-area-card--locked' : ''}" data-area-id="${area.id}">
      <div class="expedition-area-card__header">
        <h3 class="expedition-area-card__title">${escapeHtml(area.name)}</h3>
        ${exploreBadge}
        <span class="expedition-area-card__status ${statusClass}">${statusLabel}</span>
      </div>
      <p class="expedition-area-card__desc">${escapeHtml(area.description)}</p>
      <div class="expedition-area-card__meta">
        <span class="expedition-area-card__meta-item">⏱ ${formatDuration(area.durationMinutes)}</span>
        <span class="expedition-area-card__meta-item">⚡ 冒險能量 ${area.energyCost}</span>
      </div>
      <div class="expedition-area-card__rewards">
        <span class="expedition-reward-chip" data-reward-type="stardust">✦ 星塵 ${area.rewards.stardust.min}～${area.rewards.stardust.max}</span>
        <span class="expedition-reward-chip" data-reward-type="material">📦 ${escapeHtml(getMaterialName(mat.id))} ${mat.min}～${mat.max}</span>
        <span class="expedition-reward-chip" data-reward-type="bond">💜 親密度 +${area.rewards.bondExp}</span>
      </div>
      ${progressBlock}
      ${locked ? `<p class="expedition-area-card__unlock">${escapeHtml(hint)}</p>` : ''}
      <div class="expedition-area-card__actions">
        <button
          class="expedition-dispatch-button"
          data-action="open-dispatch"
          data-area-id="${area.id}"
          ${btnDisabled ? 'disabled' : ''}
        >${btnLabel}</button>
      </div>
    </article>`;
}

function startExpeditionTimer() {
  stopExpeditionTimer();
  const activeNow = state?.activeExpedition;
  // 已完成待領取：不啟動每秒 interval，避免整頁重繪
  if (!activeNow || isExpeditionTimeComplete(activeNow)) {
    return;
  }

  expeditionTimer = setInterval(() => {
    const active = state?.activeExpedition;
    if (!active) {
      stopExpeditionTimer();
      return;
    }

    if (isExpeditionTimeComplete(active)) {
      // 剛完成：停止 timer，只渲染一次切換成可領取狀態
      stopExpeditionTimer();
      stopExpeditionStatusRotation();
      renderExpeditionView();
      renderNavBadges();
      return;
    }

    // 倒數中：只更新倒數文字，不重建整頁
    const el = document.getElementById('expedition-countdown');
    if (el) {
      el.textContent = formatRemainingTime(getRemainingMs(active));
    }
  }, 1000);
}

function stopExpeditionTimer() {
  if (expeditionTimer) {
    clearInterval(expeditionTimer);
    expeditionTimer = null;
  }
}

function startExpeditionStatusRotation(areaId) {
  stopExpeditionStatusRotation();
  expeditionStatusIndex = -1;

  const setInitial = () => {
    const el = document.getElementById('expedition-status-log');
    if (!el) return;
    const { text, index } = pickStatusLine(areaId, expeditionStatusIndex);
    expeditionStatusIndex = index;
    el.textContent = text;
  };

  setInitial();

  const scheduleNext = () => {
    expeditionStatusTimer = setTimeout(() => {
      const active = state?.activeExpedition;
      if (!active || isExpeditionTimeComplete(active)) {
        stopExpeditionStatusRotation();
        return;
      }

      const el = document.getElementById('expedition-status-log');
      if (el) {
        const { text, index } = pickStatusLine(areaId, expeditionStatusIndex);
        expeditionStatusIndex = index;
        el.classList.add('expedition-status-log--changing');
        setTimeout(() => {
          el.textContent = text;
          el.classList.remove('expedition-status-log--changing');
        }, 200);
      }

      scheduleNext();
    }, randomStatusInterval());
  };

  scheduleNext();
}

function stopExpeditionStatusRotation() {
  if (expeditionStatusTimer) {
    clearTimeout(expeditionStatusTimer);
    expeditionStatusTimer = null;
  }
  expeditionStatusIndex = -1;
}

async function handleExpeditionClick(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;

  if (action === 'open-dispatch') {
    const areaId = target.dataset.areaId;
    if (state.activeExpedition) {
      showToast('目前已有探險進行中', 'warning');
      return;
    }
    const area = state.expeditionAreas.find((a) => a.id === areaId);
    const { unlocked, hint } = checkAreaUnlock(area, getOwnedPets());
    if (!unlocked) {
      showToast(hint || '此地區尚未解鎖', 'warning');
      return;
    }
    openExpeditionDispatchModal(areaId);
    return;
  }

  if (action === 'claim-expedition') {
    const expId = target.dataset.id;
    const expeditionPetId = state.activeExpedition?.petId ?? null;
    const expeditionAreaId = state.activeExpedition?.areaId ?? null;
    try {
      const result = await claimExpeditionRewards(
        expId,
        state.expeditionAreas,
        state.allPets
      );
      await trackQuest('complete_expedition');
      // 探險成功領獎後才推進探索度（不影響原本收益 / 倒數邏輯）
      const exploration = await applyExplorationOnClaim(expeditionAreaId);
      await onRefresh({ renderMode: ['expedition', 'tasks', 'collection'] });
      if (expeditionPetId) {
        await notifyBondUnlocks(expeditionPetId);
      }
      showExpeditionRewardModal(result);
      const matEntries = Object.entries(result.rewards.materials || {}).filter(([, amt]) => amt > 0);
      if (matEntries.length > 0) {
        const matText = matEntries.map(([id, amt]) => `${getMaterialName(id)} x${amt}`).join('、');
        showToast(`獲得 ${matText}`, 'success', 3200);
      } else {
        showToast('探險獎勵已領取', 'success', 2000);
      }
      if (exploration) {
        showToast(`${exploration.areaName}探索度 +${exploration.increment}%`, 'reward', 2600);
        for (const milestone of exploration.newlyReachedMilestones || []) {
          showToast(`探索里程碑達成：${milestone.title}`, 'info', 2800);
        }
      }
      await handleAchievementCheckAfterAction();
    } catch (err) {
      showToast(err.message || '領取失敗', 'error');
    }
    return;
  }

  if (action === 'toggle-exploration-panel') {
    explorationPanelCollapsed = !explorationPanelCollapsed;
    renderExplorationPanel();
    return;
  }

  if (action === 'toggle-exploration-story') {
    const areaId = target.dataset.areaId;
    // 值為 false 代表展開；預設（undefined）視為折疊
    explorationStoryCollapsed[areaId] = explorationStoryCollapsed[areaId] === false ? true : false;
    renderExplorationPanel();
    return;
  }

  if (action === 'toggle-exploration-milestones') {
    const areaId = target.dataset.areaId;
    explorationMilestonesCollapsed[areaId] = explorationMilestonesCollapsed[areaId] === false ? true : false;
    renderExplorationPanel();
    return;
  }

  if (action === 'claim-exploration-milestone') {
    const areaId = target.dataset.areaId;
    const percent = Number(target.dataset.percent);
    target.disabled = true;
    try {
      const result = await claimExplorationMilestone(areaId, percent);
      if (!result.success) {
        showToast(result.error || '領取失敗', 'warning');
        return;
      }
      await onRefresh({ renderMode: ['expedition'] });
      renderExplorationPanel();
      showToast(`已領取探索獎勵：${result.rewardText}`, 'reward', 3000);
      await handleAchievementCheckAfterAction();
    } catch (err) {
      showToast(err.message || '領取失敗', 'error');
    }
    return;
  }
}

function showExpeditionRewardModal(result) {
  const { rewards, pet, bond } = result;
  const displayPet = state.enrichedCollection?.find((p) => p.id === pet.id) || pet;
  const matEntries = Object.entries(rewards.materials || {});
  const rarityPct = Math.round((rewards.rarityBonus || 0) * 100);
  const bondPct = Math.round((rewards.bondBonus || 0) * 100);

  openModal(`
    <div class="expedition-reward-modal expedition-reward-modal--animate">
      <h2 class="modal-title expedition-reward-modal__title">探險歸來！</h2>
      <div class="expedition-reward-modal__pet">
        ${petImageHtml(displayPet, { size: 'md' })}
        <p class="expedition-reward-modal__pet-name">${escapeHtml(petDisplayName(displayPet))}</p>
        ${displayPet.nickname ? `<p class="pet-original-name pet-original-name--sm">原名：${escapeHtml(petOriginalName(displayPet))}</p>` : ''}
      </div>
      <ul class="expedition-reward-list">
        <li class="expedition-reward-item" data-reward-type="stardust">✦ 星塵 <strong class="expedition-reward-value">+${rewards.stardust}</strong>
          ${rewards.bonusStardust > 0 ? `<span class="expedition-bonus">（基礎 ${rewards.baseStardust} + 加成 ${rewards.bonusStardust}）</span>` : ''}
        </li>
        ${matEntries.map(([id, amt]) => `<li class="expedition-reward-item" data-reward-type="material">📦 ${escapeHtml(getMaterialName(id))} <strong class="expedition-reward-value">+${amt}</strong></li>`).join('')}
        <li class="expedition-reward-item" data-reward-type="bond">💜 親密度 <strong class="expedition-reward-value">+${rewards.bondExp}</strong></li>
        ${rewards.fragmentGained > 0 ? `<li class="expedition-reward-item" data-reward-type="fragment">💫 寵物碎片 <strong class="expedition-reward-value">+${rewards.fragmentGained}</strong></li>` : ''}
      </ul>
      <p class="expedition-reward-modal__workshop-hint">可在工坊製作親密度道具。</p>
      ${
        rewards.bonusStardust > 0
          ? `<p class="expedition-bonus-detail">加成：稀有度 +${rarityPct}% · 親密度 Lv.${bond?.oldLevel ?? pet.bondLevel ?? 1} +${bondPct}%</p>`
          : ''
      }
      ${bond?.leveledUp ? `<p class="expedition-levelup">親密度提升至 Lv.${bond.newLevel}！</p>` : ''}
      <button class="btn btn--primary btn--block expedition-confirm-button" id="expedition-reward-close">確認</button>
    </div>
  `);

  document.getElementById('expedition-reward-close')?.addEventListener('click', closeModal);
}

/* ─── 探索地圖探索度（V2.7.0） ─── */

const MILESTONE_STATUS_LABEL = {
  claimable: '可領取',
  claimed: '已領取',
  locked: '未達成',
};

/** 渲染探索度面板（位於探險頁，介於進行中探險與探險地區之間） */
function renderExplorationPanel() {
  const panelEl = document.getElementById('exploration-panel');
  if (!panelEl) return;

  const summary = state?.explorationSummary;
  if (!summary || !Array.isArray(summary.areas) || summary.areas.length === 0) {
    panelEl.innerHTML = '';
    return;
  }

  const collapsed = explorationPanelCollapsed;
  const cards = summary.areas.map((area) => renderExplorationAreaCard(area)).join('');

  panelEl.innerHTML = `
    <div class="exploration-panel__wrap card ${collapsed ? 'is-collapsed' : ''}">
      <button type="button" class="exploration-panel__toggle" data-action="toggle-exploration-panel" aria-expanded="${!collapsed}">
        <span class="exploration-panel__toggle-main">
          <span class="exploration-panel__toggle-icon" aria-hidden="true">🗺️</span>
          <span class="exploration-panel__toggle-title">地區探索度</span>
          ${
            summary.totalClaimable > 0
              ? `<span class="exploration-panel__claimable">可領取 ${summary.totalClaimable}</span>`
              : ''
          }
        </span>
        <span class="exploration-panel__toggle-chevron">${collapsed ? '▸' : '▾'}</span>
      </button>
      ${
        collapsed
          ? ''
          : `<div class="exploration-panel__body">
               <p class="exploration-panel__hint">完成探險並領獎，即可推進各地區探索度，解鎖故事、徽章與稱號。</p>
               <div class="exploration-area-list">${cards}</div>
             </div>`
      }
    </div>`;
}

function renderExplorationAreaCard(area) {
  const { areaId } = area;
  const progress = area.progress;
  // 預設折疊：只有明確設為 false 才展開，保持頁面整潔
  const storyOpen = explorationStoryCollapsed[areaId] === false;
  const milestonesOpen = explorationMilestonesCollapsed[areaId] === false;

  const nextText = area.fullyExplored
    ? '已完全探索'
    : area.nextMilestone
      ? `下一個里程碑：${area.nextMilestone.percent}% ${escapeHtml(area.nextMilestone.title)}`
      : '—';

  const storyBlock = area.hasStory
    ? `<div class="exploration-story is-unlocked">
         ${area.stories.map((s) => `<p class="exploration-story__text">${escapeHtml(s.text)}</p>`).join('')}
       </div>`
    : `<div class="exploration-story is-locked">
         <p class="exploration-story__text">探索度達到 ${area.storyLockedPercent}% 後解鎖地區故事。</p>
       </div>`;

  const milestoneCards = area.milestones.map((m) => renderExplorationMilestoneCard(areaId, m)).join('');

  // 已獲得徽章 / 稱號提示（來自已領取里程碑）
  const earned = [];
  for (const m of area.milestones) {
    if (m.status !== 'claimed' || !m.reward) continue;
    if (m.reward.title) earned.push(`已獲得稱號：${m.reward.title}`);
    if (m.reward.badgeId) earned.push(`已獲得徽章：${m.title}`);
  }
  const earnedBlock = earned.length
    ? `<div class="exploration-area-card__earned">
         ${earned.map((t) => `<span class="exploration-reward-chip" data-reward-type="title">${escapeHtml(t)}</span>`).join('')}
       </div>`
    : '';

  return `
    <article class="exploration-area-card" data-area-id="${areaId}">
      <div class="exploration-area-card__header">
        <h3 class="exploration-area-title">${escapeHtml(area.name)}</h3>
        <span class="exploration-progress-label">探索度 ${progress}%</span>
      </div>
      <div class="exploration-progress-bar" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">
        <div class="exploration-progress-fill" style="width: ${progress}%;"></div>
        <span class="exploration-progress-bar__text">${progress}%</span>
      </div>
      <div class="exploration-area-card__stats">
        <span class="exploration-area-card__runs">已完成探險 ${area.completedRuns} 次</span>
        ${area.claimableCount > 0 ? `<span class="exploration-status-badge exploration-status-badge--claimable">可領取 ${area.claimableCount}</span>` : ''}
        ${area.fullyExplored ? '<span class="exploration-status-badge exploration-status-badge--done">完全探索</span>' : ''}
      </div>
      <p class="exploration-next-milestone">${escapeHtml(nextText)}</p>
      ${earnedBlock}

      <button type="button" class="exploration-collapse-toggle" data-action="toggle-exploration-story" data-area-id="${areaId}" aria-expanded="${storyOpen}">
        <span>地區故事</span>
        <span class="exploration-collapse-toggle__icon">${storyOpen ? '▾' : '▸'}</span>
      </button>
      ${storyOpen ? storyBlock : ''}

      <button type="button" class="exploration-collapse-toggle" data-action="toggle-exploration-milestones" data-area-id="${areaId}" aria-expanded="${milestonesOpen}">
        <span>里程碑</span>
        <span class="exploration-collapse-toggle__icon">${milestonesOpen ? '▾' : '▸'}</span>
      </button>
      ${milestonesOpen ? `<div class="exploration-milestone-list">${milestoneCards}</div>` : ''}
    </article>`;
}

function renderExplorationMilestoneCard(areaId, milestone) {
  const { status, percent } = milestone;
  const chips = (milestone.rewardChips || [])
    .map(
      (chip) =>
        `<span class="exploration-reward-chip" data-reward-type="${chip.type}">${escapeHtml(chip.label)}</span>`
    )
    .join('');

  let button;
  if (status === 'claimable') {
    button = `<button type="button" class="exploration-claim-button" data-action="claim-exploration-milestone" data-area-id="${areaId}" data-percent="${percent}">領取</button>`;
  } else if (status === 'claimed') {
    button = `<button type="button" class="exploration-claim-button" disabled>已領取</button>`;
  } else {
    button = `<button type="button" class="exploration-claim-button" disabled>未達成</button>`;
  }

  return `
    <div class="exploration-milestone-card is-${status}">
      <div class="exploration-milestone-card__head">
        <span class="exploration-milestone-card__percent">${percent}%</span>
        <span class="exploration-milestone-card__title">${escapeHtml(milestone.title)}</span>
        <span class="exploration-status-badge exploration-status-badge--${status}">${MILESTONE_STATUS_LABEL[status]}</span>
      </div>
      <p class="exploration-milestone-card__desc">${escapeHtml(milestone.description)}</p>
      <div class="exploration-milestone-card__rewards">${chips}</div>
      ${button}
    </div>`;
}

/**
 * 探險成功領獎後，推進對應地區探索度並回傳提示資訊。
 * 不改動原本探險收益；僅疊加探索度成長層。
 */
async function applyExplorationOnClaim(areaId) {
  if (!areaId || !AREA_EXPLORATION_DEFS[areaId]) return null;
  try {
    const increment = getAreaExplorationIncrement(areaId);
    const result = await updateAreaExplorationProgress(areaId, increment);
    if (!result?.success) return null;
    return result;
  } catch (err) {
    console.warn('[QuestNote] 探索度更新失敗:', err);
    return null;
  }
}

/* ─── V2.7.2 派遣選單 Modal ─── */

const DISPATCH_RARITY_RANK = { UR: 5, SSR: 4, SR: 3, R: 2, N: 1 };

/**
 * 取得已擁有寵物並依推薦排序（僅影響顯示，不改資料）：
 * 陪伴寵物 > 高稀有度 > 高親密度 > 名稱。
 */
function getDispatchablePetsSorted() {
  const companionId = state?.companion?.id;
  const pets = getOwnedPets().slice();
  pets.sort((a, b) => {
    const ca = a.id === companionId ? 1 : 0;
    const cb = b.id === companionId ? 1 : 0;
    if (ca !== cb) return cb - ca;
    const ra = DISPATCH_RARITY_RANK[a.rarity] ?? 0;
    const rb = DISPATCH_RARITY_RANK[b.rarity] ?? 0;
    if (ra !== rb) return rb - ra;
    const la = a.bondLevel ?? 1;
    const lb = b.bondLevel ?? 1;
    if (la !== lb) return lb - la;
    return petDisplayName(a).localeCompare(petDisplayName(b), 'zh-Hant');
  });
  return pets;
}

/** 開啟派遣選單 Modal */
function openExpeditionDispatchModal(areaId) {
  const area = state.expeditionAreas.find((a) => a.id === areaId);
  if (!area) {
    showToast('找不到地區資料', 'error');
    return;
  }
  dispatchAreaId = areaId;

  // 預設選中：只有一隻可派遣寵物→自動選；否則優先陪伴寵物
  const pets = getDispatchablePetsSorted();
  const selectable = pets.filter((p) => !isPetOnExpedition(p.id, state.activeExpedition));
  const companionId = state?.companion?.id;
  dispatchSelectedPetId = null;
  if (selectable.length === 1) {
    dispatchSelectedPetId = selectable[0].id;
  } else if (companionId && selectable.some((p) => p.id === companionId)) {
    dispatchSelectedPetId = companionId;
  }

  let overlay = document.getElementById('expedition-dispatch-modal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'expedition-dispatch-modal';
    overlay.className = 'expedition-dispatch-modal';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', handleDispatchModalClick);
  }
  rememberDialogFocus(overlay);
  document.body.classList.add('expedition-dispatch-open');
  dispatchKeydownHandler = (e) => {
    if (e.key === 'Escape' && isTopDialog(overlay)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      closeExpeditionDispatchModal();
    }
  };
  document.addEventListener('keydown', dispatchKeydownHandler);

  renderExpeditionDispatchModal();
  focusDialog(overlay);
}

/** 關閉派遣選單 Modal */
function closeExpeditionDispatchModal() {
  const overlay = document.getElementById('expedition-dispatch-modal');
  if (overlay) overlay.remove();
  document.body.classList.remove('expedition-dispatch-open');
  if (overlay) restoreDialogFocus(overlay);
  if (dispatchKeydownHandler) {
    document.removeEventListener('keydown', dispatchKeydownHandler);
    dispatchKeydownHandler = null;
  }
  dispatchAreaId = null;
  dispatchSelectedPetId = null;
}

/** 派遣 Modal 點擊委派（背景 / 關閉 / 選寵物 / 確認） */
function handleDispatchModalClick(e) {
  const overlay = document.getElementById('expedition-dispatch-modal');
  if (
    e.target === overlay ||
    e.target.classList.contains('expedition-dispatch-modal__backdrop')
  ) {
    closeExpeditionDispatchModal();
    return;
  }
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const action = t.dataset.action;
  if (action === 'dispatch-close') {
    closeExpeditionDispatchModal();
    return;
  }
  if (action === 'dispatch-select-pet') {
    if (t.disabled) return;
    const scrollTop = overlay.querySelector('.expedition-dispatch-modal__body')?.scrollTop || 0;
    dispatchSelectedPetId = t.dataset.petId;
    renderExpeditionDispatchModal();
    const scrollBody = overlay.querySelector('.expedition-dispatch-modal__body');
    if (scrollBody) scrollBody.scrollTop = scrollTop;
    overlay.querySelector('.expedition-pet-option.is-selected')?.focus({ preventScroll: true });
    return;
  }
  if (action === 'dispatch-confirm') {
    confirmExpeditionDispatch(dispatchAreaId, dispatchSelectedPetId);
    return;
  }
}

/** 渲染派遣 Modal 內容 */
function renderExpeditionDispatchModal() {
  const overlay = document.getElementById('expedition-dispatch-modal');
  if (!overlay) return;
  const area = state.expeditionAreas.find((a) => a.id === dispatchAreaId);
  if (!area) {
    closeExpeditionDispatchModal();
    return;
  }

  const mat = area.rewards.material;
  const energy = state.wallet.adventureEnergy ?? 0;
  const lowEnergy = energy < area.energyCost;
  const exploration = (state.explorationSummary?.areas || []).find(
    (a) => a.areaId === dispatchAreaId
  );
  const pets = getDispatchablePetsSorted();
  const selectedPet = pets.find((p) => p.id === dispatchSelectedPetId) || null;

  const petListHtml =
    pets.length === 0
      ? '<p class="expedition-dispatch-empty">目前還沒有可派遣的寵物，先去召喚夥伴吧。</p>'
      : pets.map((p) => buildDispatchPetOptionHtml(p)).join('');

  const canConfirm = !!selectedPet && !lowEnergy && !state.activeExpedition;

  const previewHtml = selectedPet
    ? `你將派遣：<strong>${escapeHtml(petDisplayName(selectedPet))}</strong>　前往：<strong>${escapeHtml(area.name)}</strong><br>消耗：冒險能量 ${area.energyCost}　預計時間：${formatDuration(area.durationMinutes)}`
    : '請先選擇出發寵物';

  overlay.innerHTML = `
    <div class="expedition-dispatch-modal__backdrop"></div>
    <div class="expedition-dispatch-modal__content" role="dialog" aria-modal="true" aria-label="派遣探險">
      <div class="expedition-dispatch-modal__header">
        <h2 class="expedition-dispatch-modal__title">派遣探險</h2>
        <button type="button" class="expedition-dispatch-modal__close" data-action="dispatch-close" aria-label="關閉">✕</button>
      </div>
      <div class="expedition-dispatch-modal__body">
        <div class="expedition-dispatch-modal__area-summary">
          <h3 class="expedition-dispatch-area__name">${escapeHtml(area.name)}</h3>
          <p class="expedition-dispatch-area__desc">${escapeHtml(area.description)}</p>
          <div class="expedition-dispatch-area__meta">
            <span class="expedition-dispatch-area__meta-item">⏱ ${formatDuration(area.durationMinutes)}</span>
            <span class="expedition-dispatch-area__meta-item ${lowEnergy ? 'is-low' : ''}">⚡ 消耗 ${area.energyCost}（目前 ${energy}）</span>
          </div>
          <div class="expedition-dispatch-area__rewards">
            <span class="expedition-reward-chip" data-reward-type="stardust">✦ 星塵 ${area.rewards.stardust.min}～${area.rewards.stardust.max}</span>
            <span class="expedition-reward-chip" data-reward-type="material">📦 ${escapeHtml(getMaterialName(mat.id))} ${mat.min}～${mat.max}</span>
            <span class="expedition-reward-chip" data-reward-type="bond">💜 親密度 +${area.rewards.bondExp}</span>
          </div>
          ${
            exploration
              ? `<p class="expedition-dispatch-area__explore">探索度 ${exploration.progress}%${
                  exploration.fullyExplored
                    ? '（已完全探索）'
                    : exploration.nextMilestone
                      ? ` · 下一個里程碑 ${exploration.nextMilestone.percent}%`
                      : ''
                }</p>`
              : ''
          }
        </div>
        <div class="expedition-dispatch-modal__pet-section">
          <h3 class="expedition-dispatch-modal__pet-title">選擇出發寵物</h3>
          <p class="expedition-dispatch-modal__pet-note">陪伴中的寵物也可以派遣，不會取消目前的陪伴設定。</p>
          <div class="expedition-dispatch-modal__pet-list">
            ${petListHtml}
          </div>
        </div>
      </div>
      <div class="expedition-dispatch-modal__preview">${previewHtml}</div>
      <div class="expedition-dispatch-modal__footer">
        <button type="button" class="expedition-dispatch-cancel-button" data-action="dispatch-close">取消</button>
        <button type="button" class="expedition-dispatch-confirm-button" data-action="dispatch-confirm" ${canConfirm ? '' : 'disabled'}>確認派遣</button>
      </div>
    </div>`;
}

/** 派遣 Modal 內單一寵物選項 */
function buildDispatchPetOptionHtml(pet) {
  const onExp = isPetOnExpedition(pet.id, state.activeExpedition);
  const selected = dispatchSelectedPetId === pet.id;
  const rarityClass = `rarity-${pet.rarity}`;
  const liberated = pet.bondLiberated;
  const isCompanion = !!pet.isCompanion || pet.id === state?.companion?.id;
  return `
    <button type="button"
      class="expedition-pet-option ${selected ? 'is-selected' : ''} ${onExp ? 'is-disabled' : ''}"
      data-action="dispatch-select-pet"
      data-pet-id="${pet.id}"
      aria-pressed="${selected}"
      ${onExp ? 'disabled' : ''}
    >
      <span class="expedition-pet-option__img">${petImageHtml(pet, { size: 'sm' })}</span>
      <span class="expedition-pet-option__info">
        <span class="expedition-pet-option__name">${escapeHtml(petDisplayName(pet))}</span>
        ${pet.nickname ? `<span class="expedition-pet-option__original">原名：${escapeHtml(petOriginalName(pet))}</span>` : ''}
        <span class="expedition-pet-option__tags">
          <span class="badge badge--rarity ${rarityClass}">${pet.rarity}</span>
          <span class="expedition-pet-option__bond">親密 Lv.${pet.bondLevel || 1}</span>
          ${isCompanion ? '<span class="expedition-pet-option__companion">陪伴中</span>' : ''}
          ${liberated ? '<span class="expedition-pet-option__liberated">羈絆解放</span>' : ''}
          ${onExp ? '<span class="expedition-pet-option__busy">探險中</span>' : ''}
        </span>
      </span>
      ${selected ? '<span class="expedition-pet-option__check" aria-hidden="true">✓</span>' : ''}
    </button>`;
}

/** 確認派遣：完整檢查後呼叫原本 startExpedition 邏輯 */
async function confirmExpeditionDispatch(areaId, petId) {
  if (!areaId) {
    showToast('找不到地區資料', 'error');
    return;
  }
  if (!petId) {
    showToast('請先選擇出發寵物。', 'warning');
    return;
  }
  const area = state.expeditionAreas.find((a) => a.id === areaId);
  if (!area) {
    showToast('找不到地區資料', 'error');
    return;
  }
  const pet = getOwnedPets().find((p) => p.id === petId);
  if (!pet) {
    showToast('找不到這隻寵物資料。', 'error');
    return;
  }
  if (state.activeExpedition) {
    showToast('目前已有探險進行中。', 'warning');
    return;
  }
  if ((state.wallet.adventureEnergy ?? 0) < area.energyCost) {
    showToast('冒險能量不足。', 'warning');
    return;
  }
  if (isPetOnExpedition(petId, state.activeExpedition)) {
    showToast('這隻寵物正在探險中。', 'warning');
    return;
  }

  const confirmBtn = document.querySelector(
    '#expedition-dispatch-modal [data-action="dispatch-confirm"]'
  );
  if (confirmBtn) confirmBtn.disabled = true;

  try {
    // 呼叫原本探險開始邏輯（扣能量、建立 expedition 狀態、倒數）
    await startExpedition(petId, areaId, state.expeditionAreas, state.allPets);
    await trackQuest('start_expedition');
    closeExpeditionDispatchModal();
    await onRefresh({ renderMode: ['expedition', 'tasks'] });
    startExpeditionTimer();
    showToast(`已派遣 ${petDisplayName(pet)} 前往${area.name}`, 'success');
    void recordOnboardingEvent('expedition-started', { areaId, petId });
  } catch (err) {
    if (confirmBtn) confirmBtn.disabled = false;
    showToast(err.message || '無法開始探險', 'warning');
  }
}

/* ─── 習慣頁 ─── */

function renderHabitsView() {
  const statsEl = document.getElementById('habit-stats');
  const contentEl = document.getElementById('habit-view-content');
  if (!statsEl || !contentEl) return;

  if (state.habitsLoadError) {
    statsEl.innerHTML = '';
    contentEl.innerHTML = errorStateHtml(
      '習慣資料暫時無法載入',
      '請重新整理或稍後再試。',
      '重新整理',
      'habit-retry'
    );
    document.getElementById('habit-retry')?.addEventListener('click', () => location.reload());
    return;
  }

  const habits = state.habits || [];
  const today = getTodayDateString();
  const stats = state.habitStats || getHabitPageStats(habits, today);
  const reduceMotion = state.userPreferences?.reduceMotion ?? false;

  statsEl.innerHTML = `
    <div class="habit-stat-card">
      <span class="habit-stat-card__label">今日完成</span>
      <span class="habit-stat-card__value">${stats.todayCompleted} / ${stats.todayTotal}</span>
    </div>
    <div class="habit-stat-card">
      <span class="habit-stat-card__label">本週完成率</span>
      <span class="habit-stat-card__value">${stats.weekCompletionRate}%</span>
    </div>
    <div class="habit-stat-card">
      <span class="habit-stat-card__label">最長連續</span>
      <span class="habit-stat-card__value habit-stat-card__value--streak">${stats.maxStreak}${stats.maxStreak > 0 ? ' 天' : ''}</span>
    </div>
    <div class="habit-stat-card">
      <span class="habit-stat-card__label">今日習慣星塵</span>
      <span class="habit-stat-card__value">${stats.todayStardust} / 30</span>
    </div>`;

  if (habits.length === 0) {
    contentEl.innerHTML = emptyStateHtml(
      '🔄',
      '還沒有建立習慣',
      '從一個很小的習慣開始，例如每天背 10 個單字或睡前整理明天任務。',
      '建立第一個習慣',
      'habit-create-first'
    );
    return;
  }

  const todayHabits = getTodayHabits(habits, today);
  const weeklyHabits = getWeeklyHabits(habits);
  const archived = getArchivedHabits(habits);
  const nearGoal = hasWeeklyNearGoal(habits, today);

  let html = '';

  if (stats.allTodayDone && stats.todayTotal > 0) {
    html += `
      <div class="habit-done-banner">
        <p class="habit-done-banner__title">今日習慣都完成了</p>
        <p class="habit-done-banner__desc">穩定的節奏會慢慢累積成成果。</p>
      </div>`;
  }

  html += renderHabitSection(
    '今日習慣',
    todayHabits,
    today,
    reduceMotion,
    false,
    nearGoal
  );

  if (weeklyHabits.length > 0) {
    html += renderHabitSection('本週習慣', weeklyHabits, today, reduceMotion, true, nearGoal);
  }

  if (archived.length > 0) {
    html += `
      <button type="button" class="habit-archived-toggle" data-action="toggle-archived-habits">
        <span>已封存習慣（${archived.length}）</span>
        <span>${archivedHabitsCollapsed ? '展開' : '收合'}</span>
      </button>`;
    if (!archivedHabitsCollapsed) {
      html += `<div class="habit-list">${archived.map((h) => renderHabitCard(h, today, reduceMotion, true)).join('')}</div>`;
    }
  }

  contentEl.innerHTML = html;
}

function renderHabitSection(title, habitList, today, reduceMotion, weeklyOnly, showNearHint) {
  if (!habitList.length) {
    return '';
  }

  const nearHint = showNearHint && weeklyOnly && hasWeeklyNearGoal(habitList, today)
    ? '<span class="notification-dot notification-dot--hint" aria-hidden="true"></span>'
    : '';

  return `
    <section class="habit-section page-section">
      <div class="habit-section__header">
        <h2 class="habit-section__title">${escapeHtml(title)} <span class="section-count">${habitList.length}</span></h2>
        ${nearHint ? `<span class="habit-section__hint">${nearHint}</span>` : ''}
      </div>
      <div class="habit-list">${habitList.map((h) => renderHabitCard(h, today, reduceMotion, false)).join('')}</div>
    </section>`;
}

function renderHabitCard(habit, today, reduceMotion, isArchived) {
  const category = getCategoryById(habit.categoryId, state.categories);
  const catColor = category?.color || 'gray';
  const streak = getHabitStreak(habit, today);
  const streakLabel = formatStreakLabel(habit, streak);
  const doneToday = isHabitCompletedToday(habit, today);
  const monday = getWeekMonday(today);
  const weekCount = getWeeklyCompletionCount(habit, monday);
  const weekTarget = habit.targetPerWeek ?? 1;
  const weekMet = habit.frequency === 'weekly' && isWeeklyGoalMet(habit, monday);

  const freqLabel =
    habit.frequency === 'weekly' ? `每週 ${weekTarget} 次` : '每日';

  const streakHtml =
    streak > 0
      ? `<span class="habit-card__streak">${!reduceMotion ? '<span class="habit-card__streak-glow" aria-hidden="true"></span>' : ''}${escapeHtml(streakLabel)}</span>`
      : '';

  let statusHtml = '';
  let actionsHtml = '';

  if (!isArchived) {
    if (habit.frequency === 'daily') {
      if (doneToday) {
        statusHtml = '<p class="habit-card__status">今日已完成</p>';
        actionsHtml = `<button type="button" class="btn btn--secondary btn--sm" data-action="habit-uncomplete">取消完成</button>`;
      } else {
        actionsHtml = `<button type="button" class="btn btn--primary btn--sm" data-action="habit-complete">完成今日</button>`;
      }
    } else {
      const progressHtml = `<span class="habit-card__progress">本週進度：${weekCount} / ${weekTarget}</span>`;
      statusHtml = weekMet
        ? '<p class="habit-card__status">本週已達標</p>'
        : progressHtml;
      if (!doneToday) {
        actionsHtml = `<button type="button" class="btn btn--primary btn--sm" data-action="habit-complete">記錄今日完成</button>`;
      } else {
        statusHtml = '<p class="habit-card__status">今日已記錄</p>';
        actionsHtml = `<button type="button" class="btn btn--secondary btn--sm" data-action="habit-uncomplete">取消今日</button>`;
      }
    }

    actionsHtml += `
      <button type="button" class="btn btn--ghost btn--sm" data-action="habit-edit">編輯</button>
      <button type="button" class="btn btn--ghost btn--sm" data-action="habit-archive">封存</button>`;
  }

  return `
    <article class="habit-card ${doneToday ? 'habit-card--done' : ''}" data-id="${escapeHtml(habit.id)}">
      <div class="habit-card__header">
        <h3 class="habit-card__name">${escapeHtml(habit.name)}</h3>
        ${streakHtml}
      </div>
      ${habit.description ? `<p class="habit-card__desc">${escapeHtml(habit.description)}</p>` : ''}
      <div class="habit-card__badges">
        <span class="badge badge--category badge--category-${catColor}">${formatCategoryLabel(category)}</span>
        <span class="badge badge--habit-freq">${freqLabel}</span>
      </div>
      <div class="habit-card__meta">
        ${habit.frequency === 'weekly' && !isArchived ? `<span>本週：${weekCount} / ${weekTarget}</span>` : ''}
      </div>
      ${statusHtml}
      ${!isArchived ? `<div class="habit-card__actions">${actionsHtml}</div>` : ''}
    </article>`;
}

function openHabitForm(habitId = null) {
  const isEdit = !!habitId;
  const habit = isEdit ? (state.habits || []).find((h) => h.id === habitId) : null;
  const categories = state.categories || [];

  const freq = habit?.frequency || 'daily';
  const target = habit?.targetPerWeek ?? 3;

  const categoryOptions = categories
    .map(
      (c) =>
        `<option value="${escapeHtml(c.id)}" ${habit?.categoryId === c.id || (!habit && c.id === 'general') ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
    )
    .join('');

  const targetOptions = [1, 2, 3, 4, 5, 6, 7]
    .map((n) => `<option value="${n}" ${target === n ? 'selected' : ''}>每週 ${n} 次</option>`)
    .join('');

  openModal(`
    <h2 class="modal-title">${isEdit ? '編輯習慣' : '新增習慣'}</h2>
    <form id="habit-form" class="form task-form">
      <label class="form-label" for="habit-name">習慣名稱</label>
      <input class="form-input" id="habit-name" type="text" maxlength="80" value="${escapeHtml(habit?.name || '')}" required placeholder="例如：每天背單字" />

      <label class="form-label" for="habit-desc">習慣說明</label>
      <textarea class="form-textarea" id="habit-desc" rows="2" placeholder="可選填">${escapeHtml(habit?.description || '')}</textarea>

      <label class="form-label" for="habit-category">分類</label>
      <select class="form-select" id="habit-category">${categoryOptions}</select>

      <label class="form-label" for="habit-frequency">頻率</label>
      <select class="form-select" id="habit-frequency">
        <option value="daily" ${freq === 'daily' ? 'selected' : ''}>每日</option>
        <option value="weekly" ${freq === 'weekly' ? 'selected' : ''}>每週</option>
      </select>

      <div id="habit-target-wrap" ${freq === 'weekly' ? '' : 'hidden'}>
        <label class="form-label" for="habit-target">每週目標</label>
        <select class="form-select" id="habit-target">${targetOptions}</select>
      </div>

      <p id="habit-form-error" class="form-error" hidden></p>

      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="habit-form-cancel">取消</button>
        <button type="submit" class="btn btn--primary">${isEdit ? '儲存' : '建立'}</button>
      </div>
    </form>
  `);

  const freqSelect = document.getElementById('habit-frequency');
  const targetWrap = document.getElementById('habit-target-wrap');
  freqSelect?.addEventListener('change', () => {
    if (targetWrap) targetWrap.hidden = freqSelect.value !== 'weekly';
  });

  document.getElementById('habit-form-cancel')?.addEventListener('click', closeModal);

  document.getElementById('habit-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('habit-form-error');
    const name = document.getElementById('habit-name')?.value?.trim();
    const description = document.getElementById('habit-desc')?.value?.trim();
    const categoryId = document.getElementById('habit-category')?.value;
    const frequency = document.getElementById('habit-frequency')?.value;
    const targetPerWeek = document.getElementById('habit-target')?.value;

    const payload = { name, description, categoryId, frequency, targetPerWeek: Number(targetPerWeek) };
    const result = isEdit
      ? await updateHabit(habitId, payload)
      : await createHabit(payload);

    if (result.success) {
      closeModal();
      await onRefresh();
      renderHabitsView();
      showToast(isEdit ? '習慣已更新' : '習慣已建立', 'success');
      await handleAchievementCheckAfterAction();
    } else {
      if (errEl) {
        errEl.textContent = result.error || '儲存失敗';
        errEl.hidden = false;
      } else {
        showToast(result.error || '儲存失敗', 'error');
      }
    }
  });
}

/* ─── 更多 / 成就頁 ─── */

function renderWorkshopView() {
  if (!state) return;

  const summaryEl = document.getElementById('workshop-summary');
  const contentEl = document.getElementById('workshop-content');
  if (!summaryEl || !contentEl) return;

  const wallet = state.wallet || {};
  const inventory = state.inventory || { items: {}, itemUsageLogs: {} };
  const materialsCatalog = state.materialsCatalog || [];
  const craftables = state.craftablesCatalog || getEnabledCraftables();
  const materialCounts = getMaterialInventory(wallet);
  const itemCounts = getItemInventory(inventory);

  const knownMaterialIds = new Set(materialsCatalog.map((m) => m.id));
  const extraMaterialIds = Object.keys(materialCounts).filter((id) => !knownMaterialIds.has(id));
  const allMaterialEntries = [
    ...materialsCatalog.map((m) => ({ ...m, amount: materialCounts[m.id] || 0 })),
    ...extraMaterialIds.map((id) => ({
      ...getMaterialInfo(id),
      amount: materialCounts[id] || 0,
    })),
  ];

  const totalMaterials = allMaterialEntries.reduce((sum, m) => sum + (m.amount || 0), 0);
  const bondItems = craftables.filter(
    (c) => c.type === 'bond_item' || c.type === 'favorite_bond_item'
  );
  const totalItems = bondItems.reduce((sum, c) => sum + (itemCounts[c.id] || 0), 0);

  summaryEl.innerHTML = `
    <div class="workshop-summary__grid">
      <div class="workshop-summary__stat">
        <span class="workshop-summary__label">材料總數</span>
        <span class="workshop-summary__value">${totalMaterials}</span>
      </div>
      <div class="workshop-summary__stat">
        <span class="workshop-summary__label">道具庫存</span>
        <span class="workshop-summary__value">${totalItems}</span>
      </div>
    </div>
    <p class="workshop-summary__hint">使用探險取得的材料製作禮物，提升寵物親密度。</p>`;

  if (workshopTab === 'materials') {
    if (allMaterialEntries.length === 0) {
      contentEl.innerHTML = emptyStateHtml(
        '目前還沒有材料',
        '派遣寵物探險，可以帶回製作禮物的材料。'
      );
      return;
    }

    contentEl.innerHTML = `
      <div class="workshop-material-list">
        ${allMaterialEntries
          .map((mat) => {
            const tags = getFutureTagLabels(mat.futureTags || []).slice(0, 3);
            const empty = (mat.amount || 0) === 0;
            return `
              <article class="workshop-material-card card ${empty ? 'workshop-material-card--empty' : ''}">
                <div class="workshop-material-card__header">
                  <h3>${escapeHtml(mat.name)}</h3>
                  <span class="rarity-badge rarity-badge--${(mat.rarity || 'n').toLowerCase()}">${escapeHtml(mat.rarity || '?')}</span>
                </div>
                <p class="workshop-material-card__qty">數量：<strong>${mat.amount || 0}</strong></p>
                <p class="workshop-material-card__desc">${escapeHtml(mat.description || '')}</p>
                ${mat.sourceArea ? `<p class="workshop-material-card__source">來源：${escapeHtml(mat.sourceArea)}</p>` : ''}
                ${tags.length ? `<div class="workshop-tag-row">${tags.map((t) => `<span class="workshop-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
              </article>`;
          })
          .join('')}
      </div>`;
    return;
  }

  if (workshopTab === 'craft') {
    const enabled = craftables.filter((c) => c.enabled);
    if (enabled.length === 0) {
      contentEl.innerHTML = emptyStateHtml(
        '目前沒有可製作的道具',
        '等取得更多材料後再回來看看。'
      );
      return;
    }

    contentEl.innerHTML = `
      <div class="workshop-craft-list">
        ${enabled
          .map((craftable) => {
            const preview = getCraftingPreview(craftable.id, 1, wallet);
            const maxQty = preview.maxQuantity;
            const enough = preview.canCraft;
            const favoriteHint =
              craftable.type === 'favorite_bond_item'
                ? `<p class="workshop-craft-card__favorite">喜歡的寵物可獲得 +${craftable.effect?.favoriteBonusBondExp ?? craftable.effect?.bondExp ?? 0}</p>`
                : '';

            return `
              <article class="workshop-craft-card card ${enough ? '' : 'workshop-craft-card--disabled'}">
                <div class="workshop-craft-card__header">
                  <h3>${escapeHtml(craftable.name)}</h3>
                  <span class="rarity-badge rarity-badge--${(craftable.rarity || 'n').toLowerCase()}">${escapeHtml(craftable.rarity || '?')}</span>
                </div>
                <p class="workshop-craft-card__effect">${escapeHtml(formatItemEffect(craftable))}</p>
                ${favoriteHint}
                <ul class="workshop-recipe-list">
                  ${preview.materials
                    .map(
                      (m) =>
                        `<li class="${m.enough ? '' : 'workshop-recipe-list__item--missing'}">${escapeHtml(m.name)} <span>${m.have} / ${m.need}</span></li>`
                    )
                    .join('')}
                </ul>
                <div class="workshop-craft-card__actions">
                  <button class="btn btn--primary btn--sm" data-action="craft-item" data-item-id="${craftable.id}" data-qty="1" ${enough ? '' : 'disabled'}>製作 x1</button>
                  ${maxQty >= 5 ? `<button class="btn btn--secondary btn--sm" data-action="craft-item" data-item-id="${craftable.id}" data-qty="5" ${maxQty >= 5 ? '' : 'disabled'}>x5</button>` : ''}
                  ${maxQty > 1 ? `<button class="btn btn--secondary btn--sm" data-action="craft-item" data-item-id="${craftable.id}" data-qty="${maxQty}" ${enough ? '' : 'disabled'}>最大 (${maxQty})</button>` : ''}
                </div>
              </article>`;
          })
          .join('')}
      </div>`;
    return;
  }

  // gift tab
  const ownedPets = (state.enrichedCollection || []).filter((p) => p.owned);
  const availableItems = bondItems.filter((c) => (itemCounts[c.id] || 0) > 0);

  if (ownedPets.length === 0) {
    contentEl.innerHTML = emptyStateHtml(
      '還沒有可以贈送的寵物',
      '先透過召喚獲得第一位夥伴。'
    );
    return;
  }

  if (availableItems.length === 0) {
    contentEl.innerHTML = emptyStateHtml(
      '目前沒有可贈送的道具',
      '先到製作頁使用探險材料製作親密度道具。'
    );
    return;
  }

  if (!selectedGiftPetId || !ownedPets.some((p) => p.id === selectedGiftPetId)) {
    selectedGiftPetId = ownedPets[0].id;
  }
  if (!selectedGiftItemId || !availableItems.some((c) => c.id === selectedGiftItemId)) {
    selectedGiftItemId = availableItems[0].id;
  }

  const selectedPet = ownedPets.find((p) => p.id === selectedGiftPetId);
  const selectedItem = getCraftableInfo(selectedGiftItemId);
  const today = getTodayDateString();
  const dailyUsed = getDailyBondItemUsage(selectedGiftPetId, today, inventory);
  const bonus = getFavoriteBonus(selectedItem, selectedPet);
  const bondProgress = getBondProgress(selectedPet.bondExp ?? 0, selectedPet.bondLevel ?? 1);
  const previewExp = (selectedPet.bondExp ?? 0) + bonus.bondExp;
  const previewLevel = previewExp >= 500 ? 5 : previewExp >= 300 ? 4 : previewExp >= 150 ? 3 : previewExp >= 50 ? 2 : 1;
  const willLevelUp = previewLevel > (selectedPet.bondLevel ?? 1);
  const atDailyLimit = dailyUsed >= DAILY_BOND_ITEM_LIMIT;
  const itemStock = itemCounts[selectedGiftItemId] || 0;

  contentEl.innerHTML = `
    <div class="workshop-gift-layout">
      <section class="workshop-gift-section card">
        <h2 class="section-title">選擇夥伴</h2>
        <div class="workshop-gift-pet-list">
          ${ownedPets
            .map((pet) => {
              const used = getDailyBondItemUsage(pet.id, today, inventory);
              const selected = pet.id === selectedGiftPetId;
              return `
                <button type="button" class="workshop-gift-pet ${selected ? 'workshop-gift-pet--selected' : ''}" data-action="select-gift-pet" data-pet-id="${pet.id}">
                  <div class="workshop-gift-pet__img">${petImageHtml(pet, { size: 'sm' })}</div>
                  <div class="workshop-gift-pet__info">
                    <span class="workshop-gift-pet__name">${escapeHtml(petDisplayName(pet))}</span>
                    ${pet.nickname ? `<span class="pet-original-name pet-original-name--xs">原名：${escapeHtml(petOriginalName(pet))}</span>` : ''}
                    <span class="workshop-gift-pet__meta">Lv.${pet.bondLevel ?? 1} · 今日 ${used}/${DAILY_BOND_ITEM_LIMIT}</span>
                    ${(pet.bondLevel ?? 0) >= 5 ? '<span class="workshop-gift-pet__liberated">羈絆解放</span>' : ''}
                    ${pet.isCompanion ? '<span class="workshop-gift-pet__companion">陪伴中</span>' : ''}
                  </div>
                </button>`;
            })
            .join('')}
        </div>
      </section>

      <section class="workshop-gift-section card">
        <h2 class="section-title">選擇道具</h2>
        <div class="workshop-gift-item-list">
          ${availableItems
            .map((item) => {
              const selected = item.id === selectedGiftItemId;
              const stock = itemCounts[item.id] || 0;
              return `
                <button type="button" class="workshop-gift-item ${selected ? 'workshop-gift-item--selected' : ''}" data-action="select-gift-item" data-item-id="${item.id}">
                  <span class="workshop-gift-item__name">${escapeHtml(item.name)}</span>
                  <span class="workshop-gift-item__stock">x${stock}</span>
                  <span class="workshop-gift-item__effect">${escapeHtml(formatItemEffect(item))}</span>
                </button>`;
            })
            .join('')}
        </div>
      </section>

      <section class="workshop-gift-preview card ${bonus.isFavorite ? 'workshop-gift-preview--favorite' : ''}">
        <h2 class="section-title">贈送預覽</h2>
        <ul class="workshop-gift-preview__list">
          <li>目前親密度：Lv.${selectedPet.bondLevel ?? 1}（${bondProgress.current}/${bondProgress.max || 'MAX'}）</li>
          <li>使用後增加：+${bonus.bondExp}${bonus.isFavorite ? '（喜好加成）' : ''}</li>
          <li>今日已使用：${dailyUsed} / ${DAILY_BOND_ITEM_LIMIT}</li>
          ${willLevelUp ? `<li class="workshop-gift-preview__levelup">預計升級至 Lv.${previewLevel}</li>` : ''}
        </ul>
        <button class="btn btn--primary btn--block" data-action="gift-item" data-item-id="${selectedGiftItemId}" data-pet-id="${selectedGiftPetId}" ${atDailyLimit || itemStock <= 0 ? 'disabled' : ''}>贈送</button>
        ${atDailyLimit ? '<p class="workshop-gift-preview__limit">今天這隻寵物已經收到足夠多禮物了，明天再來吧。</p>' : ''}
      </section>
    </div>`;
}

async function handleWorkshopClick(e) {
  const backBtn = e.target.closest('[data-goto]');
  if (backBtn) {
    switchView(backBtn.dataset.goto);
    return;
  }

  const target = e.target.closest('[data-action]');
  if (!target || !state) return;

  const action = target.dataset.action;

  if (action === 'select-gift-pet') {
    selectedGiftPetId = target.dataset.petId;
    renderWorkshopView();
    return;
  }

  if (action === 'select-gift-item') {
    selectedGiftItemId = target.dataset.itemId;
    renderWorkshopView();
    return;
  }

  if (action === 'craft-item') {
    const itemId = target.dataset.itemId;
    const qty = parseInt(target.dataset.qty, 10) || 1;
    if (target.disabled) {
      showToast('材料不足，無法製作。', 'warning');
      return;
    }
    try {
      const result = await craftItem(itemId, qty);
      if (!result.success) {
        showToast(result.message, 'warning');
        return;
      }
      await trackQuest('craft');
      await onRefresh({ renderMode: ['workshop', 'tasks'] });
      renderWorkshopView();
      showToast(result.message, 'success');
      const card = target.closest('.workshop-craft-card');
      if (card && !state.userPreferences?.reduceMotion) {
        card.classList.add('workshop-craft-card--success');
        setTimeout(() => card.classList.remove('workshop-craft-card--success'), 800);
      }
      await handleAchievementCheckAfterAction();
    } catch (err) {
      showToast(err.message || '製作失敗', 'error');
    }
    return;
  }

  if (action === 'gift-item') {
    const itemId = target.dataset.itemId;
    const petId = target.dataset.petId;
    if (target.disabled) return;
    try {
      const result = await useBondItem(itemId, petId, state.allPets);
      if (!result.success) {
        showToast(result.message, 'warning');
        return;
      }
      await trackQuest('gift_pet');
      await onRefresh({ renderMode: ['workshop', 'tasks', 'collection'] });
      renderWorkshopView();
      if (result.isFavorite) {
        showToast(`牠很喜歡這份禮物！親密度 +${result.bondExp}`, 'success', 3200);
      } else {
        showToast(`親密度提升 +${result.bondExp}`, 'success');
      }
      if (result.leveledUp) {
        setTimeout(() => showToast(`親密度提升到 Lv.${result.newLevel}`, 'success', 2800), 400);
        await notifyBondUnlocks(petId);
      }
      const petCard = document.querySelector(`.workshop-gift-pet[data-pet-id="${petId}"]`);
      if (petCard && !state.userPreferences?.reduceMotion) {
        petCard.classList.add('workshop-gift-pet--bounce');
        setTimeout(() => petCard.classList.remove('workshop-gift-pet--bounce'), 600);
      }
      await handleAchievementCheckAfterAction();
    } catch (err) {
      showToast(err.message || '贈送失敗', 'error');
    }
  }
}

function renderMoreView() {
  renderVersionInfo();

  const summary = state?.achievementSummary;
  const badge = document.getElementById('more-achievements-badge');
  if (badge) {
    const show = (summary?.claimable ?? 0) > 0 || summary?.hasUnseenTitles;
    badge.hidden = !show;
  }

  const dailyBadge = document.getElementById('more-daily-blessing-badge');
  if (dailyBadge) {
    const daily = state.dailyCheckIn;
    const today = getTodayDateString();
    const pending = daily
      ? !hasCheckedInToday(daily, today) || !hasSpunWheelToday(daily, today)
      : true;
    dailyBadge.hidden = !pending;
  }

  const habitsBadge = document.getElementById('more-habits-badge');
  if (habitsBadge) {
    const habitIncomplete = state.habitStats?.hasIncompleteToday ?? false;
    const habitNearGoal = hasWeeklyNearGoal(state.habits || []);
    habitsBadge.hidden = !(habitIncomplete || habitNearGoal);
  }
}

/* ============================================================ *
 * 冒險手冊 View（V2.9.0）
 * 唯讀整合現有資料，詳細區塊預設收合。
 * ============================================================ */

/** 詳細區塊展開狀態（模組級，不入 IndexedDB / 備份；重啟 PWA 後回到預設收合） */
const handbookSectionState = {
  weekly: false,
  records: false,
  companions: false,
  expedition: false,
};

/** 最近一次計算出的手冊模型（同一 App session 內快取，供回到手冊時即時顯示） */
let handbookModel = null;
let handbookRefreshing = false;

function isHandbookActive() {
  return document.getElementById('view-handbook')?.classList.contains('active') ?? false;
}

/** 進入手冊或需要刷新時呼叫：先以現有模型即時渲染，再抓最新時效資料局部刷新 */
function renderHandbookView() {
  const container = document.getElementById('handbook-content');
  if (!container) return;
  if (handbookModel) {
    container.innerHTML = buildHandbookHtml(handbookModel);
  } else {
    container.innerHTML = '<p class="handbook-loading">整理你的冒險成果中…</p>';
  }
  // 只在使用者正停留於手冊、且無 Overlay 時重新生成摘要，避免不必要的背景 render
  if (isHandbookActive() && !isAnyOverlayOpen()) {
    refreshHandbookModel();
  }
}

/** 僅重繪目前模型（不重新抓資料），用於收合切換等純 UI 操作 */
function rerenderHandbookContent() {
  const container = document.getElementById('handbook-content');
  if (!container || !handbookModel) return;
  container.innerHTML = buildHandbookHtml(handbookModel);
}

async function refreshHandbookModel() {
  if (handbookRefreshing) return;
  handbookRefreshing = true;
  try {
    const model = await getAdventureHandbookSummary(state || {});
    handbookModel = model;
    if (isHandbookActive() && !isAnyOverlayOpen()) {
      const container = document.getElementById('handbook-content');
      if (container) container.innerHTML = buildHandbookHtml(model);
    }
  } catch (err) {
    uiDebugLog('[Handbook] refresh failed:', err);
  } finally {
    handbookRefreshing = false;
  }
}

function handleHandbookClick(e) {
  const backBtn = e.target.closest('[data-goto]');
  if (backBtn) {
    switchView(backBtn.dataset.goto);
    return;
  }
  const toggle = e.target.closest('[data-action="handbook-toggle"]');
  if (toggle) {
    const key = toggle.dataset.section;
    if (key && key in handbookSectionState) {
      handbookSectionState[key] = !handbookSectionState[key];
      rerenderHandbookContent();
    }
    return;
  }
  const goto = e.target.closest('[data-action="handbook-goto"]');
  if (goto?.dataset.view) {
    switchView(goto.dataset.view);
  }
}

/* ---------- HTML builders ---------- */

function handbookProgressBar(percent) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  return `<span class="handbook-progress" role="presentation"><span class="handbook-progress__fill" style="width:${pct}%"></span></span>`;
}

function buildHandbookQuickStats(quickStats) {
  if (!Array.isArray(quickStats) || quickStats.length === 0) {
    return `<section class="handbook-summary card" aria-label="成長摘要">
      <p class="handbook-empty">開始完成任務與收集夥伴，這裡就會顯示你的成長摘要。</p>
    </section>`;
  }
  const cards = quickStats.map((s) => `
    <button class="handbook-stat" type="button" data-action="handbook-goto" data-view="${escapeHtml(s.actionView || 'tasks')}">
      <span class="handbook-stat__icon" aria-hidden="true">${escapeHtml(s.icon || '✦')}</span>
      <span class="handbook-stat__label">${escapeHtml(s.label)}</span>
      <span class="handbook-stat__value">${escapeHtml(String(s.value))}</span>
    </button>`).join('');
  return `<section class="handbook-summary card" aria-label="成長摘要">
    <div class="handbook-summary__grid">${cards}</div>
  </section>`;
}

function buildHandbookGoals(goals) {
  const head = '<h2 class="handbook-goals__title">下一步目標</h2>';
  if (!Array.isArray(goals) || goals.length === 0) {
    return `<section class="handbook-goals card" aria-label="下一步目標">
      ${head}
      <p class="handbook-empty">目前沒有進行中的目標，繼續你的冒險就會出現新的挑戰！</p>
    </section>`;
  }
  const cards = goals.map((g) => {
    const unit = g.unit || '';
    const pct = g.target > 0 ? (g.current / g.target) * 100 : (g.status === 'claimable' ? 100 : 0);
    const claimable = g.status === 'claimable';
    const chip = claimable
      ? '<span class="handbook-chip handbook-chip--claimable"><span aria-hidden="true">✓</span> 可領取</span>'
      : '';
    const curDisp = Number.isFinite(g.current) ? Math.min(g.current, g.target) : g.current;
    const count = Number.isFinite(g.current) && Number.isFinite(g.target) && g.target > 0
      ? `<span class="handbook-goal__count">${escapeHtml(String(curDisp))}${escapeHtml(unit)} / ${escapeHtml(String(g.target))}${escapeHtml(unit)}</span>`
      : '';
    return `
    <button class="handbook-goal${claimable ? ' handbook-goal--claimable' : ''}" type="button" data-action="handbook-goto" data-view="${escapeHtml(g.actionView || 'tasks')}">
      <span class="handbook-goal__icon" aria-hidden="true">${escapeHtml(g.icon || '✦')}</span>
      <span class="handbook-goal__body">
        <span class="handbook-goal__title-row">
          <span class="handbook-goal__name">${escapeHtml(g.title || '目標')}</span>
          ${chip}
        </span>
        <span class="handbook-goal__meta">
          ${handbookProgressBar(pct)}
          ${count}
        </span>
        <span class="handbook-goal__hint">${escapeHtml(g.hint || '')}</span>
      </span>
    </button>`;
  }).join('');
  return `<section class="handbook-goals card" aria-label="下一步目標">
    ${head}
    <div class="handbook-goals__list">${cards}</div>
  </section>`;
}

function handbookSection(key, title, collapsedSummary, bodyHtml, available) {
  if (!available) return '';
  const expanded = !!handbookSectionState[key];
  const bodyId = `handbook-section-${key}`;
  return `
  <section class="handbook-section card${expanded ? ' is-expanded' : ''}">
    <button class="handbook-section__header" type="button"
      data-action="handbook-toggle" data-section="${key}"
      aria-expanded="${expanded ? 'true' : 'false'}" aria-controls="${bodyId}">
      <span class="handbook-section__title">${escapeHtml(title)}</span>
      <span class="handbook-section__summary">${collapsedSummary}</span>
      <span class="handbook-section__chevron" aria-hidden="true">▾</span>
    </button>
    <div class="handbook-section__body" id="${bodyId}"${expanded ? '' : ' hidden'}>
      ${bodyHtml}
    </div>
  </section>`;
}

function handbookRow(label, value, chip = '') {
  return `<div class="handbook-row">
    <span class="handbook-row__label">${escapeHtml(label)}</span>
    <span class="handbook-row__value">${value}${chip}</span>
  </div>`;
}

function buildHandbookWeekly(weekly) {
  const parts = [];
  if (weekly.daily.available) parts.push(`每日 ${weekly.daily.completed}/${weekly.daily.total}`);
  if (weekly.weekly.available) parts.push(`每週 ${weekly.weekly.completed}/${weekly.weekly.total}`);
  const summary = parts.length ? escapeHtml(parts.join('・')) : '本週進度';

  const rows = [];
  const claimChip = (n) => n > 0 ? `<span class="handbook-chip handbook-chip--info">可領取 ${n}</span>` : '';
  if (weekly.daily.available) {
    rows.push(handbookRow('每日任務', `${weekly.daily.completed} / ${weekly.daily.total}`, claimChip(weekly.daily.claimable)));
  }
  if (weekly.weekly.available) {
    rows.push(handbookRow('每週任務', `${weekly.weekly.completed} / ${weekly.weekly.total}`, claimChip(weekly.weekly.claimable)));
  }
  if (weekly.habits.available) {
    rows.push(handbookRow('今日習慣', `${weekly.habits.completed} / ${weekly.habits.total}`));
  }
  return handbookSection('weekly', '本週狀態', summary, rows.join(''), weekly.available);
}

function buildHandbookRecords(records) {
  const summary = escapeHtml(`已追蹤 ${records.items.length} 項`);
  const rows = records.items.map((item) => {
    const val = item.note ? `${item.value} ${item.note}` : `${item.value}`;
    return handbookRow(`${item.icon ? item.icon + ' ' : ''}${item.label}`, escapeHtml(String(val)));
  }).join('');
  return handbookSection('records', '長期紀錄', summary, rows, records.available);
}

function buildHandbookCompanions(collection) {
  const c = collection;
  const collSummaryParts = [];
  if (c.collection.available) collSummaryParts.push(`${c.collection.owned}/${c.collection.total}`);
  if (c.maxBond.available) collSummaryParts.push(`最高羈絆 Lv.${c.maxBond.value}`);
  const summary = collSummaryParts.length ? escapeHtml(collSummaryParts.join('・')) : '收藏與夥伴';

  const rows = [];
  if (c.collection.available) rows.push(handbookRow('圖鑑收藏', `${c.collection.owned} / ${c.collection.total}`));
  if (c.milestonesClaimed.available) rows.push(handbookRow('收藏里程碑', `${c.milestonesClaimed.claimed} / ${c.milestonesClaimed.total}`));
  if (c.maxStar.available) rows.push(handbookRow('最高星級', `${'★'.repeat(Math.min(5, c.maxStar.value))}`));
  if (c.maxBond.available) rows.push(handbookRow('最高羈絆', `Lv.${c.maxBond.value}`));
  if (c.bondLiberated.available) rows.push(handbookRow('羈絆解放', `${c.bondLiberated.value} 隻`));

  let rarityHtml = '';
  if (Array.isArray(c.rarities) && c.rarities.length) {
    const chips = c.rarities.map((r) =>
      `<span class="handbook-rarity-chip handbook-rarity-chip--${r.rarity.toLowerCase()}">${r.rarity} ${r.owned}/${r.total}</span>`
    ).join('');
    rarityHtml = `<div class="handbook-rarity-chips">${chips}</div>`;
  }

  let petsHtml = '';
  const petCards = [];
  if (c.companion) {
    petCards.push(`
      <div class="handbook-pet">
        ${petImageHtml(c.companion, { size: 'md', loading: 'lazy' })}
        <span class="handbook-pet__role">陪伴夥伴</span>
        <span class="handbook-pet__name">${escapeHtml(c.companion.displayName || c.companion.name || '夥伴')}</span>
        <span class="handbook-pet__bond">羈絆 Lv.${c.companion.bondLevel ?? 1}</span>
      </div>`);
  }
  if (c.bondPet) {
    petCards.push(`
      <div class="handbook-pet">
        ${petImageHtml(c.bondPet, { size: 'md', loading: 'lazy' })}
        <span class="handbook-pet__role">最高羈絆</span>
        <span class="handbook-pet__name">${escapeHtml(c.bondPet.displayName || c.bondPet.name || '夥伴')}</span>
        <span class="handbook-pet__bond">羈絆 Lv.${c.bondPet.bondLevel ?? 1}</span>
      </div>`);
  }
  if (petCards.length) petsHtml = `<div class="handbook-pets">${petCards.join('')}</div>`;

  const body = `${rows.join('')}${rarityHtml}${petsHtml}`;
  return handbookSection('companions', '收藏與夥伴', summary, body, c.available);
}

function buildHandbookExpedition(exp) {
  const summary = exp.averageExploration != null
    ? escapeHtml(`平均探索度 ${exp.averageExploration}%`)
    : '探險與工坊';

  const areaRows = (exp.areas || []).map((a) => {
    const target = a.nextMilestonePercent ?? 100;
    return `<div class="handbook-area">
      <div class="handbook-area__head">
        <span class="handbook-area__name">${escapeHtml(a.icon)} ${escapeHtml(a.name)}</span>
        <span class="handbook-area__pct">${a.progress}%${a.claimableCount > 0 ? ' <span class="handbook-chip handbook-chip--info">可領取</span>' : ''}</span>
      </div>
      ${handbookProgressBar(a.progress)}
    </div>`;
  }).join('');

  const extraRows = [];
  if (exp.closestArea) {
    extraRows.push(handbookRow('最接近里程碑', `${escapeHtml(exp.closestArea.name)}（${exp.closestArea.percent}%）`));
  }
  if (exp.active) {
    const activeText = `${escapeHtml(exp.active.areaName)}・${escapeHtml(exp.active.petName)}`;
    extraRows.push(handbookRow('進行中探險', activeText));
  } else {
    extraRows.push(handbookRow('進行中探險', '目前沒有派遣'));
  }
  if (exp.craftCount.available) extraRows.push(handbookRow('工坊製作', `${exp.craftCount.value} 次`));
  if (exp.materialKinds.available) extraRows.push(handbookRow('材料種類', `${exp.materialKinds.value} 種`));

  const body = `${areaRows}<div class="handbook-area-extra">${extraRows.join('')}</div>`;
  return handbookSection('expedition', '探險與工坊', summary, body, exp.available);
}

function buildHandbookHtml(model) {
  if (!model) return '<p class="handbook-loading">整理你的冒險成果中…</p>';
  return [
    buildHandbookQuickStats(model.quickStats),
    buildHandbookGoals(model.nextGoals),
    buildHandbookWeekly(model.weekly),
    buildHandbookRecords(model.records),
    buildHandbookCompanions(model.collection),
    buildHandbookExpedition(model.expedition),
  ].join('');
}

function bindAchievementClaimAll() {
  document.getElementById('achievement-summary')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="claim-all-achievements"]');
    if (!btn || btn.disabled) return;
    e.preventDefault();
    handleClaimAllAchievements();
  });
}

async function handleClaimAllAchievements() {
  const btn = document.querySelector('[data-action="claim-all-achievements"]');
  if (btn?.disabled) return;
  if (btn) btn.disabled = true;

  try {
    const result = await claimAllAchievementRewards(state?.allPets || []);
    if (!result.success) {
      showToast(
        result.error || '領取失敗',
        result.error === '目前沒有可領取的成就' ? 'info' : 'error'
      );
      state.achievementSummary = await getAchievementSummary(state?.allPets || []);
      renderAchievementsView();
      return;
    }

    await onRefresh({ renderMode: ['achievements', 'tasks'] });

    const rewards = result.rewards || {};
    const materialText = formatAchievementReward(rewards);
    const hasWalletReward = (rewards.stardust || 0) > 0 || (rewards.adventureEnergy || 0) > 0;

    if (hasWalletReward) {
      showRewardToast(rewards.stardust || 0, rewards.adventureEnergy || 0);
    }

    const detail = materialText && materialText !== '無' && !hasWalletReward
      ? `：${materialText}`
      : materialText && materialText !== '無' && hasWalletReward
        ? `（另含 ${materialText}）`
        : '';

    showToast(`已一次領取 ${result.count} 個成就獎勵${detail}`, 'success', 3500);

    state.achievementSummary = await getAchievementSummary(state?.allPets || []);
    renderAchievementsView();
    renderNavBadges();
  } catch (err) {
    showToast(err.message || '領取失敗', 'error');
    if (btn) btn.disabled = false;
  }
}

async function refreshAchievementsView() {
  if (!state) return;
  if (onAchievementCheck) {
    await onAchievementCheck();
  }
  state.achievementSummary = await getAchievementSummary(state.allPets || []);
  renderAchievementsView();
  renderNavBadges();
}

function renderAchievementsView() {
  const summary = state.achievementSummary;
  const summaryEl = document.getElementById('achievement-summary');
  const titleBarEl = document.getElementById('achievement-title-bar');
  const listEl = document.getElementById('achievement-list');

  document.querySelectorAll('#achievement-filters .filter-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.achFilter === achievementFilter);
  });

  if (!summary?.catalogLoaded) {
    if (summaryEl) {
      summaryEl.innerHTML = errorStateHtml(
        '成就資料無法載入',
        '請確認網路連線後重新整理，或稍後再試。',
        '重新整理',
        'achievement-retry'
      );
      document.getElementById('achievement-retry')?.addEventListener('click', () => location.reload());
    }
    if (titleBarEl) titleBarEl.innerHTML = '';
    if (listEl) listEl.innerHTML = '';
    return;
  }

  if (summaryEl) {
    const claimAllBtn = summary.claimable > 0
      ? `<div class="achievement-summary__actions">
          <button type="button" class="btn btn--primary btn--block btn--claim-all" data-action="claim-all-achievements">
            一次領取全部獎勵（${summary.claimable}）
          </button>
        </div>`
      : '';

    summaryEl.innerHTML = `
      <div class="achievement-summary__stats">
        <div class="achievement-summary__stat">
          <span class="achievement-summary__label">已解鎖</span>
          <span class="achievement-summary__value">${summary.unlocked} / ${summary.total}</span>
        </div>
        <div class="achievement-summary__stat">
          <span class="achievement-summary__label">完成率</span>
          <span class="achievement-summary__value">${summary.completionRate}%</span>
        </div>
        <div class="achievement-summary__stat">
          <span class="achievement-summary__label">可領取</span>
          <span class="achievement-summary__value achievement-summary__value--claimable">${summary.claimable}</span>
        </div>
      </div>
      <div class="achievement-summary__progress">
        <div class="progress-bar">
          <div class="progress-bar__fill progress-bar__fill--achievement" style="width:${summary.completionRate}%"></div>
        </div>
      </div>
      ${claimAllBtn}`;
  }

  const currentTitle = summary.equippedTitle?.name || '尚未設定稱號';
  const titleValueClass = summary.equippedTitle
    ? 'achievement-title-bar__value'
    : 'achievement-title-bar__value achievement-title-bar__value--empty';
  if (titleBarEl) {
    titleBarEl.innerHTML = `
      <div class="achievement-title-bar__row">
        <div>
          <p class="achievement-title-bar__label">目前稱號</p>
          <p class="${titleValueClass}">${escapeHtml(currentTitle)}</p>
        </div>
        <button class="btn btn--secondary btn--sm" data-action="open-titles" type="button">稱號管理</button>
      </div>`;
  }

  let items = summary.items || [];

  if (achievementFilter === 'done') {
    items = items.filter((i) => i.status === 'claimed');
  } else if (achievementFilter === 'pending') {
    items = items.filter((i) => i.status === 'locked');
  } else if (achievementFilter === 'claimable') {
    items = items.filter((i) => i.status === 'claimable');
  } else if (achievementFilter !== 'all') {
    items = items.filter((i) => i.achievement.category === achievementFilter);
  }

  if (listEl) {
    if (items.length === 0) {
      listEl.innerHTML = emptyStateHtml('🏅', '沒有符合的成就', '試試其他分類篩選。');
    } else {
      listEl.innerHTML = items.map(renderAchievementCard).join('');
    }
  }
}

function renderAchievementCard(item) {
  const { achievement, progress, target, percent, status } = item;
  const cat = achievement.category;
  const icon = CATEGORY_ICONS[cat] || '🏅';
  const catLabel = CATEGORY_LABELS[cat] || cat;
  const rewardText = formatAchievementReward(achievement.reward);
  const titleText = achievement.titleReward
    ? `稱號：${achievement.titleReward}`
    : '';

  let statusHtml = '';
  if (status === 'claimed') {
    statusHtml = '<span class="achievement-card__status achievement-card__status--done">已完成</span>';
  } else if (status === 'claimable') {
    statusHtml = `<button class="btn btn--primary btn--sm achievement-card__claim" data-action="claim-achievement" data-id="${achievement.id}" type="button">領取獎勵</button>`;
  } else {
    statusHtml = '<span class="achievement-card__status achievement-card__status--locked">未完成</span>';
  }

  return `
    <article class="achievement-card card achievement-card--${status}">
      <div class="achievement-card__header">
        <span class="achievement-card__icon">${icon}</span>
        <div class="achievement-card__titles">
          <h3 class="achievement-card__name">${escapeHtml(achievement.name)}</h3>
          <span class="achievement-card__category">${catLabel}</span>
        </div>
      </div>
      <p class="achievement-card__desc">${escapeHtml(achievement.description)}</p>
      <div class="achievement-card__progress">
        <div class="achievement-card__progress-label">
          <span>進度</span>
          <span>${Math.min(progress, target)} / ${target}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-bar__fill" style="width:${percent}%"></div>
        </div>
      </div>
      <div class="achievement-card__rewards">
        <p><span class="achievement-card__reward-label">獎勵</span> ${escapeHtml(rewardText)}</p>
        ${titleText ? `<p><span class="achievement-card__reward-label">稱號</span> ${escapeHtml(titleText)}</p>` : ''}
      </div>
      <div class="achievement-card__footer">${statusHtml}</div>
    </article>`;
}

function openTitleManagementModal() {
  const summary = state.achievementSummary;
  if (!summary?.titlesLoaded) {
    showToast('稱號資料暫時無法載入', 'error');
    return;
  }

  const titles = summary.titles || [];
  const unlocked = new Set(summary.state?.unlockedTitleIds || []);
  const equipped = summary.state?.equippedTitleId;

  const listHtml = titles.map((t) => {
    const isUnlocked = unlocked.has(t.id);
    const isEquipped = equipped === t.id;
    return `
      <div class="title-item ${isUnlocked ? '' : 'title-item--locked'} ${isEquipped ? 'title-item--equipped' : ''}">
        <div class="title-item__info">
          <span class="title-item__name">${isUnlocked ? escapeHtml(t.name) : '？？？'}</span>
          ${isEquipped ? '<span class="title-item__badge">使用中</span>' : ''}
        </div>
        ${
          isUnlocked
            ? `<button class="btn btn--secondary btn--sm" data-title-id="${t.id}" type="button">${isEquipped ? '已裝備' : '裝備'}</button>`
            : '<span class="title-item__lock">🔒</span>'
        }
      </div>`;
  }).join('');

  openModal(`
    <div class="title-modal">
      <h2 class="modal-title">稱號管理</h2>
      <p class="title-modal__desc">稱號僅供展示，不影響遊戲數值。</p>
      <div class="title-list">${listHtml}</div>
      <button class="btn btn--ghost btn--block" id="btn-clear-title" type="button">清除稱號</button>
    </div>
  `);

  document.querySelectorAll('.title-item .btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const titleId = btn.dataset.titleId;
      if (!titleId || btn.textContent === '已裝備') return;
      const result = await equipTitle(titleId);
      if (result.success) {
        await onRefresh({ renderMode: ['achievements', 'collection', 'tasks'] });
        closeModal();
        showToast(`已設定稱號：${result.title.name}`, 'success');
      } else {
        showToast(result.error || '設定失敗', 'error');
      }
    });
  });

  document.getElementById('btn-clear-title')?.addEventListener('click', async () => {
    await equipTitle(null);
    await onRefresh({ renderMode: ['achievements', 'collection', 'tasks'] });
    closeModal();
    showToast('已清除稱號', 'info');
  });
}

async function handleAchievementCheckAfterAction() {
  if (!onAchievementCheck) return;
  const result = await onAchievementCheck();
  if (result.newlyUnlocked.length > 0) {
    showAchievementUnlockNotifications(result);
    if (isModalOpen()) {
      await onRefresh();
      return;
    }
    const viewName = getCurrentViewName();
    const modes = viewName === 'tasks' ? ['tasks'] : [viewName, 'tasks'];
    await onRefresh({ renderMode: modes });
  }
}

function showAchievementUnlockNotifications(result) {
  const reduceMotion = state?.userPreferences?.reduceMotion ?? false;
  const { newlyUnlocked, newTitles } = result;

  if (newlyUnlocked.length >= 2) {
    showToast(
      `解鎖 ${newlyUnlocked.length} 個新成就，前往成就頁領取獎勵。`,
      'success',
      3500
    );
    return;
  }

  const ach = newlyUnlocked[0];
  if (!ach) return;

  if (reduceMotion) {
    const title = newTitles[0];
    const msg = title
      ? `成就解鎖：${ach.name}（稱號：${title.name}）`
      : `成就解鎖：${ach.name}`;
    showToast(msg, 'success', 3500);
    return;
  }

  showToast(`成就解鎖：${ach.name}`, 'success', 3000);
  if (newTitles[0]) {
    setTimeout(() => {
      showToast(`你獲得了稱號：${newTitles[0].name}`, 'success', 3000);
    }, 800);
  }
}

/* ─── 設定頁 ─── */

function formatBackupDateTime(isoString) {
  if (!isoString) return '無資料';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '無資料';
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resetImportUI() {
  pendingImportBackup = null;
  pendingImportFileName = '';
  pendingImportWarnings = [];

  const fileInput = document.getElementById('import-file-input');
  if (fileInput) fileInput.value = '';

  setImportElementHidden('import-idle-hint', false);
  setImportElementHidden('import-loading-hint', true);
  setImportElementHidden('import-error-hint', true);
  setImportElementHidden('import-preview', true);
  setImportElementHidden('import-restoring-hint', true);
  setImportElementHidden('import-success-panel', true);
  setImportElementHidden('btn-import-select', false);

  const errorEl = document.getElementById('import-error-hint');
  if (errorEl) errorEl.textContent = '';

  const warningEl = document.getElementById('import-preview-warning');
  if (warningEl) {
    warningEl.textContent = '';
    warningEl.hidden = true;
  }
}

function setImportElementHidden(id, hidden) {
  const el = document.getElementById(id);
  if (el) el.hidden = hidden;
}

function renderImportPreview(preview, warnings = []) {
  setText('import-preview-filename', preview.fileName);
  setText('import-preview-version', preview.appVersion);
  setText('import-preview-exported-at', formatBackupDateTime(preview.exportedAt));
  setText('import-preview-tasks', preview.taskCount);
  setText('import-preview-completed-tasks', preview.completedTaskCount);
  setText('import-preview-habits', preview.habitCount);
  setText('import-preview-collection', preview.collectionCount);
  setText(
    'import-preview-total-pets',
    preview.totalPets != null ? String(preview.totalPets) : '無資料'
  );
  setText('import-preview-stardust', preview.stardust);
  setText('import-preview-energy', preview.adventureEnergy);
  setText('import-preview-expeditions', preview.expeditionCount);
  setText('import-preview-achievements', preview.unlockedAchievementCount);
  setText('import-preview-titles', preview.unlockedTitleCount);

  const warningEl = document.getElementById('import-preview-warning');
  if (warningEl) {
    if (warnings.length > 0) {
      warningEl.textContent = warnings.join(' ');
      warningEl.hidden = false;
    } else {
      warningEl.textContent = '';
      warningEl.hidden = true;
    }
  }

  setImportElementHidden('import-idle-hint', true);
  setImportElementHidden('import-loading-hint', true);
  setImportElementHidden('import-error-hint', true);
  setImportElementHidden('import-preview', false);
  setImportElementHidden('import-restoring-hint', true);
  setImportElementHidden('import-success-panel', true);
  setImportElementHidden('btn-import-select', false);
}

function showImportError(message) {
  const errorEl = document.getElementById('import-error-hint');
  if (errorEl) errorEl.textContent = message;

  setImportElementHidden('import-idle-hint', true);
  setImportElementHidden('import-loading-hint', true);
  setImportElementHidden('import-error-hint', false);
  setImportElementHidden('import-preview', true);
  setImportElementHidden('import-restoring-hint', true);
  setImportElementHidden('import-success-panel', true);
  setImportElementHidden('btn-import-select', false);
}

async function handleImportFileSelect(file) {
  if (!file) return;

  setImportElementHidden('import-idle-hint', true);
  setImportElementHidden('import-loading-hint', false);
  setImportElementHidden('import-error-hint', true);
  setImportElementHidden('import-preview', true);
  setImportElementHidden('import-success-panel', true);

  try {
    const rawBackup = await readBackupFile(file);
    const validation = validateBackup(rawBackup);

    if (!validation.valid) {
      showImportError(validation.error || '這不是有效的 QuestNote 備份檔。');
      showToast(validation.error || '這不是有效的 QuestNote 備份檔。', 'error');
      return;
    }

    const normalized = normalizeBackupPayload(rawBackup);
    pendingImportBackup = normalized;
    pendingImportFileName = file.name;
    pendingImportWarnings = validation.warnings || [];

    const preview = previewBackup(normalized, {
      fileName: file.name,
      totalPets: state?.allPets?.length ?? null,
    });

    renderImportPreview(preview, validation.warnings || []);
  } catch (err) {
    const message = err?.message || '讀取備份檔失敗';
    showImportError(message);
    showToast(message, 'error');
  }
}

function initImportBackupHandlers() {
  const fileInput = document.getElementById('import-file-input');
  const selectBtn = document.getElementById('btn-import-select');
  const restoreBtn = document.getElementById('btn-import-restore');
  const reloadBtn = document.getElementById('btn-import-reload');

  resetImportUI();

  selectBtn?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImportFileSelect(file);
    }
  });

  restoreBtn?.addEventListener('click', () => {
    if (!pendingImportBackup) {
      showToast('請先選擇有效的備份檔', 'warning');
      return;
    }
    handleRestoreBackup();
  });

  reloadBtn?.addEventListener('click', () => {
    window.location.reload();
  });
}

async function handleRestoreBackup() {
  if (!pendingImportBackup) return;

  const hasNewerVersionWarning = pendingImportWarnings.some((w) => w.includes('較新的版本'));

  openConfirmModal(
    '恢復備份',
    '匯入後會覆蓋目前所有 QuestNote 資料，確定要繼續嗎？',
    () => {
      proceedRestoreAfterFirstConfirm(hasNewerVersionWarning);
    },
    { confirmLabel: '繼續', danger: true }
  );
}

async function proceedRestoreAfterFirstConfirm(hasNewerVersionWarning) {
  setImportElementHidden('import-preview', true);
  setImportElementHidden('btn-import-select', true);
  setImportElementHidden('import-restoring-hint', false);

  const autoBackup = await createAutoBackupBeforeImport();
  if (!autoBackup.success) {
    setImportElementHidden('import-restoring-hint', true);
    if (pendingImportBackup) {
      setImportElementHidden('import-preview', false);
    }
    setImportElementHidden('btn-import-select', false);
    showImportError('目前資料自動備份失敗，為了保護資料，本次匯入已取消。');
    showToast('目前資料自動備份失敗，為了保護資料，本次匯入已取消。', 'error');
    return;
  }

  setImportElementHidden('import-restoring-hint', true);

  const secondMessage = hasNewerVersionWarning
    ? '已發起目前資料備份下載，請確認檔案已儲存且可以讀取。此備份來自較新版本，可能無法完全相容。請再次確認你選擇的是正確備份檔。'
    : '已發起目前資料備份下載，請確認檔案已儲存且可以讀取，再執行恢復。';

  openConfirmModal(
    '最後確認',
    secondMessage,
    async () => {
      await executeRestoreBackup();
    },
    {
      confirmLabel: '確認恢復',
      danger: true,
      onCancel: () => {
        if (pendingImportBackup) {
          setImportElementHidden('import-preview', false);
        }
        setImportElementHidden('btn-import-select', false);
      },
    }
  );
}

async function executeRestoreBackup() {
  if (!pendingImportBackup) return;

  setImportElementHidden('import-preview', true);
  setImportElementHidden('btn-import-select', true);
  setImportElementHidden('import-restoring-hint', false);
  setImportElementHidden('import-success-panel', true);

  try {
    await restoreBackup(pendingImportBackup);
    await dismissOnboardingAfterRestore();
    await onRefresh({ renderMode: 'full' });
    await applyTheme(state?.userPreferences?.theme ?? 'default', { silent: true });
    applyReduceMotionClass(state?.userPreferences?.reduceMotion ?? false);
    await handleAchievementCheckAfterAction();

    setImportElementHidden('import-restoring-hint', true);
    setImportElementHidden('import-success-panel', false);
    setImportElementHidden('import-idle-hint', true);
    setImportElementHidden('import-error-hint', true);

    showToast('備份恢復完成', 'success');
    showToast('建議重新整理 App，確認資料已完整載入。', 'info', 4000);
  } catch (err) {
    console.error('[QuestNote] 恢復備份失敗:', err);
    setImportElementHidden('import-restoring-hint', true);
    setImportElementHidden('import-preview', true);
    setImportElementHidden('btn-import-select', false);
    showImportError('恢復失敗，資料未完整寫入。請重新整理後再試。');
    showToast('恢復失敗，請確認備份檔是否正確。', 'error');
  }
}

function buildVersionInfoHtml({ compact = false, serviceWorkerStatus = '檢查中' } = {}) {
  if (compact) {
    return `
      <dl class="stats-list settings-version__list version-info-list version-info-list--compact">
        <div class="version-info-row stats-row">
          <dt class="version-info-label">目前版本</dt>
          <dd class="version-info-value" data-version-app-value>${escapeHtml(formatDisplayVersion())}</dd>
        </div>
        <div class="version-info-row stats-row">
          <dt class="version-info-label">Service Worker</dt>
          <dd class="version-info-value" data-version-sw-status>${escapeHtml(serviceWorkerStatus)}</dd>
        </div>
      </dl>`;
  }

  return `
    <dl class="stats-list settings-version__list version-info-list">
      <div class="version-info-row stats-row">
        <dt class="version-info-label">目前版本</dt>
        <dd class="version-info-value" data-version-app-value>${escapeHtml(formatDisplayVersion())}</dd>
      </div>
      <div class="version-info-row stats-row">
        <dt class="version-info-label">Cache</dt>
        <dd class="version-info-value version-info-value--mono settings-version__mono" data-version-cache-value>${escapeHtml(CACHE_NAME)}</dd>
      </div>
      <div class="version-info-row stats-row">
        <dt class="version-info-label">更新時間</dt>
        <dd class="version-info-value" data-version-build-value>${escapeHtml(formatBuildTimeLocal())}</dd>
      </div>
      <div class="version-info-row stats-row">
        <dt class="version-info-label">Service Worker</dt>
        <dd class="version-info-value" data-version-sw-status>${escapeHtml(serviceWorkerStatus)}</dd>
      </div>
    </dl>
    <p class="settings-version__note version-info-note" data-version-update-hint>
      若仍看到舊版，請先匯出 JSON 備份，再關閉所有 QuestNote 分頁與主畫面 App 後重新開啟。請勿為了更新而清除網站資料。
    </p>`;
}

function updateVersionInfoServiceWorkerStatus(status) {
  document.querySelectorAll('[data-version-sw-status]').forEach((el) => {
    el.textContent = status;
  });
}

/** 同步渲染版本資訊，再非同步更新 Service Worker 狀態 */
export function renderVersionInfo() {
  const containers = document.querySelectorAll('[data-version-info]');
  uiDebugLog('[VersionInfo] render', {
    appVersion: APP_VERSION,
    cacheName: CACHE_NAME,
    buildTime: BUILD_TIME,
    containers: containers.length,
  });

  if (!containers.length) {
    console.warn('[VersionInfo] No version info container found');
    return;
  }

  containers.forEach((container) => {
    const compact = container.hasAttribute('data-version-info-compact');
    container.innerHTML = buildVersionInfoHtml({ compact, serviceWorkerStatus: '檢查中' });
  });

  setText('settings-footer-note', `QuestNote ${formatDisplayVersion()} — 離線個人任務記事 App`);

  updateServiceWorkerStatusDisplay().catch((error) => {
    console.warn('[VersionInfo] Failed to check service worker:', error);
    updateVersionInfoServiceWorkerStatus('無法確認');
  });
}

function renderSettingsView() {
  renderVersionInfo();

  if (!state) return;

  const { tasks, wallet, collectionProgress, gachaStats, activeExpedition, userPreferences, achievementSummary } = state;
  const completedCount = tasks.filter((t) => t.completed).length;

  setText('settings-task-count', tasks.length);
  setText('settings-completed-count', completedCount);
  setText('settings-stardust', wallet.stardust ?? 0);
  setText('settings-energy', wallet.adventureEnergy ?? 0);
  setText('settings-collection', `${collectionProgress.owned}/${collectionProgress.total}`);
  setText('settings-active-expedition', activeExpedition ? 1 : 0);
  setText('settings-total-pulls', gachaStats.totalPulls ?? 0);

  const achUnlocked = achievementSummary?.unlocked ?? 0;
  const achTotal = achievementSummary?.total ?? 0;
  setText('settings-achievements', `${achUnlocked}/${achTotal}`);

  renderThemePickerState(userPreferences?.theme ?? 'default');

  // 開發測試區：正式環境不可見；僅 localhost／127.0.0.1／::1（不得僅靠 CSS、不得用 ?debug 開正式 PWA）
  const localDevOn = isAuthorLocalDevMode();
  const devSection = document.getElementById('dev-tools-section');
  if (devSection) {
    if (localDevOn) {
      devSection.hidden = false;
    } else {
      // 正式環境：直接從 DOM 移除，避免 hidden／CSS 被繞過
      devSection.remove();
    }
  }
  const cheatTools = document.getElementById('dev-cheat-tools');
  if (cheatTools) cheatTools.hidden = !localDevOn;
  const revealTests = document.getElementById('dev-reveal-tests');
  if (revealTests) revealTests.hidden = !localDevOn;
}

async function updateServiceWorkerStatusDisplay() {
  let status = '無法確認';

  try {
    if (!('serviceWorker' in navigator)) {
      status = '未支援';
    } else {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        status = '未啟用';
      } else if (reg.waiting) {
        status = '有更新待套用';
      } else if (reg.active) {
        status = '已啟用';
      } else if (reg.installing) {
        status = '安裝中';
      } else {
        status = navigator.serviceWorker.controller ? '已啟用' : '未啟用';
      }
    }
  } catch (err) {
    console.warn('[VersionInfo] Failed to check service worker:', err);
    status = '無法確認';
  }

  updateVersionInfoServiceWorkerStatus(status);
}

async function handleDevUnlock() {
  if (!isDevMode()) return;
  if (!confirm('【開發測試】將 8 隻高稀有寵物加入圖鑑，確定？')) return;

  const added = await unlockDevTestPets();
  await onRefresh({ renderMode: 'full' });
  switchView('collection');
  alert(added > 0 ? `已解鎖 ${added} 隻新寵物（共 8 隻測試寵物已就緒）` : '8 隻測試寵物皆已在圖鑑中');
}

async function handleDevUnlockAll() {
  if (!isDevMode()) return;

  const petIds = (state?.allPets || []).map((p) => p.id);
  if (petIds.length === 0) {
    alert('寵物資料尚未載入，請稍後再試。');
    return;
  }

  if (!confirm(`【開發測試】將全部 ${petIds.length} 隻寵物加入圖鑑，確定？`)) return;

  const { newlyAdded, total } = await unlockAllDevPets(petIds);
  await onRefresh({ renderMode: 'full' });
  switchView('collection');
  alert(
    newlyAdded > 0
      ? `已解鎖 ${newlyAdded} 隻新寵物（全圖鑑 ${total} 隻已就緒）`
      : `全圖鑑 ${total} 隻皆已在圖鑑中`
  );
}

async function handleDevStardust() {
  if (!isDevMode()) return;

  const total = await grantDevStardust();
  await onRefresh({ renderMode: ['tasks', 'gacha'] });
  alert(`已獲得 100,000 星塵！目前共 ${total.toLocaleString()} 星塵`);
}

async function handleDevCompanionBond() {
  if (!isDevMode()) return;

  const result = await raiseDevCompanionBond();
  if (!result.success) {
    alert(result.message);
    return;
  }

  await onRefresh({ renderMode: ['tasks', 'collection'] });

  if (result.maxed) {
    showToast('陪伴寵物親密度已滿級 Lv.5', 'info');
    return;
  }

  await notifyBondUnlocks(result.petId);
  showToast(`陪伴寵物親密度提升到 Lv.${result.newLevel}`, 'success');
}

async function handleDevExpedition() {
  if (!isDevMode()) return;

  try {
    await devForceCompleteExpedition();
    await onRefresh({ renderMode: ['expedition', 'tasks'] });
    switchView('expedition');
    alert('探險已立即結束，可前往探險頁領取獎勵。');
  } catch (err) {
    alert(err.message || '沒有進行中的探險');
  }
}

async function handleDevResetDailyBlessing() {
  if (!isDevMode()) return;
  if (!confirm('【開發測試】重置今日每日祝福（簽到與轉盤），確定？')) return;

  const result = await resetDevDailyBlessing();
  dailyBlessingCollapsed = false;
  await onRefresh({ renderMode: ['tasks', 'gacha'] });
  switchView('tasks');
  alert(result.message);
}

function refreshMailboxAfterDevInject() {
  updateMailboxEntryBadge();
  if (document.getElementById('global-mailbox-modal')?.classList.contains('open')) {
    renderGlobalMailboxModal();
  }
  renderSharedUI();
}

function handleDevMailboxAnnouncement() {
  if (!isAuthorLocalDevMode()) return;
  const result = injectLocalDevAnnouncement();
  if (!result.success) {
    showToast(result.error || '注入失敗', 'warning');
    return;
  }
  refreshMailboxAfterDevInject();
  showToast('已注入本機測試公告', 'success');
}

function handleDevMailboxCompensation() {
  if (!isAuthorLocalDevMode()) return;
  const result = injectLocalDevCompensation();
  if (!result.success) {
    showToast(result.error || '注入失敗', 'warning');
    return;
  }
  refreshMailboxAfterDevInject();
  showToast('已注入本機測試補償（星塵 ×1）', 'success');
}

function handleDevMailboxClear() {
  if (!isAuthorLocalDevMode()) return;
  const result = clearLocalDevMailboxMessages();
  if (!result.success) {
    showToast(result.error || '清除失敗', 'warning');
    return;
  }
  if (mailboxSelectedId?.startsWith('dev-local-')) {
    mailboxSelectedId = null;
  }
  refreshMailboxAfterDevInject();
  showToast(`已清除 ${result.cleared} 封測試信件（已領狀態保留）`, 'info');
}

async function handleReset() {
  openConfirmModal(
    '重置所有資料',
    '所有任務、星塵、圖鑑、抽卡紀錄都將被清除，此操作無法復原。',
    () => {
      openConfirmModal(
        '再次確認',
        '確定要清除所有資料嗎？',
        async () => {
          if (typeof state.onReset === 'function') {
            await state.onReset();
            await onRefresh({ renderMode: 'full' });
            showToast('資料已重置', 'success');
            await showOnboardingAfterReset();
          }
        },
        { confirmLabel: '確定重置', danger: true }
      );
    },
    { confirmLabel: '繼續', danger: true }
  );
}

/* ─── 工具函式 ─── */

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

export { showRewardToast };
