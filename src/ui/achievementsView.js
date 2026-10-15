/**
 * Achievements view: summary, filters, cards, title management and unlock notifications.
 * Claims and title changes are persisted by achievementService.
 */
import {
  getAchievementSummary,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  formatAchievementReward,
  equipTitle,
} from '../achievementService.js';
import { errorStateHtml, escapeHtml, emptyStateHtml } from '../uiHelpers.js';
import { trackUpdateActivity } from '../updateActivity.js';

// Bound from src/ui.js by connectAchievementsView() so this module never imports ui.js back.
let claimAllButtonHtml, closeModal, getCurrentViewName, isModalOpen, onAchievementCheck, onRefresh, openModal, renderNavBadges, showToast, state;

export function connectAchievementsView(deps) {
  ({ claimAllButtonHtml, closeModal, getCurrentViewName, isModalOpen, onAchievementCheck, onRefresh, openModal, renderNavBadges, showToast, state } = deps);
}

let achievementFilter = 'all';

export async function refreshAchievementsView() {
  if (!state) return;
  if (onAchievementCheck) {
    await onAchievementCheck();
  }
  state.achievementSummary = await getAchievementSummary(state.allPets || []);
  renderAchievementsView();
  renderNavBadges();
}

export function setAchievementFilter(filter) {
  achievementFilter = filter;
}

export function renderAchievementsView() {
  const summary = state.achievementSummary;
  const summaryEl = document.getElementById('achievement-summary');
  const titleBarEl = document.getElementById('achievement-title-bar');
  const listEl = document.getElementById('achievement-list');

  document.querySelectorAll('#achievement-filters .filter-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.achFilter === achievementFilter);
  });

  if (!summary?.catalogLoaded) {
    if (summaryEl) {
      summaryEl.innerHTML = errorStateHtml(
        '成就資料無法載入',
        '請確認網路連線後重新整理，或稍後再試。',
        '重新整理',
        'achievement-retry'
      );
      document.getElementById('achievement-retry')?.addEventListener('click', () => location.reload());
    }
    if (titleBarEl) titleBarEl.innerHTML = '';
    if (listEl) listEl.innerHTML = '';
    return;
  }

  if (summaryEl) {
    const claimAllBtn = summary.claimable > 0
      ? `<div class="achievement-summary__actions">
          ${claimAllButtonHtml('achievements', summary.claimable)}
        </div>`
      : '';

    summaryEl.innerHTML = `
      <div class="achievement-summary__stats">
        <div class="achievement-summary__stat">
          <span class="achievement-summary__label">已解鎖</span>
          <span class="achievement-summary__value">${summary.unlocked} / ${summary.total}</span>
        </div>
        <div class="achievement-summary__stat">
          <span class="achievement-summary__label">完成率</span>
          <span class="achievement-summary__value">${summary.completionRate}%</span>
        </div>
        <div class="achievement-summary__stat">
          <span class="achievement-summary__label">可領取</span>
          <span class="achievement-summary__value achievement-summary__value--claimable">${summary.claimable}</span>
        </div>
      </div>
      <div class="achievement-summary__progress">
        <div class="progress-bar">
          <div class="progress-bar__fill progress-bar__fill--achievement" style="width:${summary.completionRate}%"></div>
        </div>
      </div>
      ${claimAllBtn}`;
  }

  const currentTitle = summary.equippedTitle?.name || '尚未設定稱號';
  const titleValueClass = summary.equippedTitle
    ? 'achievement-title-bar__value'
    : 'achievement-title-bar__value achievement-title-bar__value--empty';
  if (titleBarEl) {
    titleBarEl.innerHTML = `
      <div class="achievement-title-bar__row">
        <div>
          <p class="achievement-title-bar__label">目前稱號</p>
          <p class="${titleValueClass}">${escapeHtml(currentTitle)}</p>
        </div>
        <button class="btn btn--secondary btn--sm" data-action="open-titles" type="button">稱號管理</button>
      </div>`;
  }

  let items = summary.items || [];

  if (achievementFilter === 'done') {
    items = items.filter((i) => i.status === 'claimed');
  } else if (achievementFilter === 'pending') {
    items = items.filter((i) => i.status === 'locked');
  } else if (achievementFilter === 'claimable') {
    items = items.filter((i) => i.status === 'claimable');
  } else if (achievementFilter !== 'all') {
    items = items.filter((i) => i.achievement.category === achievementFilter);
  }

  if (listEl) {
    if (items.length === 0) {
      listEl.innerHTML = emptyStateHtml('🏅', '沒有符合的成就', '試試其他分類篩選。');
    } else {
      listEl.innerHTML = items.map(renderAchievementCard).join('');
    }
  }
}

function renderAchievementCard(item) {
  const { achievement, progress, target, percent, status } = item;
  const cat = achievement.category;
  const icon = CATEGORY_ICONS[cat] || '🏅';
  const catLabel = CATEGORY_LABELS[cat] || cat;
  const rewardText = formatAchievementReward(achievement.reward);
  const titleText = achievement.titleReward
    ? `稱號：${achievement.titleReward}`
    : '';

  let statusHtml = '';
  if (status === 'claimed') {
    statusHtml = '<span class="achievement-card__status achievement-card__status--done">已完成</span>';
  } else if (status === 'claimable') {
    statusHtml = `<button class="btn btn--primary btn--sm achievement-card__claim" data-action="claim-achievement" data-id="${achievement.id}" type="button">領取獎勵</button>`;
  } else {
    statusHtml = '<span class="achievement-card__status achievement-card__status--locked">未完成</span>';
  }

  return `
    <article class="achievement-card card achievement-card--${status}">
      <div class="achievement-card__header">
        <span class="achievement-card__icon">${icon}</span>
        <div class="achievement-card__titles">
          <h3 class="achievement-card__name">${escapeHtml(achievement.name)}</h3>
          <span class="achievement-card__category">${catLabel}</span>
        </div>
      </div>
      <p class="achievement-card__desc">${escapeHtml(achievement.description)}</p>
      <div class="achievement-card__progress">
        <div class="achievement-card__progress-label">
          <span>進度</span>
          <span>${Math.min(progress, target)} / ${target}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-bar__fill" style="width:${percent}%"></div>
        </div>
      </div>
      <div class="achievement-card__rewards">
        <p><span class="achievement-card__reward-label">獎勵</span> ${escapeHtml(rewardText)}</p>
        ${titleText ? `<p><span class="achievement-card__reward-label">稱號</span> ${escapeHtml(titleText)}</p>` : ''}
      </div>
      <div class="achievement-card__footer">${statusHtml}</div>
    </article>`;
}

export function openTitleManagementModal() {
  const summary = state.achievementSummary;
  if (!summary?.titlesLoaded) {
    showToast('稱號資料暫時無法載入', 'error');
    return;
  }

  const titles = summary.titles || [];
  const unlocked = new Set(summary.state?.unlockedTitleIds || []);
  const equipped = summary.state?.equippedTitleId;

  const listHtml = titles.map((t) => {
    const isUnlocked = unlocked.has(t.id);
    const isEquipped = equipped === t.id;
    return `
      <div class="title-item ${isUnlocked ? '' : 'title-item--locked'} ${isEquipped ? 'title-item--equipped' : ''}">
        <div class="title-item__info">
          <span class="title-item__name">${isUnlocked ? escapeHtml(t.name) : '？？？'}</span>
          ${isEquipped ? '<span class="title-item__badge">使用中</span>' : ''}
        </div>
        ${
          isUnlocked
            ? `<button class="btn btn--secondary btn--sm" data-title-id="${t.id}" type="button">${isEquipped ? '已裝備' : '裝備'}</button>`
            : '<span class="title-item__lock">🔒</span>'
        }
      </div>`;
  }).join('');

  openModal(`
    <div class="title-modal">
      <h2 class="modal-title">稱號管理</h2>
      <p class="title-modal__desc">稱號僅供展示，不影響遊戲數值。</p>
      <div class="title-list">${listHtml}</div>
      <button class="btn btn--ghost btn--block" id="btn-clear-title" type="button">清除稱號</button>
    </div>
  `);

  document.querySelectorAll('.title-item .btn').forEach((btn) => {
    btn.addEventListener('click', trackUpdateActivity(async () => {
      const titleId = btn.dataset.titleId;
      if (!titleId || btn.textContent === '已裝備') return;
      const result = await equipTitle(titleId);
      if (result.success) {
        await onRefresh({ renderMode: ['achievements', 'collection', 'tasks'] });
        closeModal();
        showToast(`已設定稱號：${result.title.name}`, 'success');
      } else {
        showToast(result.error || '設定失敗', 'error');
      }
    }));
  });

  document.getElementById('btn-clear-title')?.addEventListener('click', trackUpdateActivity(async () => {
    await equipTitle(null);
    await onRefresh({ renderMode: ['achievements', 'collection', 'tasks'] });
    closeModal();
    showToast('已清除稱號', 'info');
  }));
}

export async function handleAchievementCheckAfterAction() {
  if (!onAchievementCheck) return;
  const result = await onAchievementCheck();
  if (result.newlyUnlocked.length > 0) {
    showAchievementUnlockNotifications(result);
    if (isModalOpen()) {
      await onRefresh();
      return;
    }
    const viewName = getCurrentViewName();
    const modes = viewName === 'tasks' ? ['tasks'] : [viewName, 'tasks'];
    await onRefresh({ renderMode: modes });
  }
}

function showAchievementUnlockNotifications(result) {
  const reduceMotion = state?.userPreferences?.reduceMotion ?? false;
  const { newlyUnlocked, newTitles } = result;

  if (newlyUnlocked.length >= 2) {
    showToast(
      `解鎖 ${newlyUnlocked.length} 個新成就，前往成就頁領取獎勵。`,
      'success',
      3500
    );
    return;
  }

  const ach = newlyUnlocked[0];
  if (!ach) return;

  if (reduceMotion) {
    const title = newTitles[0];
    const msg = title
      ? `成就解鎖：${ach.name}（稱號：${title.name}）`
      : `成就解鎖：${ach.name}`;
    showToast(msg, 'success', 3500);
    return;
  }

  showToast(`成就解鎖：${ach.name}`, 'success', 3000);
  if (newTitles[0]) {
    setTimeout(() => {
      showToast(`你獲得了稱號：${newTitles[0].name}`, 'success', 3000);
    }, 800);
  }
}

/* ─── 設定頁 ─── */
