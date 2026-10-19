import { openDailyRace } from './dailyRaceController.js';
import { inviteCompanion, acknowledgeEncounterMigration, getEncounterEconomy } from './encounterEconomyService.js';
/**
 * UI 渲染與互動邏輯
 */
import { initFilterGestures } from './filterGestureController.js';
import { trackUpdateActivity } from './updateActivity.js';
import { claimAllAvailableRewards, isBulkClaimInProgress } from './rewardClaimService.js';
import { initReminders } from './reminderController.js';
import {
  deleteTask,
  toggleTaskComplete,
  addToTodayPlan,
  removeFromTodayPlan,
  toggleSubtaskComplete,
} from './taskService.js';
import { initFeedback } from './feedbackController.js';
import { APP_SHARE_URL, WEBSITE_SHARE_URL, APP_SHARE_DESCRIPTION, APP_SHARE_MESSAGE, shareQuestNote, copyQuestNoteInvitation } from './shareService.js';
import {
  getTodayDateString,
} from './taskFilterService.js';
import {
  setSelectedPoolId,
} from './gachaService.js';
import {
  setCompanion,
  setPetNickname,
  clearPetNickname,
  validatePetNickname,
  getNicknameCharUnits,
  NICKNAME_MAX_UNITS,
  updatePetBondUnlocks,
} from './collectionService.js';
import { getBondUpLine } from './companionService.js';
import { setTheme, applyThemeToDocument, normalizeTheme, setFontSize, applyFontSizeToDocument, normalizeFontSize } from './preferencesService.js';
import { initQuestIconLanguage } from './iconPresentation.js';
import { applyReadingModeToDocument } from './preferencesService.js';
import { initSeniorModeController, syncSeniorPresentation, isSeniorMode, seniorFeedback } from './seniorModeController.js';
import { initTwilightChrome, syncTwilightHome, reactTwilightCompanion } from './twilightPresentation.js';
import { createBondJourneyController } from './bondJourneyController.js';
import { getAwakeningProfile } from './petAwakeningProfiles.js';
import { createAwakeningController } from './petAwakeningController.js';
import { renderAwakeningHome, renderAwakeningGuide } from './petAwakeningView.js';
import { renderBondHome } from './bondJourneyView.js';
import {
  downloadBackup,
} from './backupService.js';
import {
  APP_VERSION,
} from './version.js';
import {
  preloadCompanionImage,
  preloadOwnedPetImages,
} from './imagePreloadService.js';
import { createDeferredRenderGate } from './deferredRenderGate.js';
import { resolveDrawCost } from './poolContentContract.js';
import {
  claimAchievementReward,
  markTitlesSeen,
  markExportedBackup,
} from './achievementService.js';
import { isDevMode, isAuthorLocalDevMode } from './devService.js';
import {
  playPoolDebutPresentation,
} from './themedSummonController.js';
import {
  escapeHtml,
} from './uiHelpers.js';
import {
  isExpeditionTimeComplete,
} from './expeditionService.js';
import {
  archiveHabit,
  hasWeeklyNearGoal,
} from './habitService.js';
import {
  hasCheckedInToday,
  hasSpunWheelToday,
  isWheelSpinning,
} from './dailyCheckInService.js';
import { claimQuestReward } from './questService.js';
import {
  recordOnboardingEvent,
  refreshOnboarding,
} from './onboardingController.js';
import { renderHandbookView, handleHandbookClick, connectHandbookView } from './ui/handbookView.js';
import {
  connectWeeklyReviewView,
  renderWeeklyReviewView,
  renderWeeklyReviewCard,
  handleWeeklyReviewClick,
  handleWeeklyReviewCardAction,
} from './ui/weeklyReviewView.js';
import {
  connectMailboxView,
  getMailboxPayload,
  reloadMailboxState,
  updateMailboxEntryBadge,
  bindGlobalMailboxEntry,
  renderGlobalMailboxModal,
  handleDevMailboxAnnouncement,
  handleDevMailboxCompensation,
  handleDevMailboxClear,
  getMailboxGiftStatus,
  syncGlobalMailbox,
  openGlobalMailbox,
  closeGlobalMailbox,
} from './ui/mailboxView.js';
import {
  connectAchievementsView,
  refreshAchievementsView,
  setAchievementFilter,
  renderAchievementsView,
  openTitleManagementModal,
  handleAchievementCheckAfterAction,
} from './ui/achievementsView.js';
import {
  connectSettingsView,
  initImportBackupHandlers,
  renderVersionInfo,
  renderSettingsView,
  handleDevUnlock,
  handleDevUnlockAll,
  handleDevStardust,
  handleDevCompanionBond,
  handleDevExpedition,
  handleReset,
  runHealthCheckFromSettings,
} from './ui/settingsView.js';
import {
  connectExpeditionView,
  renderExpeditionView,
  startExpeditionTimer,
  stopExpeditionTimer,
  handleExpeditionClick,
  renderExplorationPanel,
  setDispatchSelectedPetIds,
  openExpeditionDispatchModal,
  closeExpeditionDispatchModal,
  renderExpeditionDispatchModal,
} from './ui/expeditionView.js';
import {
  connectHabitsView,
  toggleArchivedHabits,
  renderHabitsView,
  openHabitForm,
} from './ui/habitsView.js';
import {
  connectWorkshopView,
  handleWorkshopTabClick,
  setWorkshopTab,
  clearWorkshopGiftSelection,
  renderWorkshopView,
  handleWorkshopClick,
} from './ui/workshopView.js';
import {
  connectCollectionView,
  handleCollectionClick,
  setCollectionFilter,
  setCollectionSeriesFilter,
  renderCollectionMilestones,
  renderCollectionView,
  openPetDetailModal,
} from './ui/collectionView.js';
import {
  connectGachaView,
  shouldShowAwakenedPresentation,
  handleGachaPoolSelectChange,
  toggleAwakeningGuide,
  getSelectedGachaPool,
  getAvailablePullsForSelectedPool,
  renderGachaView,
  testSummonReveal,
  testSummonRevealByPetId,
  isGachaPullInProgress,
  getUnlockEntryForPool,
  maybePlayPoolDebut,
  updateGachaAffordability,
  handlePull,
  handleTenPull,
  getGachaAffordability,
} from './ui/gachaView.js';
import {
  connectDailyBlessingView,
  expandDailyBlessing,
  toggleDailyBlessing,
  expandQuestPanel,
  toggleQuestPanel,
  selectQuestTab,
  formatDailyRewardBundle,
  buildDailyBlessingCardData,
  renderQuestPanel,
  trackQuest,
  renderDailyBlessingSection,
  renderGachaDailyBlessingEntry,
  handleDailyCheckIn,
  openDailyWheelModal,
  handleDevResetDailyBlessing,
} from './ui/dailyBlessingView.js';
import {
  connectCompanionView,
  handleCompanionPet,
  openPetFeedModal,
  refreshCompanionBubble,
  startCompanionDialogueTimer,
  stopCompanionDialogueTimer,
  bindActivityTracking,
  trackUserActivity,
} from './ui/companionView.js';
import { connectTaskFormView, openTaskForm } from './ui/taskFormView.js';
import {
  connectTaskListView,
  taskListUi,
  expandedTaskIds,
  recentlyCompletedTaskIds,
  handleHabitCompletion,
  renderTasksView,
  formatCategoryLabel,
} from './ui/taskListView.js';
import {
  connectModalHost,
  bindModals,
  dismissModal,
  openModal,
  closeModal,
  openPetImageViewer,
  openConfirmModal,
  petImageHtml,
  openPetImageViewerBySrc,
  closePetImageViewer,
} from './ui/modalHost.js';

export { openModal, closeModal, openPetImageViewer, openPetImageViewerBySrc, closePetImageViewer, petImageHtml };

export { openTaskForm };

export { updateGachaAffordability };

export { renderVersionInfo };

export { getMailboxGiftStatus, syncGlobalMailbox, openGlobalMailbox, closeGlobalMailbox };

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

let onRefresh = null;
let onAchievementCheck = null;
/** initUI 模組級重入防護：成功綁定後不可重複 addEventListener */
let uiInitialized = false;

/** Data is refreshed after a pull, but the hidden collection DOM can wait until entry. */
const collectionRenderGate = createDeferredRenderGate();

let currentTasksView = 'tasks';

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

// 首頁功能中樞：null | 'blessing' | 'quest' | 'titles'（預設全部收合，只顯示圖示）
let homeHubActive = null;

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

  document.getElementById('nickname-clear')?.addEventListener('click', trackUpdateActivity(async () => {
    const result = await clearPetNickname(petId);
    if (!result.success) {
      showToast(result.message || '暱稱儲存失敗，請稍後再試。', 'error');
      return;
    }
    closeModal();
    await onRefresh({ renderMode: ['collection'] });
    openPetDetailModal(petId);
    showToast('暱稱已清除', 'success');
  }));

  document.getElementById('nickname-save')?.addEventListener('click', trackUpdateActivity(async () => {
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
  }));
}

export function showToast(message, type = 'info', duration = 2800) {
  seniorFeedback(message, type);
  if (isSeniorMode()) return;
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

/**
 * View modules under src/ui/ receive ui.js state and helpers here instead of importing ui.js.
 * initUI calls this on every run, so a replaced state reference reaches every module.
 */
function connectViewModules() {
  connectModalHost({ petDisplayName, petOriginalName, showToast, state });
  connectTaskListView({ PRIORITY_LABELS, formatDateTime, notifyBondUnlocks, onRefresh, renderAchievementStrip, renderBondHomeSection, renderHomeHub, setText, showToast, state });
  connectTaskFormView({ closeModal, dismissModal, formatCategoryLabel, isTodayTaskViewMode, onRefresh, openModal, showToast, state });
  connectCompanionView({ bondBadgeHtml, closeModal, isModalOpen, isTasksViewCurrent, notifyBondUnlocks, onRefresh, openModal, openPetImageViewer, openTeachingTarget, petDisplayName, petImageHtml, petOriginalNameHtml, showBondLevelUpToast, showToast, state });
  connectDailyBlessingView({ claimAllButtonHtml, closeModal, onRefresh, openModal, showToast, state, switchView });
  connectGachaView({ RARITY_LABELS, closeModal, collectionRenderGate, encounterActions, onRefresh, openModal, openNicknameModal, petImageHtml, renderGachaDailyBlessingEntry, setText, showToast, state, switchView });
  connectCollectionView({ BOND_NEXT_UNLOCK, BOND_UNLOCK_ITEM_LABELS, bondBadgeHtml, claimAllButtonHtml, closeModal, collectionRenderGate, encounterActions, onRefresh, openModal, openNicknameModal, openPetFeedModal, openPetImageViewer, petDisplayName, petImageHtml, petNameBlockHtml, petOriginalName, setText, showToast, state, switchView });
  connectWorkshopView({ notifyBondUnlocks, onRefresh, petDisplayName, petImageHtml, showToast, state, switchView, trackQuest });
  connectHabitsView({ closeModal, formatCategoryLabel, onRefresh, openModal, showToast, state });
  connectExpeditionView({ claimAllButtonHtml, closeModal, formatDateTime, notifyBondUnlocks, onRefresh, openModal, petDisplayName, petImageHtml, petOriginalName, renderNavBadges, showToast, state, trackQuest });
  connectSettingsView({ applyReduceMotionClass, applyTheme, notifyBondUnlocks, onRefresh, openConfirmModal, renderFontSizePickerState, renderThemePickerState, setText, showToast, state, switchView, uiDebugLog });
  connectAchievementsView({ claimAllButtonHtml, closeModal, getCurrentViewName, isModalOpen, onAchievementCheck, onRefresh, openModal, renderNavBadges, showToast, state });
  connectMailboxView({ claimAllButtonHtml, renderSharedUI, showToast, state, switchView });
  connectWeeklyReviewView({ state, switchView });
  connectHandbookView({ isAnyOverlayOpen, petImageHtml, state, switchView, uiDebugLog });
}

export function initUI(appState, refreshCallback, achievementCheckCallback) {
  // 狀態參考可更新；事件綁定只允許成功完成一次
  state = appState;
  onRefresh = refreshCallback;
  onAchievementCheck = achievementCheckCallback;
  connectViewModules();

  if (uiInitialized) {
    console.warn('[UI] initUI skipped: already initialized');
    return;
  }

  uiInitialized = true;
  try {
    initTwilightChrome();
    const bondJourneyController = createBondJourneyController({ getState: () => state, refresh: (...args) => onRefresh(...args),
      openModal, closeModal, showToast, switchView,
      portrait: (pet) => petImageHtml(pet, { size: 'md', loading: 'eager', eager: true }) });
    bondJourneyController.mount();
    createAwakeningController({ getState: () => state, refresh: (...args) => onRefresh(...args),
      openModal, closeModal, showToast, openDetail: openPetDetailModal,
      portrait: (pet) => petImageHtml(pet, { size: 'md', loading: 'eager', eager: true }),
      navigate: async (action, petId) => {
        const profile = getAwakeningProfile(petId);
        if (!profile) return;
        if (action === 'story') { switchView('collection'); await bondJourneyController.open(petId); }
        if (action === 'bond') { switchView('collection'); openPetFeedModal(state.enrichedCollection.find((pet) => pet.id === petId)); }
        if (action === 'daily') { taskListUi.taskViewMode = 'today'; switchView('tasks'); renderTasksView(); }
        if (action === 'summon') { state.gachaStats = await setSelectedPoolId(profile.poolId); switchView('gacha'); }
        if (action === 'expedition') {
          switchView('expedition');
          if (!state.activeExpedition) {
            openExpeditionDispatchModal(profile.areaId);
            setDispatchSelectedPetIds([petId]); renderExpeditionDispatchModal();
          }
        }
        if (action === 'workshop') {
          await openTeachingTarget({ view: 'workshop', tab: 'craft' });
          document.querySelector(`[data-action="craft-item"][data-item-id="${profile.foodId}"]`)?.closest('article')?.scrollIntoView({ block: 'center' });
        }
      } }).mount();
    initQuestIconLanguage();
    bindNavigation();
    initFilterGestures();
    bindModals();
    bindDelegatedEvents();
    bindActivityTracking();
    bindRewardClaimAll();
    bindGlobalMailboxEntry();
    initFeedback({ navigate: switchView });
    initReminders({ openToday: () => { taskListUi.taskViewMode = 'today'; switchView('tasks'); renderTasksView(); } });
    initSeniorModeController({ getState: () => state, navigate: switchView, addTask: openTaskForm,
      mailbox: openGlobalMailbox, refreshPresentation: () => { void renderAll(); },
      today: () => { taskListUi.taskViewMode = 'today'; taskListUi.activeSmartListId = null; taskListUi.taskCategoryFilter = 'all'; switchView('tasks'); renderTasksView(); syncSeniorPresentation(); } });

    document.getElementById('collection-filters')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      setCollectionFilter(btn.dataset.filter);
      renderCollectionView();
      refreshOnboarding();
    });

    document.getElementById('collection-series-filters')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      setCollectionSeriesFilter(btn.dataset.seriesFilter || 'all');
      renderCollectionView();
    });

    document.getElementById('gacha-pool-select')?.addEventListener('change', trackUpdateActivity(handleGachaPoolSelectChange));

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
      setAchievementFilter(btn.dataset.achFilter);
      renderAchievementsView();
    });

    document.getElementById('task-view-tabs')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-task-view]');
      if (!btn) return;
      taskListUi.taskViewMode = btn.dataset.taskView;
      taskListUi.activeSmartListId = null;
      document.querySelectorAll('#task-view-tabs .segmented-control__btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.taskView === taskListUi.taskViewMode);
        b.setAttribute('aria-selected', b.dataset.taskView === taskListUi.taskViewMode ? 'true' : 'false');
      });
      renderTasksView();
    });

    document.getElementById('task-category-filters')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      taskListUi.taskCategoryFilter = btn.dataset.catFilter;
      renderTasksView();
    });

    document.getElementById('workshop-tabs')?.addEventListener('click', handleWorkshopTabClick);

    renderVersionInfo();
    bindSweetToastDevTest();
  } catch (error) {
    uiInitialized = false;
    throw error;
  }
}

const CLAIM_ALL_LABELS = { blessing: '每日祝福', quests: '冒險任務（每日與每週）',
  collection: '收藏里程碑', exploration: '所有地區探索里程碑', mailbox: '信箱附件', achievements: '成就' };
const CLAIM_CONTROLS = '[data-claim-all], [data-action="claim-quest"], [data-action="claim-achievement"], '
  + '[data-action="mailbox-claim"], [data-action="daily-check-in"], '
  + '[data-action="daily-open-wheel"], #daily-wheel-start, [data-action="claim-exploration-milestone"], '
  + '[data-collection-milestone-action="claim"]';
let bulkClaimBusy = false;

function claimAllButtonHtml(kind, count) {
  if (!(count > 0)) return '';
  return `<button type="button" class="btn btn--secondary btn--sm reward-claim-all" data-claim-all="${kind}"
    aria-label="${CLAIM_ALL_LABELS[kind]}：一鍵領取 ${count} 份獎勵" ${bulkClaimBusy ? 'disabled' : ''}>
    <span>一鍵領取</span><span class="reward-claim-all__count" aria-hidden="true">${count}</span></button>`;
}

function bindRewardClaimAll() {
  document.addEventListener('click', (e) => {
    const control = e.target.closest(CLAIM_CONTROLS);
    if (!control) return;
    if (bulkClaimBusy || isBulkClaimInProgress()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (!control.dataset.claimAll || control.disabled) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    void trackUpdateActivity(() => handleRewardClaimAll(control.dataset.claimAll, control))();
  }, true);
}

async function handleRewardClaimAll(kind, button) {
  if (bulkClaimBusy || isBulkClaimInProgress()) return;
  bulkClaimBusy = true;
  const controls = [...document.querySelectorAll(CLAIM_CONTROLS)].map((el) => [el, el.disabled]);
  controls.forEach(([el]) => { el.disabled = true; });
  const originalLabel = button.innerHTML;
  button.textContent = '領取中…';
  button.setAttribute('aria-busy', 'true');
  try {
    const result = await claimAllAvailableRewards(kind, { allPets: state.allPets || [],
      payload: getMailboxPayload(), ...getMailboxCatalogs(), appVersion: APP_VERSION });
    if (kind === 'mailbox') {
      await reloadMailboxState();
      for (const item of result.results || []) void recordOnboardingEvent('mailbox-claimed', { messageId: item.entry.id });
    }
    await onRefresh({ renderMode: 'current' });
    if (result.count > 0) {
      const rewardText = formatDailyRewardBundle(result.rewards);
      const extraCount = (result.results || []).filter((item) => item.reward?.title || item.reward?.badgeId || item.badge).length;
      const extraText = extraCount ? '，含徽章／稱號' : '';
      const failures = result.failures?.length || 0;
      showToast(`已領取 ${result.count} 份${kind === 'blessing' ? '祝福' : '獎勵'}${rewardText ? `：${rewardText}` : ''}${extraText}${failures ? `；${failures} 份未領取，可再試一次` : ''}`,
        failures ? 'warning' : 'reward', 4200);
      await handleAchievementCheckAfterAction();
    } else {
      showToast(result.error || result.failures?.[0]?.error || '目前沒有可領取的獎勵', result.failures?.length ? 'warning' : 'info');
    }
  } catch (error) {
    showToast(error?.message || '領取未完成，請稍後再試', 'warning');
  } finally {
    bulkClaimBusy = false;
    controls.forEach(([el, disabled]) => { if (el.isConnected) el.disabled = disabled; });
    if (button.isConnected) {
      button.innerHTML = originalLabel;
      button.removeAttribute('aria-busy');
    }
    renderDailyBlessingSection();
    renderQuestPanel();
    renderHomeHub();
    renderCollectionMilestones();
    renderExplorationPanel();
    renderAchievementsView();
    renderGlobalMailboxModal();
    updateMailboxEntryBadge();
  }
}

function bindDelegatedEvents() {
  document.getElementById('view-tasks')?.addEventListener('click', trackUpdateActivity(async (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const card = target.closest('.task-card');
    const id = card?.dataset.id;
    const action = target.dataset.action;

    if (handleWeeklyReviewCardAction(action)) return;

    if (action === 'habit-complete' || action === 'habit-uncomplete') {
      const habitCard = target.closest('.today-habit-card');
      if (habitCard) await handleHabitCompletion(action, habitCard.dataset.id, habitCard);
      return;
    }
    if (action === 'go-habits') {
      switchView('habits');
      return;
    }
    if (action === 'habit-create-first') {
      openHabitForm();
      return;
    }

    if (action === 'home-hub') {
      const hub = target.dataset.hub;
      const willOpen = homeHubActive !== hub;
      homeHubActive = willOpen ? hub : null;
      if (willOpen && hub === 'blessing') {
        expandDailyBlessing();
        renderDailyBlessingSection();
      }
      if (willOpen && hub === 'quest') {
        expandQuestPanel();
        renderQuestPanel();
      }
      renderHomeHub();
      return;
    }

    if (action === 'quest-toggle-collapse') {
      toggleQuestPanel();
      renderQuestPanel();
      return;
    }

    if (action === 'quest-tab') {
      const scope = target.dataset.scope;
      if (selectQuestTab(scope)) {
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
      const encounterDateBefore = state.encounterEconomy?.dailyReceipt?.date;

      if (cardEl && isCompleting && !isSeniorMode()) {
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

      if (target.disabled) return;
      target.disabled = true;
      let result;
      try { result = await toggleTaskComplete(id); }
      catch (error) {
        await onRefresh();
        showToast(error.message || '任務未能儲存，請再試一次。', 'error');
        return;
      } finally { target.disabled = false; }

      if (isCompleting) {
        recentlyCompletedTaskIds.add(id);
        setTimeout(() => recentlyCompletedTaskIds.delete(id), 2500);

      }

      if (isCompleting && !taskBefore?.isTutorial) {
        await trackQuest('complete_task');
      }

      await onRefresh();

      const receipt = state.encounterEconomy?.dailyReceipt;
      const encounterGain = isCompleting && receipt?.source === 'task' && receipt.sourceId === id && receipt.date !== encounterDateBefore ? receipt.amount : 0;
      if (isCompleting && !isSeniorMode()) {
        if (result.reward) showRewardToast(result.reward.amount, result.reward.energy, encounterGain);
        else showToast(`任務已完成${encounterGain && !isSeniorMode() ? ` · 相遇碎片 +${encounterGain}` : ''}`, 'success');
      }

      if (isSeniorMode()) {
        const reward = result.reward;
        seniorFeedback(isCompleting
          ? `已完成「${taskBefore.title}」。${state.companion ? '夥伴也很開心。' : '完成狀態已儲存。'}`
          : `「${taskBefore.title}」已改回未完成。已領獎勵不會重複發放。`, 'success');
        syncSeniorPresentation();
        document.querySelector(`.task-card[data-id="${CSS.escape(String(id))}"] [data-action="toggle"]`)?.focus({ preventScroll: true });
      }

      if (isCompleting) {
        reactTwilightCompanion(state.companion?.dialogues?.praise?.[0]);
      }
      if (isCompleting && taskListUi.taskViewMode === 'today') {
        requestAnimationFrame(() => {
          document.querySelector(`.task-card[data-id="${CSS.escape(String(id))}"]`)
            ?.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'nearest' });
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
      taskListUi.activeSmartListId = target.dataset.listId;
      if (target.dataset.listId === 'completed') {
        taskListUi.completedRangeFilter = 'completed_1_month';
      }
      renderTasksView();
    } else if (action === 'smart-list-back') {
      taskListUi.activeSmartListId = null;
      renderTasksView();
    } else if (action === 'completed-range') {
      taskListUi.completedRangeFilter = target.dataset.range;
      renderTasksView();
    } else if (action === 'toggle-completed-section') {
      taskListUi.completedSectionCollapsed = !taskListUi.completedSectionCollapsed;
      renderTasksView();
    } else if (action === 'pick-unscheduled') {
      taskListUi.taskViewMode = 'all';
      taskListUi.taskCategoryFilter = 'all';
      document.querySelectorAll('#task-view-tabs .segmented-control__btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.taskView === 'all');
      });
      renderTasksView();
    } else if (action === 'go-achievements') {
      switchView('achievements');
    } else if (action === 'go-habits') {
      switchView('habits');
    } else if (action === 'toggle-daily-blessing') {
      toggleDailyBlessing();
      renderDailyBlessingSection();
    } else if (action === 'daily-check-in') {
      await handleDailyCheckIn();
    } else if (action === 'daily-open-race') {
      await openDailyRace({ pets: state.allPets || [],
        ownedIds: (state.enrichedCollection || []).filter(p => p.owned).map(p => p.id),
        imageHtml: petImageHtml, openModal, refresh: () => onRefresh(),
        reduceMotion: state.userPreferences?.reduceMotion ?? false });
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
    } else if (action === 'companion-feed') {
      e.preventDefault();
      e.stopPropagation();
      if (state?.companion) openPetFeedModal(state.companion);
    } else if (action === 'empty-add-task') {
      openTaskForm();
    } else if (action === 'empty-go-gacha') {
      switchView('gacha');
    } else if (action === 'empty-go-collection') {
      switchView('collection');
    } else if (action === 'edit' && id) {
      openTaskForm(id);
    } else if (action === 'delete' && id) {
      const title = state.tasks.find((task) => task.id === id)?.title || '這項任務';
      openConfirmModal('刪除任務', isSeniorMode() ? `要刪除「${title}」這項任務嗎？刪除後無法復原，已獲得的獎勵會保留。` : '確定要刪除此任務嗎？刪除後無法復原。', async () => {
        await deleteTask(id);
        await onRefresh();
        showToast(isSeniorMode() ? `已刪除「${title}」。` : '任務已刪除', 'success');
      }, { danger: true, confirmLabel: isSeniorMode() ? '刪除任務' : '刪除' });
    }
  }));

  document.getElementById('btn-add-task')?.addEventListener('click', () => openTaskForm());

  document.getElementById('view-gacha')?.addEventListener('click', trackUpdateActivity(async (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'toggle-awakening-guide') {
      toggleAwakeningGuide(target);
    } else if (action === 'show-awakening-guide') {
      switchView('guide');
      requestAnimationFrame(() => {
        const guide = document.getElementById('guide-pet-awakening');
        guide?.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'start' });
        guide?.focus({ preventScroll: true });
      });
    } else if (action === 'go-home-daily-blessing') {
      homeHubActive = 'blessing';
      expandDailyBlessing();
      switchView('tasks');
      requestAnimationFrame(() => {
        renderDailyBlessingSection();
        renderHomeHub();
        document.getElementById('homeDailyBlessingContainer')?.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'start' });
      });
    } else if (action === 'daily-open-wheel') {
      await openDailyWheelModal();
    }
  }));

  document.getElementById('btn-pull')?.addEventListener('click', trackUpdateActivity(handlePull));
  document.getElementById('btn-pull-ten')?.addEventListener('click', trackUpdateActivity(handleTenPull));

  document.getElementById('view-collection')?.addEventListener('click', trackUpdateActivity(handleCollectionClick));

  document.getElementById('btn-export')?.addEventListener('click', trackUpdateActivity(async () => {
    try {
      await downloadBackup();
      await markExportedBackup();
      await handleAchievementCheckAfterAction();
      showToast('JSON 備份已下載', 'success');
    } catch {
      showToast('匯出失敗，請稍後再試', 'error');
    }
  }));

  initImportBackupHandlers();

  document.getElementById('btn-reset')?.addEventListener('click', trackUpdateActivity(handleReset));

  document.getElementById('btn-dev-unlock')?.addEventListener('click', trackUpdateActivity(handleDevUnlock));

  document.getElementById('btn-dev-unlock-all')?.addEventListener('click', trackUpdateActivity(handleDevUnlockAll));

  document.getElementById('btn-dev-stardust')?.addEventListener('click', trackUpdateActivity(handleDevStardust));
  document.getElementById('btn-dev-companion-bond')?.addEventListener('click', trackUpdateActivity(handleDevCompanionBond));

  document.getElementById('btn-dev-expedition')?.addEventListener('click', trackUpdateActivity(handleDevExpedition));
  document.getElementById('btn-dev-daily-blessing')?.addEventListener('click', trackUpdateActivity(handleDevResetDailyBlessing));
  document.getElementById('btn-dev-mailbox-announcement')?.addEventListener('click', trackUpdateActivity(handleDevMailboxAnnouncement));
  document.getElementById('btn-dev-mailbox-compensation')?.addEventListener('click', trackUpdateActivity(handleDevMailboxCompensation));
  document.getElementById('btn-dev-mailbox-clear')?.addEventListener('click', trackUpdateActivity(handleDevMailboxClear));

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
    void trackUpdateActivity(handleExpeditionClick)(e);
  });

  document.getElementById('view-more')?.addEventListener('click', (e) => {
    const item = e.target.closest('[data-goto]');
    if (!item) return;
    switchView(item.dataset.goto);
    if (item.hasAttribute('data-scroll-daily-blessing')) {
      homeHubActive = 'blessing';
      expandDailyBlessing();
      requestAnimationFrame(() => {
        renderDailyBlessingSection();
        renderHomeHub();
        document.getElementById('homeDailyBlessingContainer')?.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'start' });
      });
    }
  });

  document.getElementById('view-share')?.addEventListener('click', (e) => {
    const backBtn = e.target.closest('[data-goto]');
    if (backBtn) switchView(backBtn.dataset.goto);
  });
  document.getElementById('share-description').textContent = APP_SHARE_DESCRIPTION;
  document.getElementById('share-website-link').href = WEBSITE_SHARE_URL;
  document.getElementById('share-app-link').href = APP_SHARE_URL;
  document.getElementById('share-message-text').textContent = APP_SHARE_MESSAGE;
  document.getElementById('btn-share-app')?.addEventListener('click', trackUpdateActivity(async () => {
    const result = await shareQuestNote();
    if (result === 'unsupported') {
      const copied = await copyQuestNoteInvitation();
      showToast(copied ? '邀請已複製，包含官網與 App 連結' : '無法自動複製，請展開分享內容並長按選取', copied ? 'success' : 'warning');
    } else if (result === 'failed') {
      showToast('無法開啟分享，請使用「複製邀請內容」', 'warning');
    }
  }));
  document.getElementById('btn-copy-app-link')?.addEventListener('click', trackUpdateActivity(async () => {
    const copied = await copyQuestNoteInvitation();
    showToast(copied ? '邀請已複製，包含官網與 App 連結' : '無法自動複製，請展開分享內容並長按選取', copied ? 'success' : 'warning');
  }));

  document.getElementById('view-workshop')?.addEventListener('click', (e) => {
    void trackUpdateActivity(handleWorkshopClick)(e);
  });

  document.getElementById('view-handbook')?.addEventListener('click', (e) => {
    void trackUpdateActivity(handleHandbookClick)(e);
  });

  document.getElementById('view-weekly-review')?.addEventListener('click', (e) => {
    void trackUpdateActivity(handleWeeklyReviewClick)(e);
  });

  document.getElementById('view-guide')?.addEventListener('click', (e) => {
    const backBtn = e.target.closest('[data-goto]');
    if (backBtn) switchView(backBtn.dataset.goto);
  });

  document.getElementById('view-achievements')?.addEventListener('click', trackUpdateActivity(async (e) => {
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
  }));

  document.getElementById('view-settings')?.addEventListener('click', trackUpdateActivity(async (e) => {
    const backBtn = e.target.closest('[data-goto]');
    if (backBtn) {
      switchView(backBtn.dataset.goto);
      return;
    }

    const healthButton = e.target.closest('[data-action="run-health-check"]');
    if (healthButton) {
      await runHealthCheckFromSettings();
      return;
    }

    const themeCard = e.target.closest('[data-action="select-theme"]');
    if (themeCard) {
      const theme = themeCard.dataset.theme;
      if (theme) await applyTheme(theme);
    }
  }));

  document.getElementById('font-size-picker')?.addEventListener('change', trackUpdateActivity(async (event) => {
    if (event.target.name !== 'font-size') return;
    const picker = event.currentTarget;
    const previous = state.userPreferences?.fontSize;
    picker.disabled = true;
    try {
      const prefs = await setFontSize(event.target.value);
      state.userPreferences = prefs;
      applyFontSizeToDocument(prefs.fontSize);
      renderFontSizePickerState(prefs.fontSize);
      setText('font-size-result', '字體大小已儲存');
    } catch (error) {
      applyFontSizeToDocument(previous);
      renderFontSizePickerState(previous);
      setText('font-size-result', '無法儲存字體大小，請再試一次。');
      console.warn('[Preferences] Failed to save font size:', error);
    } finally {
      picker.disabled = false;
    }
  }));

  document.querySelector('.theme-picker')?.addEventListener('keydown', trackUpdateActivity(async (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    const current = event.target.closest('[data-action="select-theme"]');
    if (!current) return;
    event.preventDefault();
    const cards = [...document.querySelectorAll('.theme-picker [data-action="select-theme"]')];
    const index = cards.indexOf(current);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1
      : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + cards.length) % cards.length;
    await applyTheme(cards[next].dataset.theme);
    cards[next].focus();
  }));

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

  document.getElementById('view-habits')?.addEventListener('click', trackUpdateActivity(async (e) => {
    const backBtn = e.target.closest('[data-goto]');
    if (backBtn) {
      switchView(backBtn.dataset.goto);
      return;
    }

    const toggleArchived = e.target.closest('[data-action="toggle-archived-habits"]');
    if (toggleArchived) {
      toggleArchivedHabits();
      renderHabitsView();
      return;
    }

    const target = e.target.closest('[data-action]');
    if (!target) return;

    const card = target.closest('.habit-card');
    const id = card?.dataset.id;
    const action = target.dataset.action;

    if ((action === 'habit-complete' || action === 'habit-uncomplete') && id) {
      await handleHabitCompletion(action, id, card);
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
  }));
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
  if (viewName === 'workshop' && !document.getElementById('view-workshop')?.classList.contains('active')) {
    clearWorkshopGiftSelection();
  }
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach((n) => { n.classList.remove('active'); n.removeAttribute('aria-current'); });

  const view = document.getElementById(`view-${viewName}`);
  window.scrollTo(0, 0);
  const navView = viewName === 'achievements' || viewName === 'settings' || viewName === 'habits' || viewName === 'workshop' || viewName === 'handbook' || viewName === 'weekly-review' || viewName === 'guide' || viewName === 'feedback' || viewName === 'share' ? 'more' : viewName;
  const nav = document.querySelector(`.nav-item[data-view="${navView}"]`);
  if (view) view.classList.add('active');
  if (nav) { nav.classList.add('active'); nav.setAttribute('aria-current', 'page'); }
  if (viewName === 'guide') {
    const awakeningGuide = document.getElementById('guide-pet-awakening');
    if (awakeningGuide) awakeningGuide.innerHTML = renderAwakeningGuide();
    window.scrollTo(0, 0);
  }

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
      // 進入召喚頁僅在尚未看過時播放；手動切換也使用相同完整登場。
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

  if (viewName === 'weekly-review') {
    renderWeeklyReviewView();
  }

  if (viewName === 'collection') {
    preloadOwnedPetImages(state?.enrichedCollection, state?.allPets, 12).catch(() => {});
  }

  if (viewName === 'tasks' && state?.companion) {
    preloadCompanionImage(state).catch(() => {});
  }

  currentTasksView = viewName === 'achievements' || viewName === 'settings' || viewName === 'habits' || viewName === 'workshop' || viewName === 'handbook' || viewName === 'weekly-review' || viewName === 'guide' || viewName === 'feedback' || viewName === 'share' || viewName === 'more'
    ? currentTasksView
    : viewName;
  if (viewName === 'tasks' || viewName === 'gacha' || viewName === 'collection' || viewName === 'expedition' || viewName === 'more') {
    currentTasksView = viewName;
  }
  renderNavBadges();
  void recordOnboardingEvent('view-changed', { viewName });
  syncSeniorPresentation();
  if (isSeniorMode()) requestAnimationFrame(() => [...(view?.querySelectorAll('h1, h2') || [])].find((heading) => heading.getClientRects().length)?.focus({ preventScroll: true }));
}

/** Teaching links only navigate and select filters; product controls own every write. */
export async function openTeachingTarget({ view, filter, tab, hub, petId, detail } = {}) {
  closeModal();
  document.querySelector('#specified-invitation-dialog[open] [data-invitation-action="close"]:not(:disabled)')?.click();
  document.querySelector('#identity-detail-dialog[open] [data-identity-action="close-dialog"]')?.click();
  if (document.body.classList.contains('expedition-dispatch-open')) closeExpeditionDispatchModal();
  if (view === 'collection' && filter === 'owned') {
    setCollectionFilter('owned');
    setCollectionSeriesFilter('all');
  }
  if (view === 'workshop' && ['materials', 'craft', 'gift'].includes(tab)) {
    setWorkshopTab(tab);
    clearWorkshopGiftSelection({ keepMessage: true });
    document.querySelectorAll('[data-workshop-tab]').forEach((button) => {
      const active = button.dataset.workshopTab === tab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
  }
  if (view === 'tasks' && ['blessing', 'quest', 'titles'].includes(hub)) homeHubActive = hub;
  switchView(view);
  if (view === 'collection') renderCollectionView();
  if (view === 'tasks' && hub) renderHomeHub();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (detail && petId) openPetDetailModal(petId);
}

/** 取得目前 active 的 view 名稱 */
/** Whether the task list currently shows the today plan (new tasks default into it). */
function isTodayTaskViewMode() {
  return taskListUi.taskViewMode === 'today';
}

/** Whether the last main view switched to is the home (tasks) view. */
function isTasksViewCurrent() {
  return currentTasksView === 'tasks';
}

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
  renderWeeklyReviewCard();
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
  syncTwilightHome(state);
  renderBondHomeSection();
  refreshOnboarding();
  syncSeniorPresentation();
}

function renderBondHomeSection() {
  const root = document.getElementById('bond-journey-home');
  if (!root) return;
  const html = renderBondHome(state) + renderAwakeningHome(state);
  const opener = document.getElementById('modal-overlay')?.classList.contains('open')
    ? root.querySelector('[data-bond-open]') : null;
  // Preserve a connected dialog opener while updating the lightweight home card.
  root.innerHTML = html;
  const replacement = root.querySelector('[data-bond-open]');
  if (opener && replacement && opener.dataset.bondOpen === replacement.dataset.bondOpen) {
    opener.textContent = replacement.textContent;
    replacement.replaceWith(opener);
  }
  root.hidden = !html;
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
    case 'weekly-review':
      renderWeeklyReviewView();
      break;
    case 'guide':
      if (document.getElementById('guide-pet-awakening')) document.getElementById('guide-pet-awakening').innerHTML = renderAwakeningGuide();
      refreshOnboarding();
      break;
    case 'share':
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
  applyFontSizeToDocument(state.userPreferences?.fontSize);
  applyReadingModeToDocument(state.userPreferences?.readingMode);
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
  syncSeniorPresentation();
}

function maybeRefreshExpeditionBubble() {
  if (!state?.companion || currentTasksView !== 'tasks') return;
  const exp = state.activeExpedition;
  if (!exp || !isExpeditionTimeComplete(exp) || exp.claimed) return;
  if (!document.getElementById('companion-bubble-text')) return;
  refreshCompanionBubble();
}

/* ─── 任務頁 ─── */

/** Reuse the real today list, repairing filters and interrupted modal navigation. */
export function showGuidedHome() {
  closeModal();
  taskListUi.taskViewMode = 'today';
  taskListUi.taskCategoryFilter = 'all';
  switchView('tasks');
  renderTasksView();
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

export function applyReduceMotionClass(enabled) {
  document.body.classList.toggle('reduce-motion', !!enabled);
}

function preferredScrollBehavior() {
  return isSeniorMode() || state?.userPreferences?.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto' : 'smooth';
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
    applyFontSizeToDocument(state.userPreferences?.fontSize);
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

function renderFontSizePickerState(fontSize) {
  const valid = normalizeFontSize(fontSize);
  document.querySelectorAll('input[name="font-size"]').forEach((input) => {
    input.checked = input.value === valid;
  });
}

function renderThemePickerState(activeTheme) {
  const theme = normalizeTheme(activeTheme);
  document.querySelectorAll('[data-action="select-theme"]').forEach((card) => {
    const cardTheme = card.dataset.theme;
    const isActive = cardTheme === theme;
    card.classList.toggle('theme-card--active', isActive);
    card.setAttribute('aria-checked', isActive ? 'true' : 'false');
    card.tabIndex = isActive ? 0 : -1;
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
  (document.getElementById('toast-container') || document.body).appendChild(toast);
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
  (document.getElementById('toast-container') || document.body).appendChild(toast);
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

function showRewardToast(amount, energy = 0, encounterFragments = 0) {
  // Senior mode hides the game layer: rewards still accrue, but their numbers are not announced.
  if (isSeniorMode()) return;
  const toast = document.createElement('div');
  toast.className = 'reward-toast reward-toast--reward';
  let text = `<span class="reward-toast__icon">✨</span><span class="reward-toast__message">獲得 <strong class="toast-highlight">${amount}</strong> 星塵！</span>`;
  if (energy > 0) {
    text += `<span class="reward-toast__energy">＋<strong class="toast-highlight">${energy}</strong> 冒險能量</span>`;
  }
  if (encounterFragments > 0) text += `<span class="reward-toast__energy">相遇碎片 ＋${encounterFragments}</span>`;
  toast.innerHTML = text;
  (document.getElementById('toast-container') || document.body).appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, energy > 0 ? 3000 : 2500);
}

/* ─── 召喚頁 ─── */

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

export { showRewardToast };

function encounterActions() {
  return {
    renderCollectionMilestones,
    async invite(id) {
      try { const result = await inviteCompanion(id, state.allPets, state.poolsData); await onRefresh({ renderMode:['gacha','collection','tasks'] }); void recordOnboardingEvent('companion-invited', { petId:id }); return result; }
      catch (error) { await onRefresh({ renderMode:['gacha','collection'] }); throw error; }
    },
    async dismissMigration() { await acknowledgeEncounterMigration(); state.encounterEconomy = await getEncounterEconomy(); },
    switchView, openPetDetail: openPetDetailModal, openNickname: openNicknameModal,
    isBusy: () => isGachaPullInProgress() || !!maybePlayPoolDebut._inflight,
    isExpanded: (id) => shouldShowAwakenedPresentation(getUnlockEntryForPool(id)),
    draw: (count) => {
      const draw = () => trackUpdateActivity(count === 10 ? handleTenPull : handlePull)();
      if (!isSeniorMode()) return draw();
      const pool = getSelectedGachaPool();
      if (!pool) return;
      const cost = resolveDrawCost(pool, count);
      return new Promise((resolve) => {
        openConfirmModal(`召喚 ${count} 次夥伴`, `將使用 ${cost} 星塵，在「${pool.name}」隨機相遇 ${count} 次。你目前有 ${state.wallet.stardust} 星塵。結果會自動加入收藏；召喚後無法取消。`, async () => {
          try {
            if (getSelectedGachaPool()?.id !== pool.id) { showToast('卡池已變更，請重新確認召喚。', 'warning'); return; }
            await draw();
          } finally { resolve(); }
        }, { confirmLabel: `使用 ${cost} 星塵召喚`, onCancel: resolve });
      });
    },
    async setCompanion(id) {
      await setCompanion(id);
      await onRefresh({ renderMode: ['collection', 'tasks'] });
      void recordOnboardingEvent('companion-set', { petId: id });
    },
    async selectPool(id) {
      if (isGachaPullInProgress() || maybePlayPoolDebut._inflight) return;
      try {
        state.gachaStats = await setSelectedPoolId(id);
        renderGachaView();
        maybePlayPoolDebut._fromSwitcher = true;
        await maybePlayPoolDebut(id);
      } catch (error) { showToast(error.message || '切換卡池失敗', 'error'); }
    },
  };
}
