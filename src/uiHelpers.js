/**
 * QuestNote v1.6 — 共用 UI 模板與輔助函式
 */

/** HTML 跳脫 */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 空狀態 */
export function emptyStateHtml(icon, title, desc, btnLabel = null, btnAction = null) {
  return `
    <div class="empty-state">
      <span class="empty-state__icon" aria-hidden="true">${icon}</span>
      <p class="empty-state__title">${escapeHtml(title)}</p>
      <p class="empty-state__desc">${escapeHtml(desc)}</p>
      ${btnLabel ? `<button class="btn btn--primary btn--sm" type="button" data-action="${btnAction}">${escapeHtml(btnLabel)}</button>` : ''}
    </div>`;
}

/** 錯誤狀態 */
export function errorStateHtml(title, reason, actionLabel = null, actionId = null) {
  return `
    <div class="error-state" role="alert">
      <span class="error-state__icon" aria-hidden="true">⚠</span>
      <p class="error-state__title">${escapeHtml(title)}</p>
      <p class="error-state__desc">${escapeHtml(reason)}</p>
      ${actionLabel ? `<button class="btn btn--secondary btn--sm" type="button" id="${actionId || 'error-retry'}">${escapeHtml(actionLabel)}</button>` : ''}
    </div>`;
}

/** 載入狀態 */
export function loadingStateHtml(text = '載入中…') {
  return `
    <div class="loading-state" aria-busy="true">
      <div class="loading-state__spinner" aria-hidden="true"></div>
      <p class="loading-state__text">${escapeHtml(text)}</p>
    </div>`;
}

/** Skeleton 佔位列 */
export function skeletonLines(count = 3) {
  return `<div class="skeleton-group" aria-hidden="true">${Array.from({ length: count }, () => '<div class="skeleton-line"></div>').join('')}</div>`;
}

/** 頁面區塊標題 */
export function sectionHeaderHtml(title, desc = null) {
  return `
    <header class="page-section__header">
      <h2 class="section-title">${escapeHtml(title)}</h2>
      ${desc ? `<p class="section-desc">${escapeHtml(desc)}</p>` : ''}
    </header>`;
}

/** 通知紅點 */
export function notificationDotHtml(className = '') {
  return `<span class="notification-dot ${className}" aria-hidden="true"></span>`;
}
