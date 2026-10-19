/**
 * Weekly review page (this week / last week) and the Monday home card that offers last week's
 * review. Reads only the in-memory App state. The card's "seen this week" flag is a per-device UI
 * preference in localStorage, never part of the save or the backup.
 */
import { getWeekMonday } from '../habitService.js';
import { isSeniorMode } from '../seniorModeController.js';
import { getTodayDateString } from '../taskFilterService.js';
import { escapeHtml } from '../uiHelpers.js';
import { buildWeeklyReview, buildSeniorWeeklySummary, formatWeekRange, isMondayCardDue } from '../weeklyReviewService.js';

// Bound from src/ui.js by connectWeeklyReviewView() so this module never imports ui.js back.
let state, switchView;

export function connectWeeklyReviewView(deps) {
  ({ state, switchView } = deps);
}

const CARD_SEEN_KEY = 'questnote-weekly-review-card-seen';
let weekOffset = 0;

function readCardSeenWeek() {
  try { return localStorage.getItem(CARD_SEEN_KEY); } catch { return null; }
}

function markCardSeen(today = getTodayDateString()) {
  try { localStorage.setItem(CARD_SEEN_KEY, getWeekMonday(today)); } catch { /* private mode: the card just shows again */ }
}

function currentReview() {
  return buildWeeklyReview({ tasks: state?.tasks || [], habits: state?.habits || [],
    dailyCheckIn: state?.dailyCheckIn || null, weekOffset });
}

function weekTabsHtml() {
  const tab = (offset, label) => `<button type="button" class="segmented-control__btn${weekOffset === offset ? ' active' : ''}"
    data-action="weekly-review-week" data-offset="${offset}" role="tab" aria-selected="${weekOffset === offset}">${label}</button>`;
  return `<div class="weekly-review__tabs segmented-control" role="tablist" aria-label="選擇週次">${tab(0, '本週')}${tab(1, '上週')}</div>`;
}

function statHtml(value, label) {
  return `<div class="weekly-review__stat"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></div>`;
}

function seniorHtml(review) {
  const summary = buildSeniorWeeklySummary(review);
  return `
    <section class="weekly-review__senior card" aria-label="這週的成果">
      <div class="weekly-review__big"><strong>${summary.tasks}</strong><span>完成了幾件事</span></div>
      <div class="weekly-review__big"><strong>${summary.habitDays}</strong><span>習慣做了幾天</span></div>
      <p class="weekly-review__message">${escapeHtml(summary.message)}</p>
    </section>`;
}

function tasksHtml(review) {
  const { completed, recent } = review.tasks;
  if (!completed) return `<section class="weekly-review__section card"><h2>完成的任務</h2><p class="weekly-review__empty">這週還沒有完成的任務。</p></section>`;
  const rows = recent.map((task) => `<li>${escapeHtml((task.title || '').split('\n')[0])}</li>`).join('');
  const more = completed > recent.length ? `<p class="weekly-review__more">還有 ${completed - recent.length} 件</p>` : '';
  return `<section class="weekly-review__section card"><h2>完成的任務</h2><ul class="weekly-review__list">${rows}</ul>${more}</section>`;
}

function habitsHtml(review) {
  const { items } = review.habits;
  if (!items.length) return `<section class="weekly-review__section card"><h2>習慣</h2><p class="weekly-review__empty">還沒有建立習慣。</p></section>`;
  const rows = items.map((item) => {
    const notes = [];
    if (item.frequency === 'weekly' && item.weeklyRewardClaimed) notes.push('週獎勵已領');
    if (item.streak) notes.push(item.frequency === 'weekly' ? `連續 ${item.streak} 週` : `連續 ${item.streak} 天`);
    return `<li class="weekly-review__habit${item.met ? ' is-met' : ''}">
      <span class="weekly-review__habit-name">${escapeHtml(item.name)}</span>
      <span class="weekly-review__habit-count">${item.met ? '✓ ' : ''}${item.done} / ${item.target}${item.frequency === 'weekly' ? ' 次' : ' 天'}</span>
      ${notes.length ? `<span class="weekly-review__habit-note">${escapeHtml(notes.join('・'))}</span>` : ''}
    </li>`;
  }).join('');
  return `<section class="weekly-review__section card"><h2>習慣</h2><ul class="weekly-review__habits">${rows}</ul></section>`;
}

export function renderWeeklyReviewView() {
  const container = document.getElementById('weekly-review-content');
  if (!container) return;
  const review = currentReview();
  const range = `<p class="weekly-review__range">${escapeHtml(formatWeekRange(review))}${review.isCurrentWeek ? '・到今天為止' : ''}</p>`;
  if (isSeniorMode()) {
    container.innerHTML = `${weekTabsHtml()}${range}${seniorHtml(review)}`;
    return;
  }
  const checkIns = review.checkIns.available ? statHtml(`${review.checkIns.days} 天`, '每日簽到') : '';
  container.innerHTML = `${weekTabsHtml()}${range}
    <section class="weekly-review__summary card" aria-label="本週摘要">
      ${statHtml(review.tasks.completed, '完成任務')}
      ${statHtml(`${review.habits.activeDays} 天`, '有做習慣')}
      ${checkIns}
    </section>
    ${tasksHtml(review)}
    ${habitsHtml(review)}`;
}

/** Open the review on a given week (0 = this week, 1 = last week). */
export function openWeeklyReview(offset = 0) {
  weekOffset = offset === 1 ? 1 : 0;
  switchView('weekly-review');
}

export function handleWeeklyReviewClick(e) {
  const back = e.target.closest('[data-goto]');
  if (back) {
    switchView(back.dataset.goto);
    return;
  }
  const tab = e.target.closest('[data-action="weekly-review-week"]');
  if (tab) {
    weekOffset = tab.dataset.offset === '1' ? 1 : 0;
    renderWeeklyReviewView();
  }
}

export function renderWeeklyReviewCard() {
  const card = document.getElementById('weekly-review-card');
  if (!card) return;
  const today = getTodayDateString();
  if (!isMondayCardDue(today, readCardSeenWeek())) {
    card.hidden = true;
    card.innerHTML = '';
    return;
  }
  const lastWeek = buildWeeklyReview({ tasks: state?.tasks || [], habits: state?.habits || [],
    dailyCheckIn: state?.dailyCheckIn || null, today, weekOffset: 1 });
  card.hidden = false;
  card.innerHTML = `
    <div class="weekly-review-card__text">
      <strong>上週回顧</strong>
      <span>完成 ${lastWeek.tasks.completed} 件事・習慣做了 ${lastWeek.habits.activeDays} 天</span>
    </div>
    <div class="weekly-review-card__actions">
      <button type="button" class="btn btn--primary btn--sm" data-action="open-weekly-review">看回顧</button>
      <button type="button" class="btn btn--ghost btn--sm" data-action="dismiss-weekly-review" aria-label="關閉上週回顧">關閉</button>
    </div>`;
}

/** Home card buttons; both mark the card as seen for this week. Returns true when handled. */
export function handleWeeklyReviewCardAction(action) {
  if (action !== 'open-weekly-review' && action !== 'dismiss-weekly-review') return false;
  markCardSeen();
  renderWeeklyReviewCard();
  if (action === 'open-weekly-review') openWeeklyReview(1);
  return true;
}
