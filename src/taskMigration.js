/**

 * 任務資料遷移 — 補齊 V1.8 欄位，不破壞舊資料（含 V1.9 殘留 tags 可安全忽略）

 */

import { dbGetAll, dbPut, STORES } from './db.js';

import { getTodayDateString } from './taskFilterService.js';



const VALID_PRIORITIES = new Set(['normal', 'important', 'urgent']);



/** 正規化子任務 */

function normalizeSubtask(sub) {

  if (!sub || typeof sub !== 'object') {

    return {

      id: `subtask_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,

      text: '',

      completed: false,

      createdAt: new Date().toISOString(),

      completedAt: null,

    };

  }

  return {

    id: sub.id || `subtask_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,

    text: typeof sub.text === 'string' ? sub.text : '',

    completed: sub.completed ?? false,

    createdAt: sub.createdAt || new Date().toISOString(),

    completedAt: sub.completedAt ?? null,

  };

}



function extractTitleFromContent(content) {

  const firstLine = (content || '').split('\n')[0]?.trim();

  return firstLine || '未命名任務';

}



function resolveTaskType() {
  return 'one_time';
}



/**

 * 正規化單一任務，補齊 V1.8 欄位

 * tags 等 V1.9 欄位若存在會保留，但不影響 V1.8 邏輯

 */

export function normalizeTask(task, today = getTodayDateString()) {

  if (!task || typeof task !== 'object') return null;



  const content = typeof task.content === 'string' ? task.content : '';

  const plannedDate = task.plannedDate ?? null;

  let isPlannedToday = false;



  if (plannedDate === today) {

    isPlannedToday = true;

  }



  const type = resolveTaskType();

  const now = new Date().toISOString();

  const wasRepeatable = task.type === 'repeatable' || task.taskType === 'repeatable';

  let rewardClaimed = !!task.rewardClaimed;

  if (wasRepeatable && task.lastRewardClaimedAt) {

    rewardClaimed = true;

  }

  let completedAt = task.completedAt ?? null;

  if (task.completed && !completedAt) {

    completedAt = task.updatedAt || task.createdAt || now;

  }



  return {

    ...task,

    id: task.id,

    content,

    title: task.title || extractTitleFromContent(content),

    priority: VALID_PRIORITIES.has(task.priority) ? task.priority : 'normal',

    type,

    categoryId: task.categoryId || 'general',

    startDate: task.startDate ?? null,

    dueDate: task.dueDate ?? null,

    isPlannedToday,

    plannedDate,

    subtasks: Array.isArray(task.subtasks)

      ? task.subtasks.map(normalizeSubtask)

      : [],

    completed: !!task.completed,

    rewardClaimed,

    createdAt: task.createdAt || now,

    updatedAt: task.updatedAt || task.createdAt || now,

    completedAt,

    lastRewardClaimedAt: task.lastRewardClaimedAt ?? null,

  };

}



/** 判斷任務是否需要寫回（欄位有變更） */

function taskNeedsMigration(original, normalized) {

  if (!original?.id || !normalized) return false;



  if (!original.categoryId && normalized.categoryId) return true;

  if (original.startDate === undefined && normalized.startDate !== undefined) return true;

  if (original.dueDate === undefined && normalized.dueDate !== undefined) return true;

  if (!Array.isArray(original.subtasks) && Array.isArray(normalized.subtasks)) return true;

  if (!original.title && normalized.title) return true;

  if (original.taskType && !original.type) return true;

  if (original.type === 'repeatable' || original.taskType === 'repeatable') return true;

  if (original.completed && !original.completedAt && normalized.completedAt) return true;

  if (original.isPlannedToday !== normalized.isPlannedToday) return true;

  if (original.priority !== normalized.priority && !VALID_PRIORITIES.has(original.priority)) return true;



  return false;

}



/**

 * 執行任務遷移：讀取所有任務、補欄位、寫回

 * @returns {{ migrated: number, total: number, error?: string }}

 */

export async function migrateTasks() {

  const today = getTodayDateString();

  let migrated = 0;



  try {

    const tasks = await dbGetAll(STORES.TASKS);

    if (!tasks.length) return { migrated: 0, total: 0 };



    for (const task of tasks) {

      const normalized = normalizeTask(task, today);

      if (!normalized) continue;

      if (taskNeedsMigration(task, normalized)) {

        await dbPut(STORES.TASKS, normalized);

        migrated++;

      }

    }



    return { migrated, total: tasks.length };

  } catch (err) {

    console.error('[QuestNote] 任務遷移失敗:', err);

    return { migrated, total: 0, error: err.message };

  }

}

