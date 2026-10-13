import { attachTaskVoiceInput } from './taskVoiceInput.js';

const QUESTIONS = [
  ['想完成什麼事？', '先寫下這件事，換行可以補充說明。'],
  ['打算什麼時候做？', '選擇今天、明天、其他日期，或暫時不安排。'],
  ['這件事有多重要？', '選一個最符合現在心情的程度。'],
  ['要放在哪個分類？', '方便之後找到這件事。'],
  ['還想補充什麼嗎？', '日期範圍與小步驟都可以留白。'],
  ['這樣記下來可以嗎？', '確認後就會加入任務清單。'],
];

function moveField(section, field) {
  if (!field) return;
  if (field.previousElementSibling?.matches(`label[for="${field.id}"]`)) section.append(field.previousElementSibling);
  section.append(field);
}

export function initTaskWizard(form) {
  if (!form) return null;
  form.classList.add('task-form--wizard');
  form.noValidate = true;
  const actions = form.querySelector(':scope > .form-actions:last-child');
  const options = form.querySelector('.task-editor-options');
  const sections = QUESTIONS.map(([question, hint], index) => {
    const section = document.createElement('section');
    section.className = 'task-wizard__step';
    section.dataset.wizardStep = String(index);
    section.setAttribute('aria-labelledby', `task-wizard-question-${index}`);
    section.innerHTML = `<p class="task-wizard__eyebrow">新增任務 · ${index + 1} / ${QUESTIONS.length}</p><h3 id="task-wizard-question-${index}" tabindex="-1">${question}</h3><p class="task-wizard__hint">${hint}</p>`;
    form.insertBefore(section, actions);
    return section;
  });

  moveField(sections[0], form.querySelector('#task-content'));
  const contentError = document.createElement('p');
  contentError.className = 'form-error';
  contentError.id = 'task-wizard-content-error';
  contentError.textContent = '請先寫下想完成的事。';
  contentError.hidden = true;
  sections[0].append(contentError);
  const voiceInput = attachTaskVoiceInput(form, sections[0], form.querySelector('#task-content'));
  const toggle = form.querySelector('label[for="task-plan-today"]');
  if (toggle) sections[1].append(toggle);
  sections[1].append(form.querySelector('#task-plan-date').closest('.form-field'));
  sections[1].append(form.querySelector('#task-planned-time').closest('.form-field'));
  const priorityGroup = form.querySelector('#task-priority-group');
  if (priorityGroup.previousElementSibling?.matches('.form-label')) sections[2].append(priorityGroup.previousElementSibling);
  sections[2].append(priorityGroup, form.querySelector('#task-priority'));
  moveField(sections[3], form.querySelector('#task-category'));
  [...options.children].forEach((child) => {
    if (child.tagName !== 'SUMMARY') sections[4].append(child);
  });
  options.remove();

  const review = document.createElement('div');
  review.className = 'task-wizard__review';
  review.setAttribute('aria-live', 'polite');
  sections[5].append(review);
  const progress = document.createElement('div');
  progress.className = 'task-wizard__progress';
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-label', '新增任務進度');
  progress.setAttribute('aria-valuemin', '1');
  progress.setAttribute('aria-valuemax', String(QUESTIONS.length));
  progress.innerHTML = '<span></span>';
  form.prepend(progress);

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'btn btn--ghost task-wizard__back';
  back.textContent = '上一步';
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'btn btn--primary task-wizard__next';
  next.textContent = '繼續';
  const submit = actions.querySelector('[type="submit"]');
  actions.insertBefore(back, submit);
  actions.insertBefore(next, submit);

  let current = 0;
  function renderReview() {
    const content = form.querySelector('#task-content').value.trim();
    const planDate = form.querySelector('#task-plan-date').value;
    const time = form.querySelector('#task-planned-time').value;
    const priority = form.querySelector('#task-priority-group .active')?.textContent.trim() || '普通';
    const category = form.querySelector('#task-category').selectedOptions[0]?.textContent.trim() || '一般';
    const rows = [
      ['要做的事', content],
      ['安排', `${planDate || '未安排'}${time ? ` ${time}` : ''}`],
      ['重要程度', priority],
      ['分類', category],
    ];
    const startDate = form.querySelector('#task-start-date').value;
    const dueDate = form.querySelector('#task-due-date').value;
    const subtasks = [...form.querySelectorAll('#subtask-form-list .subtask-form-input')]
      .map((input) => input.value.trim()).filter(Boolean);
    if (startDate || dueDate) rows.push(['日期範圍', `${startDate || '未指定'} → ${dueDate || '未指定'}`]);
    if (subtasks.length) rows.push(['小步驟', subtasks.join('、')]);
    review.replaceChildren(...rows.map(([label, value]) => {
      const row = document.createElement('p');
      const strong = document.createElement('strong');
      strong.textContent = `${label}：`;
      row.append(strong, document.createTextNode(value));
      return row;
    }));
  }
  function goTo(index) {
    if (current === 0 && index > 0) voiceInput.stop();
    current = Math.max(0, Math.min(index, sections.length - 1));
    sections.forEach((section, i) => { section.hidden = i !== current; });
    progress.setAttribute('aria-valuenow', String(current + 1));
    progress.querySelector('span').style.width = `${((current + 1) / sections.length) * 100}%`;
    back.hidden = current === 0;
    next.hidden = current === sections.length - 1;
    next.textContent = current === sections.length - 2 ? '查看摘要' : '繼續';
    submit.hidden = current !== sections.length - 1;
    if (current === sections.length - 1) renderReview();
    sections[current].querySelector('h3')?.focus({ preventScroll: true });
    form.closest('.modal')?.scrollTo?.({ top: 0 });
  }
  function nextStep() {
    if (current === 0 && !form.querySelector('#task-content').value.trim()) {
      form.querySelector('#task-content').focus();
      form.querySelector('#task-content').setAttribute('aria-invalid', 'true');
      form.querySelector('#task-content').setAttribute('aria-describedby', contentError.id);
      contentError.hidden = false;
      return;
    }
    form.querySelector('#task-content').removeAttribute('aria-invalid');
    form.querySelector('#task-content').removeAttribute('aria-describedby');
    contentError.hidden = true;
    goTo(current + 1);
  }
  back.addEventListener('click', () => goTo(current - 1));
  next.addEventListener('click', nextStep);
  form.querySelector('#task-plan-date').addEventListener('change', () => goTo(2));
  form.querySelectorAll('[data-plan-date]').forEach((button) => button.addEventListener('click', () => goTo(2)));
  form.querySelectorAll('#task-priority-group button').forEach((button) => button.addEventListener('click', () => goTo(3)));
  form.querySelector('#task-category').addEventListener('change', () => goTo(4));
  goTo(0);
  return { goTo, next: nextStep, isReview: () => current === sections.length - 1 };
}
