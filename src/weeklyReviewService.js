/**
 * Weekly review: what was finished in one Monday–Sunday week, computed only from data the App
 * already stores (task completedAt, habit daily logs, the 90-day check-in history).
 * Pure: no database, no DOM. Rewards are not totalled because the App keeps no reward history.
 */
import { getTodayDateString } from './taskFilterService.js';
import { getWeekMonday, getWeeklyCompletionCount, isWeeklyRewardClaimed, getHabitStreak, getActiveHabits } from './habitService.js';

const RECENT_TASKS = 5;
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T12:00:00`);
  date.setDate(date.getDate() + days);
  return getTodayDateString(date);
}

/** Local calendar date of an ISO timestamp, or null when it is missing or invalid. */
function localDateOf(isoTimestamp) {
  if (!isoTimestamp) return null;
  const date = new Date(isoTimestamp);
  return Number.isNaN(date.getTime()) ? null : getTodayDateString(date);
}

/** The week `weekOffset` weeks before the one containing `today` (0 = this week, 1 = last week). */
export function getReviewWeek(today = getTodayDateString(), weekOffset = 0) {
  const start = addDays(getWeekMonday(today), -7 * weekOffset);
  const end = addDays(start, 6);
  const isCurrentWeek = weekOffset === 0;
  // Days of the week that have already happened: up to today for this week, all seven otherwise.
  let elapsedDays = 7;
  if (isCurrentWeek) {
    elapsedDays = 0;
    for (let day = start; day <= today && elapsedDays < 7; day = addDays(day, 1)) elapsedDays += 1;
  }
  return { start, end, isCurrentWeek, elapsedDays };
}

export function buildWeeklyReview({ tasks = [], habits = [], dailyCheckIn = null, today = getTodayDateString(), weekOffset = 0 } = {}) {
  const week = getReviewWeek(today, weekOffset);
  const inWeek = (date) => Boolean(date) && date >= week.start && date <= week.end;

  const completedTasks = tasks
    .filter((task) => task?.completed && inWeek(localDateOf(task.completedAt)))
    .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));

  const activeHabits = getActiveHabits(habits);
  const activeDays = new Set();
  const items = activeHabits.map((habit) => {
    for (const [key, log] of Object.entries(habit.logs || {})) {
      if (log?.completed && inWeek(key)) activeDays.add(key);
    }
    const done = getWeeklyCompletionCount(habit, week.start);
    const weekly = habit.frequency === 'weekly';
    const target = weekly ? (habit.targetPerWeek ?? 1) : week.elapsedDays;
    return {
      id: habit.id,
      name: habit.name,
      frequency: weekly ? 'weekly' : 'daily',
      done,
      target,
      met: target > 0 && done >= target,
      weeklyRewardClaimed: weekly ? isWeeklyRewardClaimed(habit, week.start) : null,
      // A streak only means something "as of now", so it is given for the current week only.
      streak: week.isCurrentWeek ? getHabitStreak(habit, today) : null,
    };
  });

  const history = Array.isArray(dailyCheckIn?.history) ? dailyCheckIn.history : [];
  const checkInDays = new Set(history.filter((entry) => entry?.checkedInAt && inWeek(entry.date)).map((entry) => entry.date));

  return {
    weekStart: week.start,
    weekEnd: week.end,
    isCurrentWeek: week.isCurrentWeek,
    elapsedDays: week.elapsedDays,
    tasks: {
      completed: completedTasks.length,
      recent: completedTasks.slice(0, RECENT_TASKS).map((task) => ({ id: task.id, title: task.title || task.content || '' })),
    },
    habits: {
      items,
      completions: items.reduce((sum, item) => sum + item.done, 0),
      activeDays: activeDays.size,
    },
    checkIns: { available: Boolean(dailyCheckIn), days: checkInDays.size },
  };
}

/** The two numbers senior mode shows, with one encouraging line. */
export function buildSeniorWeeklySummary(review) {
  const tasks = review.tasks.completed;
  const habitDays = review.habits.activeDays;
  let message = '這週從一件小事開始就很好。';
  if (tasks > 0 && habitDays > 0) message = '事情和習慣都有照顧到，很棒。';
  else if (tasks > 0) message = '完成的每一件事都算數。';
  else if (habitDays > 0) message = '習慣有在持續，繼續保持。';
  return { tasks, habitDays, message };
}

/** "10/13（一）～10/19（日）" */
export function formatWeekRange(review) {
  const label = (dateStr) => {
    const date = new Date(`${dateStr}T12:00:00`);
    return `${date.getMonth() + 1}/${date.getDate()}（${WEEKDAY_LABELS[date.getDay()]}）`;
  };
  return `${label(review.weekStart)}～${label(review.weekEnd)}`;
}

/** The home card offers last week's review on Mondays, until it is opened or dismissed for that week. */
export function isMondayCardDue(today = getTodayDateString(), dismissedWeekStart = null) {
  const isMonday = new Date(`${today}T12:00:00`).getDay() === 1;
  return isMonday && dismissedWeekStart !== getWeekMonday(today);
}
