/**
 * Task form: create and edit tasks, subtasks, dates, reminders and the today-plan option,
 * including the guided tutorial draft and senior-mode composition. Writes go through taskService.
 */
import { showSkippedEditorHint, getGuidedTutorialDraft } from '../guidedOnboardingController.js';
import { recordOnboardingEvent } from '../onboardingController.js';
import { shiftDate } from '../reminderRules.js';
import { composeSeniorTaskForm, decorateSeniorControls, seniorTaskCreated, isSeniorMode } from '../seniorModeController.js';
import { getTodayDateString, isInTodayPlan, validateDateRange } from '../taskFilterService.js';
import { updateTask, createTask } from '../taskService.js';
import { initTaskWizard } from '../taskWizard.js';
import { escapeHtml } from '../uiHelpers.js';
import { trackUpdateActivity } from '../updateActivity.js';
import { handleAchievementCheckAfterAction } from './achievementsView.js';

// Bound from src/ui.js by connectTaskFormView() so this module never imports ui.js back.
let closeModal, dismissModal, formatCategoryLabel, isTodayTaskViewMode, onRefresh, openModal, showToast, state;

export function connectTaskFormView(deps) {
  ({ closeModal, dismissModal, formatCategoryLabel, isTodayTaskViewMode, onRefresh, openModal, showToast, state } = deps);
}

export function openTaskForm(taskId = null) {
  showSkippedEditorHint();
  const practice = !taskId ? getGuidedTutorialDraft() : null;
  const task = taskId ? state.tasks.find((t) => t.id === taskId) : practice;
  const isEdit = !!taskId && !!task;
  const today = getTodayDateString();
  const categories = state.categories || [];
  const inPlan = practice ? true : task ? isInTodayPlan(task, today) : isTodayTaskViewMode();
  const subtasks = task?.subtasks || [];

  const categoryOptions = categories.map(
    (c) => `<option value="${c.id}" ${(task?.categoryId || 'general') === c.id ? 'selected' : ''}>${formatCategoryLabel(c)}</option>`
  ).join('');

  const subtaskListHtml = subtasks.map((s, i) => `
    <div class="subtask-form-item" data-index="${i}">
      <input type="text" class="form-input subtask-form-input" value="${escapeHtml(s.text)}" placeholder="子任務內容" maxlength="200" />
      <button type="button" class="btn btn--ghost btn--sm btn--danger subtask-form-remove" data-index="${i}" aria-label="刪除子任務">×</button>
    </div>
  `).join('');

  openModal(`
    <h2 class="modal-title">${isEdit ? '編輯任務' : '新增任務'}</h2>
    <form id="task-form" class="form task-form">
      <label class="form-label" for="task-content">任務內容</label>
      <textarea id="task-content" class="form-textarea" rows="4" placeholder="第一行將自動成為標題…" required>${task ? escapeHtml(task.content) : ''}</textarea>

      <label class="settings-toggle form-toggle" for="task-plan-today">
        <span class="settings-toggle__text">
          <span class="settings-toggle__label">加入今日計畫</span>
          <span class="settings-toggle__desc">標記為今天打算完成的任務</span>
        </span>
        <input type="checkbox" id="task-plan-today" class="settings-toggle__input" ${inPlan ? 'checked' : ''} />
        <span class="settings-toggle__switch" aria-hidden="true"></span>
      </label>

      <details class="task-editor-options" ${isEdit ? 'open' : ''}>
      <summary>分類、日期與子任務</summary>
      <label class="form-label" for="task-category">分類</label>
      <select id="task-category" class="form-select">${categoryOptions}</select>

      <label class="form-label">重要程度</label>
      <div class="segmented-control" id="task-priority-group">
        <button type="button" class="segmented-control__btn ${(!task || task.priority === 'normal') ? 'active' : ''}" data-value="normal">普通</button>
        <button type="button" class="segmented-control__btn segmented-control__btn--important ${task?.priority === 'important' ? 'active' : ''}" data-value="important">重要</button>
        <button type="button" class="segmented-control__btn segmented-control__btn--urgent ${task?.priority === 'urgent' ? 'active' : ''}" data-value="urgent">緊急</button>
      </div>
      <input type="hidden" id="task-priority" value="${task?.priority || 'normal'}" />

      ${!isEdit ? '<p class="form-hint">當天臨時任務可略過開始日與截止日；勾選「加入今日計畫」即可安排今天要做的事。</p>' : ''}

      <div class="form-row">
        <div class="form-field">
          <label class="form-label" for="task-start-date">開始日</label>
          <input type="date" id="task-start-date" class="form-input" value="${escapeHtml(task?.startDate || '')}" />
        </div>
        <div class="form-field">
          <label class="form-label" for="task-due-date">截止日</label>
          <input type="date" id="task-due-date" class="form-input" value="${escapeHtml(task?.dueDate || '')}" />
        </div>
      </div>
      <p class="form-error" id="task-date-error" hidden>開始日不可晚於截止日</p>

      <div class="form-field">
        <label class="form-label" for="task-plan-date">安排日期</label>
        <input type="date" id="task-plan-date" class="form-input" value="${escapeHtml(task?.plannedDate || (inPlan ? today : ''))}" />
        <div class="form-actions">
          <button type="button" class="btn btn--secondary btn--sm" data-plan-date="today">今天</button>
          <button type="button" class="btn btn--secondary btn--sm" data-plan-date="tomorrow">明天</button>
          <button type="button" class="btn btn--ghost btn--sm" data-plan-date="clear">未安排</button>
        </div>
        <p class="form-hint">前一天選「明天」，隔天會加入今日計畫與每日提醒。</p>
      </div>

      <div class="form-field">
        <label class="form-label" for="task-planned-time">安排時間（選填）</label>
        <input type="time" id="task-planned-time" class="form-input" value="${escapeHtml(task?.plannedTime || '')}" aria-describedby="task-time-hint" />
        <p id="task-time-hint" class="form-hint">記下要做的時間；這不是個別鬧鐘。每日提醒可在設定中開啟。</p>
      </div>

      <label class="form-label">子任務</label>
      <div id="subtask-form-list" class="subtask-form-list">${subtaskListHtml}</div>
      <p class="form-hint subtask-form-empty" id="subtask-form-empty" ${subtasks.length ? 'hidden' : ''}>這個任務還沒有子任務，可以把大型任務拆成幾個小步驟。</p>
      <div class="subtask-form-add">
        <input type="text" id="subtask-new-input" class="form-input" placeholder="輸入子任務內容" maxlength="200" />
        <button type="button" class="btn btn--secondary btn--sm" id="subtask-add-btn">新增子任務</button>
      </div>
      </details>

      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="form-cancel">取消</button>
        <button type="submit" class="btn btn--primary">${isEdit ? '儲存' : '新增'}</button>
      </div>
    </form>
  `);

  composeSeniorTaskForm(isEdit);
  if (practice) {
    document.getElementById('task-plan-date').value = today;
    void recordOnboardingEvent('editor-opened');
  }

  document.getElementById('form-cancel')?.addEventListener('click', dismissModal);

  document.querySelectorAll('[data-plan-date]').forEach((button) => button.addEventListener('click', () => {
    const date = button.dataset.planDate === 'clear' ? '' : shiftDate(getTodayDateString(), button.dataset.planDate === 'tomorrow' ? 1 : 0);
    document.getElementById('task-plan-date').value = date;
    document.getElementById('task-plan-today').checked = date === getTodayDateString();
  }));
  document.getElementById('task-plan-date')?.addEventListener('change', (event) => {
    document.getElementById('task-plan-today').checked = event.target.value === getTodayDateString();
  });
  document.getElementById('task-plan-today')?.addEventListener('change', (event) => {
    document.getElementById('task-plan-date').value = event.target.checked ? getTodayDateString() : '';
  });

  document.querySelectorAll('#task-priority-group .segmented-control__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#task-priority-group .segmented-control__btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('task-priority').value = btn.dataset.value;
    });
  });

  const formSubtasks = [...subtasks];

  function renderSubtaskFormList() {
    const list = document.getElementById('subtask-form-list');
    const emptyHint = document.getElementById('subtask-form-empty');
    if (!list) return;
    list.innerHTML = formSubtasks.map((s, i) => `
      <div class="subtask-form-item" data-index="${i}">
        <input type="text" class="form-input subtask-form-input" value="${escapeHtml(s.text)}" placeholder="子任務內容" maxlength="200" data-index="${i}" />
        <button type="button" class="btn btn--ghost btn--sm btn--danger subtask-form-remove" data-index="${i}" aria-label="刪除子任務">×</button>
      </div>
    `).join('');
    if (emptyHint) emptyHint.hidden = formSubtasks.length > 0;
    decorateSeniorControls();

    list.querySelectorAll('.subtask-form-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.index);
        formSubtasks.splice(idx, 1);
        renderSubtaskFormList();
      });
    });
    list.querySelectorAll('.subtask-form-input').forEach((input) => {
      input.addEventListener('input', () => {
        const idx = Number(input.dataset.index);
        if (formSubtasks[idx]) formSubtasks[idx].text = input.value;
      });
    });
  }

  document.getElementById('subtask-add-btn')?.addEventListener('click', () => {
    const input = document.getElementById('subtask-new-input');
    const text = input?.value.trim();
    if (!text) {
      showToast('子任務文字不可為空', 'warning');
      return;
    }
    formSubtasks.push({ text, completed: false });
    if (input) input.value = '';
    renderSubtaskFormList();
  });

  document.getElementById('subtask-new-input')?.addEventListener('keydown', (e) => {
    // Enter can confirm an IME candidate; do not turn that into a subtask action.
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('subtask-add-btn')?.click();
    }
  });

  renderSubtaskFormList();

  let wizard = null;
  document.getElementById('task-form')?.addEventListener('submit', trackUpdateActivity(async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (wizard && !wizard.isReview()) { wizard.next(); return; }
    if (form.dataset.saving === 'true') return;
    const content = document.getElementById('task-content').value.trim();
    const priority = document.getElementById('task-priority').value;
    const categoryId = document.getElementById('task-category').value;
    const startDate = document.getElementById('task-start-date').value || null;
    const dueDate = document.getElementById('task-due-date').value || null;
    const planToday = document.getElementById('task-plan-today').checked;
    const plannedDate = document.getElementById('task-plan-date').value || null;
    const plannedTime = document.getElementById('task-planned-time').value || null;
    const dateError = document.getElementById('task-date-error');

    if (!content) {
      showToast('請輸入任務內容', 'warning');
      return;
    }

    const dateCheck = validateDateRange(startDate, dueDate);
    if (!dateCheck.valid) {
      wizard?.goTo(4);
      const options = dateError?.closest('details');
      if (options) options.open = true;
      if (dateError) {
        dateError.textContent = dateCheck.message;
        dateError.hidden = false;
      }
      showToast(dateCheck.message, 'error');
      document.getElementById('task-start-date').setAttribute('aria-invalid', 'true');
      document.getElementById('task-start-date').setAttribute('aria-describedby', 'task-date-error');
      document.getElementById('task-start-date').focus();
      return;
    }
    if (dateError) dateError.hidden = true;
    document.getElementById('task-start-date').removeAttribute('aria-invalid');

    const subtaskInputs = document.querySelectorAll('#subtask-form-list .subtask-form-input');
    const finalSubtasks = formSubtasks.map((s, i) => ({
      id: s.id,
      text: (subtaskInputs[i]?.value || s.text || '').trim(),
      completed: s.completed ?? false,
      createdAt: s.createdAt,
      completedAt: s.completedAt ?? null,
    })).filter((s) => s.text);

    for (const s of finalSubtasks) {
      if (!s.text) {
        showToast('子任務文字不可為空', 'warning');
        return;
      }
    }

    const payload = {
      ...(practice || {}),
      content,
      priority,
      categoryId,
      startDate,
      dueDate,
      planToday,
      plannedDate,
      plannedTime,
      subtasks: finalSubtasks,
    };

    let createdTask = null;
    form.dataset.saving = 'true';
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      if (isEdit) {
        const todayStr = getTodayDateString();
        await updateTask(taskId, {
          content,
          priority,
          categoryId,
          startDate,
          dueDate,
          subtasks: finalSubtasks,
          isPlannedToday: planToday,
          plannedDate,
          plannedTime,
        });
        showToast('任務已更新', 'success');
      } else {
        createdTask = await createTask(payload);
        showToast('任務已新增', 'success');
        seniorTaskCreated(createdTask.id);
      }
      closeModal();
      await onRefresh();
      if (!createdTask?.isTutorial) await handleAchievementCheckAfterAction();
      if (createdTask) {
        void recordOnboardingEvent('task-created', { taskId: createdTask.id });
      }
    } catch (err) {
      showToast(err.message || '儲存失敗', 'error');
    } finally { form.dataset.saving = 'false'; submit.disabled = false; }
  }));
  // Senior mode keeps the one-page form composed by composeSeniorTaskForm instead of the six-step wizard.
  if (!isEdit && !practice && !isSeniorMode()) wizard = initTaskWizard(document.getElementById('task-form'));
}
