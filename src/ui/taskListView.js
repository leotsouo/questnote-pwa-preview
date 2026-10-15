/**
 * Home task list: today plan, all tasks, smart lists, category and completed-range filters,
 * task cards and today's habit shortcuts. ui.js event handlers change the list through the
 * exported taskListUi state and the expanded / recently completed sets.
 */
import { getCategoryById } from '../categoryService.js';
import { isDemonFinalTask } from '../demonFinalTaskCore.js';
import { completeHabitToday, uncompleteHabitToday } from '../habitService.js';
import { shiftDate } from '../reminderRules.js';
import { calculateRewardAmount, calculateAdventureEnergyAmount, calculateBondAmount } from '../rewardService.js';
import { syncSeniorPresentation, isSeniorMode } from '../seniorModeController.js';
import {
  getTodayDateString,
  isInTodayPlan,
  isCompletedToday,
  filterByCategory,
  getTodayViewSections,
  sortTasks,
  SMART_LISTS,
  filterBySmartList,
  COMPLETED_RANGE_OPTIONS,
  filterCompletedTasksByRange,
  getCompletedRangeEmptyMessage,
  getDateBadgeClass,
  formatDateBadgeText,
  getSubtaskProgress,
} from '../taskFilterService.js';
import { getTodayDailyHabits, renderTodayHabits } from '../todayHabitsView.js';
import { syncTwilightHome, twilightIcon } from '../twilightPresentation.js';
import { escapeHtml, emptyStateHtml } from '../uiHelpers.js';
import { handleAchievementCheckAfterAction } from './achievementsView.js';
import { renderCompanionSection } from './companionView.js';
import { trackQuest, renderDailyBlessingSection, renderQuestPanel } from './dailyBlessingView.js';
import { getAvailablePullsForSelectedPool } from './gachaView.js';

// Bound from src/ui.js by connectTaskListView() so this module never imports ui.js back.
let PRIORITY_LABELS, formatDateTime, notifyBondUnlocks, onRefresh, renderAchievementStrip, renderBondHomeSection, renderHomeHub, setText, showToast, state;

export function connectTaskListView(deps) {
  ({ PRIORITY_LABELS, formatDateTime, notifyBondUnlocks, onRefresh, renderAchievementStrip, renderBondHomeSection, renderHomeHub, setText, showToast, state } = deps);
}

/** Task list UI state (memory only): view mode, smart list, category and completed-section filters. */
export const taskListUi = {
  taskViewMode: 'today',
  activeSmartListId: null,
  taskCategoryFilter: 'all',
  completedSectionCollapsed: true,
  completedRangeFilter: 'completed_1_month',
};
let habitActionBusy = false;
export const expandedTaskIds = new Set();
export const recentlyCompletedTaskIds = new Set();
export async function handleHabitCompletion(action, id, card) {
  if (habitActionBusy) return;
  const restoreFocus = card?.contains(document.activeElement);
  const view = card?.closest('.view');
  const encounterDateBefore = state.encounterEconomy?.dailyReceipt?.date;
  habitActionBusy = true;
  const buttons = '[data-action="habit-complete"], [data-action="habit-uncomplete"]';
  document.querySelectorAll(buttons).forEach((button) => { button.disabled = true; });
  card?.classList.add('habit-card--completing');
  try {
    const completing = action === 'habit-complete';
    const result = await (completing ? completeHabitToday(id) : uncompleteHabitToday(id));
    if (!result.success) {
      showToast(result.error || '操作失敗', 'error');
      return;
    }
    if (completing) await trackQuest('complete_habit');
    await onRefresh({ renderMode: ['habits', 'tasks'] });
    if (completing) {
      const parts = [];
      const receipt = state.encounterEconomy?.dailyReceipt;
      if (receipt?.source === 'habit' && receipt.sourceId === id && receipt.date !== encounterDateBefore) parts.push(`相遇碎片 +${receipt.amount}`);
      if (result.stardustGiven > 0) parts.push(`星塵 +${result.stardustGiven}`);
      if (result.energyGiven > 0) parts.push(`冒險能量 +${result.energyGiven}`);
      if (result.bondGiven > 0) parts.push('親密度 +1');
      showToast(parts.length ? `習慣完成！${parts.join('、')}`
        : result.stardustCapped ? '今日習慣星塵已達上限，仍已記錄完成。' : '習慣已記錄完成',
      result.stardustCapped && !parts.length ? 'warning' : 'success');
      if (result.bondGiven > 0) await notifyBondUnlocks(state.companion?.id);
      await handleAchievementCheckAfterAction();
    } else {
      showToast('已取消今日完成', 'info');
    }
  } catch (error) {
    console.warn('[Habits] Completion failed:', error);
    showToast('無法更新習慣，請稍後再試。', 'error');
    await onRefresh({ renderMode: ['habits', 'tasks'] });
  } finally {
    habitActionBusy = false;
    card?.classList.remove('habit-card--completing');
    document.querySelectorAll(buttons).forEach((button) => { button.disabled = false; });
    if (restoreFocus) {
      view?.querySelector(`[data-id="${CSS.escape(String(id))}"] [data-action^="habit-"]`)?.focus({ preventScroll: true });
    }
  }
}

export function renderTasksView() {
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
  renderTodayPlanSummary(tasks.filter((task) => !task.isTutorial), today);
  renderHabitSummary();
  renderCategoryFilters(categories);
  syncTwilightHome(state);

  const catFilterEl = document.getElementById('task-category-filters');
  renderBondHomeSection();
  if (catFilterEl) {
    catFilterEl.hidden = taskListUi.taskViewMode === 'smart' && !taskListUi.activeSmartListId;
  }

  const contentEl = document.getElementById('task-view-content');
  if (!contentEl) return;
  contentEl.dataset.taskView = taskListUi.taskViewMode;

  if (taskListUi.taskViewMode === 'today') {
    contentEl.innerHTML = renderTodayView(tasks, today);
  } else if (taskListUi.taskViewMode === 'all') {
    contentEl.innerHTML = renderAllTasksView(tasks, today);
  } else if (taskListUi.taskViewMode === 'smart') {
    contentEl.innerHTML = taskListUi.activeSmartListId
      ? renderSmartListDetail(tasks, taskListUi.activeSmartListId, today)
      : renderSmartListHub(tasks, today);
  }
  syncSeniorPresentation();
}

function renderHabitSummary() {
  const el = document.getElementById('habit-summary');
  if (!el) return;

  const stats = state.habitStats;
  if (taskListUi.taskViewMode === 'today' || !stats?.hasHabits) {
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
    `<button type="button" class="filter-btn ${taskListUi.taskCategoryFilter === 'all' ? 'active' : ''}" data-cat-filter="all">全部</button>`,
    ...categories.map(
      (c) => `<button type="button" class="filter-btn ${taskListUi.taskCategoryFilter === c.id ? 'active' : ''}" data-cat-filter="${c.id}">${formatCategoryLabel(c)}</button>`
    ),
  ];
  el.innerHTML = btns.join('');
  el.hidden = taskListUi.taskViewMode === 'smart' && !taskListUi.activeSmartListId;
}

export function formatCategoryLabel(category) {
  return escapeHtml(category?.name || '一般');
}

function applyCategoryFilter(tasks) {
  return filterByCategory(tasks, taskListUi.taskCategoryFilter);
}

function renderCollapsibleTaskSection(title, taskList, collapsed = taskListUi.completedSectionCollapsed) {
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

  const plannedEmpty = sections.planned.length === 0
    && !getTodayDailyHabits(state.habits || [], today, taskListUi.taskCategoryFilter).length
    ? emptyStateHtml(
        '📅',
        '今天還沒有安排任務',
        '挑 1～3 件最重要的事，讓你的夥伴陪你完成。',
        '從待排程任務選擇',
        'pick-unscheduled'
      )
    : '';

  let html = renderTaskListSection('今日計畫', sections.planned, plannedEmpty);
  html += renderTodayHabits(state.habits || [], {
    today, categories: state.categories, categoryFilter: taskListUi.taskCategoryFilter,
    loadError: state.habitsLoadError, busy: habitActionBusy,
  });
  html += renderTaskListSection('今天到期', sections.dueToday);
  html += renderTaskListSection('今天開始', filtered.filter((task) => !task.completed && task.startDate === today
    && task.plannedDate !== today && task.dueDate !== today));
  html += renderTaskListSection('逾期未完成', sections.overdue,
    sections.overdue.length === 0 && taskListUi.taskCategoryFilter !== 'all' ? '' :
    sections.overdue.length === 0 ? emptyStateHtml('✓', '沒有逾期任務', '目前節奏保持得不錯。') : ''
  );
  html += renderCollapsibleTaskSection('今日已完成', sections.completedToday);
  const tomorrow = shiftDate(today, 1);
  html += renderTaskListSection('明日計畫', sortTasks(filtered.filter((task) => !task.completed && task.plannedDate === tomorrow), tomorrow));

  if (!html.trim()) {
    return emptyStateHtml('📋', '目前沒有待辦任務', '新增一個小任務，讓你的夥伴開始累積能量吧。', '新增任務', 'empty-add-task');
  }
  return html;
}

function renderAllTasksView(tasks, today) {
  const filtered = applyCategoryFilter(tasks);
  const incomplete = sortTasks(filtered.filter((t) => !t.completed), today);

  const categoryEmpty = taskListUi.taskCategoryFilter !== 'all' && incomplete.length === 0;

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
    const active = taskListUi.completedRangeFilter === opt.id;
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
    filtered = filterCompletedTasksByRange(filtered, taskListUi.completedRangeFilter);
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
    completed: getCompletedRangeEmptyMessage(taskListUi.completedRangeFilter),
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
              <button type="button" class="subtask-check ${s.completed ? 'checked' : ''}" data-action="toggle-subtask" data-subtask-id="${escapeHtml(s.id)}" aria-label="${s.completed ? '取消完成' : '完成'}：${escapeHtml(s.text)}" aria-pressed="${s.completed ? 'true' : 'false'}">
                ${s.completed ? '✓' : ''}
              </button>
              <span class="subtask-text">${escapeHtml(s.text)}</span>
            </li>
          `).join('')}
        </ul>
      ` : ''}
    </div>
  ` : '';


  const demonTask = isDemonFinalTask(task);
  const planBtn = !demonTask && !task.completed
    ? inPlan
      ? `<button class="btn btn--ghost btn--sm" data-action="unplan-today">移出今日</button>`
      : `<button class="btn btn--ghost btn--sm" data-action="plan-today">加入今日</button>`
    : '';

  const expandBtn = hasSubtasks
    ? `<button class="btn btn--ghost btn--sm" data-action="toggle-expand">${isExpanded ? '收合' : '展開'}</button>`
    : '';

  const preview = task.content.split('\n').slice(1).filter((line) => line.trim()).slice(0, 2).join(' ');
  const description = task.content.split('\n').slice(1).join('\n').trim();
  const rewardsHtml = task.completed ? doneInfo : task.rewardClaimed
    ? `<div class="task-card__rewards"><span>${twilightIcon('check')}獎勵已領取</span></div>`
    : `<div class="task-card__rewards"><span>${twilightIcon('spark')}${stardust} 星塵</span><span>${twilightIcon('energy')}${energy} 能量</span>${state.companion ? `<span>${twilightIcon('heart')}+${calculateBondAmount(task)} 親密度</span>` : ''}</div>`;

  const completeButton = `<button type="button" class="task-check ${task.completed ? 'checked' : ''}" data-action="toggle" ${(task.isTutorial || demonTask) && task.completed ? 'disabled' : ''} aria-pressed="${task.completed}" aria-label="${task.completed ? (task.isTutorial || demonTask) ? '已完成' : '取消完成' : '完成'} ${escapeHtml(task.title)}">${task.completed ? twilightIcon('check') : ''}<span class="senior-label">${task.completed ? (task.isTutorial || demonTask) ? '已完成' : '取消完成' : '完成任務'}</span></button>`;
  return `<article class="task-card twilight-task-card ${priorityClass} ${demonTask ? 'task-card--demon-final' : ''} ${task.completed ? 'task-card--done' : ''} ${justCompleted ? 'task-card--just-done' : ''}" data-id="${escapeHtml(task.id)}">
    ${isSeniorMode() ? '' : completeButton}
    <div class="twilight-task-body">
      <div class="task-card__meta"><span>${demonTask ? '惡魔的趣味 · 覺醒約定 · 無期限' : task.isTutorial ? '基本操作練習' : formatCategoryLabel(category)}</span>${task.priority !== 'normal' ? `<span class="twilight-task-priority">${escapeHtml(PRIORITY_LABELS[task.priority])}</span>` : ''}${task.dueDate || task.startDate ? `<span class="${dateClass}">${escapeHtml(dateText)}</span>` : ''}${!inPlan && !task.completed ? '<span>未排入今日</span>' : ''}</div>
      <h3 class="task-card__title">${escapeHtml(task.title)}</h3>
      ${task.plannedTime ? `<p class="task-card__time">安排時間 ${escapeHtml(task.plannedTime)}</p>` : ''}
      ${preview ? `<p class="task-card__preview">${escapeHtml(preview)}</p>` : ''}
      ${description ? `<details class="task-card__description"><summary>任務說明</summary><p class="task-card__preview">${escapeHtml(description)}</p></details>` : ''}
      ${subtasksHtml}
      ${rewardsHtml}
      ${demonTask ? '<p class="demon-task-note">夥伴的約定 · 只能完成，無完成期限</p>' : ''}
      ${expandBtn ? `<div class="twilight-task-expander">${expandBtn}</div>` : ''}
    </div>
    ${isSeniorMode() ? `<div class="senior-task-actions">${completeButton}${demonTask ? '' : '<button type="button" class="btn btn--ghost" data-action="edit">編輯任務</button>'}</div>` : ''}
    ${demonTask ? '' : `<details class="twilight-task-menu"><summary aria-label="${escapeHtml(task.title)}：更多操作">${twilightIcon('more')}<span class="senior-label">更多操作</span></summary><div class="task-card__actions">${planBtn}<button type="button" class="btn btn--ghost btn--sm" data-action="edit">編輯</button><button type="button" class="btn btn--ghost btn--sm btn--danger" data-action="delete">刪除</button></div></details>`}
  </article>`;
}
