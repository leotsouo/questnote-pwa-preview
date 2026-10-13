/** Shared, deterministic reminder projection and calendar rules. */
export const REMINDER_DEFAULTS = Object.freeze({
  time: '08:00', tasks: true, habits: true, weekly: true, overdue: false, showTitles: false,
});

export function zonedParts(now, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(now)).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function shiftDate(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Find the next local-calendar occurrence. Offset sampling handles DST gaps/folds. */
export function nextReminderAt(now, settings) {
  const today = zonedParts(now, settings.timeZone).date;
  const [hour, minute] = settings.time.split(':').map(Number);
  for (let day = 0; day < 3; day++) {
    const date = shiftDate(today, day);
    const target = Date.parse(`${date}T${settings.time}:00Z`);
    const candidates = new Set();
    for (const sample of [target - 86400000, target, target + 86400000]) {
      const local = zonedParts(sample, settings.timeZone);
      const offset = Date.parse(`${local.date}T${local.time}:00Z`) - sample;
      candidates.add(target - offset);
    }
    const valid = [...candidates].filter((time) => {
      const p = zonedParts(time, settings.timeZone);
      return p.date === date && p.time === settings.time;
    }).sort((a, b) => a - b);
    // A repeated local hour uses its first occurrence only.
    if (valid.length && valid[0] > now) return valid[0];
    if (!valid.length) {
      // In a DST gap, use the first valid minute after the requested local time.
      const start = Math.min(...candidates) - 3600000;
      for (let t = start; t <= start + 4 * 3600000; t += 60000) {
        const p = zonedParts(t, settings.timeZone);
        if (t > now && p.date === date && p.time >= `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`) return t;
      }
    }
  }
  throw new Error('無法計算下一次提醒時間');
}

export function projectReminderData(tasks, habits, settings, now = Date.now()) {
  const today = zonedParts(now, settings.timeZone).date;
  const oldest = shiftDate(today, -28);
  return {
    tasks: tasks.filter((t) => !t.isTutorial && !t.completed).map((t) => ({
      id: t.id, plannedDate: t.plannedDate || null, startDate: t.startDate || null,
      dueDate: t.dueDate || null, priority: t.priority || 'normal',
      ...(settings.showTitles ? { title: String(t.title || t.content?.split('\n')[0] || '').slice(0, 60) } : {}),
    })),
    habits: habits.filter((h) => h.isActive !== false && !h.archivedAt).map((h) => ({
      id: h.id, frequency: h.frequency, targetPerWeek: h.targetPerWeek || 1,
      completedDates: Object.keys(h.logs || {}).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= oldest && h.logs[d]?.completed),
      ...(settings.showTitles ? { name: String(h.name || '').slice(0, 60) } : {}),
    })),
  };
}

export function buildDailyDigest(state, now = Date.now()) {
  const { settings, tasks = [], habits = [] } = state;
  const date = zonedParts(now, settings.timeZone).date;
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const monday = shiftDate(date, -(day === 0 ? 6 : day - 1));
  const nextMonday = shiftDate(monday, 7);
  const due = settings.tasks ? tasks.filter((t) => !t.isTutorial && !t.completed && [t.plannedDate, t.startDate, t.dueDate].includes(date)) : [];
  const ids = new Set(due.map((t) => t.id));
  const overdue = settings.tasks && settings.overdue ? tasks.filter((t) => !t.isTutorial && !t.completed && t.dueDate && t.dueDate < date && !ids.has(t.id)) : [];
  const daily = settings.habits ? habits.filter((h) => h.frequency === 'daily' && !h.completedDates.includes(date)) : [];
  const weekly = settings.habits && settings.weekly ? habits.filter((h) => h.frequency === 'weekly' && !h.completedDates.includes(date)
    && h.completedDates.filter((d) => d >= monday && d < nextMonday).length < h.targetPerWeek) : [];
  const count = due.length + overdue.length + daily.length + weekly.length;
  const body = [`今天有 ${due.length} 項任務、${daily.length} 項每日習慣。`];
  if (overdue.length) body.push(`另有 ${overdue.length} 項逾期待處理。`);
  if (weekly.length) body.push(`${weekly.length} 項本週習慣尚未達標。`);
  if (settings.showTitles) {
    const ordered = [...due].sort((a, b) => ({ urgent: 2, important: 1, normal: 0 }[b.priority] || 0) - ({ urgent: 2, important: 1, normal: 0 }[a.priority] || 0));
    const names = [...ordered, ...daily, ...weekly, ...overdue].map((t) => t.title || t.name).filter(Boolean);
    if (names.length) body.push(names.slice(0, 3).join('、') + (names.length > 3 ? `，另有 ${names.length - 3} 項` : ''));
  }
  return { date, count, title: `QuestNote · ${date.slice(5).replace('-', '/')} 今日計畫`, body: body.join('\n') };
}
