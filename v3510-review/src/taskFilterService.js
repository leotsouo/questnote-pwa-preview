/**
 * 任務篩選、智慧清單、排序與日期顯示
 */

/** 取得今日日期字串 YYYY-MM-DD（本地時區） */
export function getTodayDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 解析 YYYY-MM-DD 為本地 Date（午夜） */
export function parseDateString(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 兩日期字串相差天數（a - b） */
export function daysBetween(a, b) {
  const da = parseDateString(a);
  const db = parseDateString(b);
  if (!da || !db) return null;
  return Math.round((da - db) / 86400000);
}

/** 任務是否在今日計畫中 */
export function isInTodayPlan(task, today = getTodayDateString()) {
  return task.plannedDate === today;
}

/** 從 ISO 時間字串取得本地日期 YYYY-MM-DD */
export function getLocalDateStringFromIso(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (!Number.isNaN(d.getTime())) {
    return getTodayDateString(d);
  }
  const datePart = isoString.split('T')[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
}

/** 任務是否於今日完成 */
export function isCompletedToday(task, today = getTodayDateString()) {
  if (!task.completed) return false;
  const completedDate = getLocalDateStringFromIso(task.completedAt);
  if (completedDate) return completedDate === today;
  const fallback = getLocalDateStringFromIso(task.updatedAt) || getLocalDateStringFromIso(task.createdAt);
  return fallback === today;
}

/** 日期狀態 */
export function getDateStatus(task, today = getTodayDateString()) {
  if (!task.dueDate) return 'none';
  if (task.completed) return 'done';
  const diff = daysBetween(task.dueDate, today);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff <= 7) return 'upcoming';
  return 'future';
}

/** 截止日在未來 7 天內（不含今天之前） */
export function isDueSoon(task, today = getTodayDateString()) {
  if (!task.dueDate || task.completed) return false;
  const diff = daysBetween(task.dueDate, today);
  return diff > 0 && diff <= 7;
}

/** 格式化日期 badge 文字 */
export function formatDateBadgeText(task, today = getTodayDateString()) {
  if (!task.dueDate) return '無截止日';
  const status = getDateStatus(task, today);
  const diff = daysBetween(task.dueDate, today);

  switch (status) {
    case 'overdue':
      return diff === -1 ? '昨天' : `已逾期 ${Math.abs(diff)} 天`;
    case 'today':
      return '今天';
    case 'tomorrow':
      return '明天';
    case 'upcoming':
      return `${diff} 天後`;
    case 'future': {
      const [y, m, d] = task.dueDate.split('-');
      return `${y}/${m}/${d}`;
    }
    case 'done': {
      const [y, m, d] = task.dueDate.split('-');
      return `${y}/${m}/${d}`;
    }
    default:
      return '無截止日';
  }
}

/** 日期 badge CSS 類別 */
export function getDateBadgeClass(task, today = getTodayDateString()) {
  const status = getDateStatus(task, today);
  return `badge--date badge--date-${status}`;
}

/** 子任務進度 */
export function getSubtaskProgress(task) {
  const subtasks = task.subtasks || [];
  const total = subtasks.length;
  const done = subtasks.filter((s) => s.completed).length;
  return { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
}

/** 所有子任務是否完成（主任務未完成） */
export function allSubtasksCompleted(task) {
  const subtasks = task.subtasks || [];
  return subtasks.length > 0 && subtasks.every((s) => s.completed);
}

/** 智慧清單定義 */
export const SMART_LISTS = [
  {
    id: 'today',
    name: '今天',
    desc: '今日計畫、今天到期或今天開始的任務',
    icon: '☀',
  },
  {
    id: 'due_soon',
    name: '即將到期',
    desc: '截止日在未來 7 天內的未完成任務',
    icon: '⏳',
  },
  {
    id: 'overdue',
    name: '已逾期',
    desc: '已過截止日且尚未完成',
    icon: '⚠',
  },
  {
    id: 'urgent',
    name: '緊急任務',
    desc: '重要程度為緊急的未完成任務',
    icon: '🔥',
  },
  {
    id: 'important',
    name: '重要任務',
    desc: '重要程度為重要的未完成任務',
    icon: '★',
  },
  {
    id: 'no_date',
    name: '無日期任務',
    desc: '未設定開始日與截止日的未完成任務',
    icon: '○',
  },
  {
    id: 'has_subtasks',
    name: '有子任務',
    desc: '已拆解子步驟的任務',
    icon: '☑',
  },
  {
    id: 'completed',
    name: '已完成',
    desc: '所有已完成的任務',
    icon: '✓',
  },
];

/** 智慧清單篩選 */
export function filterBySmartList(listId, tasks, today = getTodayDateString()) {
  switch (listId) {
    case 'today':
      return tasks.filter(
        (t) =>
          t.plannedDate === today ||
          t.dueDate === today ||
          t.startDate === today
      );
    case 'due_soon':
      return tasks.filter((t) => !t.completed && isDueSoon(t, today));
    case 'overdue':
      return tasks.filter(
        (t) => !t.completed && t.dueDate && daysBetween(t.dueDate, today) < 0
      );
    case 'urgent':
      return tasks.filter((t) => !t.completed && t.priority === 'urgent');
    case 'important':
      return tasks.filter((t) => !t.completed && t.priority === 'important');
    case 'no_date':
      return tasks.filter(
        (t) => !t.completed && !t.startDate && !t.dueDate
      );
    case 'has_subtasks':
      return tasks.filter((t) => (t.subtasks || []).length > 0);
    case 'completed':
      return tasks.filter((t) => t.completed);
    default:
      return [];
  }
}

/** 已完成任務時間篩選選項 */
export const COMPLETED_RANGE_OPTIONS = [
  { id: 'completed_1_month', label: '一個月內', days: 30 },
  { id: 'completed_3_months', label: '三個月內', days: 90 },
  { id: 'completed_all', label: '全部已完成', days: null },
];

/**
 * 依完成時間範圍篩選已完成任務
 * @param {Array} tasks
 * @param {'completed_1_month'|'completed_3_months'|'completed_all'} range
 */
export function filterCompletedTasksByRange(tasks, range) {
  const completedTasks = tasks.filter((task) => task.completed);

  if (range === 'completed_all') {
    return completedTasks;
  }

  const days = range === 'completed_1_month' ? 30 : 90;
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - days);

  return completedTasks.filter((task) => {
    if (!task.completedAt) return false;
    const completedDate = new Date(task.completedAt);
    if (Number.isNaN(completedDate.getTime())) return false;
    return completedDate >= cutoff;
  });
}

/** 已完成智慧清單空狀態文案 */
export function getCompletedRangeEmptyMessage(range) {
  switch (range) {
    case 'completed_1_month':
      return ['最近一個月還沒有完成的任務', '完成任務後會出現在這裡。'];
    case 'completed_3_months':
      return ['最近三個月還沒有完成的任務', '完成任務後會出現在這裡。'];
    case 'completed_all':
    default:
      return ['目前還沒有已完成任務', '完成任務後會出現在這裡。'];
  }
}

/** 依分類篩選 */
export function filterByCategory(tasks, categoryId) {
  if (!categoryId || categoryId === 'all') return tasks;
  return tasks.filter((t) => (t.categoryId || 'general') === categoryId);
}

/** 任務排序權重（數字越小越前） */
function getSortWeight(task, today = getTodayDateString()) {
  if (task.completed) return 900;

  const dateStatus = getDateStatus(task, today);
  if (dateStatus === 'overdue') return 100;
  if (dateStatus === 'today') return 200;
  if (task.priority === 'urgent') return 300;
  if (task.priority === 'important') return 400;
  if (isInTodayPlan(task, today)) return 500;
  if (dateStatus === 'upcoming' || dateStatus === 'tomorrow') return 600;
  if (dateStatus === 'none') return 800;
  return 700;
}

/** 排序任務（未完成優先，已完成最後） */
export function sortTasks(tasks, today = getTodayDateString()) {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;

    const wa = getSortWeight(a, today);
    const wb = getSortWeight(b, today);
    if (wa !== wb) return wa - wb;

    if (a.dueDate && b.dueDate) {
      const cmp = a.dueDate.localeCompare(b.dueDate);
      if (cmp !== 0) return cmp;
    } else if (a.dueDate) return -1;
    else if (b.dueDate) return 1;

    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

/** 今日視圖分組 */
export function getTodayViewSections(tasks, today = getTodayDateString()) {
  const incomplete = tasks.filter((t) => !t.completed);
  const complete = tasks.filter((t) => t.completed);

  const plannedIncomplete = incomplete.filter((t) => isInTodayPlan(t, today));
  const plannedCompletedToday = complete.filter(
    (t) => isInTodayPlan(t, today) && isCompletedToday(t, today)
  );
  const planned = sortTasks([...plannedIncomplete, ...plannedCompletedToday], today);

  const inPlanIds = new Set(planned.map((t) => t.id));

  const dueToday = incomplete.filter(
    (t) => t.dueDate === today && !inPlanIds.has(t.id)
  );
  const overdue = incomplete.filter(
    (t) => t.dueDate && daysBetween(t.dueDate, today) < 0
  );
  const completedToday = complete.filter(
    (t) => isCompletedToday(t, today) && !inPlanIds.has(t.id)
  );

  const dueTodayIds = new Set(dueToday.map((t) => t.id));
  const overdueFiltered = overdue.filter(
    (t) => !inPlanIds.has(t.id) && !dueTodayIds.has(t.id)
  );

  return {
    planned,
    plannedIncomplete: sortTasks(plannedIncomplete, today),
    plannedCompletedToday: sortTasks(plannedCompletedToday, today),
    dueToday: sortTasks(dueToday, today),
    overdue: sortTasks(overdueFiltered, today),
    completedToday: sortTasks(completedToday, today),
  };
}

/** 驗證日期範圍 */
export function validateDateRange(startDate, dueDate) {
  if (!startDate || !dueDate) return { valid: true };
  if (startDate > dueDate) {
    return { valid: false, message: '開始日不可晚於截止日' };
  }
  return { valid: true };
}

/** 是否在截止日當天或之前完成 */
export function isCompletedBeforeDue(task) {
  if (!task.completed || !task.dueDate) return false;
  const completedDate = getLocalDateStringFromIso(task.completedAt)
    || getLocalDateStringFromIso(task.updatedAt);
  if (!completedDate) return false;
  return completedDate <= task.dueDate;
}
