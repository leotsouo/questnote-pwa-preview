/** Alternative presentation only. All actions call the existing UI/services. */
import { applyReadingModeToDocument, setReadingMode, setSeniorOnboardingCompleted } from './preferencesService.js';
import { getTodayDateString, isInTodayPlan, isCompletedToday } from './taskFilterService.js';
import { isTopDialog } from './dialogFocus.js';

let actions;
let originalHomeOrder;
let switching = false;
let practiceTaskId = null;
let practicing = false;
let categoryDisclosure;
let modalBackgroundWasInert = null;
const seniorHeadings = new WeakSet();
const messages = [];
const pageNames = { tasks: '任務首頁', gacha: '召喚夥伴', collection: '寵物收藏', expedition: '探險', more: '更多功能', settings: '設定', habits: '習慣', achievements: '成就', workshop: '工坊', handbook: '冒險手冊', guide: '使用教學', feedback: '意見回報', share: '分享 QuestNote' };
export const isSeniorMode = () => document.body.dataset.readingMode === 'senior';

export function initSeniorModeController(callbacks) {
  actions = callbacks;
  originalHomeOrder = [...document.getElementById('view-tasks').children];
  const observed = new WeakSet();
  const syncModal = () => { syncSeniorModalBackground(); decorateSeniorControls(); if (isSeniorMode() && messages.length) renderFeedback(); };
  const modalObserver = new MutationObserver(syncModal);
  const observeModals = () => {
    document.querySelectorAll('#modal-overlay, #global-mailbox-modal, #pet-image-viewer, #expedition-dispatch-modal').forEach((modal) => {
      if (!observed.has(modal)) { modalObserver.observe(modal, { attributes: true, attributeFilter: ['class'] }); observed.add(modal); }
    });
    syncModal();
  };
  new MutationObserver(observeModals).observe(document.body, { childList: true });
  observeModals();
  document.getElementById('reading-mode-toggle')?.addEventListener('change', async (event) => {
    if (switching) return;
    switching = true;
    const control = event.target;
    const previous = isSeniorMode();
    control.disabled = true;
    try {
      const prefs = await setReadingMode(control.checked ? 'senior' : 'normal');
      actions.getState().userPreferences = prefs;
      applyReadingModeToDocument(prefs.readingMode);
      actions.refreshPresentation();
      syncSeniorPresentation();
      document.getElementById('reading-mode-result').textContent = control.checked
        ? '易讀模式已開啟並儲存。任務與夥伴都保留在原處。' : '已回到一般模式，設定已儲存。';
    } catch {
      control.checked = previous;
      document.getElementById('reading-mode-result').textContent = '設定未儲存，請再試一次。';
    } finally { control.disabled = false; switching = false; }
  });
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-senior-action]');
    if (!button) return;
    const action = button.dataset.seniorAction;
    if (action === 'home') actions.today();
    if (action === 'settings') actions.navigate('settings');
    if (action === 'mailbox') actions.mailbox();
    if (action === 'add') actions.addTask();
    if (action === 'practice') {
      practicing = true;
      actions.addTask();
      const input = document.getElementById('task-content');
      if (input) { input.value = '喝一杯水'; input.closest('form').dataset.dirty = 'true'; input.focus(); input.select(); }
    }
    if (action === 'guide-finish' || action === 'guide-restart') {
      button.disabled = true;
      try {
        actions.getState().userPreferences = await setSeniorOnboardingCompleted(action === 'guide-finish');
        practicing = false;
        practiceTaskId = null;
        syncSeniorPresentation();
        if (action === 'guide-restart') actions.today();
      } catch { seniorFeedback('教學設定未儲存，請再試一次。', 'error'); }
      finally { button.disabled = false; }
    }
    if (action === 'guide-summon') actions.navigate('gacha');
    if (action === 'dismiss-feedback') {
      const host = button.closest('.senior-completion-receipt').parentElement;
      messages.length = 0;
      document.querySelectorAll('.senior-completion-receipt').forEach((node) => node.remove());
      const focus = [...host.querySelectorAll('h1, h2, button, summary')].find((node) => node.getClientRects().length && !node.disabled);
      if (focus) { if (focus.matches('h1, h2')) focus.tabIndex = -1; focus.focus(); }
    }
  });
  syncSeniorPresentation();
}

export function syncSeniorPresentation() {
  if (!actions) return;
  const state = actions.getState();
  const senior = isSeniorMode();
  syncSeniorModalBackground();
  decorateSeniorControls();
  const toggle = document.getElementById('reading-mode-toggle');
  if (toggle && !switching) toggle.checked = senior;
  const home = document.getElementById('view-tasks');
  if (home.dataset.seniorComposed !== String(senior)) {
    // Move real nodes, keeping DOM reading order, handlers and a reversible order.
    originalHomeOrder.forEach((node) => home.append(node));
    categoryDisclosure?.remove();
    if (senior) {
      const first = ['senior-home-intro', 'senior-practice', 'twilight-chapter-heading', 'task-view-tabs', 'task-category-filters', 'task-view-content', 'today-plan-summary', 'habit-summary'];
      const anchor = home.firstChild;
      first.forEach((id) => { const node = document.getElementById(id); if (node) home.insertBefore(node, anchor); });
    }
    home.dataset.seniorComposed = String(senior);
  }
  const categories = document.getElementById('task-category-filters');
  if (senior) {
    if (!categoryDisclosure?.isConnected) {
      categoryDisclosure = document.createElement('details');
      categoryDisclosure.className = 'senior-filter-options';
      categoryDisclosure.innerHTML = '<summary>依分類篩選</summary>';
      categories.before(categoryDisclosure);
      categoryDisclosure.append(categories);
    }
    categoryDisclosure.hidden = categories.hidden;
    const activeCategory = categories.querySelector('.active')?.textContent.trim() || '全部';
    categoryDisclosure.querySelector('summary').textContent = `依分類篩選：${activeCategory}`;
  }
  document.querySelectorAll('.senior-only').forEach((node) => { node.hidden = !senior; });
  const location = document.getElementById('senior-location');
  const view = document.querySelector('.view.active');
  const viewName = view?.id.replace('view-', '') || 'tasks';
  if (location) {
    location.hidden = !senior || viewName === 'tasks';
    location.querySelector('strong').textContent = pageNames[viewName] || 'QuestNote';
  }
  document.querySelectorAll('.view h1, .view h2').forEach((heading) => {
    if (senior && !heading.hasAttribute('tabindex')) { heading.setAttribute('tabindex', '-1'); seniorHeadings.add(heading); }
    else if (!senior && seniorHeadings.has(heading)) { heading.removeAttribute('tabindex'); seniorHeadings.delete(heading); }
  });
  const add = document.querySelector('.twilight-add-task');
  if (add && !add.querySelector('.senior-label')) add.insertAdjacentHTML('beforeend', '<span class="senior-label">新增任務</span>');
  const smart = document.querySelector('[data-task-view="smart"]');
  if (smart) smart.textContent = senior ? '分類與紀錄' : '智慧';
  const close = document.getElementById('modal-close');
  if (close) close.textContent = senior ? '關閉' : '×';
  const today = getTodayDateString();
  const pending = state.tasks.filter((task) => !task.completed && isInTodayPlan(task, today)).length;
  const done = state.tasks.filter((task) => isCompletedToday(task, today)).length;
  document.getElementById('senior-today-summary').textContent = `今日計畫尚有 ${pending} 件待辦；今天已完成 ${done} 件。`;
  document.getElementById('senior-today-date').textContent = new Intl.DateTimeFormat('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(`${today}T12:00:00`));
  const guide = document.getElementById('senior-practice');
  guide.hidden = !senior || state.userPreferences.seniorOnboardingCompleted;
  if (senior) {
    const content = document.getElementById('task-view-content');
    if (state.tasks.length && !practiceTaskId) content.after(guide);
    else document.getElementById('twilight-chapter-heading').before(guide);
  }
  const task = state.tasks.find((row) => row.id === practiceTaskId);
  const step = task?.completed ? 'reward' : task ? 'complete' : 'create';
  guide.querySelector('h2').textContent = { create: '一起試一次，從一件小事開始', complete: '接著，完成你剛新增的任務', reward: '完成小事，旅程也向前一步' }[step];
  guide.querySelector('p').textContent = { create: '建立一項「喝一杯水」的真實任務，也可以改成你今天想做的事。', complete: '做好這件事後，按任務上的「完成任務」。獎勵會直接存入同一份存檔。', reward: '完成與獎勵已記錄。星塵可以召喚夥伴，能量可以讓夥伴探險。' }[step];
  guide.querySelector('[data-senior-action="practice"]').hidden = step !== 'create';
  guide.querySelector('[data-senior-action="guide-summon"]').hidden = step !== 'reward';
  guide.querySelector('[data-senior-action="guide-finish"]').textContent = step === 'reward' ? '我知道了' : '先自行使用';
  if (!senior) { messages.length = 0; document.querySelectorAll('.senior-completion-receipt').forEach((node) => node.remove()); }
  else if (messages.length) renderFeedback();
}

export function seniorTaskCreated(id) {
  if (practicing) { practiceTaskId = id; practicing = false; }
  syncSeniorPresentation();
}

export function seniorTaskFormClosed() { practicing = false; }

function syncSeniorModalBackground() {
  const app = document.getElementById('app');
  if (!app) return;
  const locked = isSeniorMode() && !!document.querySelector('#modal-overlay.open, #global-mailbox-modal.open, #pet-image-viewer.is-open, #expedition-dispatch-modal');
  if (locked) {
    if (modalBackgroundWasInert === null) modalBackgroundWasInert = app.inert;
    app.inert = true;
  } else if (modalBackgroundWasInert !== null) {
    app.inert = modalBackgroundWasInert;
    modalBackgroundWasInert = null;
  }
}

export function decorateSeniorControls() {
  if (!isSeniorMode()) return;
  document.querySelectorAll('button[aria-label]').forEach((button) => {
    if (button.querySelector('.senior-label')) return;
    if (/^[\s×✕＋+−‹›…⋯✓]*$/.test(button.textContent)) {
      const label = document.createElement('span');
      label.className = 'senior-label';
      label.textContent = button.getAttribute('aria-label');
      button.append(label);
    }
  });
}

/** A readable, dismissible receipt survives toast timeout and view refreshes. */
export function seniorFeedback(message, type = 'info') {
  if (!isSeniorMode()) return;
  const viewId = document.querySelector('.view.active')?.id;
  if (messages.at(-1)?.message !== message || messages.at(-1)?.viewId !== viewId) messages.push({ message: String(message), type, viewId });
  if (messages.length > 12) messages.shift();
  renderFeedback();
  document.querySelector('.senior-completion-receipt')?.scrollIntoView({ behavior: 'instant', block: 'nearest' });
}

function renderFeedback() {
  const current = messages.filter((entry) => entry.viewId === document.querySelector('.view.active')?.id).slice(-3);
  if (!current.length) { document.querySelectorAll('.senior-completion-receipt').forEach((node) => node.remove()); return; }
  const native = document.activeElement?.closest('dialog[open]') || [...document.querySelectorAll('dialog[open]')].at(-1);
  const modal = [...document.querySelectorAll('#modal-overlay.open, #global-mailbox-modal.open, #pet-image-viewer.is-open, #expedition-dispatch-modal')].find(isTopDialog);
  const host = native?.querySelector('.dialog-body, #identity-reveal-content, #identity-dialog-content') || native
    || modal?.querySelector('#modal-body, #mailbox-modal-body, .expedition-dispatch-modal__content, .pet-image-viewer__content')
    || document.querySelector('.view.active > .identity-surface') || document.querySelector('.view.active');
  if (!host) return;
  let receipt = host.querySelector(':scope > .senior-completion-receipt');
  document.querySelectorAll('.senior-completion-receipt').forEach((node) => { if (node !== receipt) node.remove(); });
  if (!receipt) {
    receipt = document.createElement('section');
    receipt.className = 'senior-completion-receipt';
    receipt.setAttribute('aria-label', '操作結果');
    receipt.innerHTML = '<h2>操作結果</h2><div role="status" aria-live="polite" aria-atomic="true"></div><button type="button" class="btn btn--ghost" data-senior-action="dismiss-feedback">收起結果</button>';
    host.prepend(receipt);
  }
  const live = receipt.querySelector('[role="status"]');
  const text = current.map(({ message, type }) => `${type === 'error' || type === 'warning' ? '注意：' : ''}${message}`).join('\n');
  if (live.textContent !== text) live.textContent = text;
}

/** Same fields, same form submission; optional settings move into native details. */
export function composeSeniorTaskForm(isEdit) {
  if (!isSeniorMode()) return;
  const form = document.getElementById('task-form');
  const details = document.createElement('details');
  details.className = 'senior-form-options';
  details.innerHTML = '<summary>更多設定：分類、重要程度、日期與子任務</summary>';
  const categoryLabel = form.querySelector('[for="task-category"]');
  const priority = form.querySelector('#task-priority');
  for (let node = categoryLabel; node;) {
    const next = node.nextSibling;
    details.append(node);
    if (node === priority) break;
    node = next;
  }
  const dates = form.querySelector('#task-start-date').closest('.form-row');
  const hint = dates.previousElementSibling;
  if (hint?.classList.contains('form-hint')) details.append(hint);
  details.append(dates, form.querySelector('#task-date-error'));
  details.append(form.querySelector('[for="task-plan-today"]'));
  form.querySelector('[data-plan-date]')?.parentElement.classList.add('senior-schedule-shortcuts');
  const list = form.querySelector('#subtask-form-list');
  details.append(list.previousElementSibling, list, form.querySelector('#subtask-form-empty'), form.querySelector('.subtask-form-add'));
  form.insertBefore(details, form.lastElementChild);
  form.querySelector('[for="task-content"]').textContent = '要做什麼？';
  form.querySelector('#task-content').placeholder = '例如：晚上吃藥。換行可以補充說明。';
  form.querySelector('#task-content').rows = 3;
  form.querySelector('button[type="submit"]').textContent = isEdit ? '儲存修改' : '新增任務';
  if (!isEdit) {
    form.querySelector('#task-plan-date').value = getTodayDateString();
    form.querySelector('#task-plan-today').checked = true;
  }
  form.addEventListener('input', () => { form.dataset.dirty = 'true'; });
  form.addEventListener('change', () => { form.dataset.dirty = 'true'; });
  form.addEventListener('click', (event) => {
    if (event.target.closest('[data-plan-date], [data-value], #subtask-add-btn, .subtask-form-remove')) form.dataset.dirty = 'true';
  });
}
