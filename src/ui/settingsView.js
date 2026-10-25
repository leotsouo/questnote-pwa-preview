/**
 * Settings view: backup import and restore, version and service worker status,
 * the author-only dev tools and the full local reset. Restore writes all stores or none
 * (backupService); this module only drives the confirmation and status UI.
 */
import {
  readBackupFile,
  validateBackup,
  normalizeBackupPayload,
  previewBackup,
  createAutoBackupBeforeImport,
  restoreBackup,
} from '../backupService.js';
import {
  isAuthorLocalDevMode,
  isDevMode,
  unlockDevTestPets,
  unlockAllDevPets,
  grantDevStardust,
  raiseDevCompanionBond,
  devForceCompleteExpedition,
} from '../devService.js';
import { runAppHealthCheck } from '../healthCheckService.js';
import { dismissOnboardingAfterRestore, showOnboardingAfterReset } from '../onboardingController.js';
import { RELEASE_PROFILE } from '../releaseProfile.js';
import { renderReminderSettings } from '../reminderController.js';
import { escapeHtml } from '../uiHelpers.js';
import { trackUpdateActivity } from '../updateActivity.js';
import { updateControlsHtml, refreshUpdateControls } from '../updateController.js';
import {
  formatDisplayVersion,
  CACHE_NAME,
  formatBuildTimeLocal,
  APP_VERSION,
  BUILD_TIME,
} from '../version.js';
import { formatRecentErrors, getRecentErrors } from '../errorLog.js';
import { handleAchievementCheckAfterAction } from './achievementsView.js';
import { initWebMigrationCard } from './webMigrationView.js';

// Bound from src/ui.js by connectSettingsView() so this module never imports ui.js back.
let applyReduceMotionClass, applyTheme, notifyBondUnlocks, onRefresh, openConfirmModal, renderFontSizePickerState, renderThemePickerState, setText, showToast, state, switchView, uiDebugLog;

export function connectSettingsView(deps) {
  ({ applyReduceMotionClass, applyTheme, notifyBondUnlocks, onRefresh, openConfirmModal, renderFontSizePickerState, renderThemePickerState, setText, showToast, state, switchView, uiDebugLog } = deps);
}

let pendingImportBackup = null;
let pendingImportFileName = '';
let pendingImportWarnings = [];
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

export function initImportBackupHandlers() {
  const fileInput = document.getElementById('import-file-input');
  const selectBtn = document.getElementById('btn-import-select');
  const restoreBtn = document.getElementById('btn-import-restore');
  const reloadBtn = document.getElementById('btn-import-reload');

  resetImportUI();
  initWebMigrationCard();

  selectBtn?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      void trackUpdateActivity(handleImportFileSelect)(file);
    }
  });

  restoreBtn?.addEventListener('click', () => {
    if (!pendingImportBackup) {
      showToast('請先選擇有效的備份檔', 'warning');
      return;
    }
    void trackUpdateActivity(handleRestoreBackup)();
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
    const message = '恢復流程未完成，請先重新整理並檢查資料。';
    showImportError(message);
    showToast(message, 'error');
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
      </dl>${updateControlsHtml()}`;
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
      ${recentErrorsRowHtml()}
    </dl>
    <p class="settings-version__note version-info-note" data-version-update-hint>
      按「檢查並更新」即可取得新版。更新保留存檔，請勿清除網站資料。
    </p>${updateControlsHtml()}${HEALTH_CHECK_VISIBLE ? healthCheckHtml() : ''}`;
}

/** Uncaught errors of this session (src/errorLog.js). Shown on every profile so a report can quote them. */
function recentErrorsRowHtml() {
  const lines = formatRecentErrors(getRecentErrors(), 3);
  if (!lines.length) return '';
  return `
      <div class="version-info-row stats-row">
        <dt class="version-info-label">最近錯誤</dt>
        <dd class="version-info-value version-info-value--mono settings-version__mono" data-version-recent-errors>${lines.map((line) => escapeHtml(line)).join('<br>')}</dd>
      </div>`;
}

/** The App health check is a developer tool: offered in the source checkout and the preview, never in production or the iOS app. */
export function isHealthCheckVisible(profile) {
  return profile !== 'production' && profile !== 'ios';
}
const HEALTH_CHECK_VISIBLE = isHealthCheckVisible(RELEASE_PROFILE?.profile);
// The version card can re-render while a check runs, so the block is always drawn from this state.
let healthCheckRunning = false;
let healthCheckReport = null;
let healthCheckError = '';

function healthCheckSummary() {
  if (healthCheckRunning) return '檢查中，請稍候…';
  if (healthCheckError) return `健康檢查無法完成：${healthCheckError}`;
  if (!healthCheckReport) return '只在預覽版與本機顯示。會讀取 App 檔案，並在這台裝置的存檔寫入後刪除一筆探測紀錄。';
  const entries = Object.values(healthCheckReport.results);
  const failed = entries.filter((status) => status === 'error').length;
  return healthCheckReport.ok
    ? `${formatDisplayVersion()}：${entries.length} 項全部通過`
    : `${formatDisplayVersion()}：${failed} / ${entries.length} 項未通過`;
}

function healthResultsHtml(report) {
  if (!report) return '';
  const entries = Object.entries(report.results);
  const failures = report.errors.length
    ? `<ul class="settings-health__errors">${report.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul>`
    : '';
  const rows = entries.map(([name, status]) => `
    <li class="settings-health__row"><span>${escapeHtml(name)}</span><strong>${status === 'error' ? '未通過' : '通過'}</strong></li>`).join('');
  return `${failures}
    <details class="settings-health__details">
      <summary>全部 ${entries.length} 項</summary>
      <ul class="settings-health__list">${rows}</ul>
    </details>`;
}

function healthCheckHtml() {
  const label = healthCheckRunning ? '檢查中…' : healthCheckReport ? '重新執行健康檢查' : '執行健康檢查';
  return `
    <div class="settings-health" data-health-check>
      <button type="button" class="btn btn--secondary btn--block" data-action="run-health-check"${healthCheckRunning ? ' disabled' : ''}>${label}</button>
      <p class="settings-version__note settings-health__summary" role="status" aria-live="polite">${escapeHtml(healthCheckSummary())}</p>
      ${healthResultsHtml(healthCheckReport)}
    </div>`;
}

function refreshHealthCheckBlocks() {
  document.querySelectorAll('[data-health-check]').forEach((block) => { block.outerHTML = healthCheckHtml(); });
}

/** Run the App health check from the settings version card and show the result there. */
export async function runHealthCheckFromSettings() {
  if (healthCheckRunning) return;
  healthCheckRunning = true;
  healthCheckError = '';
  refreshHealthCheckBlocks();
  try {
    healthCheckReport = await runAppHealthCheck();
  } catch (error) {
    healthCheckReport = null;
    healthCheckError = error?.message || String(error);
  } finally {
    healthCheckRunning = false;
    refreshHealthCheckBlocks();
    document.querySelector('#view-settings [data-action="run-health-check"]')?.focus({ preventScroll: true });
  }
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

  refreshUpdateControls();
  setText('settings-footer-note', `QuestNote ${formatDisplayVersion()} — 離線個人任務記事 App`);

  updateServiceWorkerStatusDisplay().catch((error) => {
    console.warn('[VersionInfo] Failed to check service worker:', error);
    updateVersionInfoServiceWorkerStatus('無法確認');
  });
}

export function renderSettingsView() {
  void renderReminderSettings();
  renderVersionInfo();

  if (!state) return;

  const { tasks, wallet, collectionProgress, gachaStats, activeExpedition, userPreferences, achievementSummary } = state;
  const formalTasks = tasks.filter((t) => !t.isTutorial);
  const completedCount = formalTasks.filter((t) => t.completed).length;

  setText('settings-task-count', formalTasks.length);
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
  renderFontSizePickerState(userPreferences?.fontSize);

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

export async function handleDevUnlock() {
  if (!isDevMode()) return;
  if (!confirm('【開發測試】將 8 隻高稀有寵物加入圖鑑，確定？')) return;

  const added = await unlockDevTestPets();
  await onRefresh({ renderMode: 'full' });
  switchView('collection');
  alert(added > 0 ? `已解鎖 ${added} 隻新寵物（共 8 隻測試寵物已就緒）` : '8 隻測試寵物皆已在圖鑑中');
}

export async function handleDevUnlockAll() {
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

export async function handleDevStardust() {
  if (!isDevMode()) return;

  const total = await grantDevStardust();
  await onRefresh({ renderMode: ['tasks', 'gacha'] });
  alert(`已獲得 100,000 星塵！目前共 ${total.toLocaleString()} 星塵`);
}

export async function handleDevCompanionBond() {
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

export async function handleDevExpedition() {
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
export async function handleReset() {
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
