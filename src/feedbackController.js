import {
  loadFeedbackDraft, saveFeedbackDraft, clearFeedbackDraft, normalizeFeedback,
  validateFeedback, collectFeedbackDiagnostics, buildFeedbackReport, sendFeedback,
  loadPendingFeedback, savePendingFeedback, finishFeedback, getFeedbackReceipt,
} from './feedbackService.js';

export function initFeedback({ navigate }) {
  const form = document.getElementById('feedback-form');
  if (!form) return;
  const preview = document.getElementById('feedback-preview');
  const body = document.getElementById('feedback-report');
  const status = document.getElementById('feedback-status');
  const draftStatus = document.getElementById('feedback-draft-status');
  const send = document.getElementById('feedback-send');
  const diagnosticPreview = document.getElementById('feedback-diagnostics');
  const receipt = document.getElementById('feedback-receipt');
  let report = null;
  let sending = false;
  const readForm = () => normalizeFeedback({
    type: form.elements.type.value, title: form.elements.title.value,
    description: form.elements.description.value, steps: form.elements.steps.value,
    expected: form.elements.expected.value, includeDiagnostics: form.elements.includeDiagnostics.checked,
  });
  const populate = (draft) => {
    for (const key of ['type', 'title', 'description', 'steps', 'expected']) form.elements[key].value = draft[key];
    form.elements.includeDiagnostics.checked = draft.includeDiagnostics;
  };
  const syncSend = () => {
    send.disabled = !report || sending || navigator.onLine === false;
    send.textContent = sending ? '正在送出…' : '送出回報';
    document.getElementById('feedback-offline').hidden = navigator.onLine !== false;
  };
  const showReceipt = (id) => {
    receipt.hidden = !id;
    receipt.textContent = id ? `已收到回報，謝謝你！收件編號：${id}。開發者會查看並安排處理。` : '';
  };
  populate(loadFeedbackDraft());
  showReceipt(getFeedbackReceipt()?.id);
  syncSend();
  document.querySelectorAll('[data-feedback-open]').forEach((button) => {
    button.addEventListener('click', () => {
      diagnosticPreview.textContent = JSON.stringify(collectFeedbackDiagnostics(), null, 2);
      navigate('feedback');
      document.getElementById('feedback-heading').focus();
    });
  });
  document.querySelector('#view-feedback [data-goto]')?.addEventListener('click', () => navigate('more'));
  form.addEventListener('input', () => {
    report = null;
    preview.hidden = true;
    status.textContent = '';
    syncSend();
    draftStatus.textContent = saveFeedbackDraft(readForm())
      ? '草稿已儲存在這個瀏覽器，尚未送出。'
      : '此瀏覽器無法儲存草稿，離開前請先預覽並下載回報。';
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (sending) return;
    const draft = readForm();
    const error = validateFeedback(draft);
    if (error) { status.textContent = error; return; }
    report = report || loadPendingFeedback(draft) || buildFeedbackReport(draft, collectFeedbackDiagnostics());
    const saved = savePendingFeedback(draft, report);
    document.getElementById('feedback-report-title').textContent = report.title;
    body.value = report.body;
    preview.hidden = false;
    status.textContent = '回報已整理，尚未送出。確認內容後即可直接送出。';
    if (!saved) draftStatus.textContent = '無法保存重試資訊，請勿重新整理；可先下載回報備份。';
    syncSend();
    preview.scrollIntoView({ behavior: 'auto', block: 'start' });
    body.focus();
    body.setSelectionRange(0, 0);
  });
  for (const event of ['online', 'offline']) window.addEventListener(event, syncSend);
  send.addEventListener('click', async () => {
    if (!report || sending || navigator.onLine === false) return;
    sending = true;
    for (const control of form.elements) control.disabled = true;
    syncSend();
    status.textContent = '正在送出，請稍候…';
    try {
      const result = await sendFeedback(report);
      const cleared = finishFeedback(result.id);
      showReceipt(result.id);
      report = null;
      preview.hidden = true;
      populate(normalizeFeedback());
      draftStatus.textContent = cleared ? '回報已送出，草稿已清除。' : '回報已送出，但瀏覽器無法清除舊草稿；請勿重複送出。';
      status.textContent = '送出成功。';
      receipt.scrollIntoView({ block: 'center' });
    } catch (error) {
      status.textContent = error.message;
    } finally {
      sending = false;
      for (const control of form.elements) control.disabled = false;
      syncSend();
    }
  });
  document.getElementById('feedback-copy').addEventListener('click', async () => {
    if (!report) return;
    try { await navigator.clipboard.writeText(report.body); status.textContent = '已複製回報內容。'; }
    catch { body.focus(); body.select(); status.textContent = '無法自動複製，已選取內容，請使用裝置的複製功能。'; }
  });
  document.getElementById('feedback-download').addEventListener('click', () => {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([`# ${report.title}\n\n${report.body}\n`], { type: 'text/markdown;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `questnote-feedback-${report.id}.md`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = '已下載回報檔案，尚未送出。';
  });
  document.getElementById('feedback-clear').addEventListener('click', () => {
    if (sending || !window.confirm('要清除這份回報草稿嗎？已送出的回報不會被刪除。')) return;
    const cleared = clearFeedbackDraft();
    populate(normalizeFeedback());
    report = null;
    preview.hidden = true;
    syncSend();
    draftStatus.textContent = cleared ? '草稿已清除。' : '無法清除瀏覽器內的草稿，重新整理後舊內容可能仍會出現。';
    status.textContent = '';
  });
}
