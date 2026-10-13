/**
 * 任務 CRUD、子任務、今日計畫與完成邏輯
 */
import { isDemonFinalTask } from './demonFinalTaskCore.js';
import { dbGet, dbGetAll, dbPut, dbMutateRecords, STORES } from './db.js';
import { commitTutorialTask } from './guidedOnboardingService.js';
import { GUIDED_KEY } from './guidedOnboardingCore.js';
import { putWithAwakeningProgress } from './petAwakeningService.js';
import { claimTaskReward } from './rewardService.js';
import { normalizeTask, normalizePlannedTime } from './taskMigration.js';
import {
  getTodayDateString,
  validateDateRange,
  isCompletedBeforeDue,
  isCompletedToday,
  isInTodayPlan,
} from './taskFilterService.js';
import {
  recordPlanToday,
  recordSubtaskCreated,
  recordSubtaskCompleted,
  recordCompletedBeforeDue,
} from './taskStatsService.js';

/** 從 content 第一行擷取標題 */
export function extractTitle(content) {
  const firstLine = (content || '').split('\n')[0].trim();
  return firstLine || '未命名任務';
}

/** 產生唯一 ID */
function generateId() {
  return crypto.randomUUID();
}

function validatePlannedTime(value) {
  if (value == null || value === '') return null;
  const time = normalizePlannedTime(value);
  if (!time) throw new Error('請輸入有效時間（00:00 至 23:59）');
  return time;
}

/** 產生子任務 ID */
export function generateSubtaskId() {
  return `subtask_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** 正規化從 DB 讀取的任務 */
function normalizeFromDb(task) {
  return normalizeTask(task, getTodayDateString());
}

/** 建立任務預設欄位 */
function buildTaskDefaults(data, now) {
  const today = getTodayDateString();
  const planToday = !!data.planToday;
  return {
    categoryId: data.categoryId || 'general',
    startDate: data.startDate || null,
    dueDate: data.dueDate || null,
    isPlannedToday: (data.plannedDate || (planToday ? today : null)) === today,
    plannedDate: data.plannedDate || (planToday ? today : null),
    plannedTime: validatePlannedTime(data.plannedTime),
    subtasks: (data.subtasks || []).map((s) => ({
      id: s.id || generateSubtaskId(),
      text: (s.text || '').trim(),
      completed: s.completed ?? false,
      createdAt: s.createdAt || now,
      completedAt: s.completedAt ?? null,
    })),
  };
}

/** 取得所有任務（已正規化） */
export async function getAllTasks() {
  const tasks = await dbGetAll(STORES.TASKS);
  const guide = tasks.some((t) => t.tutorialMode === 'replay') ? await dbGet(STORES.META, GUIDED_KEY) : null;
  return tasks.filter((t) => t.tutorialMode !== 'replay' || (guide?.status === 'active' && t.tutorialRunId === guide.runId)).map(normalizeFromDb);
}

/** 依 ID 取得任務 */
export async function getTaskById(id) {
  const tasks = await getAllTasks();
  return tasks.find((t) => t.id === id) ?? null;
}

/**
 * 新增任務
 */
export async function createTask(data) {
  const now = new Date().toISOString();
  const dateCheck = validateDateRange(data.startDate, data.dueDate);
  if (!dateCheck.valid) throw new Error(dateCheck.message);

  const extras = buildTaskDefaults(data, now);
  const task = {
    id: data.isTutorial ? `tutorial:${data.tutorialRunId}` : generateId(),
    content: data.content.trim(),
    title: extractTitle(data.content),
    priority: data.priority || 'normal',
    type: 'one_time',
    completed: false,
    rewardClaimed: false,
    lastRewardClaimedAt: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    ...extras,
    ...(data.isTutorial ? { isTutorial: true, tutorialRunId: data.tutorialRunId,
      tutorialMode: data.tutorialMode === 'replay' ? 'replay' : 'first' } : {}),
  };

  if (task.isTutorial) return commitTutorialTask(task);
  await dbPut(STORES.TASKS, task);

  if (extras.isPlannedToday) await recordPlanToday();
  if (extras.subtasks.length > 0) await recordSubtaskCreated();

  return task;
}

/**
 * 更新任務
 */
export async function updateTask(id, updates) {
  const task = await getTaskById(id);
  if (!task) throw new Error('任務不存在');

  const startDate = updates.startDate !== undefined ? updates.startDate : task.startDate;
  const dueDate = updates.dueDate !== undefined ? updates.dueDate : task.dueDate;
  const dateCheck = validateDateRange(startDate, dueDate);
  if (!dateCheck.valid) throw new Error(dateCheck.message);

  const now = new Date().toISOString();
  const updated = {
    ...task,
    ...updates,
    type: 'one_time',
    updatedAt: now,
    plannedTime: updates.plannedTime !== undefined ? validatePlannedTime(updates.plannedTime) : task.plannedTime,
  };

  if (updates.content !== undefined) {
    updated.content = updates.content.trim();
    updated.title = extractTitle(updated.content);
  }

  if (updates.subtasks !== undefined) {
    const hadSubtasks = (task.subtasks || []).length > 0;
    updated.subtasks = updates.subtasks.map((s) => ({
      id: s.id || generateSubtaskId(),
      text: (s.text || '').trim(),
      completed: s.completed ?? false,
      createdAt: s.createdAt || now,
      completedAt: s.completedAt ?? null,
    }));
    if (!task.isTutorial && !hadSubtasks && updated.subtasks.length > 0) {
      await recordSubtaskCreated();
    }
  }

  const today = getTodayDateString();
  if (!task.isTutorial && updates.isPlannedToday && updated.plannedDate === today && !task.isPlannedToday) {
    await recordPlanToday();
  }

  await putWithAwakeningProgress(STORES.TASKS, updated);
  return updated;
}

/** 刪除任務 */
export async function deleteTask(id) {
  await dbMutateRecords([{ store: STORES.TASKS, key: id }], ([task]) => {
    if (isDemonFinalTask(task)) throw Error('惡魔的趣味不能刪除，只能完成；沒有完成期限。');
    return { deletes: [{ store: STORES.TASKS, key: id }] };
  });
}

/** 加入今日計畫 */
export async function addToTodayPlan(id) {
  const today = getTodayDateString();
  const task = await updateTask(id, {
    isPlannedToday: true,
    plannedDate: today,
  });
  if (!task.isTutorial) await recordPlanToday();
  return task;
}

/** 移出今日計畫 */
export async function removeFromTodayPlan(id) {
  return updateTask(id, {
    isPlannedToday: false,
    plannedDate: null,
  });
}

/** 切換子任務完成狀態 */
export async function toggleSubtaskComplete(taskId, subtaskId) {
  const task = await getTaskById(taskId);
  if (!task) throw new Error('任務不存在');

  const now = new Date().toISOString();
  let justCompleted = false;

  const subtasks = (task.subtasks || []).map((s) => {
    if (s.id !== subtaskId) return s;
    const completed = !s.completed;
    if (completed && !s.completed) justCompleted = true;
    return {
      ...s,
      completed,
      completedAt: completed ? now : null,
    };
  });

  const updated = await updateTask(taskId, { subtasks });

  if (justCompleted && !task.isTutorial) {
    await recordSubtaskCompleted();
  }

  const allDone = subtasks.length > 0 && subtasks.every((s) => s.completed);
  return { task: updated, justCompleted, allSubtasksDone: allDone && !updated.completed };
}

/**
 * 切換任務完成狀態，完成時自動發放獎勵
 */
export async function toggleTaskComplete(id) {
  const task = await getTaskById(id);
  if (!task) throw new Error('任務不存在');
  if (task.isTutorial) {
    const reward = await claimTaskReward(task);
    return { task: reward.task, reward: reward.amount || reward.energy ? reward : null, justCompleted: !task.completed };
  }

  const now = new Date().toISOString();

  if (task.completed && isDemonFinalTask(task)) return { task, reward: null, justCompleted: false };
  if (task.completed) {
    const updated = await updateTask(id, {
      completed: false,
      completedAt: null,
    });
    return { task: updated, reward: null, justCompleted: false };
  }

  const updated = await updateTask(id, {
    completed: true,
    completedAt: now,
  });

  if (isCompletedBeforeDue(updated)) {
    await recordCompletedBeforeDue();
  }

  const reward = await claimTaskReward(updated);
  if (reward.amount > 0 || reward.energy > 0) {
    return { task: reward.task, reward, justCompleted: true };
  }
  return { task: reward.task, reward: null, justCompleted: true };
}

/** 今日完成的任務數 */
export async function getTodayCompletedCount() {
  const tasks = await getAllTasks();
  const today = getTodayDateString();
  return tasks.filter((t) => !t.isTutorial && isCompletedToday(t, today)).length;
}

/** 今日計畫任務數 */
export async function getTodayPlanCount() {
  const tasks = await getAllTasks();
  const today = getTodayDateString();
  return tasks.filter((t) => !t.isTutorial && !t.completed && isInTodayPlan(t, today)).length;
}

/** 匯出所有任務（備份用） */
export async function exportTasks() {
  return getAllTasks();
}

/** 匯入任務（備份還原用） */
export async function importTasks(tasks) {
  const today = getTodayDateString();
  for (const task of tasks) {
    const normalized = normalizeTask(task, today);
    await dbPut(STORES.TASKS, normalized);
  }
}
