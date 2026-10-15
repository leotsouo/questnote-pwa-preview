import { getActiveHabits, isCompletedToday, getHabitStreak } from './habitService.js';
import { escapeHtml } from './uiHelpers.js';

export function getTodayDailyHabits(habits, today, categoryFilter = 'all') {
  return getActiveHabits(habits)
    .filter((habit) => habit.frequency === 'daily'
      && (categoryFilter === 'all' || (habit.categoryId || 'general') === categoryFilter))
    .sort((a, b) => Number(isCompletedToday(a, today)) - Number(isCompletedToday(b, today)));
}

export function renderTodayHabits(habits, { today, categories = [], categoryFilter = 'all', loadError = false, busy = false }) {
  const daily = getTodayDailyHabits(habits, today, categoryFilter);
  if (!loadError && !daily.length && categoryFilter !== 'all') return '';
  const completed = daily.filter((habit) => isCompletedToday(habit, today)).length;
  const cards = daily.map((habit) => {
    const done = isCompletedToday(habit, today);
    const category = categories.find((entry) => entry.id === (habit.categoryId || 'general'));
    const streak = getHabitStreak(habit, today);
    const status = done ? '今日已完成' : '每日';
    const meta = [status, category?.name, streak > 0 ? `連續 ${streak} 天` : ''].filter(Boolean).join(' · ');
    return `<article class="today-habit-card ${done ? 'today-habit-card--done' : ''}" data-id="${escapeHtml(habit.id)}">
      <button type="button" class="today-habit-check" data-action="${done ? 'habit-uncomplete' : 'habit-complete'}"
        aria-pressed="${done}" aria-label="${escapeHtml(habit.name)}：${done ? '取消今日完成' : '完成今日'}" ${busy ? 'disabled' : ''}>
        <span aria-hidden="true">${done ? '✓' : '○'}</span>
      </button>
      <div class="today-habit-card__body">
        <h3 class="today-habit-card__name">${escapeHtml(habit.name)}</h3>
        <p class="today-habit-card__meta">${escapeHtml(meta)}</p>
      </div>
    </article>`;
  }).join('');
  const empty = loadError
    ? '<p class="today-habits__hint" role="status">習慣暫時無法載入，請到習慣頁重試。</p>'
    : `<div class="today-habits__empty">
        <p class="today-habits__hint">每日習慣會自動列在這裡，和今天的任務一起完成。</p>
        <button type="button" class="btn btn--secondary btn--sm" data-action="habit-create-first">新增每日習慣</button>
      </div>`;
  return `<section class="today-habits page-section" aria-label="今日每日習慣">
    <div class="today-habits__header">
      <h2 class="section-title">今日習慣 <span class="section-count" aria-live="polite">${completed} / ${daily.length}</span></h2>
      <button type="button" class="btn btn--ghost btn--sm" data-action="go-habits">管理習慣 ›</button>
    </div>
    ${daily.length ? `<div class="today-habits__list">${cards}</div>` : empty}
  </section>`;
}
