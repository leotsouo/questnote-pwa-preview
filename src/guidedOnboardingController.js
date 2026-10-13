/** A coach over real product controls; all checkpoints belong to the service. */
import { dbGet, STORES } from './db.js';
import { GUIDED_KEY, GUIDED_STEPS, tutorialDraft } from './guidedOnboardingCore.js';
import { advanceGuidedOnboarding, recoverGuidedOnboarding, startGuidedReplay,
  resetGuidedAfterDataReset, dismissGuidedAfterRestore, acknowledgeGuidedHint } from './guidedOnboardingService.js';
import { GUIDED_EDUCATION, contextualEducation } from './guidedEducation.js';
import { PAGE_LESSONS, readPageTour, savePageTour } from './guidedPageTour.js';
import { getPetImageSrc } from './imagePreloadService.js';
import { reactTwilightCompanion } from './twilightPresentation.js';

let record;
let app;
let navigation;
let root;
let target;
let priorTargetDescription;
let queue = Promise.resolve();
let skipOpen = false;
let holdTimer;
let holdStarted;
let resizeObserver;
let signature = '';
let repairing = false;
let layoutFrame;
let hintFeature;
let pageTour;
let tourTarget;
const inertElements = new Map();
const pendingSkipKey = () => `questnote-guided-skip-pending:${location.pathname}`;
const skipPending = () => { try { return sessionStorage.getItem(pendingSkipKey()) === '1'; } catch { return false; } };
const rememberSkip = (pending) => { try { if (pending) sessionStorage.setItem(pendingSkipKey(), '1'); else sessionStorage.removeItem(pendingSkipKey()); } catch { /* Session storage is optional. */ } };
const escape = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CONTENT = {
  WELCOME: ['從一件小事，一起出發', '我們會一起新增、完成一個練習任務。只需幾分鐘，不用先想內容。', '一起試一次'],
  MEET_COMPANION: ['這是陪你出發的夥伴', '完成生活中的小事，牠的親密度也會一起累積。慢慢來，我陪你。', '一起往前'],
  HOME_INTRO: ['今天要做的事，在這裡', '「今日」會列出今天安排的任務。接著，我們放進第一個練習。', '我找到今日任務了'],
  OPEN_CREATE_QUEST: ['新增你的第一個 Quest', '點一下「新增任務」。夥伴會陪你準備。'],
  CREATE_TUTORIAL_QUEST: ['這次，我們先幫你準備好了', '內容與今天的日期都已填好。點表單的「新增」，親手建立它。'],
  RETURN_HOME: ['你的任務，已經在今日', '這就是剛才建立的練習任務。平常新增的任務也會出現在這裡。', '我找到它了'],
  COMPLETE_TUTORIAL_QUEST: ['現在，試著完成它', '你已做完「新增任務」的練習。點一下這個任務的「完成」。'],
  REWARD_REVEAL: ['每一次完成，都往前一點', '任務完成後，會得到星塵與冒險能量，陪伴夥伴也會累積親密度。', '看看夥伴'],
  COMPANION_REACTION: ['你做到了，我也往前了一點', '剛才的完成，讓夥伴增加了 5 點親密度。下一次，換成你生活中的小事。', '一起繼續'],
  FINISH: ['接下來，換成你的 Quest', '你已親手新增並完成一次。想再練習，隨時到「更多 → 使用教學」。', '新增自己的任務'],
};

export const isGuidedOnboardingActive = () => record?.status === 'active';
export const getGuidedTutorialDraft = () => tutorialDraft(record);

function run(action) {
  const next = queue.then(action).catch((error) => {
    console.warn('[Guided practice]', error);
    feedback('這一步還沒存好。請再試一次；也可以從「略過教學」離開。');
    if (!isGuidedOnboardingActive()) navigation.showToast?.('教學進度還沒存好，請再試一次。', 'error');
  });
  queue = next;
  return next;
}

function feedback(message = '先完成這一步，我們等等再看這裡。') {
  const status = root?.querySelector('.guided-feedback');
  if (status) { status.textContent = ''; requestAnimationFrame(() => { status.textContent = message; }); }
}

function releaseLock() {
  for (const [element, value] of inertElements) element.inert = value;
  inertElements.clear();
  if (priorTargetDescription !== undefined && target) {
    if (priorTargetDescription === null) target.removeAttribute('aria-describedby');
    else target.setAttribute('aria-describedby', priorTargetDescription);
    priorTargetDescription = undefined;
  }
  target?.classList.remove('guided-target');
  document.body.classList.remove('guided-active', 'guided-editor');
}

function lockAround(allowed) {
  const visit = (parent) => {
    for (const child of parent.children) {
      if (['SCRIPT', 'STYLE', 'LINK'].includes(child.tagName)) continue;
      if (allowed.some((node) => child === node)) continue;
      if (allowed.some((node) => child.contains(node))) visit(child);
      else { inertElements.set(child, child.inert); child.inert = true; }
    }
  };
  visit(document.body);
}

function findTarget() {
  const task = record?.taskId ? `.task-card[data-id="${CSS.escape(record.taskId)}"]` : null;
  switch (record?.step) {
    case 'MEET_COMPANION': case 'COMPANION_REACTION': return document.querySelector('#twilight-home');
    case 'HOME_INTRO': return document.querySelector('#task-view-tabs');
    case 'OPEN_CREATE_QUEST': return document.querySelector('.twilight-add-task') || document.querySelector('#btn-add-task');
    case 'CREATE_TUTORIAL_QUEST': return document.querySelector('#task-form button[type="submit"]');
    case 'RETURN_HOME': return document.querySelector(task);
    case 'COMPLETE_TUTORIAL_QUEST': return document.querySelector(`${task} [data-action="toggle"]`);
    default: return null;
  }
}

function positionSpotlight() {
  if (!isGuidedOnboardingActive() || skipOpen) return;
  const box = target?.getBoundingClientRect();
  const height = window.visualViewport?.height || window.innerHeight;
  const width = document.documentElement.clientWidth;
  const coach = root.querySelector('.guided-coach');
  if (!coach) return;
  // At large text sizes the coach must leave room for the real control.
  // Its content stays scrollable rather than covering the highlighted target.
  coach.style.maxHeight = box && !skipOpen ? Math.max(120, height * (record.step === 'CREATE_TUTORIAL_QUEST' ? .48 : .55)) + 'px' : '';
  // Keep the instruction and real control apart. Tall cards remain scrollable.
  const coachHeight = coach.getBoundingClientRect().height;
  const above = box && box.top > coachHeight + 28;
  coach.dataset.position = above ? 'top' : 'bottom';
  if (box && ['OPEN_CREATE_QUEST', 'COMPLETE_TUTORIAL_QUEST', 'RETURN_HOME'].includes(record.step)) {
    const desired = above ? Math.min(height - box.height - 12, coachHeight + 28)
      : Math.max(20, (height - coachHeight - 28 - box.height) / 2);
    const overlaps = above ? box.top < coachHeight + 24 : box.bottom > height - coachHeight - 24;
    if (overlaps && Math.abs(box.top - desired) > 2) {
      window.scrollBy({ top: box.top - desired, behavior: 'instant' });
      requestAnimationFrame(positionSpotlight);
      return;
    }
  }
  root.style.setProperty('--guided-coach-height', `${coachHeight}px`);
  document.documentElement.style.setProperty('--guided-coach-height', `${coachHeight}px`);
  const gap = 7;
  const left = Math.max(0, (box?.left || 0) - gap);
  const right = Math.min(width, (box?.right || 0) + gap);
  const top = Math.max(0, (box?.top || 0) - gap);
  const bottom = Math.min(height, (box?.bottom || 0) + gap);
  const panels = root.querySelectorAll('.guided-shade');
  const rectangles = box ? [ [0, 0, width, top], [0, bottom, width, height - bottom],
    [0, top, left, bottom - top], [right, top, width - right, bottom - top] ] : [[0, 0, width, height]];
  panels.forEach((panel, i) => {
    const r = rectangles[i];
    panel.hidden = !r;
    if (r) Object.assign(panel.style, { left: `${r[0]}px`, top: `${r[1]}px`, width: `${Math.max(0, r[2])}px`, height: `${Math.max(0, r[3])}px` });
  });
  const ring = root.querySelector('.guided-ring');
  ring.hidden = !box;
  if (box) Object.assign(ring.style, { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${Math.max(0, bottom - top)}px` });
}

function settleSpotlight() {
  cancelAnimationFrame(layoutFrame);
  // Follow the product modal's entrance/scroll layout without advancing any lesson.
  const until = performance.now() + 600;
  const update = () => {
    positionSpotlight();
    if (isGuidedOnboardingActive() && performance.now() < until) layoutFrame = requestAnimationFrame(update);
  };
  layoutFrame = requestAnimationFrame(update);
}

function companionMarkup() {
  const pet = app.companion || app.allPets?.find((p) => p.id === 'pet_n01');
  const name = pet?.displayName || pet?.name || '小夥伴';
  return `<div class="guided-companion"><img src="${escape(pet ? getPetImageSrc(pet, 'card') : 'assets/icons/icon-192.png')}" alt="" width="56" height="56"><span>${escape(name)}陪你一起${record.mode === 'replay' ? '練習' : '出發'}</span></div>`;
}

function updateHelp() {
  document.body.classList.toggle('guided-learned', ['completed', 'skipped'].includes(record?.status));
  const label = document.querySelector('#guide-tutorial-status');
  const button = document.querySelector('#guide-tutorial-button');
  if (label) label.textContent = isGuidedOnboardingActive() ? '進度已保存，可接著完成這次練習。' : '親手練習新增與完成任務。再次練習不會重複發放獎勵。';
  if (button) { button.textContent = isGuidedOnboardingActive() ? '繼續基本操作練習' : '再次學習基本操作'; button.dataset.onboardingAction = 'replay'; }
}

export function refreshGuidedOnboarding() {
  if (!root || !record) return;
  updateHelp();
  if (!isGuidedOnboardingActive()) {
    releaseLock(); root.replaceChildren(); signature = '';
    document.dispatchEvent(new CustomEvent('questnote:guided-state-change'));
    renderPageTour();
    if (hintFeature && !document.querySelector('.guided-feature-hint')) renderContextualHint(hintFeature);
    return;
  }
  document.querySelectorAll('.guided-feature-hint').forEach((hint) => hint.remove());
  releaseLock();
  document.dispatchEvent(new CustomEvent('questnote:guided-state-change'));
  document.body.classList.add('guided-active');
  document.body.classList.toggle('guided-editor', record.step === 'CREATE_TUTORIAL_QUEST');
  target = findTarget();
  if (!skipOpen && target?.matches('button')) {
    priorTargetDescription = target.getAttribute('aria-describedby');
    target.setAttribute('aria-describedby', `${priorTargetDescription || ''} guided-instruction`.trim());
  }
  target?.classList.add('guided-target');
  const nextSignature = JSON.stringify([record.step, skipOpen, record.mode, app.companion?.id, Boolean(target)]);
  if (signature !== nextSignature) {
    const [title, instruction, action] = CONTENT[record.step];
    const text = record.mode === 'replay' && record.step === 'COMPANION_REACTION'
      ? '這是完成任務時的陪伴反應。真正完成自己的任務時，牠會一起累積親密度。' : instruction;
    const chapter = GUIDED_STEPS.indexOf(record.step) < 3 ? 0 : GUIDED_STEPS.indexOf(record.step) < 7 ? 1 : 2;
    const reward = record.reward;
    root.innerHTML = `<div class="guided-shades" aria-hidden="true">${Array.from({ length: 4 }, () => '<div class="guided-shade"></div>').join('')}</div><div class="guided-ring" aria-hidden="true"></div>
      <section class="guided-coach" role="${skipOpen ? 'dialog' : 'region'}" ${skipOpen ? 'aria-modal="true"' : ''} aria-labelledby="guided-title" aria-describedby="guided-instruction" tabindex="-1">
        <ol class="guided-chapters" aria-label="練習進度">${['相遇', '動手', '一起成長'].map((label, i) => `<li ${i === chapter ? 'aria-current="step"' : ''}>${i < chapter ? '<span aria-hidden="true">✓ </span>' : ''}${label}</li>`).join('')}</ol>
        ${companionMarkup()}
        <h2 id="guided-title">${skipOpen ? '確定要略過教學嗎？' : title}</h2>
        <p id="guided-instruction" aria-live="polite">${skipOpen ? '這次練習會帶你親手完成一次任務，大約只需幾分鐘。之後也能到使用教學重新練習。' : text}</p>
        ${!skipOpen && record.step === 'WELCOME' && record.mode === 'first' ? '<p class="guided-note">第一位夥伴會在下一步與你相遇。</p>' : ''}
        ${!skipOpen && record.mode === 'replay' ? '<p class="guided-note">再次練習 · 獎勵為示範，不會更動星塵、能量或親密度。</p>' : ''}
        ${!skipOpen && record.step === 'REWARD_REVEAL' ? `<dl class="guided-receipt"><div><dt>星塵</dt><dd>+${reward?.amount || 20}</dd></div><div><dt>能量</dt><dd>+${reward?.energy || 1}</dd></div><div><dt>親密度</dt><dd>+${reward?.bondAmount || 5}</dd></div></dl><p class="guided-note">${reward?.preview ? '示範收穫，沒有重複發放。' : '已存入星塵、能量與夥伴紀錄。'}</p>` : ''}
        ${!skipOpen && record.step === 'COMPANION_REACTION' && record.mode === 'replay' ? '<p class="guided-note">真正完成自己的任務時，夥伴才會增加親密度。</p>' : ''}
        <p class="guided-feedback" role="status" aria-live="polite"></p>
        <div class="guided-actions">${skipOpen ? '<button type="button" class="btn btn--primary" data-guided-action="cancel-skip">繼續練習</button><button type="button" class="btn btn--secondary guided-hold" data-guided-action="hold-skip" aria-describedby="guided-hold-help">長按 1.5 秒略過<span class="guided-hold-progress" aria-hidden="true"></span></button><p id="guided-hold-help" class="guided-note">不方便長按？可直接使用下方確認按鈕。</p><button type="button" class="guided-link" data-guided-action="confirm-skip">確認略過教學</button>'
          : action ? `<button type="button" class="btn btn--primary" aria-describedby="guided-instruction" data-guided-action="${record.step === 'FINISH' ? 'finish-create' : 'acknowledge'}">${action}</button>` : target ? '<span class="guided-action-hint">請點畫面上亮起的按鈕</span>' : '<button type="button" class="btn btn--secondary" data-guided-action="repair">重新開啟這一步</button>'}
          ${!skipOpen && record.step === 'FINISH' ? '<button type="button" class="btn btn--secondary" data-guided-action="finish-growth">帶著夥伴繼續成長</button><button type="button" class="btn btn--secondary" data-guided-action="finish-home">先回今日任務</button>' : ''}
          ${!skipOpen ? '<button type="button" class="guided-link" data-guided-action="skip">略過教學</button>' : ''}
        </div>
      </section>`;
    signature = nextSignature;
    resizeObserver.disconnect();
    resizeObserver.observe(root.querySelector('.guided-coach'));
    requestAnimationFrame(() => {
      positionSpotlight();
      settleSpotlight();
      if (target) target.scrollIntoView({ block: 'center', behavior: 'instant' });
      const focus = root.querySelector(skipOpen ? '[data-guided-action="cancel-skip"]' : '[data-guided-action="acknowledge"], [data-guided-action="finish-create"]');
      (focus || target || root.querySelector('.guided-coach')).focus({ preventScroll: true });
      positionSpotlight();
    });
  }
  const actionTarget = ['OPEN_CREATE_QUEST', 'CREATE_TUTORIAL_QUEST', 'COMPLETE_TUTORIAL_QUEST'].includes(record.step);
  const editor = record.step === 'CREATE_TUTORIAL_QUEST' ? document.querySelector('#task-form') : null;
  lockAround([root, ...(!skipOpen && editor ? [editor] : !skipOpen && actionTarget && target ? [target] : [])]);
  // Inputs are shown as real prefilled controls; creating the task is the one required action.
  if (record.step === 'CREATE_TUTORIAL_QUEST') {
    document.querySelector('#task-form')?.classList.add('guided-task-form');
    document.querySelectorAll('#task-form input, #task-form textarea').forEach((field) => { field.readOnly = true; });
  }
  positionSpotlight();
}

async function repairPresentation() {
  if (repairing || !isGuidedOnboardingActive()) return;
  repairing = true;
  try {
    if (record.step === 'CREATE_TUTORIAL_QUEST') {
      if (!document.querySelector('#task-form')) navigation.openTaskForm();
    } else {
      if (document.querySelector('.modal-overlay.open') || !document.querySelector('#view-tasks.active')) navigation.showGuidedHome();
    }
  } finally { repairing = false; }
  refreshGuidedOnboarding();
}

async function action(name, expected = {}) {
  if (name === 'repair') { record = await recoverGuidedOnboarding(); navigation.showGuidedHome(); await repairPresentation(); return; }
  if (name === 'skip') { skipOpen = true; signature = ''; refreshGuidedOnboarding(); return; }
  if (name === 'cancel-skip') { stopHold(); skipOpen = false; signature = ''; refreshGuidedOnboarding(); return; }
  if (name === 'confirm-skip') {
    let saved = true;
    try { record = await advanceGuidedOnboarding('skip-confirmed', { expectedRunId: expected.expectedRunId }); rememberSkip(false); }
    catch {
      saved = false; record = { ...record, status: 'skipped' };
      rememberSkip(true);
    }
    skipOpen = false; releaseLock(); navigation.showGuidedHome();
    refreshGuidedOnboarding(); navigation.showToast?.(saved ? '教學已略過。新增任務時會有小提醒；也能到「更多 → 使用教學」再次練習。' : '這次已離開教學。儲存暫時失敗，下次開啟會重試保存略過選擇。', 'info', 6500); return;
  }
  if (name === 'finish-create' || name === 'finish-home' || name === 'finish-tour' || name === 'finish-growth') {
    record = await advanceGuidedOnboarding('finish', expected); releaseLock(); refreshGuidedOnboarding(); navigation.showGuidedHome();
    if (record.status === 'completed' && name === 'finish-create') navigation.openTaskForm();
    if (record.status === 'completed' && name === 'finish-tour') await movePageTour('start');
    if (record.status === 'completed' && name === 'finish-growth') navigation.showGrowthHelp?.();
    return;
  }
  if (name === 'acknowledge') {
    record = await advanceGuidedOnboarding('acknowledge', expected);
    if (record.step === 'MEET_COMPANION') await navigation.refreshState();
    if (record.step === 'COMPANION_REACTION') reactTwilightCompanion('你做到了。接下來，我也陪你一起。');
    await repairPresentation();
  }
}

function stopHold() {
  clearTimeout(holdTimer); holdStarted = null;
  root?.querySelector('.guided-hold')?.classList.remove('is-holding');
}

export async function recordGuidedOnboardingEvent(event, detail = {}) {
  if (!root) return;
  const expected = { expectedStep: record?.step, expectedRunId: record?.runId };
  return run(async () => {
    if (skipPending()) {
      try { record = await advanceGuidedOnboarding('skip-confirmed'); rememberSkip(false); }
      catch { record = { ...record, status: 'skipped' }; }
    } else if (event === 'editor-opened') record = await advanceGuidedOnboarding(event, expected);
    else if (['task-created', 'task-completed', 'foreground', 'navigation'].includes(event)) record = await recoverGuidedOnboarding();
    if (event === 'foreground') { pageTour = await readPageTour(); await navigation.refreshState(); }
    await repairPresentation(); refreshGuidedOnboarding();
    if (event === 'view-changed' && !isGuidedOnboardingActive()) await contextualHint(detail.viewName);
    if (event === 'pet-care-opened' && !isGuidedOnboardingActive()) await contextualHint('pet-care');
  });
}

async function contextualHint(view) {
  document.querySelectorAll('.guided-feature-hint:not(.guided-page-tour)').forEach((hint) => hint.remove());
  hintFeature = view;
  // Do not replace the local unlocked exit with the failed checkpoint on disk.
  if (skipPending()) return;
  // The old timed toast did not prove the explanation was read. Only an explicit
  // dismissal acknowledges this new education; navigating away keeps it available.
  record = await dbGet(STORES.META, GUIDED_KEY) || record;
  renderContextualHint(view);
}

function renderContextualHint(view) {
  if (skipPending() || pageTour?.status === 'active' || document.querySelector('#onboarding-root .onboarding-dock')) return;
  const hint = contextualEducation(record, view);
  const viewHost = document.querySelector(`#view-${CSS.escape(view)}.active`);
  const host = view === 'pet-care' ? document.querySelector('#modal-overlay.open .pet-detail')
    : view === 'tasks' && document.querySelector('#task-form') ? document.querySelector('#task-form')
    : viewHost?.querySelector('.identity-surface') || viewHost;
  if (!hint || !host) return;
  const card = document.createElement('aside');
  card.className = 'guided-feature-hint card';
  card.setAttribute('aria-labelledby', 'guided-feature-title');
  const body = host.matches('#task-form') ? '寫下一件你想做的事，再點「新增」。今天做完後，回到今日任務，點那一件任務的「完成」。' : hint.body;
  card.innerHTML = `<p class="guided-note">第一次來這裡 · 小提醒</p><h2 id="guided-feature-title">${escape(hint.title)}</h2><p>${escape(body)}</p>
    <div class="guided-feature-actions"><button type="button" class="btn btn--secondary" data-guided-hint-dismiss="${escape(view)}">我知道了</button>
    <button type="button" class="guided-link" data-guided-hint-help="${escape(view)}">查看使用教學</button></div>`;
  const header = [...host.children].find((child) => child.matches('header, .pet-detail__name'));
  if (header) header.after(card); else host.prepend(card);
  // Optional education does not move focus, lock controls or expire for slow readers.
}

export function showSkippedEditorHint() {
  if (record?.status === 'skipped') void run(() => contextualHint('tasks'));
}

export async function replayGuidedOnboarding() {
  return run(async () => {
    rememberSkip(false);
    record = isGuidedOnboardingActive() ? await recoverGuidedOnboarding() : await startGuidedReplay();
    navigation.showGuidedHome(); signature = ''; await repairPresentation();
  });
}

export async function pauseGuidedPageTour() {
  if (pageTour?.status === 'active') pageTour = await savePageTour('pause', pageTour.cursor);
  renderPageTour();
}

export async function initGuidedOnboarding(state, handlers) {
  app = state; navigation = handlers; record = await dbGet(STORES.META, GUIDED_KEY);
  pageTour = await readPageTour();
  if (skipPending() && record?.status === 'active') {
    try { record = await advanceGuidedOnboarding('skip-confirmed'); rememberSkip(false); }
    catch { record = { ...record, status: 'skipped' }; }
  }
  root = document.querySelector('#guided-onboarding-root');
  new MutationObserver(() => {
    if (pageTour?.status === 'active' && !isGuidedOnboardingActive()
      && !document.querySelector('.view.active .guided-page-tour')) renderPageTour();
  }).observe(document.querySelector('#app'), { childList: true, subtree: true });
  resizeObserver = new ResizeObserver(positionSpotlight);
  root.addEventListener('click', (event) => {
    const name = event.target.closest('[data-guided-action]')?.dataset.guidedAction;
    const expected = { expectedStep: record?.step, expectedRunId: record?.runId };
    if (name && name !== 'hold-skip') void run(() => action(name, expected));
    else if (event.target.closest('.guided-shade')) feedback();
  });
  root.addEventListener('pointerdown', (event) => {
    const hold = event.target.closest('.guided-hold');
    if (!hold || event.button !== 0) return;
    event.preventDefault(); stopHold(); holdStarted = performance.now();
    try { hold.setPointerCapture(event.pointerId); } catch { /* Synthetic/switch input may not own a pointer. */ }
    hold.classList.add('is-holding');
    const expected = { expectedRunId: record?.runId };
    holdTimer = setTimeout(() => { stopHold(); void run(() => action('confirm-skip', expected)); }, 1500);
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) root.addEventListener(name, stopHold);
  root.addEventListener('pointermove', (event) => {
    if (!holdStarted) return;
    const r = root.querySelector('.guided-hold')?.getBoundingClientRect();
    if (!r || event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) stopHold();
  });
  document.addEventListener('visibilitychange', () => { stopHold(); if (!document.hidden) void recordGuidedOnboardingEvent('foreground'); });
  window.addEventListener('popstate', () => { if (isGuidedOnboardingActive()) void recordGuidedOnboardingEvent('navigation'); });
  window.addEventListener('resize', positionSpotlight);
  document.addEventListener('transitionend', positionSpotlight, true);
  document.addEventListener('animationend', positionSpotlight, true);
  window.visualViewport?.addEventListener('resize', positionSpotlight);
  window.visualViewport?.addEventListener('scroll', positionSpotlight);
  document.addEventListener('scroll', positionSpotlight, true);
  const permitted = (element) => root.contains(element) || (!skipOpen && ['OPEN_CREATE_QUEST', 'CREATE_TUTORIAL_QUEST', 'COMPLETE_TUTORIAL_QUEST'].includes(record.step) && target?.contains(element));
  document.addEventListener('click', (event) => {
    const tourButton = event.target.closest('[data-page-tour-action]');
    if (tourButton && !isGuidedOnboardingActive()) {
      const expectedCursor = pageTour?.cursor;
      void run(() => movePageTour(tourButton.dataset.pageTourAction, expectedCursor));
    }
    if (!isGuidedOnboardingActive() || permitted(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation(); feedback();
  }, true);
  document.addEventListener('keydown', (event) => {
    if (!isGuidedOnboardingActive()) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); void run(() => action(skipOpen ? 'cancel-skip' : 'skip')); return; }
    if (event.key === 'Tab') {
      const controls = [...root.querySelectorAll('button:not(:disabled)')];
      if (!skipOpen && target?.matches('button')) controls.unshift(target);
      const index = controls.indexOf(document.activeElement);
      const next = controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length];
      event.preventDefault(); event.stopImmediatePropagation(); next?.focus();
    } else if (!permitted(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); feedback(); }
  }, true);
  document.addEventListener('focusin', (event) => {
    if (isGuidedOnboardingActive() && !permitted(event.target)) root.querySelector('.guided-coach')?.focus({ preventScroll: true });
  });
  document.addEventListener('click', (event) => {
    const dismissed = event.target.closest('[data-guided-hint-dismiss]')?.dataset.guidedHintDismiss;
    const help = event.target.closest('[data-guided-hint-help]')?.dataset.guidedHintHelp;
    if (dismissed) void run(async () => {
      const button = event.target.closest('button');
      const card = button.closest('.guided-feature-hint');
      try { record = await acknowledgeGuidedHint(dismissed); }
      catch { navigation.showToast?.('這次已關閉提醒。儲存暫時失敗，下次可能再顯示。', 'info'); }
      const host = card.parentElement;
      hintFeature = null;
      card.remove();
      const next = host?.querySelector('button:not(:disabled), input, select, summary');
      next?.focus({ preventScroll: true });
    });
    if (help) {
      hintFeature = null;
      document.querySelectorAll('.guided-feature-hint').forEach((hint) => hint.remove());
      navigation.showEducationHelp?.(help);
    }
  });
  const help = document.querySelector('#guided-feature-help');
  if (help) help.innerHTML = Object.entries(GUIDED_EDUCATION).map(([feature, content]) =>
    `<details data-education-feature="${feature}"><summary>${escape(content.title)}</summary><p>${escape(content.body)}</p>
      ${content.lesson ? `<button type="button" class="btn btn--secondary" data-onboarding-action="lesson:${content.lesson}">繼續學習這一章</button>` : ''}</details>`).join('');
  await repairPresentation(); refreshGuidedOnboarding();
  if (!isGuidedOnboardingActive() && pageTour?.status === 'active') {
    navigation.showPage?.(PAGE_LESSONS[pageTour.cursor].view);
    renderPageTour(true);
  }
}

function renderPageTour(focus = false) {
  tourTarget?.classList.remove('guided-page-target');
  document.querySelectorAll('.guided-page-tour').forEach((node) => node.remove());
  const replay = document.querySelector('#guided-page-tour-button');
  if (replay) replay.textContent = pageTour?.status === 'paused' ? '繼續其他頁面教學' : '認識其他頁面';
  if (isGuidedOnboardingActive() || pageTour?.status !== 'active') return;
  const lesson = PAGE_LESSONS[pageTour.cursor];
  const view = document.querySelector('.view.active');
  if (!view) return;
  document.querySelectorAll('.guided-feature-hint').forEach((node) => node.remove());
  const host = view.querySelector('.identity-surface') || view;
  const here = view.id === `view-${lesson.view}`;
  const card = document.createElement('section');
  card.className = 'guided-feature-hint guided-page-tour card';
  card.setAttribute('aria-labelledby', 'guided-page-title');
  card.innerHTML = `<p class="guided-note">接著認識 QuestNote · ${pageTour.cursor + 1} / ${PAGE_LESSONS.length}</p>
    <h2 id="guided-page-title" tabindex="-1">${escape(lesson.title)}</h2><p>${here ? escape(lesson.body) : '你可以自由查看其他頁面。準備好後，回到目前的教學頁面繼續。'}</p>
    <div class="guided-feature-actions">${pageTour.cursor > 0 ? '<button type="button" class="btn btn--secondary" data-page-tour-action="back">上一步</button>' : ''}
    <button type="button" class="btn btn--primary" data-page-tour-action="${here ? 'next' : 'return'}">${here ? pageTour.cursor === PAGE_LESSONS.length - 1 ? '完成教學，回到今日' : '下一步' : '回到教學頁面'}</button>
    <button type="button" class="guided-link" data-page-tour-action="pause">先到這裡，之後繼續</button></div>`;
  host.prepend(card);
  tourTarget = here && lesson.target ? view.querySelector(lesson.target) : null;
  tourTarget?.classList.add('guided-page-target');
  if (focus) requestAnimationFrame(() => card.querySelector('h2')?.focus({ preventScroll: true }));
}

async function movePageTour(actionName, expectedCursor) {
  if (actionName !== 'return') pageTour = await savePageTour(actionName, expectedCursor);
  if (pageTour?.status === 'active') {
    navigation.showPage?.(PAGE_LESSONS[pageTour.cursor].view);
    renderPageTour(true);
    window.scrollTo(0, 0);
  } else {
    renderPageTour();
    if (pageTour?.status === 'completed') navigation.showGuidedHome();
    if (actionName === 'pause') {
      navigation.showToast?.('進度已保存。到「更多 → 使用教學」可以繼續。', 'info');
      document.querySelector('.nav-item.active')?.focus({ preventScroll: true });
    }
  }
}

export async function guidedAfterReset(restored = false) {
  rememberSkip(false);
  record = restored ? await dismissGuidedAfterRestore() : await resetGuidedAfterDataReset();
  pageTour = await readPageTour();
  skipOpen = false; signature = ''; refreshGuidedOnboarding();
}
