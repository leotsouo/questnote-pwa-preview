/** Lightweight, opt-out teaching layered over the real QuestNote screens. */
import {
  advanceOnboardingForEvent,
  normalizeOnboardingState,
  saveOnboardingState,
  startLesson, pauseLesson, advanceLesson, previousLessonStep,
} from './onboardingService.js';
import { resolveActivePool, resolveDrawCost } from './poolContentContract.js';
import { getDispatchTerms } from './expeditionGameplay.js';
import { LESSONS, LESSON_STATUS_LABELS, getLesson, getLessonStepContent, getLessonAvailability } from './onboardingLessons.js';
import { isGuidedOnboardingActive, refreshGuidedOnboarding, recordGuidedOnboardingEvent,
  replayGuidedOnboarding, guidedAfterReset, pauseGuidedPageTour } from './guidedOnboardingController.js';
import { getPetImageSrc } from './imagePreloadService.js';

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
let guideSignature = '';
let lessonCompleted = null;
let collapsed = false;
let pendingWrite = Promise.resolve();
let dockObserver = null;
let rootHome;

function enqueue(action) {
  const next = pendingWrite.then(action);
  pendingWrite = next.catch((error) => {
    console.warn('[Onboarding] update failed:', error);
    navigation?.showToast?.('教學進度還沒存好，請再試一次。', 'error');
  });
  return pendingWrite;
}

function escapeText(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function lessonContent() {
  const id = record?.activeLesson;
  return id ? getLessonStepContent(id, record.lessons[id].step, appState) : null;
}

function ownedPets() {
  return (appState?.enrichedCollection || []).filter((pet) => pet.owned);
}

function singleCost() {
  const pool = resolveActivePool(appState?.poolsData, appState?.gachaStats?.selectedPoolId);
  return pool ? resolveDrawCost(pool, 1) : 100;
}

function expeditionTerms() {
  const area = appState?.expeditionAreas?.find((entry) => entry.id === 'mist_forest');
  return getDispatchTerms(area || { id: 'mist_forest', energyCost: 3, durationMinutes: 15 }, appState?.firstJourneyAvailable === true);
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
          ? `「${task.title || '這件任務'}」完成後，點「完成」可獲得星塵和冒險能量；有設定陪伴時也會提升牠的親密度。還沒做完就留著，無須提前勾選。`
          : '建立真正要做的任務；做完後點「完成」可得到星塵、能量與陪伴夥伴親密度，重要程度會影響獎勵。',
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
            ? '已顯示你獲得的夥伴；點「設為陪伴」，牠就會出現在任務首頁。一起完成任務、撫摸或送禮可累積親密度；Lv.2 起能從「故事與同行」閱讀專屬故事，再選自己的任務或習慣完成約定。'
            : '切到「已獲得」，就能快速找到剛召喚的夥伴。再點「設為陪伴」，牠會出現在任務首頁。親密度 Lv.2 起有專屬故事與同行約定，可以跟著自己的日常慢慢解鎖。'
          : '召喚得到的寵物會收進圖鑑；之後用「已獲得」篩選，再選一隻設為陪伴。',
        primary: ['前往圖鑑', 'locate-collection'],
        secondary: ['稍後再選夥伴', 'later-collection'],
      };
    case 'expedition': {
      const terms = expeditionTerms();
      return {
        title: '帶夥伴去探險',
        body: `迷霧森林${terms.firstJourney ? '首次短程' : '行程'}消耗 ${terms.energyCost} 點冒險能量、歷時 ${terms.durationMinutes} 分鐘；你目前有 ${energy} 點。選 1～3 隻夥伴，再選探索、採集或羈絆目標；一隻也能出發。回來後閱讀旅程報告並領取獎勵，沒有逾期損失。${ownedPets().length && energy >= terms.energyCost ? '現在就可以試著派遣。' : '條件不足也可以先完成教學。'}`,
        primary: ['查看探險', 'locate-expedition'],
        secondary: ['完成教學', 'finish'],
      };
    }
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
  if (record.activeLesson || lessonCompleted) {
    // Product dialogs may replace their body. Remount only when its host changes;
    // rendering on every descendant mutation would observe our own teaching DOM.
    const paused = hasActivePresentation() && Boolean(document.querySelector('#confirm-cancel, .dream-bloom-overlay, .dream-debut-overlay, .summon-reveal-overlay'));
    if (!root.isConnected || root.parentElement !== growthHost() || root.hidden !== paused) render();
    return;
  }
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
  const lesson = lessonContent();
  if (lesson) {
    if (currentView() !== lesson.target.view) return null;
    return document.querySelector(lesson.selector) || document.getElementById(`view-${lesson.target.view}`)?.querySelector('h1');
  }
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
  // Basic practice status belongs to the guided controller; legacy lessons only
  // render their own chapter progress and must not overwrite its replay label.
  if (!record) return;
  const chapters = document.getElementById('guide-chapters');
  if (!chapters) return;
  const signature = JSON.stringify([record.lessons, LESSONS.map((lesson) => getLessonAvailability(lesson.id, appState))]);
  if (guideSignature === signature) return;
  const focusedAction = chapters.contains(document.activeElement) ? document.activeElement.dataset.onboardingAction : null;
  chapters.innerHTML = LESSONS.map((lesson, index) => {
    const progress = record.lessons[lesson.id];
    const resumable = ['active', 'paused'].includes(progress.status);
    const label = resumable ? '繼續本章' : progress.status === 'new' ? '開始本章' : '重看與練習';
    return `<article class="guide-chapter card" aria-labelledby="guide-chapter-${lesson.id}">
      <div class="guide-chapter__top"><span>第 ${index + 1} 章 · ${lesson.steps.length} 個小步驟</span><span class="guide-chapter__status" data-status="${progress.status}">${LESSON_STATUS_LABELS[progress.status]}</span></div>
      <span class="growth-chapter-icon" aria-hidden="true">${lesson.icon}</span>
      <h3 id="guide-chapter-${lesson.id}">${lesson.title}</h3>
      <p>${lesson.summary}</p>
      <p class="growth-outcome">${lesson.outcome}</p>
      <details class="guide-chapter__help"><summary>開始前的小提醒</summary><p>${escapeText(getLessonAvailability(lesson.id, appState))}</p></details>
      ${resumable ? `<p class="guide-chapter__resume">進度 ${lesson.steps.indexOf(progress.step) + 1} / ${lesson.steps.length}：${getLessonStepContent(lesson.id, progress.step, appState).title}</p>` : ''}
      <button class="btn btn--primary" type="button" data-onboarding-action="lesson:${lesson.id}" aria-label="${label}：${lesson.title}">${label} · ${lesson.steps.length} 步</button>
    </article>`;
  }).join('');
  guideSignature = signature;
  if (focusedAction) chapters.querySelector(`[data-onboarding-action="${focusedAction}"]`)?.focus({ preventScroll: true });
}

function render() {
  if (!root || !record) return;
  if (isGuidedOnboardingActive()) { root.replaceChildren(); clearHighlight(); refreshGuidedOnboarding(); return; }
  renderGuideStatus();
  const growth = Boolean(record.activeLesson || lessonCompleted);
  document.body.classList.toggle('growth-learning', growth);
  mountGrowthCoach(growth);
  if (hasActivePresentation() && (!growth || document.querySelector('#confirm-cancel') || document.querySelector('.dream-bloom-overlay, .dream-debut-overlay, .summon-reveal-overlay'))) {
    root.hidden = true;
    clearHighlight();
    return;
  }
  root.hidden = false;
  const lesson = getLesson(record.activeLesson);
  const progress = lesson ? record.lessons[lesson.id] : null;
  const chapterContent = lessonContent();
  const content = chapterContent ? { ...chapterContent,
    primary: [chapterContent.action, 'lesson-locate'],
    secondary: [progress.step === lesson.steps.at(-1) ? '我了解了，完成本章' : lesson.practice[progress.step] ? '先了解，下一步' : '下一步', 'lesson-next'],
  } : record.status === 'active' ? stepContent() : null;
  const coachBrief = content?.brief || ({
    task: '記下一件真正想做的事。今天要做，就加入今日計畫。',
    reward: '真的做完後再點「完成」，星塵與能量就會入帳。',
    summon: '用星塵召喚第一位夥伴。資源不夠也可以稍後再來。',
    collection: '在圖鑑選一隻設為陪伴。Lv.2 起，一起閱讀故事、完成約定。',
    expedition: '選地區、夥伴與目標，確認能量花費後出發。',
  })[record.step];
  const signature = JSON.stringify({ record, content, showCompletion, lessonCompleted, collapsed });
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
            <p>完成一件小事，遇見一位夥伴。</p>
            <p class="onboarding-dialog__hint">用自己的任務試試看。隨時可以停下來。</p>
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
            <h2 id="onboarding-done-title">接下來，照自己的步調走</h2>
            <p>Lv.2 起，聽夥伴的故事，再選一件小事一起完成約定。</p>
            <p class="onboarding-dialog__hint">想了解更多，隨時到「更多 → 使用教學」。</p>
            <div class="onboarding-dialog__actions">
              <button class="btn btn--primary" type="button" data-onboarding-action="close-summary">開始使用</button>
              <button class="btn btn--ghost" type="button" data-onboarding-action="summary-guide">查看使用教學</button>
            </div>
          </section>
        </div>`;
    } else if (lessonCompleted) {
      const completed = getLesson(lessonCompleted);
      const practiced = record.lessons[lessonCompleted].status === 'practiced';
      const nextChapter = LESSONS[LESSONS.findIndex((entry) => entry.id === lessonCompleted) + 1];
      root.innerHTML = `<aside class="onboarding-dock onboarding-lesson-dock growth-coach" aria-label="章節完成">
        <div role="status"><h2>${completed.title}：${practiced ? '已完成實作' : '已了解'}</h2>
        <p>${practiced ? '本章的實作紀錄已保存，可以繼續下一章。' : '閱讀進度已保存；尚未實作的操作，可等資源或時間足夠時再練習。'}</p></div>
        <div class="onboarding-dock__actions">${nextChapter ? `<button class="btn btn--primary" type="button" data-onboarding-action="lesson:${nextChapter.id}">繼續下一章：${nextChapter.title}</button><button class="btn btn--secondary" type="button" data-onboarding-action="lesson-guide">返回成長教學</button>` : '<button class="btn btn--primary" type="button" data-onboarding-action="lesson-guide">完成這段成長旅程</button>'}
        <button class="btn btn--ghost btn--sm" type="button" data-onboarding-action="lesson-close">繼續使用 App</button></div></aside>`;
    } else if (content) {
      root.innerHTML = `
        <aside class="onboarding-dock${lesson ? ' onboarding-lesson-dock growth-coach' : ''}" data-step="${lesson ? progress.step : record.step}" data-collapsed="${collapsed}" aria-label="${lesson ? lesson.title : '新手教學'}">
          <div class="onboarding-dock__top">
            <span>${lesson ? `${lesson.title} ${lesson.steps.indexOf(progress.step) + 1} / ${lesson.steps.length}` : `新手教學 ${STEP_NUMBER[record.step]} / 5`}</span>
            <button type="button" data-onboarding-action="collapse" aria-expanded="${!collapsed}" aria-controls="onboarding-step-body">${collapsed ? '展開' : '收起'}</button>
            <button type="button" data-onboarding-action="${lesson ? 'lesson-pause' : 'pause'}">稍後</button>
          </div>
          ${lesson ? growthCompanionMarkup() : ''}
          <h2 tabindex="-1">${escapeText(content.title)}</h2>
          ${lesson ? `<ol class="growth-step-rail" aria-label="本章步驟">${lesson.steps.map((step, i) => `<li ${step === progress.step ? 'aria-current="step"' : ''}><span>${i + 1}</span>${escapeText(getLessonStepContent(lesson.id, step, appState).title)}</li>`).join('')}</ol>` : ''}
          <progress class="onboarding-progress" value="${lesson ? lesson.steps.indexOf(progress.step) + 1 : STEP_NUMBER[record.step]}" max="${lesson ? lesson.steps.length : 5}" aria-label="教學進度"></progress>
          <div id="onboarding-step-body" ${collapsed ? 'hidden' : ''}>
          <p class="onboarding-brief" aria-live="polite" aria-atomic="true">${escapeText(coachBrief || content.body)}</p>
          ${lesson && lesson.practice[progress.step] ? '<p class="growth-practice-note">可以親手試試；條件還不足或想保留資源，也能先了解，之後再實作。</p>' : ''}
          <div class="onboarding-dock__actions">
            <button class="btn btn--primary btn--sm" type="button" data-onboarding-action="${content.primary[1]}">${content.primary[0]}</button>
            <button class="btn btn--ghost btn--sm" type="button" data-onboarding-action="${content.secondary[1]}">${lesson && progress.step === lesson.steps.at(-1) ? '完成教學' : content.secondary[0]}</button>
          </div>
          <div class="onboarding-dock__footer">
          <details class="onboarding-more"><summary>想了解更多</summary><ul>${(content.tips || [content.body]).map((tip) => `<li>${escapeText(tip)}</li>`).join('')}</ul></details>
          ${lesson ? `<button class="onboarding-dock__skip" type="button" data-onboarding-action="lesson-back" ${progress.step === lesson.steps[0] ? 'disabled' : ''}>上一步</button>` : '<button class="onboarding-dock__skip" type="button" data-onboarding-action="skip">略過教學</button>'}
          </div>
          </div>
        </aside>`;
    } else {
      root.replaceChildren();
    }

    document.body.classList.toggle('onboarding-dialog-open', isDialog);
    document.body.classList.toggle('onboarding-active', Boolean(content && !lesson));
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
    if (lesson) requestAnimationFrame(centerGrowthStep);
    dockObserver?.disconnect();
    const dock = root.querySelector('.onboarding-dock');
    if (dock) dockObserver?.observe(dock);
  }
  updateHighlight();
}

function centerGrowthStep() {
  const rail = root.querySelector('.growth-step-rail');
  const current = rail?.querySelector('[aria-current]');
  if (current) rail.scrollLeft = current.offsetLeft - rail.offsetLeft - (rail.clientWidth - current.offsetWidth) / 2;
}

function growthCompanionMarkup() {
  const pet = appState.companion;
  return pet ? `<div class="growth-companion"><img src="${escapeText(getPetImageSrc(pet, 'card'))}" width="44" height="44" alt=""><span>${escapeText(pet.displayName || pet.name)}陪你慢慢學</span></div>` : '<p class="growth-companion">先認識方法，準備好再與夥伴一起試。</p>';
}

function growthHost() {
  const modal = document.querySelector('#specified-invitation-dialog[open] .invitation-content')
    || document.querySelector('#identity-detail-dialog[open] .dialog-body')
    || document.querySelector('#expedition-dispatch-modal .expedition-dispatch-modal__body')
    || document.querySelector('#modal-overlay.open #modal-body');
  const view = document.querySelector('.view.active');
  const petDetail = modal?.querySelector('.pet-detail');
  return petDetail || modal || view?.querySelector('.identity-surface') || view;
}

function mountGrowthCoach(growth) {
  const host = growth ? growthHost() : rootHome;
  if (!host || root.parentElement === host) return;
  const heading = host.querySelector('.pet-detail__name');
  if (growth && heading) heading.after(root);
  else if (growth) host.prepend(root);
  else host.append(root);
  if (growth) requestAnimationFrame(centerGrowthStep);
}

async function locateLesson() {
  const content = lessonContent();
  if (!content) return;
  await navigation.openTeachingTarget(content.target);
  render();
  requestAnimationFrame(() => {
    root.querySelector('h2')?.focus({ preventScroll: true });
    root.scrollIntoView({ block: 'start', behavior: 'instant' });
    centerGrowthStep();
  });
}

async function save(next) {
  const wasCompleted = record?.status === 'completed';
  const previousLesson = record?.activeLesson;
  record = await saveOnboardingState(next);
  if (record.status === 'completed' && !wasCompleted) showCompletion = true;
  if (previousLesson && !record.activeLesson && ['understood', 'practiced'].includes(record.lessons[previousLesson].status)) lessonCompleted = previousLesson;
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
    const tallTarget = target.getBoundingClientRect().height > window.innerHeight * 0.4;
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: tallTarget ? 'start' : 'center' });
    if (!target.matches('button, input, select, textarea, a[href], [tabindex]')) target.tabIndex = -1;
    target.focus?.({ preventScroll: true });
    updateHighlight();
  });
}

async function handleAction(action) {
  if (action === 'replay' || action === 'resume') {
    await save(pauseLesson(record));
    return replayGuidedOnboarding();
  }
  if (!record) return;
  if (action === 'collapse') { collapsed = !collapsed; return render(); }
  if (action.startsWith('lesson:')) {
    await pauseGuidedPageTour();
    showCompletion = false;
    lessonCompleted = null;
    collapsed = false;
    await save(startLesson(record, action.slice(7)));
    await locateLesson();
    return;
  }
  if (action === 'lesson-next') { collapsed = false; await save(advanceLesson(record)); if (record.activeLesson) await locateLesson(); return; }
  if (action === 'lesson-back') { await save(previousLessonStep(record)); return locateLesson(); }
  if (action === 'lesson-pause') {
    const pausedId = record.activeLesson;
    await save(pauseLesson(record));
    await navigation.openTeachingTarget({ view: 'guide' });
    requestAnimationFrame(() => document.querySelector(`[data-onboarding-action="lesson:${pausedId}"]`)?.focus());
    return;
  }
  if (action === 'lesson-close' || action === 'lesson-guide') {
    lessonCompleted = null;
    render();
    if (action === 'lesson-guide') await navigation.openTeachingTarget({ view: 'guide' });
    return;
  }
  if (action === 'lesson-locate') {
    const content = lessonContent();
    if (!content) return;
    await navigation.openTeachingTarget(content.target);
    revealTarget(content.selector);
    return;
  }
  if (action.startsWith('quick:')) {
    const key = action.slice(6);
    await save(pauseLesson(record));
    if (key === 'mailbox') return navigation.openGlobalMailbox();
    const targets = { blessing: { view: 'tasks', hub: 'blessing' }, quest: { view: 'tasks', hub: 'quest' },
      habits: { view: 'habits' }, achievements: { view: 'achievements' }, settings: { view: 'settings' }, handbook: { view: 'handbook' } };
    if (targets[key]) await navigation.openTeachingTarget(targets[key]);
    return;
  }
  if (action === 'start') return setStep('task');
  if (action === 'skip') return save({ ...record, status: 'dismissed' });
  if (action === 'pause') return save({ ...record, status: 'paused' });
  if (action === 'resume') {
    lessonCompleted = null;
    collapsed = false;
    await save({ ...pauseLesson(record), status: 'active', step: record.step === 'welcome' ? 'task' : record.step });
    navigation.switchView('tasks');
    return;
  }
  if (action === 'replay') {
    showCompletion = false;
    lessonCompleted = null;
    collapsed = false;
    await save({ ...pauseLesson(record), status: 'active', step: 'task', taskId: null });
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
  rootHome = root.parentElement;
  dockObserver = new ResizeObserver(() => {
    const height = root.querySelector('.onboarding-dock')?.getBoundingClientRect().height || 0;
    document.documentElement.style.setProperty('--onboarding-coach-space', `${height + 32}px`);
  });
  const presentationObserver = new MutationObserver(syncPresentationVisibility);
  presentationObserver.observe(document.body, { childList: true, subtree: true });
  const modalOverlay = document.getElementById('modal-overlay');
  if (modalOverlay) presentationObserver.observe(modalOverlay, { attributes: true, attributeFilter: ['class'] });
  root.addEventListener('click', (event) => {
    const action = event.target.closest('[data-onboarding-action]')?.dataset.onboardingAction;
    const expected = record?.activeLesson ? `${record.activeLesson}:${record.lessons[record.activeLesson].step}` : null;
    if (action) void enqueue(() => {
      if (['lesson-next', 'lesson-back', 'lesson-locate'].includes(action)
        && expected !== (record.activeLesson ? `${record.activeLesson}:${record.lessons[record.activeLesson].step}` : null)) return;
      return handleAction(action);
    });
  });
  root.addEventListener('keydown', (event) => {
    const dialog = root.querySelector('[role="dialog"]');
    if (!dialog) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (record.status === 'new') void enqueue(() => handleAction('skip'));
      else void enqueue(() => handleAction('close-summary'));
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
    if (root.contains(event.target)) return;
    const action = event.target.closest('[data-onboarding-action]')?.dataset.onboardingAction;
    if (action) void enqueue(() => handleAction(action));
  });

  // A completed action can survive a reload even if the guide state write was interrupted.
  if (record.status === 'active' && record.step === 'reward' && record.taskId
    && appState.tasks?.some((task) => task.id === record.taskId && task.completed)) {
    void recordOnboardingEvent('task-completed', { taskId: record.taskId });
  }
  render();
  if (record.activeLesson) void enqueue(locateLesson);
}

export function refreshOnboarding() {
  render();
  refreshGuidedOnboarding();
}

export function openOnboardingEducation(feature) {
  navigation.switchView('guide');
  const detail = document.querySelector(`[data-education-feature="${CSS.escape(feature)}"]`);
  if (detail) {
    detail.open = true;
    // The preceding modal close restores its opener on the next frame. Place
    // focus after that restoration, while this requested help is still visible.
    requestAnimationFrame(() => {
      if (document.querySelector('#view-guide.active') && detail.isConnected) detail.querySelector('summary')?.focus();
    });
  }
}

export async function recordOnboardingEvent(event, detail = {}) {
  await recordGuidedOnboardingEvent(event, detail);
  return enqueue(async () => {
    if (!record) return;
    if (event === 'view-changed') {
      render();
      return;
    }
    const next = advanceOnboardingForEvent(record, event, detail);
    if (JSON.stringify(next) !== JSON.stringify(record)) {
      const wasLesson = record.activeLesson;
      await save(next);
      if (wasLesson && record.activeLesson) await locateLesson();
    } else {
      render();
    }
  });
}

export async function showOnboardingAfterReset() {
  await guidedAfterReset();
  lessonCompleted = null;
  collapsed = false;
  await save({ status: 'dismissed', step: 'welcome', taskId: null });
}

export async function dismissOnboardingAfterRestore() {
  await guidedAfterReset(true);
  showCompletion = false;
  lessonCompleted = null;
  await save({ status: 'dismissed', step: 'welcome', taskId: null });
}
