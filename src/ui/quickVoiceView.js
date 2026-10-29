/**
 * Quick voice entry sheet: one tap listens, 停止 saves the spoken text as a task due today,
 * then a short bar offers 復原 and 再說一件. Cancelled, timed-out or failed takes never save:
 * they open the typed task form with whatever was heard.
 */
import { recordOnboardingEvent } from '../onboardingController.js';
import { createQuickVoiceSession } from '../quickVoice.js';
import { seniorTaskCreated } from '../seniorModeController.js';
import { getTodayDateString } from '../taskFilterService.js';
import { createTask, deleteTask } from '../taskService.js';
import { escapeHtml } from '../uiHelpers.js';
import { handleAchievementCheckAfterAction } from './achievementsView.js';
import { openTaskForm } from './taskFormView.js';

// Bound from src/ui.js by connectQuickVoiceView() so this module never imports ui.js back.
let closeModal, onRefresh, openModal, showToast;

export function connectQuickVoiceView(deps) {
  ({ closeModal, onRefresh, openModal, showToast } = deps);
}

const UNDO_MS = 5000;
const BAR_MS = 12000;

const FALLBACK_MESSAGES = {
  timeout: '錄音滿 60 秒已停下，沒有自動儲存。請確認文字後再按新增。',
  ended: '語音中斷了，沒有自動儲存。請確認文字後再按新增。',
  empty: '沒有聽到內容，改用打字。',
  unsupported: '這裡無法使用語音輸入，改用打字。',
  'not-allowed': '麥克風權限未開啟，改用打字。',
  'service-not-allowed': '語音辨識權限未開啟，改用打字。',
  'audio-capture': '找不到可用的麥克風，改用打字。',
  network: '語音服務無法連線，改用打字。',
  'no-speech': '沒有聽到聲音，改用打字。',
};

let barTimers = [];

function removeUndoBar() {
  barTimers.forEach(clearTimeout);
  barTimers = [];
  document.getElementById('quick-voice-undo')?.remove();
}

function showUndoBar(task) {
  removeUndoBar();
  const bar = document.createElement('div');
  bar.id = 'quick-voice-undo';
  bar.className = 'quick-voice-undo';
  bar.setAttribute('role', 'status');
  bar.innerHTML = `<span class="quick-voice-undo__text">已建立：${escapeHtml(task.title || task.content)}</span>
    <button type="button" class="btn btn--ghost btn--sm" data-qv="undo">復原</button>
    <button type="button" class="btn btn--primary btn--sm" data-qv="again">再說一件</button>`;
  document.body.appendChild(bar);
  bar.querySelector('[data-qv="undo"]').addEventListener('click', async () => {
    removeUndoBar();
    try {
      await deleteTask(task.id);
      await onRefresh();
      showToast('已復原，這件沒有建立', 'info');
    } catch (err) {
      showToast(err.message || '復原失敗', 'error');
    }
  });
  bar.querySelector('[data-qv="again"]').addEventListener('click', () => {
    removeUndoBar();
    openQuickVoice();
  });
  barTimers.push(setTimeout(() => bar.querySelector('[data-qv="undo"]')?.setAttribute('hidden', ''), UNDO_MS));
  barTimers.push(setTimeout(removeUndoBar, BAR_MS));
}

function openTypedForm(text, reason) {
  closeModal();
  openTaskForm();
  const field = document.getElementById('task-content');
  if (field && text) {
    field.value = text;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
  field?.focus();
  const message = FALLBACK_MESSAGES[reason];
  if (message) showToast(message, 'warning', 4200);
}

async function saveSpokenTask(text) {
  try {
    const task = await createTask({ content: text, planToday: true, plannedDate: getTodayDateString() });
    closeModal();
    await onRefresh();
    seniorTaskCreated(task.id);
    showUndoBar(task);
    await handleAchievementCheckAfterAction();
    void recordOnboardingEvent('task-created', { taskId: task.id });
  } catch (err) {
    showToast(err.message || '儲存失敗，改用打字', 'error');
    openTypedForm(text, '');
  }
}

export function openQuickVoice() {
  removeUndoBar();
  openModal(`
    <h2 class="modal-title">語音新增任務</h2>
    <div class="quick-voice" id="quick-voice">
      <p class="quick-voice__status" id="quick-voice-status" role="status" aria-live="polite"></p>
      <p class="quick-voice__text" id="quick-voice-text" aria-live="polite"></p>
      <button type="button" class="quick-voice__main" id="quick-voice-main"></button>
      <button type="button" class="btn btn--ghost btn--sm quick-voice__cancel" id="quick-voice-cancel">取消</button>
    </div>
  `);
  const root = document.getElementById('quick-voice');
  const status = document.getElementById('quick-voice-status');
  const liveText = document.getElementById('quick-voice-text');
  const main = document.getElementById('quick-voice-main');
  const cancel = document.getElementById('quick-voice-cancel');

  const session = createQuickVoiceSession({
    onState(state, text) {
      if (!root.isConnected) return;
      liveText.textContent = text;
      main.classList.toggle('is-listening', state === 'listening');
      main.disabled = state === 'finishing';
      if (state === 'listening') {
        status.textContent = text ? '說完了就按「停止並儲存」。' : '請說話…說完按「停止並儲存」。';
        main.textContent = '停止並儲存';
      } else if (state === 'finishing') {
        status.textContent = '正在完成語音轉文字…';
      } else if (state === 'idle') {
        status.textContent = '點一下開始說話。';
        main.textContent = '開始說話';
      }
    },
    onSave: (text) => { void saveSpokenTask(text); },
    onFallback: (text, reason) => openTypedForm(text, reason),
    onCancel: () => closeModal(),
  });
  main.addEventListener('click', () => (session.state === 'listening' ? session.stop() : session.start()));
  cancel.addEventListener('click', () => session.cancel());

  // Closing the sheet any other way (backdrop, Esc, back) is a cancel: nothing is saved.
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    const observer = new MutationObserver(() => {
      if (root.isConnected && overlay.classList.contains('open')) return;
      observer.disconnect();
      if (session.state !== 'done') session.cancel();
    });
    observer.observe(overlay, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
  }
  session.start();
}
