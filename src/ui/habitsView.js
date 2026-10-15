/**
 * Habits view: daily and weekly habit sections, habit cards and the habit form.
 * Habit writes go through habitService; completion rewards are handled in ui.js.
 */
import { getCategoryById } from '../categoryService.js';
import {
  getHabitPageStats,
  getTodayHabits,
  getWeeklyHabits,
  getArchivedHabits,
  hasWeeklyNearGoal,
  getHabitStreak,
  formatStreakLabel,
  isCompletedToday as isHabitCompletedToday,
  getWeekMonday,
  getWeeklyCompletionCount,
  isWeeklyGoalMet,
  updateHabit,
  createHabit,
} from '../habitService.js';
import { getTodayDateString } from '../taskFilterService.js';
import { errorStateHtml, emptyStateHtml, escapeHtml } from '../uiHelpers.js';
import { trackUpdateActivity } from '../updateActivity.js';
import { handleAchievementCheckAfterAction } from './achievementsView.js';

// Bound from src/ui.js by connectHabitsView() so this module never imports ui.js back.
let closeModal, formatCategoryLabel, onRefresh, openModal, showToast, state;

export function connectHabitsView(deps) {
  ({ closeModal, formatCategoryLabel, onRefresh, openModal, showToast, state } = deps);
}

let archivedHabitsCollapsed = true;
export function toggleArchivedHabits() {
  archivedHabitsCollapsed = !archivedHabitsCollapsed;
}

export function renderHabitsView() {
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

export function openHabitForm(habitId = null) {
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

      <p id="habit-form-error" class="form-error" role="alert" hidden></p>

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

  const habitForm = document.getElementById('habit-form');
  const cancel = document.getElementById('habit-form-cancel');
  cancel?.addEventListener('click', () => {
    if (habitForm?.dataset.saving !== 'true') closeModal();
  });

  document.getElementById('habit-form')?.addEventListener('submit', trackUpdateActivity(async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (form.dataset.saving === 'true') return;
    const submit = form.querySelector('button[type="submit"]');
    const submitLabel = submit.textContent;
    const errEl = document.getElementById('habit-form-error');
    const name = document.getElementById('habit-name')?.value?.trim();
    const description = document.getElementById('habit-desc')?.value?.trim();
    const categoryId = document.getElementById('habit-category')?.value;
    const frequency = document.getElementById('habit-frequency')?.value;
    const targetPerWeek = document.getElementById('habit-target')?.value;

    const payload = { name, description, categoryId, frequency, targetPerWeek: Number(targetPerWeek) };
    const showError = (message) => {
      if (errEl) {
        errEl.textContent = message;
        errEl.hidden = false;
      } else {
        showToast(message, 'error');
      }
    };
    if (errEl) errEl.hidden = true;
    form.dataset.saving = 'true';
    submit.disabled = true;
    submit.textContent = '儲存中…';
    if (cancel) cancel.disabled = true;
    let saved = false;
    try {
      const result = isEdit
        ? await updateHabit(habitId, payload)
        : await createHabit(payload);
      if (!result.success) {
        showError(result.error || '儲存失敗');
        return;
      }
      saved = true;
      closeModal();
      await onRefresh();
      renderHabitsView();
      showToast(isEdit ? '習慣已更新' : '習慣已建立', 'success');
      await handleAchievementCheckAfterAction();
    } catch (err) {
      console.error('[QuestNote] 習慣儲存流程失敗:', err);
      if (saved) {
        showToast('習慣已儲存，但畫面更新未完成。請重新整理。', 'error');
      } else {
        showError('儲存失敗，請再試一次。');
      }
    } finally {
      // A detached, committed form must never submit a second create action.
      if (!saved) {
        form.dataset.saving = 'false';
        submit.disabled = false;
        submit.textContent = submitLabel;
        if (cancel) cancel.disabled = false;
      }
    }
  }));
}

/* ─── 更多 / 成就頁 ─── */
