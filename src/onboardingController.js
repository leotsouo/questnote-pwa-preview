/** Lightweight, opt-out teaching layered over the real QuestNote screens. */
import {
  advanceOnboardingForEvent,
  normalizeOnboardingState,
  saveOnboardingState,
} from './onboardingService.js';
import { resolveActivePool, resolveDrawCost } from './poolContentContract.js';

const STEP_NUMBER = { task: 1, reward: 2, summon: 3, collection: 4, expedition: 5 };
const WELCOME_MESSAGE_ID = '2026-07-welcome-10pull';

let appState = null;
let navigation = null;
let record = null;
let root = null;
let showCompletion = false;
let lastSignature = '';
let highlighted = null;
let priorFocus = null;

function ownedPets() {
  return (appState?.enrichedCollection || []).filter((pet) => pet.owned);
}

function singleCost() {
  const pool = resolveActivePool(appState?.poolsData, appState?.gachaStats?.selectedPoolId);
  return pool ? resolveDrawCost(pool, 1) : 100;
}

function expeditionCost() {
  return appState?.expeditionAreas?.find((area) => area.id === 'mist_forest')?.energyCost ?? 3;
}

function currentView() {
  return document.querySelector('.view.active')?.id?.replace(/^view-/, '') || 'tasks';
}

function welcomeGiftStatus() {
  return navigation?.getMailboxGiftStatus?.(WELCOME_MESSAGE_ID) || 'unknown';
}

function stepContent() {
  const task = appState?.tasks?.find((item) => item.id === record.taskId);
  const stardust = Number(appState?.wallet?.stardust) || 0;
  const energy = Number(appState?.wallet?.adventureEnergy) || 0;
  const cost = singleCost();
  const ownedFilterActive = document.querySelector('#collection-filters [data-filter="owned"]')
    ?.classList.contains('active');

  switch (record.step) {
    case 'task':
      return {
        title: '先記下一件真正要做的事',
        body: '按右下角「＋」新增任務。若打算今天完成，可以勾選「加入今日計畫」；不必填入示範資料。',
        primary: ['找到新增任務', 'locate-task'],
        secondary: ['我已有任務，往下看', 'later-task'],
      };
    case 'reward':
      return {
        title: '完成任務就能獲得資源',
        body: task
          ? `「${task.title || '這件任務'}」完成後，點任務上的「完成」可獲得星塵和冒險能量。還沒做完就留著，無須為了教學提前勾選。`
          : '先建立一件真正要做的任務；做完後點「完成」即可得到星塵和冒險能量，重要程度會影響獎勵。',
        primary: task ? ['找到任務', 'locate-reward'] : ['新增一件任務', 'locate-task'],
        secondary: ['這件事稍後完成', 'later-reward'],
      };
    case 'summon':
      if (stardust >= cost) return {
        title: '用星塵召喚夥伴',
        body: `你目前有 ${stardust} 星塵，單次召喚需要 ${cost}。前往「召喚」並試一次；結果會加入圖鑑。`,
        primary: ['前往召喚', 'locate-summon'],
        secondary: ['稍後再召喚', 'later-summon'],
      };
      if (welcomeGiftStatus() === 'claimed') return {
        title: '累積星塵再召喚',
        body: `單次召喚需要 ${cost} 星塵，目前有 ${stardust}。迎新禮已領取；完成任務或每日祝福可繼續累積星塵。`,
        primary: ['前往任務', 'locate-task'],
        secondary: ['稍後再召喚', 'later-summon'],
      };
      if (welcomeGiftStatus() === 'unavailable') return {
        title: '累積星塵再召喚',
        body: `單次召喚需要 ${cost} 星塵，目前有 ${stardust}。迎新禮目前無法領取；完成任務或每日祝福可繼續累積星塵。`,
        primary: ['前往任務', 'locate-task'],
        secondary: ['稍後再召喚', 'later-summon'],
      };
      return {
        title: '星塵還差一點',
        body: `單次召喚需要 ${cost} 星塵，目前有 ${stardust}。${welcomeGiftStatus() === 'claimable' ? '信箱有可領取的迎新禮。' : '信箱可能有可領取的迎新禮；'}若沒有，可完成任務或每日祝福慢慢累積。`,
        primary: ['開啟信箱', 'open-mailbox'],
        secondary: ['稍後再召喚', 'later-summon'],
      };
    case 'collection':
      return {
        title: '到圖鑑找到你的夥伴',
        body: ownedPets().length
          ? ownedFilterActive
            ? '已顯示你獲得的夥伴；點「設為陪伴」，牠就會出現在任務首頁。'
            : '切到「已獲得」，就能快速找到剛召喚的夥伴。再點「設為陪伴」，牠會出現在任務首頁。'
          : '召喚得到的寵物會收進圖鑑；之後用「已獲得」篩選，再選一隻設為陪伴。',
        primary: ['前往圖鑑', 'locate-collection'],
        secondary: ['稍後再選夥伴', 'later-collection'],
      };
    case 'expedition':
      return {
        title: '帶夥伴去探險',
        body: `迷霧森林需要一隻已獲得的寵物和 ${expeditionCost()} 點冒險能量；你目前有 ${energy} 點。派遣後會倒數，結束時回來領取星塵、材料與親密度。${ownedPets().length && energy >= expeditionCost() ? '現在就可以試著派遣。' : '條件不足也可以先完成教學。'}`,
        primary: ['查看探險', 'locate-expedition'],
        secondary: ['完成教學', 'finish'],
      };
    default:
      return null;
  }
}

function clearHighlight() {
  highlighted?.classList.remove('onboarding-target');
  highlighted = null;
}

function hasActivePresentation() {
  return Boolean(document.querySelector(
    '.dream-bloom-overlay, .dream-debut-overlay, .summon-reveal-overlay, .modal-overlay.open',
  ));
}

function syncPresentationVisibility() {
  if (!root || !record) return;
  const paused = hasActivePresentation();
  if (root.hidden === paused) return;
  root.hidden = paused;
  if (paused) {
    clearHighlight();
  } else {
    render();
  }
}

function targetForStep() {
  if (record?.status !== 'active') return null;
  const view = currentView();
  if (record.step === 'task' && view === 'tasks') return document.getElementById('btn-add-task');
  if (record.step === 'reward' && view === 'tasks') {
    const selector = record.taskId
      ? `.task-card[data-id="${CSS.escape(record.taskId)}"] [data-action="toggle"]`
      : '.task-card [data-action="toggle"]';
    return document.querySelector(selector);
  }
  if (record.step === 'summon') {
    if ((appState?.wallet?.stardust || 0) < singleCost() && view === 'tasks') {
      return document.getElementById(
        ['claimed', 'unavailable'].includes(welcomeGiftStatus()) ? 'btn-add-task' : 'btn-global-mailbox',
      );
    }
    if (view === 'gacha') return document.getElementById('btn-pull');
  }
  if (record.step === 'collection' && view === 'collection') {
    const ownedFilter = document.querySelector('#collection-filters [data-filter="owned"]');
    if (!ownedFilter?.classList.contains('active')) return ownedFilter;
    return document.querySelector('.collection-card [data-action="set-companion"]') || ownedFilter;
  }
  if (record.step === 'expedition' && view === 'expedition') {
    return document.querySelector('#expedition-areas [data-area-id="mist_forest"] [data-action="open-dispatch"]:not(:disabled)')
      || document.querySelector('#expedition-areas [data-area-id="mist_forest"]');
  }
  return null;
}

function updateHighlight() {
  const next = targetForStep();
  if (next === highlighted) return;
  clearHighlight();
  if (!next) return;
  next.classList.add('onboarding-target');
  highlighted = next;
}

function renderGuideStatus() {
  const label = document.getElementById('guide-tutorial-status');
  const button = document.getElementById('guide-tutorial-button');
  if (!label || !button || !record) return;
  const resumable = record.status === 'paused' || record.status === 'active';
  label.textContent = resumable ? '你的教學進度已保留。' : '可以隨時重看，不會自動建立任務或發放獎勵。';
  button.textContent = resumable ? '繼續實作引導' : '重新體驗引導';
  button.dataset.onboardingAction = resumable ? 'resume' : 'replay';
}

function render() {
  if (!root || !record) return;
  if (hasActivePresentation()) {
    root.hidden = true;
    clearHighlight();
    return;
  }
  root.hidden = false;
  renderGuideStatus();
  const content = record.status === 'active' ? stepContent() : null;
  const signature = JSON.stringify({ record, content, showCompletion });
  if (signature !== lastSignature) {
    const focusedAction = root.contains(document.activeElement)
      ? document.activeElement?.dataset?.onboardingAction : null;
    const wasDialog = root.querySelector('[role="dialog"]') !== null;
    const isDialog = record.status === 'new' || (record.status === 'completed' && showCompletion);
    if (isDialog && !wasDialog) priorFocus = document.activeElement;

    if (record.status === 'new') {
      root.innerHTML = `
        <div class="onboarding-scrim">
          <section class="onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboarding-welcome-title">
            <img class="onboarding-dialog__logo" src="assets/icons/icon-192.png" alt="" width="64" height="64">
            <p class="onboarding-eyebrow">歡迎來到 QuestNote</p>
            <h2 id="onboarding-welcome-title">把待辦事項變成一場小冒險</h2>
            <p>記下真正要做的事，完成後獲得星塵與冒險能量；用星塵召喚夥伴，再帶牠去探險。</p>
            <p class="onboarding-dialog__hint">接下來會直接在 App 裡練習，約需幾分鐘。所有操作都使用你的正式資料。</p>
            <div class="onboarding-dialog__actions">
              <button class="btn btn--primary" type="button" data-onboarding-action="start">用自己的任務開始</button>
              <button class="btn btn--ghost" type="button" data-onboarding-action="skip">略過教學</button>
            </div>
          </section>
        </div>`;
    } else if (record.status === 'completed' && showCompletion) {
      root.innerHTML = `
        <div class="onboarding-scrim">
          <section class="onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboarding-done-title">
            <p class="onboarding-eyebrow">新手教學完成</p>
            <h2 id="onboarding-done-title">你已經知道怎麼開始冒險了</h2>
            <p>每天可以先安排任務，完成後累積星塵與能量；召喚、陪伴和探險會讓旅程繼續向前。</p>
            <p class="onboarding-dialog__hint">每日祝福、習慣、成就、工坊和資料備份，都能在「更多 → 使用教學」查看。</p>
            <div class="onboarding-dialog__actions">
              <button class="btn btn--primary" type="button" data-onboarding-action="close-summary">開始使用</button>
              <button class="btn btn--ghost" type="button" data-onboarding-action="summary-guide">查看使用教學</button>
            </div>
          </section>
        </div>`;
    } else if (content) {
      root.innerHTML = `
        <aside class="onboarding-dock" data-step="${record.step}" aria-label="新手教學">
          <div class="onboarding-dock__top">
            <span>新手教學 ${STEP_NUMBER[record.step]} / 5</span>
            <button type="button" data-onboarding-action="pause">稍後</button>
          </div>
          <div aria-live="polite" aria-atomic="true">
            <h2>${content.title}</h2>
            <p>${content.body.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p>
          </div>
          <div class="onboarding-dock__actions">
            <button class="btn btn--primary btn--sm" type="button" data-onboarding-action="${content.primary[1]}">${content.primary[0]}</button>
            <button class="btn btn--ghost btn--sm" type="button" data-onboarding-action="${content.secondary[1]}">${content.secondary[0]}</button>
          </div>
          <button class="onboarding-dock__skip" type="button" data-onboarding-action="skip">略過整個教學</button>
        </aside>`;
    } else {
      root.replaceChildren();
    }

    document.body.classList.toggle('onboarding-dialog-open', isDialog);
    document.body.classList.toggle('onboarding-active', Boolean(content));
    const app = document.getElementById('app');
    if (app) app.inert = isDialog;
    if (isDialog) {
      root.querySelector('[data-onboarding-action="start"], [data-onboarding-action="close-summary"]')?.focus();
    } else if (wasDialog && priorFocus?.isConnected) {
      priorFocus.focus({ preventScroll: true });
      priorFocus = null;
    } else if (focusedAction) {
      root.querySelector(`[data-onboarding-action="${focusedAction}"]`)?.focus({ preventScroll: true });
    }
    lastSignature = signature;
  }
  updateHighlight();
}

async function save(next) {
  record = await saveOnboardingState(next);
  if (record.status === 'completed') showCompletion = true;
  render();
}

async function setStep(step) {
  await save({ ...record, status: 'active', step });
}

function revealTarget(selector) {
  requestAnimationFrame(() => {
    const target = document.querySelector(selector);
    if (!target) return;
    const reduceMotion = appState?.userPreferences?.reduceMotion
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    target.focus?.({ preventScroll: true });
    updateHighlight();
  });
}

async function handleAction(action) {
  if (!record) return;
  if (action === 'start') return setStep('task');
  if (action === 'skip') return save({ ...record, status: 'dismissed' });
  if (action === 'pause') return save({ ...record, status: 'paused' });
  if (action === 'resume') {
    await save({ ...record, status: 'active', step: record.step === 'welcome' ? 'task' : record.step });
    navigation.switchView('tasks');
    return;
  }
  if (action === 'replay') {
    await save({ ...record, status: 'active', step: 'task', taskId: null });
    navigation.switchView('tasks');
    return;
  }
  if (action === 'later-task') {
    const taskId = appState?.tasks?.find((task) => !task.completed)?.id || null;
    return save({ ...record, status: 'active', step: 'reward', taskId });
  }
  if (action === 'later-reward') return setStep('summon');
  if (action === 'later-summon') return setStep('collection');
  if (action === 'later-collection') return setStep('expedition');
  if (action === 'finish') return save({ ...record, status: 'completed' });
  if (action === 'close-summary') {
    showCompletion = false;
    return render();
  }
  if (action === 'summary-guide') {
    showCompletion = false;
    render();
    navigation.switchView('guide');
    return;
  }
  if (action === 'locate-task') {
    navigation.switchView('tasks');
    revealTarget('#btn-add-task');
  }
  if (action === 'locate-reward') {
    navigation.switchView('tasks');
    const selector = record.taskId
      ? `.task-card[data-id="${CSS.escape(record.taskId)}"] [data-action="toggle"]`
      : '.task-card [data-action="toggle"]';
    if (record.taskId && !document.querySelector(selector)) {
      document.querySelector('#task-view-tabs [data-task-view="all"]')?.click();
    }
    revealTarget(selector);
  }
  if (action === 'open-mailbox') {
    await navigation.openGlobalMailbox({ focusClaimableId: WELCOME_MESSAGE_ID });
  }
  if (action === 'locate-summon') {
    navigation.switchView('gacha');
    revealTarget('#btn-pull');
  }
  if (action === 'locate-collection') {
    navigation.switchView('collection');
    revealTarget('#collection-filters [data-filter="owned"]');
  }
  if (action === 'locate-expedition') {
    navigation.switchView('expedition');
    revealTarget('#expedition-areas [data-area-id="mist_forest"]');
  }
}

export function initOnboarding(app, handlers, initialRecord) {
  appState = app;
  navigation = handlers;
  record = normalizeOnboardingState(initialRecord);
  root = document.getElementById('onboarding-root');
  if (!root) return;
  const presentationObserver = new MutationObserver(syncPresentationVisibility);
  presentationObserver.observe(document.body, { childList: true });
  const modalOverlay = document.getElementById('modal-overlay');
  if (modalOverlay) presentationObserver.observe(modalOverlay, { attributes: true, attributeFilter: ['class'] });
  root.addEventListener('click', (event) => {
    const action = event.target.closest('[data-onboarding-action]')?.dataset.onboardingAction;
    if (action) void handleAction(action).catch((error) => console.warn('[Onboarding] action failed:', error));
  });
  root.addEventListener('keydown', (event) => {
    const dialog = root.querySelector('[role="dialog"]');
    if (!dialog) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (record.status === 'new') void handleAction('skip');
      else void handleAction('close-summary');
    }
    if (event.key !== 'Tab') return;
    const buttons = [...dialog.querySelectorAll('button:not(:disabled)')];
    const first = buttons[0];
    const last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  document.getElementById('view-guide')?.addEventListener('click', (event) => {
    const action = event.target.closest('[data-onboarding-action]')?.dataset.onboardingAction;
    if (action) void handleAction(action).catch((error) => console.warn('[Onboarding] guide action failed:', error));
  });

  // A completed action can survive a reload even if the guide state write was interrupted.
  if (record.status === 'active' && record.step === 'reward' && record.taskId
    && appState.tasks?.some((task) => task.id === record.taskId && task.completed)) {
    void recordOnboardingEvent('task-completed', { taskId: record.taskId });
  }
  render();
}

export function refreshOnboarding() {
  render();
}

export async function recordOnboardingEvent(event, detail = {}) {
  if (!record) return;
  if (event === 'view-changed') {
    render();
    return;
  }
  const next = advanceOnboardingForEvent(record, event, detail);
  if (next.status !== record.status || next.step !== record.step || next.taskId !== record.taskId) {
    await save(next);
  } else {
    render();
  }
}

export async function showOnboardingAfterReset() {
  await save({ status: 'new', step: 'welcome', taskId: null });
}

export async function dismissOnboardingAfterRestore() {
  showCompletion = false;
  await save({ status: 'dismissed', step: 'welcome', taskId: null });
}
