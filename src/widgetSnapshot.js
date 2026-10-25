/**
 * Snapshot of unfinished to-dos for the iOS home-screen widget. Only the fields the widget shows;
 * the widget groups by date itself, so a snapshot written yesterday still sorts correctly today.
 */
export const WIDGET_SNAPSHOT_LIMIT = 20;
const TITLE_LIMIT = 60;

function rank(task, today) {
  if (task.dueDate && task.dueDate < today) return 0;
  if (task.plannedDate === today) return 1;
  if (task.dueDate === today) return 2;
  if (task.dueDate) return 3;
  return 4;
}

export function buildWidgetSnapshot(tasks, today) {
  const unfinished = (tasks || []).filter((task) => !task.completed && !task.isTutorial);
  const ordered = unfinished
    .map((task, index) => ({ task, index, rank: rank(task, today) }))
    .sort((a, b) => a.rank - b.rank
      || (a.rank === 3 ? a.task.dueDate.localeCompare(b.task.dueDate) : 0)
      || a.index - b.index)
    .slice(0, WIDGET_SNAPSHOT_LIMIT)
    .map(({ task }) => ({
      id: task.id,
      title: String(task.title || task.content || '').slice(0, TITLE_LIMIT),
      plannedDate: task.plannedDate || null,
      dueDate: task.dueDate || null,
      priority: task.priority || 'normal',
    }));
  return { schemaVersion: 1, today, unfinishedCount: unfinished.length, tasks: ordered };
}
