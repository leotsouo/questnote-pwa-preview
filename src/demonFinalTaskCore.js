import { DARKCOURT_AWAKENING_IDS } from './petAwakeningProfiles.js';

export const DEMON_QUESTION = '你最近有哪件事對你很有幫助，你卻一直沒完成的？覺得完成的過程很痛苦卻知道對自己很好的？';
export const DEMON_TASK_TITLE = '惡魔的趣味';
export const needsDemonFinalTask = (petId) => DARKCOURT_AWAKENING_IDS.includes(petId);
export const demonFinalTaskId = (petId) => `demon_final_${petId}`;
export const isDemonFinalTask = (task) => typeof task?.id === 'string' && task.id.startsWith('demon_final_');
export const findDemonFinalTask = (tasks, petId) => (tasks || []).find((task) => task.id === demonFinalTaskId(petId));

export function validateDemonFinalTask(task) {
  if (!isDemonFinalTask(task)) return [];
  const petId = task.id.slice('demon_final_'.length);
  return needsDemonFinalTask(petId) && task.systemTask === 'demon-final' && task.awakeningPetId === petId
    && task.title === DEMON_TASK_TITLE && typeof task.content === 'string'
    && task.content.startsWith(`${DEMON_TASK_TITLE}\n`) && task.content.slice(DEMON_TASK_TITLE.length).trim()
    && task.content.length <= 2010 && task.dueDate === null && task.startDate === null
    && task.plannedDate && !task.isTutorial && task.type === 'one_time' && task.subtasks?.length === 0
    ? [] : ['惡魔的趣味：系統任務格式無效'];
}

export function demonFinalTaskComplete(tasks, petId) {
  const task = findDemonFinalTask(tasks, petId);
  return !!task && !validateDemonFinalTask(task).length && task.completed
    && typeof task.completedAt === 'string' && Number.isFinite(Date.parse(task.completedAt));
}

/** Only completion may change the promise; guard the current persisted record. */
export function assertDemonTaskUpdate(current, next) {
  if (!isDemonFinalTask(current)) {
    if (isDemonFinalTask(next) || next?.systemTask === 'demon-final') throw Error('請從夥伴的覺醒旅程接下惡魔的趣味');
    return;
  }
  const mutable = new Set(['completed', 'completedAt', 'updatedAt', 'isPlannedToday', 'rewardClaimed', 'lastRewardClaimedAt']);
  if (Object.keys({ ...current, ...next }).some((key) => !mutable.has(key) && JSON.stringify(current[key]) !== JSON.stringify(next[key]))
    || (current.rewardClaimed && !next.rewardClaimed) || (current.completed && !next.completed) || (!next.completed && next.completedAt)) {
    throw Error('惡魔的趣味只能完成，不能編輯、移出今日或取消完成');
  }
}
