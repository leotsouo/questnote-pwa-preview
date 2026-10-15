/**
 * Home daily blessing and quest panel: check-in, the reward wheel, streak previews,
 * the gacha-page blessing entry and daily/weekly quests. Rewards are persisted by
 * dailyCheckInService and questService.
 */
import {
  isYesterday,
  calculateCheckInRewards,
  hasCheckedInToday,
  hasSpunWheelToday,
  isWheelSpinning,
  performDailyCheckIn,
  loadWheelRewards,
  prepareDailyWheelSpin,
  releaseWheelSpinLock,
  finalizeDailyWheelSpin,
} from '../dailyCheckInService.js';
import { isDevMode, resetDevDailyBlessing } from '../devService.js';
import { MATERIAL_LABELS } from '../expeditionService.js';
import { updateQuestProgress } from '../questService.js';
import { getTodayDateString } from '../taskFilterService.js';
import { escapeHtml } from '../uiHelpers.js';
import { trackUpdateActivity } from '../updateActivity.js';
import { getMaterialName, getCraftableInfo } from '../workshopService.js';
import { handleAchievementCheckAfterAction } from './achievementsView.js';
import { buildWheelDiscHtml, animateDailyWheel } from './dailyWheelView.js';
import { isSweetTheme } from './gachaView.js';

// Bound from src/ui.js by connectDailyBlessingView() so this module never imports ui.js back.
let claimAllButtonHtml, closeModal, onRefresh, openModal, showToast, state, switchView;

export function connectDailyBlessingView(deps) {
  ({ claimAllButtonHtml, closeModal, onRefresh, openModal, showToast, state, switchView } = deps);
}

let questPanelTab = 'daily';
let questPanelCollapsed = true;
let dailyWheelRewards = null;
let dailyBlessingCollapsed = true;
let dailyBlessingCollapseDay = null;
export function expandDailyBlessing() {
  dailyBlessingCollapsed = false;
}

/** The manual choice holds for today; see resolveDailyBlessingCollapsed(). */
export function toggleDailyBlessing() {
  dailyBlessingCollapsed = !dailyBlessingCollapsed;
  dailyBlessingCollapseDay = getTodayDateString();
}

export function expandQuestPanel() {
  questPanelCollapsed = false;
}

export function toggleQuestPanel() {
  questPanelCollapsed = !questPanelCollapsed;
}

/** Switch the quest panel tab; returns whether it changed. */
export function selectQuestTab(scope) {
  if (!scope || scope === questPanelTab) return false;
  questPanelTab = scope;
  return true;
}

export function formatDailyRewardBundle(bundle) {
  if (!bundle) return '';
  const parts = [];
  if (bundle.stardust > 0) parts.push(`星塵 +${bundle.stardust}`);
  if (bundle.encounterFragments > 0) parts.push(`相遇碎片 +${bundle.encounterFragments}`);
  if (bundle.adventureEnergy > 0) parts.push(`冒險能量 +${bundle.adventureEnergy}`);
  if (bundle.materials) {
    for (const [id, amt] of Object.entries(bundle.materials)) {
      if (amt > 0) parts.push(`${getMaterialName(id) || MATERIAL_LABELS[id] || id} +${amt}`);
    }
  }
  if (bundle.items) {
    for (const [id, amt] of Object.entries(bundle.items)) {
      if (amt > 0) {
        const info = getCraftableInfo(id);
        parts.push(`${info?.name || id} +${amt}`);
      }
    }
  }
  return parts.join('、');
}

function getProjectedCheckInStreak(daily, today, checkedIn) {
  if (checkedIn) return daily?.streak ?? 0;
  if (daily?.lastCheckInDate && isYesterday(daily.lastCheckInDate, today)) {
    return (daily.streak ?? 0) + 1;
  }
  return 1;
}

function buildDailyRewardPreviewChips(projectedStreak) {
  const base = calculateCheckInRewards(1);
  const full = calculateCheckInRewards(projectedStreak);
  const chips = [];

  chips.push({ icon: '✨', text: `星塵 +${base.stardust}`, bonus: false });
  chips.push({ icon: '⚡', text: `冒險能量 +${base.adventureEnergy}`, bonus: false });

  const extraStardust = full.stardust - base.stardust;
  if (extraStardust > 0) {
    chips.push({ icon: '✨', text: `星塵 +${extraStardust}`, bonus: true });
  }
  const extraEnergy = full.adventureEnergy - base.adventureEnergy;
  if (extraEnergy > 0) {
    chips.push({ icon: '⚡', text: `冒險能量 +${extraEnergy}`, bonus: true });
  }
  if (full.materials) {
    for (const [id, amt] of Object.entries(full.materials)) {
      if (amt > 0) {
        chips.push({
          icon: '💎',
          text: `${getMaterialName(id) || MATERIAL_LABELS[id] || id} +${amt}`,
          bonus: true,
        });
      }
    }
  }
  if (full.items) {
    for (const [id, amt] of Object.entries(full.items)) {
      if (amt > 0) {
        const info = getCraftableInfo(id);
        chips.push({
          icon: '🎁',
          text: `${info?.name || id} +${amt}`,
          bonus: true,
        });
      }
    }
  }
  return chips;
}

function getSevenDayMilestoneProgress(projectedStreak) {
  const target = 7;
  const progress = Math.min(projectedStreak, target);
  const percent = Math.round((progress / target) * 100);
  let label;
  if (projectedStreak >= target) {
    label = projectedStreak === target
      ? '今日達成 7 天連續簽到獎勵！'
      : '已解鎖 7 天連續簽到獎勵';
  } else {
    const remaining = target - projectedStreak;
    label = `距離 7 天獎勵還差 ${remaining} 天`;
  }
  return { percent, label };
}

function showDailyBlessingRewardToast(text) {
  const toast = document.createElement('div');
  toast.className = 'reward-toast reward-toast--daily';
  toast.innerHTML = `<span class="reward-toast__icon">🌙</span><span>${escapeHtml(text)}</span>`;
  (document.getElementById('toast-container') || document.body).appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function resolveDailyBlessingCollapsed(allDone, today) {
  if (dailyBlessingCollapseDay !== today) {
    dailyBlessingCollapseDay = today;
    // 預設一律折疊，保持頁面整潔（使用者可自行展開）
    dailyBlessingCollapsed = true;
  }
  return dailyBlessingCollapsed;
}

export function buildDailyBlessingCardData() {
  const daily = state.dailyCheckIn;
  const today = getTodayDateString();
  const checkedIn = daily ? hasCheckedInToday(daily, today) : false;
  const spun = daily ? hasSpunWheelToday(daily, today) : false;
  const allDone = checkedIn && spun;
  const hasPending = !allDone;
  const collapsed = resolveDailyBlessingCollapsed(allDone, today);
  const streak = daily?.streak ?? 0;
  const bestStreak = daily?.bestStreak ?? 0;
  const projectedStreak = getProjectedCheckInStreak(daily, today, checkedIn);
  const rewardChips = buildDailyRewardPreviewChips(projectedStreak);
  const milestone = getSevenDayMilestoneProgress(projectedStreak);

  const checkInBtnLabel = checkedIn ? '今日已簽到' : '今日簽到';
  const wheelBtnLabel = spun ? '今日已轉盤' : '幸運轉盤';

  let statusBadgeText = '今日已完成';
  let statusBadgeClass = 'daily-status-badge done';
  if (!allDone) {
    statusBadgeClass = 'daily-status-badge';
    if (!checkedIn && !spun) statusBadgeText = '待領取';
    else if (!checkedIn) statusBadgeText = '簽到待領';
    else statusBadgeText = '轉盤待領';
  }

  let footerHint = '今天的祝福已全部領取，明天再來吧～';
  if (!allDone) {
    if (!checkedIn && !spun) footerHint = '完成簽到與轉盤，領取今日全部祝福';
    else if (!checkedIn) footerHint = '轉盤已轉，別忘了領取今日簽到獎勵';
    else footerHint = '簽到完成！記得轉動幸運轉盤喔';
  }

  let compactSummary = `連續 ${streak} 天`;
  if (allDone) {
    compactSummary += ' · 今日已完成';
  } else {
    const pendingParts = [];
    if (!checkedIn) pendingParts.push('簽到');
    if (!spun) pendingParts.push('轉盤');
    compactSummary += ` · 待領取：${pendingParts.join('、')}`;
  }

  const rewardChipsHtml = rewardChips.map((chip) => `
    <span class="daily-reward-chip${chip.bonus ? ' daily-reward-chip--bonus' : ''}">
      <span class="daily-reward-chip__icon" aria-hidden="true">${chip.icon}</span>
      <span class="daily-reward-chip__text">${escapeHtml(chip.text)}</span>
    </span>`).join('');

  const html = `
    <div class="daily-blessing-card${collapsed ? ' daily-blessing-card--collapsed' : ''}${hasPending ? ' daily-blessing-card--pending' : ''}">
      <header class="daily-blessing-card__header">
        <button type="button" class="daily-blessing-card__toggle" data-action="toggle-daily-blessing" aria-expanded="${!collapsed}">
          <span class="daily-blessing-card__icon daily-blessing-card__icon--default" aria-hidden="true">✦</span>
          <span class="daily-blessing-card__icon daily-blessing-card__icon--sweet" aria-hidden="true">🌸</span>
          <span class="daily-blessing-card__header-main">
            <span class="daily-blessing-title">每日祝福</span>
            <span class="daily-blessing-subtitle daily-blessing-subtitle--default">冒險者每日補給</span>
            <span class="daily-blessing-subtitle daily-blessing-subtitle--sweet">每日小祝福</span>
            <span class="daily-blessing-card__compact-summary">${escapeHtml(compactSummary)}</span>
          </span>
          <span class="${statusBadgeClass}">${escapeHtml(statusBadgeText)}</span>
          <span class="daily-blessing-card__chevron" aria-hidden="true">${collapsed ? '▼' : '▲'}</span>
        </button>
        ${claimAllButtonHtml('blessing', Number(!checkedIn) + Number(!spun))}
      </header>

      <div class="daily-blessing-card__body" ${collapsed ? 'hidden' : ''}>
        <section class="daily-streak-section" aria-label="連續簽到">
          <div class="daily-streak-row">
            <div class="daily-streak-stat">
              <span class="daily-streak-stat__label">連續簽到</span>
              <span class="daily-streak-stat__value"><span class="daily-streak-number">${streak}</span> 天</span>
            </div>
            <div class="daily-streak-stat">
              <span class="daily-streak-stat__label">最高紀錄</span>
              <span class="daily-streak-stat__value">${bestStreak} 天</span>
            </div>
          </div>
          <div class="daily-milestone-progress">
            <div class="daily-milestone-progress__header">
              <span class="daily-milestone-progress__label">${escapeHtml(milestone.label)}</span>
              <span class="daily-milestone-progress__value">${Math.min(projectedStreak, 7)} / 7</span>
            </div>
            <div class="progress-bar daily-milestone-progress__bar">
              <div class="progress-bar__fill daily-milestone-progress__fill" style="width: ${milestone.percent}%"></div>
            </div>
          </div>
        </section>

        <section class="daily-reward-preview" aria-label="今日獎勵預覽">
          <h3 class="daily-reward-preview__title">今日獎勵預覽</h3>
          <div class="daily-reward-preview__chips">
            ${rewardChipsHtml}
          </div>
        </section>

        <div class="daily-blessing-card__actions">
          <button type="button" class="btn btn--secondary daily-blessing-card__btn"
            data-action="daily-check-in" ${checkedIn ? 'disabled' : ''}>
            ${escapeHtml(checkInBtnLabel)}
          </button>
          <button type="button" class="btn btn--primary daily-blessing-card__btn"
            data-action="daily-open-wheel" ${spun ? 'disabled' : ''}>
            ${escapeHtml(wheelBtnLabel)}
          </button>
        </div>

        <p class="daily-blessing-card__footer">${escapeHtml(footerHint)}</p>
      </div>
    </div>`;

  return { html, hasPending, allDone, checkedIn, spun, compactSummary, statusBadgeText };
}

/* ─── 冒險任務（每日 / 每週） ─── */

/** 依獎勵 bundle 建立顯示用 chip 清單 */
function buildQuestRewardChips(reward) {
  const chips = [];
  if (!reward) return chips;
  if (reward.stardust > 0) {
    chips.push({ type: 'stardust', label: `星塵 +${reward.stardust}` });
  }
  if (reward.adventureEnergy > 0) {
    chips.push({ type: 'energy', label: `冒險能量 +${reward.adventureEnergy}` });
  }
  if (reward.materials) {
    for (const [id, amt] of Object.entries(reward.materials)) {
      if (amt > 0) {
        chips.push({ type: 'material', label: `${getMaterialName(id) || MATERIAL_LABELS[id] || id} +${amt}` });
      }
    }
  }
  if (reward.items) {
    for (const [id, amt] of Object.entries(reward.items)) {
      if (amt > 0) {
        const info = getCraftableInfo(id);
        chips.push({ type: 'item', label: `${info?.name || id} +${amt}` });
      }
    }
  }
  return chips;
}

function buildQuestCardHtml(quest) {
  const percent = quest.target > 0
    ? Math.min(100, Math.round((quest.current / quest.target) * 100))
    : 0;

  let cardStateClass = '';
  let badgeClass = 'quest-status-badge--progress';
  let badgeText = '進行中';
  let btnText = '進行中';
  let btnDisabled = true;
  if (quest.status === 'claimable') {
    cardStateClass = ' is-complete';
    badgeClass = 'quest-status-badge--claimable';
    badgeText = '可領取';
    btnText = '領取';
    btnDisabled = false;
  } else if (quest.status === 'claimed') {
    cardStateClass = ' is-claimed';
    badgeClass = 'quest-status-badge--claimed';
    badgeText = '已領取';
    btnText = '已領取';
    btnDisabled = true;
  }

  const chips = buildQuestRewardChips(quest.reward)
    .map((chip) => `<span class="quest-reward-chip" data-reward-type="${chip.type}">${escapeHtml(chip.label)}</span>`)
    .join('');

  return `
    <div class="quest-card${cardStateClass}" data-quest-id="${escapeHtml(quest.id)}" data-scope="${escapeHtml(quest.scope)}">
      <div class="quest-card__head">
        <span class="quest-card__title">${escapeHtml(quest.title)}</span>
        <span class="quest-status-badge ${badgeClass}">${badgeText}</span>
      </div>
      <p class="quest-card__description">${escapeHtml(quest.description)}</p>
      <div class="quest-card__progress">
        <div class="quest-card__progress-bar">
          <div class="quest-card__progress-fill" style="width:${percent}%"></div>
        </div>
        <span class="quest-card__progress-text">${quest.current} / ${quest.target}</span>
      </div>
      ${chips ? `<div class="quest-card__rewards">${chips}</div>` : ''}
      <button
        type="button"
        class="quest-claim-button"
        data-action="claim-quest"
        ${btnDisabled ? 'disabled' : ''}
      >${btnText}</button>
    </div>`;
}

export function renderQuestPanel() {
  const el = document.getElementById('quest-panel');
  if (!el) return;

  const summary = state.questSummary;
  if (!summary) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  el.hidden = false;

  const scope = questPanelTab === 'weekly' ? 'weekly' : 'daily';
  const activeData = scope === 'weekly' ? summary.weekly : summary.daily;

  const totalClaimable = summary.totalClaimable ?? 0;

  // 狀態 badge：有獎勵可領 / 今日已完成 / 今日進行中
  let statusText = '今日進行中';
  let statusClass = 'quest-panel__status-badge--progress';
  if (totalClaimable > 0) {
    statusText = '有獎勵可領';
    statusClass = 'quest-panel__status-badge--claimable';
  } else if (summary.daily.total > 0 && summary.daily.completedCount >= summary.daily.total) {
    statusText = '今日已完成';
    statusClass = 'quest-panel__status-badge--done';
  }

  const collapsed = questPanelCollapsed;
  el.classList.toggle('quest-panel--collapsed', collapsed);

  const listHtml = activeData.items.length > 0
    ? activeData.items.map(buildQuestCardHtml).join('')
    : '<p class="quest-empty">目前沒有可顯示的任務。</p>';

  el.innerHTML = `
    <div class="quest-panel__inner${collapsed ? ' quest-panel--collapsed' : ''}${totalClaimable > 0 ? ' quest-panel--pending' : ''}">
      <header class="quest-panel__header-wrap">
        <button
          type="button"
          class="quest-panel__header"
          data-action="quest-toggle-collapse"
          aria-expanded="${!collapsed}"
          aria-controls="quest-panel-body"
        >
          <span class="quest-panel__icon" aria-hidden="true">🗺️</span>
          <span class="quest-panel__header-main">
            <span class="quest-panel__eyebrow">每日 / 每週挑戰</span>
            <span class="quest-panel__title">冒險任務</span>
            <span class="quest-panel__subtitle">完成每日與每週挑戰，累積冒險獎勵</span>
          </span>
          <span class="quest-panel__status-badge ${statusClass}">${statusText}</span>
          <span class="quest-panel__collapse-icon" aria-hidden="true">${collapsed ? '▼' : '▲'}</span>
        </button>
        ${claimAllButtonHtml('quests', totalClaimable)}
      </header>
      <div class="quest-panel__body" id="quest-panel-body" ${collapsed ? 'hidden' : ''}>
        <div class="quest-panel__summary">
          <div class="quest-panel__summary-item">
            <span class="quest-panel__summary-label">每日完成</span>
            <span class="quest-panel__summary-value">${summary.daily.completedCount} / ${summary.daily.total}</span>
          </div>
          <div class="quest-panel__summary-item">
            <span class="quest-panel__summary-label">每週完成</span>
            <span class="quest-panel__summary-value">${summary.weekly.completedCount} / ${summary.weekly.total}</span>
          </div>
          <div class="quest-panel__summary-item">
            <span class="quest-panel__summary-label">可領取</span>
            <span class="quest-panel__summary-value">${totalClaimable}</span>
          </div>
        </div>
        <div class="quest-panel__tabs" role="tablist" aria-label="冒險任務分頁">
          <button type="button" class="quest-tab${scope === 'daily' ? ' is-active' : ''}" data-action="quest-tab" data-scope="daily" role="tab" aria-selected="${scope === 'daily'}">
            每日${summary.daily.claimableCount > 0 ? ` <span class="quest-tab__dot" aria-hidden="true"></span>` : ''}
          </button>
          <button type="button" class="quest-tab${scope === 'weekly' ? ' is-active' : ''}" data-action="quest-tab" data-scope="weekly" role="tab" aria-selected="${scope === 'weekly'}">
            每週${summary.weekly.claimableCount > 0 ? ` <span class="quest-tab__dot" aria-hidden="true"></span>` : ''}
          </button>
        </div>
        <div class="quest-list quest-panel__list">${listHtml}</div>
        <p class="quest-panel__footer-hint">完成挑戰可以獲得星塵、材料與道具</p>
      </div>
    </div>`;
}

/**
 * 依行為事件更新冒險任務進度，並於任務完成時提示。
 * 失敗時不影響原本操作（僅 console warn）。
 */
export async function trackQuest(eventType, amount = 1) {
  try {
    const result = await updateQuestProgress(eventType, amount);
    if (result?.newlyCompleted?.length) {
      for (const { quest } of result.newlyCompleted) {
        showToast(`冒險任務完成：${quest.title}`, 'success', 2600);
      }
    }
  } catch (err) {
    console.warn('[QuestNote] 冒險任務進度更新失敗:', err);
  }
}

export function renderDailyBlessingSection() {
  const homeEl = document.getElementById('homeDailyBlessingContainer');
  if (!homeEl) return;

  const { html, hasPending } = buildDailyBlessingCardData();
  homeEl.innerHTML = html;

  if (hasPending) {
    homeEl.classList.add('daily-blessing-section--pending');
  } else {
    homeEl.classList.remove('daily-blessing-section--pending');
  }

  renderGachaDailyBlessingEntry();
}

export function renderGachaDailyBlessingEntry() {
  const el = document.getElementById('gacha-daily-blessing-entry');
  if (!el) return;

  const { allDone, checkedIn, spun, compactSummary, statusBadgeText } = buildDailyBlessingCardData();

  let statusClass = 'daily-blessing-gacha-entry__status';
  if (allDone) statusClass += ' daily-blessing-gacha-entry__status--done';

  el.innerHTML = `
    <div class="daily-blessing-gacha-entry__card card">
      <div class="daily-blessing-gacha-entry__main">
        <span class="daily-blessing-gacha-entry__icon" aria-hidden="true">✦</span>
        <div class="daily-blessing-gacha-entry__text">
          <span class="daily-blessing-gacha-entry__title">每日祝福</span>
          <span class="daily-blessing-gacha-entry__summary">${escapeHtml(compactSummary)}</span>
        </div>
        <span class="${statusClass}">${escapeHtml(statusBadgeText)}</span>
      </div>
      <div class="daily-blessing-gacha-entry__actions">
        ${!checkedIn ? '<button type="button" class="btn btn--secondary btn--sm" data-action="go-home-daily-blessing">前往簽到</button>' : ''}
        ${!spun ? '<button type="button" class="btn btn--primary btn--sm" data-action="daily-open-wheel">幸運轉盤</button>' : ''}
        ${allDone ? '<button type="button" class="btn btn--ghost btn--sm" data-action="go-home-daily-blessing">查看紀錄</button>' : ''}
      </div>
    </div>`;
}

export async function handleDailyCheckIn() {
  if (isWheelSpinning()) return;
  const result = await performDailyCheckIn();
  if (!result.success) {
    showToast(result.error || '簽到失敗', result.error?.includes('已經') ? 'info' : 'error');
    return;
  }
  const rewardText = formatDailyRewardBundle(result.rewards);
  const today = getTodayDateString();
  const willBeAllDone = hasSpunWheelToday(
    { ...state.dailyCheckIn, lastCheckInDate: today },
    today
  );
  if (willBeAllDone) dailyBlessingCollapsed = true;
  await trackQuest('daily_checkin');
  await onRefresh({ renderMode: ['tasks', 'gacha'] });
  showDailyBlessingRewardToast(`簽到成功！獲得 ${rewardText}`);
  if (result.streak >= 3) {
    showToast(`連續簽到 ${result.streak} 天！`, 'success');
  }
  await handleAchievementCheckAfterAction();
}

export async function openDailyWheelModal() {
  const daily = state.dailyCheckIn;
  const today = getTodayDateString();
  if (daily && hasSpunWheelToday(daily, today)) {
    showToast('今天已經轉過幸運轉盤了，明天再來吧。', 'info');
    return;
  }

  const rewards = dailyWheelRewards || await loadWheelRewards();
  dailyWheelRewards = rewards;
  const canSpin = !(daily && hasSpunWheelToday(daily, today));

  openModal(`
    <div class="wheel-modal daily-wheel-modal-body">
      <h2 class="modal-title">每日幸運轉盤</h2>
      <p class="wheel-modal__status ${canSpin ? 'wheel-modal__status--available' : 'wheel-modal__status--done'}">${canSpin ? '今天還可以轉 1 次' : '今天已經轉過了'}</p>
      <div class="wheel-container" id="daily-wheel-container">
        ${buildWheelDiscHtml(rewards, { sweet: isSweetTheme() })}
      </div>
      <p class="wheel-modal__hint">轉盤結果由系統先決定，動畫僅為展示效果。</p>
    </div>
  `);

  if (!canSpin) return;

  const startBtn = document.getElementById('daily-wheel-start');
  startBtn?.addEventListener('click', trackUpdateActivity(async () => {
    if (startBtn.disabled || isWheelSpinning()) return;
    startBtn.disabled = true;

    const prep = await prepareDailyWheelSpin();
    if (!prep.success) {
      showToast(prep.error || '無法轉盤', 'info');
      releaseWheelSpinLock();
      startBtn.disabled = false;
      return;
    }

    let wheelSpinFinished = false;
    const finishWheelSpin = async () => {
      if (wheelSpinFinished) return;
      wheelSpinFinished = true;

      const result = await finalizeDailyWheelSpin(prep.reward);
      if (!result.success) {
        showToast(result.error || '轉盤結算失敗', 'error');
        releaseWheelSpinLock();
        startBtn.disabled = false;
        return;
      }
      closeModal();
      dailyBlessingCollapsed = true;
      await onRefresh({ renderMode: ['tasks', 'gacha'] });
      showDailyBlessingRewardToast(`獲得：${prep.reward.label}`);
      await handleAchievementCheckAfterAction();
    };

    try {
      await animateDailyWheel(prep.rewardIndex, prep.segmentCount, {
        reduceMotion: state.userPreferences?.reduceMotion ?? false,
      });
      await finishWheelSpin();
    } catch (err) {
      console.error('[QuestNote] 轉盤錯誤:', err);
      releaseWheelSpinLock();
      showToast('轉盤發生錯誤，請稍後再試', 'error');
      startBtn.disabled = false;
    }
  }));
}
export async function handleDevResetDailyBlessing() {
  if (!isDevMode()) return;
  if (!confirm('【開發測試】重置今日每日祝福（簽到與轉盤），確定？')) return;

  const result = await resetDevDailyBlessing();
  dailyBlessingCollapsed = false;
  await onRefresh({ renderMode: ['tasks', 'gacha'] });
  switchView('tasks');
  alert(result.message);
}
