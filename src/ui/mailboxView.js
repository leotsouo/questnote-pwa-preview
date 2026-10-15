/**
 * Global mailbox (V3.0.0): entry badge, modal, message detail, reward claims and the
 * author-only local test messages. Remote title/body text is always set via textContent.
 * Read/claimed state is persisted by mailboxService; message bodies are not.
 */
import { isAuthorLocalDevMode } from '../devService.js';
import {
  rememberDialogFocus,
  isTopDialog,
  focusDialog,
  restoreDialogFocus,
} from '../dialogFocus.js';
import {
  getGlobalMailboxState,
  buildMailboxViewModel,
  getMailboxBadgeSummary,
  shouldCheckMailboxOnForeground,
  refreshGlobalMailbox,
  fetchGlobalMailbox,
  getMailboxTypeLabel,
  getClaimStatusLabel,
  formatMailboxRewardPreview,
  getLocalDevMailboxMessages,
  markMailboxMessageRead,
  claimMailboxReward,
  injectLocalDevAnnouncement,
  injectLocalDevCompensation,
  clearLocalDevMailboxMessages,
} from '../mailboxService.js';
import { refreshOnboarding, recordOnboardingEvent } from '../onboardingController.js';
import { APP_VERSION } from '../version.js';

// Bound from src/ui.js by connectMailboxView() so this module never imports ui.js back.
let claimAllButtonHtml, renderSharedUI, showToast, state, switchView;

export function connectMailboxView(deps) {
  ({ claimAllButtonHtml, renderSharedUI, showToast, state, switchView } = deps);
}

/** 全域信箱 UI 狀態（正文不持久化；狀態存 meta） */
let mailboxPayload = { schemaVersion: 1, generatedAt: null, messages: [], warnings: [] };
let mailboxStateLocal = null;
let mailboxFromCache = false;
let mailboxFetchFailed = false;
let mailboxFilter = null; // null = 依 defaultFilter
let mailboxSelectedId = null;
let mailboxRefreshing = false;
let mailboxKeydownHandler = null;
let mailboxLastFocus = null;
/* ═══════════════════════════════════════
   V3.0.0 全域信箱 UI
   遠端 title/body 一律 textContent，禁止 innerHTML 直接渲染遠端文字
   補償：once per local profile（每份本機資料領取一次）
   ═══════════════════════════════════════ */

function getMailboxCatalogs() {
  return {
    materialsCatalog: state?.materialsCatalog || [],
    craftablesCatalog: state?.craftablesCatalog || [],
  };
}

/** Latest fetched mailbox payload, for bulk claims outside the mailbox modal. */
export function getMailboxPayload() {
  return mailboxPayload;
}

/** Re-read the stored read/claimed state after a claim made outside the mailbox modal. */
export async function reloadMailboxState() {
  mailboxStateLocal = await getGlobalMailboxState();
}

function getMailboxViewModel(filterOverride) {
  const filter = filterOverride ?? mailboxFilter ?? 'all';
  return buildMailboxViewModel(mailboxPayload, mailboxStateLocal || { readIds: [], claimedIds: [] }, {
    filter,
    appVersion: APP_VERSION,
  });
}

export function getMailboxGiftStatus(messageId) {
  if (mailboxStateLocal?.claimedIds?.includes(messageId)) return 'claimed';
  const gift = getMailboxViewModel('all').allVisible.find((message) => message.id === messageId);
  if (gift) return gift.status?.claimable ? 'claimable' : 'unavailable';
  return mailboxFetchFailed || mailboxPayload?.messages?.length ? 'unavailable' : 'unknown';
}

export function updateMailboxEntryBadge() {
  const btn = document.getElementById('btn-global-mailbox');
  const badge = document.getElementById('mailbox-entry-badge');
  const gift = document.getElementById('mailbox-entry-gift');
  if (!btn || !badge || !gift) return;

  const vm = buildMailboxViewModel(mailboxPayload, mailboxStateLocal || { readIds: [], claimedIds: [] }, {
    filter: 'all',
    appVersion: APP_VERSION,
  });
  const summary = getMailboxBadgeSummary(vm);

  btn.setAttribute('aria-label', summary.ariaLabel);

  // 禮物圖示：僅在有可領取補償時顯示；否則必須隱藏，避免誤以為還有未讀
  if (summary.showClaimHint) {
    gift.hidden = false;
    gift.removeAttribute('hidden');
    gift.classList.add('mailbox-entry-btn__gift--pulse');
    badge.hidden = true;
    badge.setAttribute('hidden', '');
    badge.textContent = '';
  } else if (summary.showUnreadBadge) {
    gift.hidden = true;
    gift.setAttribute('hidden', '');
    gift.classList.remove('mailbox-entry-btn__gift--pulse');
    badge.hidden = false;
    badge.removeAttribute('hidden');
    badge.textContent = summary.unreadDisplay;
  } else {
    gift.hidden = true;
    gift.setAttribute('hidden', '');
    gift.classList.remove('mailbox-entry-btn__gift--pulse');
    badge.hidden = true;
    badge.setAttribute('hidden', '');
    badge.textContent = '';
  }
}

/**
 * 非阻塞同步信箱（啟動／前景／手動刷新）
 * 失敗不得阻斷 App
 */
export async function syncGlobalMailbox(options = {}) {
  const { force = false, silent = true } = options;
  try {
    if (!force && !shouldCheckMailboxOnForeground() && mailboxPayload?.messages?.length >= 0 && mailboxStateLocal) {
      // 仍允許僅用記憶體更新 badge
      updateMailboxEntryBadge();
      return { ok: true, throttled: true };
    }

    const catalogs = getMailboxCatalogs();
    const result = force
      ? await refreshGlobalMailbox(catalogs)
      : await fetchGlobalMailbox({ ...catalogs, force: false });

    mailboxPayload = result.payload || mailboxPayload;
    mailboxFromCache = !!result.fromCache;
    mailboxFetchFailed = result.ok === false;
    mailboxStateLocal = await getGlobalMailboxState();
    updateMailboxEntryBadge();
    refreshOnboarding();

    if (document.getElementById('global-mailbox-modal')?.classList.contains('open')) {
      renderGlobalMailboxModal();
    }
    return result;
  } catch (err) {
    console.warn('[QuestNote] 信箱同步失敗（不影響其他功能）:', err);
    if (!silent) showToast('目前無法取得信件，請稍後再試', 'info');
    updateMailboxEntryBadge();
    return { ok: false, error: err?.message };
  }
}

export function bindGlobalMailboxEntry() {
  document.getElementById('btn-global-mailbox')?.addEventListener('click', () => {
    openGlobalMailbox();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void syncGlobalMailbox({ force: false, silent: true });
    }
  });
}

function ensureGlobalMailboxModal() {
  let modal = document.getElementById('global-mailbox-modal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'global-mailbox-modal';
  modal.className = 'global-mailbox-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', '信箱');

  const backdrop = document.createElement('div');
  backdrop.className = 'global-mailbox-modal__backdrop';
  backdrop.dataset.action = 'mailbox-close';

  const sheet = document.createElement('div');
  sheet.className = 'global-mailbox-modal__sheet';

  const header = document.createElement('div');
  header.className = 'global-mailbox-modal__header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'global-mailbox-modal__title-wrap';
  const title = document.createElement('h2');
  title.className = 'global-mailbox-modal__title';
  title.id = 'mailbox-modal-title';
  title.textContent = '信箱';
  const unread = document.createElement('span');
  unread.className = 'global-mailbox-modal__unread';
  unread.id = 'mailbox-modal-unread';
  titleWrap.append(title, unread);

  const actions = document.createElement('div');
  actions.className = 'global-mailbox-modal__actions';
  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'global-mailbox-modal__icon-btn';
  refreshBtn.id = 'mailbox-refresh-btn';
  refreshBtn.dataset.action = 'mailbox-refresh';
  refreshBtn.setAttribute('aria-label', '刷新信箱');
  refreshBtn.textContent = '↻';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'global-mailbox-modal__icon-btn';
  closeBtn.dataset.action = 'mailbox-close';
  closeBtn.setAttribute('aria-label', '關閉信箱');
  closeBtn.textContent = '✕';
  actions.append(refreshBtn, closeBtn);
  header.append(titleWrap, actions);

  const offline = document.createElement('p');
  offline.className = 'global-mailbox-modal__offline';
  offline.id = 'mailbox-offline-hint';
  offline.hidden = true;
  offline.textContent = '目前為離線內容';

  const filters = document.createElement('div');
  filters.className = 'global-mailbox-modal__filters';
  filters.id = 'mailbox-filters';
  filters.setAttribute('role', 'tablist');
  filters.setAttribute('aria-label', '信件篩選');

  const body = document.createElement('div');
  body.className = 'global-mailbox-modal__body';
  body.id = 'mailbox-modal-body';

  sheet.append(header, offline, filters, body);
  modal.append(backdrop, sheet);
  document.body.appendChild(modal);

  modal.addEventListener('click', handleMailboxModalClick);
  return modal;
}

function handleMailboxModalClick(e) {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const action = t.dataset.action;

  if (action === 'mailbox-close') {
    closeGlobalMailbox();
    return;
  }
  if (action === 'mailbox-refresh') {
    void handleMailboxRefresh();
    return;
  }
  if (action === 'mailbox-filter') {
    mailboxFilter = t.dataset.filter || 'all';
    mailboxSelectedId = null;
    renderGlobalMailboxModal();
    return;
  }
  if (action === 'mailbox-open-message') {
    const id = t.dataset.messageId;
    if (!id) return;
    void openMailboxMessageDetail(id);
    return;
  }
  if (action === 'mailbox-back-list') {
    mailboxSelectedId = null;
    renderGlobalMailboxModal();
    return;
  }
  if (action === 'mailbox-claim') {
    const id = t.dataset.messageId;
    if (!id) return;
    void handleMailboxClaim(id, t);
    return;
  }
  if (action === 'mailbox-action-view') {
    const view = t.dataset.view;
    if (!view) return;
    closeGlobalMailbox();
    switchView(view);
  }
}

async function handleMailboxRefresh() {
  if (mailboxRefreshing) return;
  mailboxRefreshing = true;
  const btn = document.getElementById('mailbox-refresh-btn');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('is-loading');
  }
  try {
    const result = await syncGlobalMailbox({ force: true, silent: false });
    if (!result.ok && !mailboxPayload?.messages?.length) {
      showToast('目前無法取得信件，請稍後再試', 'info');
    } else if (result.fromCache) {
      showToast('目前為離線內容', 'info', 2200);
    }
  } finally {
    mailboxRefreshing = false;
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
    renderGlobalMailboxModal();
  }
}

export async function openGlobalMailbox({ focusClaimableId = null } = {}) {
  mailboxLastFocus = document.activeElement;
  ensureGlobalMailboxModal();
  mailboxSelectedId = null;

  if (!mailboxStateLocal) {
    try {
      mailboxStateLocal = await getGlobalMailboxState();
    } catch {
      mailboxStateLocal = { readIds: [], claimedIds: [] };
    }
  }

  const vm = getMailboxViewModel('all');
  if (mailboxFilter == null) {
    mailboxFilter = vm.defaultFilter;
  }
  const focusedGift = vm.allVisible.find((message) => message.id === focusClaimableId && message.status?.claimable);
  if (focusedGift) {
    mailboxFilter = 'claimable';
    mailboxSelectedId = focusedGift.id;
  }

  const modal = document.getElementById('global-mailbox-modal');
  rememberDialogFocus(modal);
  modal?.classList.add('open');
  document.body.classList.add('global-mailbox-open', 'modal-open');
  renderGlobalMailboxModal();

  mailboxKeydownHandler = (e) => {
    if (e.key === 'Escape' && isTopDialog(modal)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (mailboxSelectedId) {
        mailboxSelectedId = null;
        renderGlobalMailboxModal();
        focusDialog(modal);
      } else {
        closeGlobalMailbox();
      }
    }
  };
  document.addEventListener('keydown', mailboxKeydownHandler);

  // 開啟時輕量同步（不阻塞 UI）
  void syncGlobalMailbox({ force: false, silent: true });

  requestAnimationFrame(() => {
    (focusedGift
      ? document.querySelector('.mailbox-detail__claim-btn')
      : document.getElementById('mailbox-refresh-btn'))?.focus();
  });
}

export function closeGlobalMailbox() {
  const modal = document.getElementById('global-mailbox-modal');
  modal?.classList.remove('open');
  document.body.classList.remove('global-mailbox-open');
  if (!document.getElementById('modal-overlay')?.classList.contains('open')) {
    document.body.classList.remove('modal-open');
  }
  if (mailboxKeydownHandler) {
    document.removeEventListener('keydown', mailboxKeydownHandler);
    mailboxKeydownHandler = null;
  }
  mailboxSelectedId = null;
  if (mailboxLastFocus && typeof mailboxLastFocus.focus === 'function') {
    try { mailboxLastFocus.focus(); } catch { /* ignore */ }
  }
  mailboxLastFocus = null;
  restoreDialogFocus(modal);
  updateMailboxEntryBadge();
}

function formatMailboxDate(iso) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('zh-Hant-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return String(iso).slice(0, 16);
  }
}

export function renderGlobalMailboxModal() {
  const modal = document.getElementById('global-mailbox-modal');
  if (!modal?.classList.contains('open')) return;

  const vmAll = buildMailboxViewModel(mailboxPayload, mailboxStateLocal || { readIds: [], claimedIds: [] }, {
    filter: 'all',
    appVersion: APP_VERSION,
  });
  const activeFilter = mailboxFilter || vmAll.defaultFilter || 'all';
  mailboxFilter = activeFilter;
  const vm = buildMailboxViewModel(mailboxPayload, mailboxStateLocal || { readIds: [], claimedIds: [] }, {
    filter: activeFilter,
    appVersion: APP_VERSION,
  });

  const unreadEl = document.getElementById('mailbox-modal-unread');
  if (unreadEl) {
    unreadEl.textContent = vmAll.unreadCount > 0 ? `未讀 ${vmAll.unreadCount}` : '未讀 0';
  }

  const offline = document.getElementById('mailbox-offline-hint');
  if (offline) offline.hidden = !mailboxFromCache;

  const filtersEl = document.getElementById('mailbox-filters');
  let claimActions = document.getElementById('mailbox-claim-actions');
  if (!claimActions && filtersEl) {
    claimActions = document.createElement('div');
    claimActions.id = 'mailbox-claim-actions';
    claimActions.className = 'mailbox-claim-actions';
    filtersEl.after(claimActions);
  }
  if (claimActions) {
    claimActions.hidden = vmAll.claimableCount === 0;
    claimActions.innerHTML = vmAll.claimableCount > 0
      ? `<span class="mailbox-claim-actions__hint">收下所有可領附件，信件仍保留</span>${claimAllButtonHtml('mailbox', vmAll.claimableCount)}` : '';
  }

  const filters = document.getElementById('mailbox-filters');
  if (filters) {
    filters.replaceChildren();
    const chips = [
      { id: 'all', label: '全部' },
      { id: 'unread', label: '未讀' },
      { id: 'claimable', label: '可領取' },
    ];
    for (const chip of chips) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mailbox-filter-chip' + (activeFilter === chip.id ? ' is-active' : '');
      btn.dataset.action = 'mailbox-filter';
      btn.dataset.filter = chip.id;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', activeFilter === chip.id ? 'true' : 'false');
      btn.textContent = chip.label;
      filters.appendChild(btn);
    }
  }

  const body = document.getElementById('mailbox-modal-body');
  if (!body) return;
  body.replaceChildren();

  if (mailboxSelectedId) {
    const msg = findMailboxMessageById(mailboxSelectedId);
    if (msg) {
      body.appendChild(buildMailboxDetailElement(msg));
      return;
    }
    mailboxSelectedId = null;
  }

  if (!vm.messages.length) {
    const empty = document.createElement('div');
    empty.className = 'mailbox-empty';
    const icon = document.createElement('div');
    icon.className = 'mailbox-empty__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = mailboxFetchFailed && !(mailboxPayload?.messages?.length) ? '📭' : '📭';
    const title = document.createElement('p');
    title.className = 'mailbox-empty__title';
    const desc = document.createElement('p');
    desc.className = 'mailbox-empty__desc';

    if (mailboxFetchFailed && !(mailboxPayload?.messages?.length)) {
      title.textContent = '目前無法取得信件，請稍後再試';
      desc.textContent = '連線恢復後可手動刷新';
    } else if (activeFilter !== 'all') {
      title.textContent = '這個分類目前沒有信件';
      desc.textContent = '試試切換其他篩選';
    } else {
      title.textContent = '目前沒有新信件';
      desc.textContent = '更新公告與補償會出現在這裡';
    }
    empty.append(icon, title, desc);
    body.appendChild(empty);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'mailbox-list';
  for (const msg of vm.messages) {
    list.appendChild(buildMailboxListItem(msg));
  }
  body.appendChild(list);
}

function buildMailboxListItem(msg) {
  const li = document.createElement('li');
  li.className = 'mailbox-list-item'
    + (msg.status?.unread ? ' is-unread' : '')
    + (msg.status?.claimable ? ' is-claimable' : '');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'mailbox-list-item__btn';
  btn.dataset.action = 'mailbox-open-message';
  btn.dataset.messageId = msg.id;

  const icon = document.createElement('span');
  icon.className = 'mailbox-list-item__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = msg.icon || '📮';

  const main = document.createElement('span');
  main.className = 'mailbox-list-item__main';

  const title = document.createElement('span');
  title.className = 'mailbox-list-item__title';
  title.textContent = msg.title;

  const meta = document.createElement('span');
  meta.className = 'mailbox-list-item__meta';

  const typeChip = document.createElement('span');
  typeChip.className = `mailbox-type-chip mailbox-type-chip--${msg.type}`;
  typeChip.textContent = getMailboxTypeLabel(msg.type);

  const date = document.createElement('span');
  date.className = 'mailbox-list-item__date';
  date.textContent = formatMailboxDate(msg.publishedAt);

  meta.append(typeChip, date);

  if (msg.source === 'local-dev' && isAuthorLocalDevMode()) {
    const testChip = document.createElement('span');
    testChip.className = 'mailbox-type-chip mailbox-type-chip--local-dev';
    testChip.textContent = '本機測試';
    meta.appendChild(testChip);
  }

  if (msg.status?.claimStatus) {
    const claimChip = document.createElement('span');
    claimChip.className = `mailbox-claim-chip mailbox-claim-chip--${msg.status.claimStatus}`;
    claimChip.textContent = getClaimStatusLabel(msg.status.claimStatus);
    meta.appendChild(claimChip);
  }

  main.append(title, meta);

  const marks = document.createElement('span');
  marks.className = 'mailbox-list-item__marks';
  if (msg.status?.unread) {
    const dot = document.createElement('span');
    dot.className = 'mailbox-list-item__unread-dot';
    dot.setAttribute('aria-label', '未讀');
    marks.appendChild(dot);
  }
  if (msg.status?.claimable) {
    const gift = document.createElement('span');
    gift.className = 'mailbox-list-item__gift';
    gift.setAttribute('aria-hidden', 'true');
    gift.textContent = '🎁';
    marks.appendChild(gift);
  }

  btn.append(icon, main, marks);
  li.appendChild(btn);
  return li;
}

function buildMailboxDetailElement(msg) {
  // 重新解析狀態（單封，避免把其他 local-dev 併進來干擾）
  const vm = buildMailboxViewModel(
    { messages: [msg] },
    mailboxStateLocal || { readIds: [], claimedIds: [] },
    { filter: 'all', appVersion: APP_VERSION, includeLocalDev: false },
  );
  const status = vm.allVisible[0]?.status || msg.status || {};

  const wrap = document.createElement('div');
  wrap.className = 'mailbox-detail';

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'mailbox-detail__back';
  back.dataset.action = 'mailbox-back-list';
  back.textContent = '← 返回列表';

  const head = document.createElement('div');
  head.className = 'mailbox-detail__head';
  const icon = document.createElement('span');
  icon.className = 'mailbox-detail__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = msg.icon || '📮';
  const title = document.createElement('h3');
  title.className = 'mailbox-detail__title';
  title.textContent = msg.title;
  head.append(icon, title);

  const meta = document.createElement('div');
  meta.className = 'mailbox-detail__meta';
  const typeChip = document.createElement('span');
  typeChip.className = `mailbox-type-chip mailbox-type-chip--${msg.type}`;
  typeChip.textContent = getMailboxTypeLabel(msg.type);
  const date = document.createElement('span');
  date.className = 'mailbox-detail__date';
  date.textContent = formatMailboxDate(msg.publishedAt);
  meta.append(typeChip, date);

  if (msg.source === 'local-dev' && isAuthorLocalDevMode()) {
    const testChip = document.createElement('span');
    testChip.className = 'mailbox-type-chip mailbox-type-chip--local-dev';
    testChip.textContent = '本機測試';
    meta.appendChild(testChip);
  }

  if (status.claimStatus) {
    const claimChip = document.createElement('span');
    claimChip.className = `mailbox-claim-chip mailbox-claim-chip--${status.claimStatus}`;
    claimChip.textContent = getClaimStatusLabel(status.claimStatus);
    meta.appendChild(claimChip);
  }

  const body = document.createElement('p');
  body.className = 'mailbox-detail__body';
  body.textContent = msg.body || '';

  wrap.append(back, head, meta, body);

  if (msg.type === 'compensation') {
    const rewardBox = document.createElement('div');
    rewardBox.className = 'mailbox-reward-preview';
    const rewardTitle = document.createElement('p');
    rewardTitle.className = 'mailbox-reward-preview__title';
    rewardTitle.textContent = '獎勵預覽';
    rewardBox.appendChild(rewardTitle);

    if (status.claimStatus === 'invalid' || msg.rewardError) {
      const err = document.createElement('p');
      err.className = 'mailbox-reward-preview__error';
      err.textContent = '此補償資料格式有誤';
      rewardBox.appendChild(err);
    } else {
      const lines = formatMailboxRewardPreview(msg.reward);
      if (!lines.length) {
        const empty = document.createElement('p');
        empty.className = 'mailbox-reward-preview__empty';
        empty.textContent = '此補償沒有可領取的獎勵內容';
        rewardBox.appendChild(empty);
      } else {
        const ul = document.createElement('ul');
        ul.className = 'mailbox-reward-preview__list';
        for (const line of lines) {
          const li = document.createElement('li');
          li.textContent = line.text;
          ul.appendChild(li);
        }
        rewardBox.appendChild(ul);
      }
    }
    wrap.appendChild(rewardBox);

    if (status.claimable) {
      const claimBtn = document.createElement('button');
      claimBtn.type = 'button';
      claimBtn.className = 'btn btn--primary mailbox-detail__claim-btn';
      claimBtn.dataset.action = 'mailbox-claim';
      claimBtn.dataset.messageId = msg.id;
      claimBtn.textContent = '領取補償';
      wrap.appendChild(claimBtn);
      const note = document.createElement('p');
      note.className = 'mailbox-detail__claim-note';
      note.textContent = '每份本機資料領取一次';
      wrap.appendChild(note);
    }
  }

  if (msg.action?.type === 'view' && msg.action.view) {
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'btn btn--secondary mailbox-detail__action-btn';
    actionBtn.dataset.action = 'mailbox-action-view';
    actionBtn.dataset.view = msg.action.view;
    actionBtn.textContent = msg.action.label || '前往查看';
    wrap.appendChild(actionBtn);
  }

  return wrap;
}

function findMailboxMessageById(messageId) {
  if (!messageId) return null;
  const vm = buildMailboxViewModel(mailboxPayload, mailboxStateLocal || { readIds: [], claimedIds: [] }, {
    filter: 'all',
    appVersion: APP_VERSION,
  });
  return vm.allVisible.find((m) => m.id === messageId)
    || (mailboxPayload.messages || []).find((m) => m.id === messageId)
    || getLocalDevMailboxMessages(getMailboxCatalogs()).find((m) => m.id === messageId)
    || null;
}

async function openMailboxMessageDetail(messageId) {
  mailboxSelectedId = messageId;
  try {
    mailboxStateLocal = await markMailboxMessageRead(messageId);
  } catch (err) {
    console.warn('[QuestNote] 標記已讀失敗:', err);
  }
  renderGlobalMailboxModal();
  updateMailboxEntryBadge();
}

async function handleMailboxClaim(messageId, btnEl) {
  if (!messageId) return;
  if (btnEl) btnEl.disabled = true;

  const msg = findMailboxMessageById(messageId);
  if (!msg) {
    showToast('信件不存在', 'warning');
    if (btnEl) btnEl.disabled = false;
    return;
  }

  const result = await claimMailboxReward(msg, {
    ...getMailboxCatalogs(),
    appVersion: APP_VERSION,
  });

  if (!result.success) {
    showToast(result.error || '領取失敗', 'warning');
    if (btnEl) btnEl.disabled = false;
    // 重新讀狀態
    try { mailboxStateLocal = await getGlobalMailboxState(); } catch { /* ignore */ }
    renderGlobalMailboxModal();
    updateMailboxEntryBadge();
    return;
  }

  mailboxStateLocal = result.state;
  if (result.wallet && state) state.wallet = result.wallet;
  if (result.inventory && state) state.inventory = result.inventory;
  if (result.encounterEconomy && state) state.encounterEconomy = result.encounterEconomy;

  showToast('補償已領取', 'reward', 2800);
  renderSharedUI();
  renderGlobalMailboxModal();
  updateMailboxEntryBadge();
  void recordOnboardingEvent('mailbox-claimed', { messageId });
}

function refreshMailboxAfterDevInject() {
  updateMailboxEntryBadge();
  if (document.getElementById('global-mailbox-modal')?.classList.contains('open')) {
    renderGlobalMailboxModal();
  }
  renderSharedUI();
}

export function handleDevMailboxAnnouncement() {
  if (!isAuthorLocalDevMode()) return;
  const result = injectLocalDevAnnouncement();
  if (!result.success) {
    showToast(result.error || '注入失敗', 'warning');
    return;
  }
  refreshMailboxAfterDevInject();
  showToast('已注入本機測試公告', 'success');
}

export function handleDevMailboxCompensation() {
  if (!isAuthorLocalDevMode()) return;
  const result = injectLocalDevCompensation();
  if (!result.success) {
    showToast(result.error || '注入失敗', 'warning');
    return;
  }
  refreshMailboxAfterDevInject();
  showToast('已注入本機測試補償（星塵 ×1）', 'success');
}

export function handleDevMailboxClear() {
  if (!isAuthorLocalDevMode()) return;
  const result = clearLocalDevMailboxMessages();
  if (!result.success) {
    showToast(result.error || '清除失敗', 'warning');
    return;
  }
  if (mailboxSelectedId?.startsWith('dev-local-')) {
    mailboxSelectedId = null;
  }
  refreshMailboxAfterDevInject();
  showToast(`已清除 ${result.cleared} 封測試信件（已領狀態保留）`, 'info');
}
