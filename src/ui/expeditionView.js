/**
 * Expedition view: area cards, camp, journey archive, live timers and status lines,
 * the exploration progress panel and the dispatch modal. Expedition writes go through
 * expeditionService / explorationService.
 */
import { renderBondKeepsake } from '../bondJourneyView.js';
import { CAMP_UPGRADES, upgradeCamp } from '../campService.js';
import {
  rememberDialogFocus,
  isTopDialog,
  focusDialog,
  restoreDialogFocus,
} from '../dialogFocus.js';
import {
  EXPEDITION_OBJECTIVES,
  getDispatchTerms,
  getExpeditionRecommendations,
  getPetSpecialty,
} from '../expeditionGameplay.js';
import {
  isExpeditionTimeComplete,
  getRemainingMs,
  formatRemainingTime,
  checkAreaUnlock,
  claimExpeditionRewards,
  isPetOnExpedition,
  startExpedition,
} from '../expeditionService.js';
import { EXPEDITION_COMPLETE_MSG, pickStatusLine, randomStatusInterval } from '../expeditionStatusService.js';
import { claimExplorationMilestone } from '../explorationService.js';
import { refreshOnboarding, recordOnboardingEvent } from '../onboardingController.js';
import { escapeHtml } from '../uiHelpers.js';
import { trackUpdateActivity } from '../updateActivity.js';
import { getMaterialName } from '../workshopService.js';
import { handleAchievementCheckAfterAction } from './achievementsView.js';

// Bound from src/ui.js by connectExpeditionView() so this module never imports ui.js back.
let claimAllButtonHtml, closeModal, formatDateTime, notifyBondUnlocks, onRefresh, openModal, petDisplayName, petImageHtml, petOriginalName, renderNavBadges, showToast, state, trackQuest;

export function connectExpeditionView(deps) {
  ({ claimAllButtonHtml, closeModal, formatDateTime, notifyBondUnlocks, onRefresh, openModal, petDisplayName, petImageHtml, petOriginalName, renderNavBadges, showToast, state, trackQuest } = deps);
}

let expeditionTimer = null;
let expeditionStatusTimer = null;
let expeditionStatusIndex = -1;
// V2.7.2 派遣 Modal 狀態
let dispatchAreaId = null;
let dispatchSelectedPetIds = [];
let dispatchObjective = 'explore';
let journeyArchiveExpanded = false;
let dispatchKeydownHandler = null;
const explorationStoryCollapsed = {};
const explorationMilestonesCollapsed = {};
// 地區探索度整體區塊：預設收起（類似首頁功能，保持頁面整潔）
let explorationPanelCollapsed = true;
function getOwnedPets() {
  return (state.enrichedCollection || []).filter((p) => p.owned);
}
function formatDuration(minutes) {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h} 小時 ${m} 分` : `${h} 小時`;
  }
  return `${minutes} 分鐘`;
}

export function renderExpeditionView() {
  if (!state) return;

  const { wallet, expeditionAreas, activeExpedition } = state;
  const ownedPets = getOwnedPets();
  const hasActive = !!activeExpedition;
  const isComplete = activeExpedition && isExpeditionTimeComplete(activeExpedition);

  // 冒險能量卡片
  const energyEl = document.getElementById('expedition-energy');
  const energy = wallet.adventureEnergy ?? 0;
  if (energyEl) {
    energyEl.classList.toggle('expedition-energy--low', energy === 0);
    energyEl.innerHTML = `
      <div class="expedition-energy__header">
        <span class="expedition-energy__icon">⚡</span>
        <div>
          <p class="expedition-energy__label">冒險能量</p>
          <p class="expedition-energy__value">${energy}</p>
        </div>
      </div>
      ${
        energy === 0
          ? `<p class="expedition-energy__warning"><strong>冒險能量不足</strong><br>完成有效任務可以獲得冒險能量。</p>`
          : '<p class="expedition-energy__hint">完成任務可以獲得冒險能量</p>'
      }`;
  }

  // 進行中探險
  const activeEl = document.getElementById('expedition-active');
  if (activeEl) {
    if (!activeExpedition) {
      activeEl.innerHTML = '';
      stopExpeditionStatusRotation();
    } else {
      const pet = state.enrichedCollection.find((p) => p.id === activeExpedition.petId);
      const teamNames = (activeExpedition.petIds || [activeExpedition.petId])
        .map((id) => state.enrichedCollection.find((p) => p.id === id))
        .filter(Boolean).map(petDisplayName).join('、');
      const area = expeditionAreas.find((a) => a.id === activeExpedition.areaId);
      const remaining = getRemainingMs(activeExpedition);
      const complete = isExpeditionTimeComplete(activeExpedition);

      activeEl.innerHTML = `
        <article class="expedition-active-card card expedition-active-card--area-${area?.id || 'mist_forest'} ${complete ? 'expedition-active-card--ready' : 'expedition-active-card--glow'}">
          <div class="expedition-active-card__fx" aria-hidden="true"></div>
          <span class="expedition-status-badge ${complete ? 'expedition-status-badge--ready' : 'expedition-status-badge--active'}">${complete ? '可領取' : '進行中'}</span>
          <h2 class="section-title">${complete ? '探險歸來' : '進行中探險'}</h2>
          <div class="expedition-active-card__body">
            <div class="expedition-active-card__pet">
              <div class="expedition-active-card__pet-img ${complete ? 'expedition-pet-img--complete' : 'expedition-pet-img--float'}">
                ${pet ? petImageHtml(pet, { size: 'md' }) : ''}
              </div>
              <div>
                <p class="expedition-active-card__name">${teamNames ? escapeHtml(teamNames) : '未知寵物'}</p>
                ${pet?.nickname ? `<p class="pet-original-name pet-original-name--sm">原名：${escapeHtml(petOriginalName(pet))}</p>` : ''}
                <p class="expedition-active-card__area">${area ? escapeHtml(area.name) : ''} · ${escapeHtml(EXPEDITION_OBJECTIVES[activeExpedition.objective || 'explore'].label)}</p>
                <p class="expedition-active-card__status-label">${complete ? '探索完成' : '探索日誌'}</p>
              </div>
            </div>
            ${
              complete
                ? `<p class="expedition-complete-msg">${EXPEDITION_COMPLETE_MSG}</p>
                   <p class="expedition-report-event">${escapeHtml(activeExpedition.plannedResult?.event?.title || '探險報告已送達')}</p>
                   <button class="btn btn--primary btn--block expedition-claim-btn expedition-claim-btn--glow" data-action="claim-expedition" data-id="${escapeHtml(activeExpedition.id)}">閱讀報告並領獎</button>`
                : `<p class="expedition-status-log" id="expedition-status-log"></p>
                   <div class="expedition-countdown-row">
                     <span class="expedition-pulse-dot" aria-hidden="true"></span>
                     <p class="expedition-countdown" id="expedition-countdown">${formatRemainingTime(remaining)}</p>
                   </div>
                   <p class="expedition-countdown__label">剩餘時間</p>`
            }
          </div>
        </article>`;

      if (!complete && area?.id) {
        startExpeditionStatusRotation(area.id);
      } else {
        stopExpeditionStatusRotation();
      }
    }
  }

  // 探索地圖探索度面板
  renderExplorationPanel();
  renderCampPanel();
  renderJourneyArchive();

  // 探險地區（V2.7.2：先選地區，點派遣開 Modal）
  const areasEl = document.getElementById('expedition-areas');
  if (areasEl) {
    const explorationMap = {};
    for (const a of state.explorationSummary?.areas || []) {
      explorationMap[a.areaId] = a;
    }

    areasEl.innerHTML = `
      <h2 class="section-title">探險地區</h2>
      <p class="expedition-map__hint">${hasActive ? '領取目前旅程的獎勵後可再出發；現在仍可查看地區情報。' : '選擇地區查看路線與收穫，再組隊出發。'}</p>
      <div class="expedition-map expedition-area-grid">
        ${expeditionAreas
          .map((area) => renderExpeditionAreaCard(area, {
            hasActive,
            energy,
            ownedPets,
            exploration: explorationMap[area.id] || null,
            firstJourney: state.firstJourneyAvailable && area.id === 'mist_forest',
          }))
          .join('')}
      </div>`;
  }

  // 寵物選擇已移至派遣 Modal，清空舊容器
  const petsEl = document.getElementById('expedition-pets');
  if (petsEl) petsEl.innerHTML = '';
}

function expeditionAreaImageUrl(areaId) {
  return `./assets/expeditions/${encodeURIComponent(areaId)}.webp`;
}

/** 地區小卡保留派遣所需的資訊，完整路線與收穫放在派遣視窗。 */
function renderExpeditionAreaCard(area, { hasActive, energy, ownedPets, exploration, firstJourney }) {
  const { unlocked } = checkAreaUnlock(area, ownedPets);
  const locked = !unlocked;
  const mat = area.rewards.material;
  const terms = getDispatchTerms(area, firstJourney);
  const lowEnergy = energy < terms.energyCost;

  let statusLabel = '可派遣';
  let statusClass = 'expedition-area-card__status--ready';
  let btnLabel = '選隊出發';
  if (locked) {
    statusLabel = '未解鎖';
    statusClass = 'expedition-area-card__status--locked';
    btnLabel = '解鎖條件';
  } else if (hasActive) {
    statusLabel = '';
    statusClass = 'expedition-area-card__status--busy';
    btnLabel = '查看地區';
  } else if (lowEnergy) {
    statusLabel = '能量不足';
    statusClass = 'expedition-area-card__status--locked';
    btnLabel = '查看地區';
  }

  const progress = exploration?.progress ?? 0;

  return `
    <article class="expedition-area-card card expedition-area-card--${area.id} ${locked ? 'expedition-area-card--locked' : ''}" data-area-id="${area.id}">
      <div class="expedition-area-card__art">
        <img src="${expeditionAreaImageUrl(area.id)}" alt="" loading="lazy" decoding="async">
        ${statusLabel ? `<span class="expedition-area-card__status ${statusClass}">${statusLabel}</span>` : ''}
      </div>
      <div class="expedition-area-card__content">
        <div class="expedition-area-card__header">
          <h3 class="expedition-area-card__title">${escapeHtml(area.name)}</h3>
          <span class="expedition-explore-badge">${progress}%</span>
        </div>
        <div class="expedition-area-card__meta">
          <span>⏱ ${formatDuration(terms.durationMinutes)}</span>
          <span>⚡ ${terms.energyCost}${firstJourney ? ' · 首次' : ''}</span>
        </div>
        <div class="expedition-area-card__progress" role="progressbar" aria-label="${escapeHtml(area.name)}探索度" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">
          <span class="expedition-area-progress-fill" style="width: ${progress}%;"></span>
        </div>
        <p class="expedition-area-card__material">📦 ${escapeHtml(getMaterialName(mat.id))}</p>
        <button type="button" class="expedition-dispatch-button" data-action="open-dispatch" data-area-id="${area.id}" aria-label="${escapeHtml(area.name)}：${btnLabel}">${btnLabel}</button>
      </div>
    </article>`;
}

function renderCampPanel() {
  const el = document.getElementById('expedition-camp');
  if (!el) return;
  const wasOpen = el.querySelector('.camp-card__details')?.open ?? false;
  const level = state.campProgress?.level || 0;
  const next = CAMP_UPGRADES[level];
  const materials = state.wallet?.materials || {};
  const costs = next ? Object.entries(next.materials).map(([id, amount]) => {
    const owned = materials[id] || 0;
    return `<span class="camp-cost ${owned < amount ? 'is-missing' : ''}">${escapeHtml(getMaterialName(id))} ${owned}/${amount}</span>`;
  }).join('') : '';
  const affordable = next && Object.entries(next.materials).every(([id, amount]) => (materials[id] || 0) >= amount);
  el.innerHTML = `<article class="card camp-card">
    <details class="camp-card__details" ${wasOpen ? 'open' : ''}>
      <summary class="camp-card__summary"><span><strong>共用營地 · Lv.${level}</strong><small>${next ? `下一步：${next.name}` : '全部建設完成'}</small></span><span class="camp-card__summary-action">${affordable ? '可升級' : '查看'}</span></summary>
      <div class="camp-card__content">
        ${renderBondKeepsake(state)}
        <p>六區素材一起建設營地，升級會永久保留。</p>
        <div class="camp-unlocks">${CAMP_UPGRADES.map((entry) => `<span class="camp-unlock ${level >= entry.level ? 'is-open' : ''}">${level >= entry.level ? '✓' : '○'} ${entry.name}</span>`).join('')}</div>
        ${next ? `<p>${next.description}</p><div class="camp-costs">${costs}</div><button type="button" class="btn btn--primary" data-action="upgrade-camp" ${affordable ? '' : 'disabled'}>投入素材升級</button>` : '<p>營地已完成全部建設。</p>'}
      </div>
    </details>
  </article>`;
}

function renderJourneyArchive() {
  const el = document.getElementById('expedition-archive');
  if (!el) return;
  const journeys = state.recentExpeditions || [];
  if (!journeys.length) {
    el.innerHTML = '';
    return;
  }
  const wasOpen = el.querySelector('.journey-archive__details')?.open ?? false;
  el.innerHTML = `<article class="card journey-archive"><details class="journey-archive__details" ${wasOpen ? 'open' : ''}>
    <summary class="journey-archive__summary"><strong>旅程檔案</strong><span>${journeys.length} 份報告 · 查看</span></summary>
    <div class="journey-archive__content"><p>已領取的旅程會留在這裡，隨時可以重讀。</p>
    <div class="journey-list">${journeys.slice(0, journeyArchiveExpanded ? journeys.length : 5).map((journey) => {
      const area = state.expeditionAreas.find((entry) => entry.id === journey.areaId);
      return `<button type="button" data-action="read-journey" data-id="${escapeHtml(journey.id)}"><strong>${escapeHtml(area?.name || journey.areaId)}</strong><span>${escapeHtml(journey.report?.event?.title || '過往旅程')} · ${escapeHtml(formatDateTime(journey.startedAt))}</span></button>`;
    }).join('')}</div>${journeys.length > 5 ? `<button type="button" class="btn btn--ghost" data-action="toggle-journey-archive">${journeyArchiveExpanded ? '收起舊報告' : `查看全部 ${journeys.length} 份報告`}</button>` : ''}
    </div></details></article>`;
}

function showJourneyReport(journey) {
  const area = state.expeditionAreas.find((entry) => entry.id === journey.areaId);
  const report = journey.report;
  const rewards = journey.rewardsFinal || report?.rewards;
  const team = (journey.petIds || [journey.petId]).map((id) =>
    state.enrichedCollection.find((pet) => pet.id === id)).filter(Boolean).map(petDisplayName).join('、');
  const materials = Object.entries(rewards?.materials || {}).map(([id, amount]) =>
    `${escapeHtml(getMaterialName(id))} +${amount}`).join('、');
  openModal(`<div class="journey-report"><h2 class="modal-title">${escapeHtml(area?.name || '旅程報告')}</h2>
    <p>${escapeHtml(formatDateTime(journey.startedAt))} · ${escapeHtml(EXPEDITION_OBJECTIVES[journey.objective || 'explore'].label)}</p>
    <p>隊伍：${escapeHtml(team || '早期單人探險')}</p>
    <h3>${escapeHtml(report?.event?.title || '探險歸來')}</h3>
    <p>${escapeHtml(report?.event?.text || '夥伴完成旅程，帶回了收穫。')}</p>
    <p>收穫：星塵 +${rewards?.stardust || 0}、${materials || '無素材'}、親密度 +${rewards?.bondExp || 0}</p>
    ${report?.exploration ? `<p>探索度 +${report.exploration.increment}% → ${report.exploration.progress}%</p>` : ''}
    <button type="button" class="btn btn--primary btn--block" id="journey-report-close">關閉</button></div>`);
  document.getElementById('journey-report-close')?.addEventListener('click', closeModal);
}

export function startExpeditionTimer() {
  stopExpeditionTimer();
  const activeNow = state?.activeExpedition;
  // 已完成待領取：不啟動每秒 interval，避免整頁重繪
  if (!activeNow || isExpeditionTimeComplete(activeNow)) {
    return;
  }

  expeditionTimer = setInterval(() => {
    const active = state?.activeExpedition;
    if (!active) {
      stopExpeditionTimer();
      return;
    }

    if (isExpeditionTimeComplete(active)) {
      // 剛完成：停止 timer，只渲染一次切換成可領取狀態
      stopExpeditionTimer();
      stopExpeditionStatusRotation();
      renderExpeditionView();
      renderNavBadges();
      refreshOnboarding();
      return;
    }

    // 倒數中：只更新倒數文字，不重建整頁
    const el = document.getElementById('expedition-countdown');
    if (el) {
      el.textContent = formatRemainingTime(getRemainingMs(active));
    }
  }, 1000);
}

export function stopExpeditionTimer() {
  if (expeditionTimer) {
    clearInterval(expeditionTimer);
    expeditionTimer = null;
  }
}

function startExpeditionStatusRotation(areaId) {
  stopExpeditionStatusRotation();
  expeditionStatusIndex = -1;

  const setInitial = () => {
    const el = document.getElementById('expedition-status-log');
    if (!el) return;
    const { text, index } = pickStatusLine(areaId, expeditionStatusIndex);
    expeditionStatusIndex = index;
    el.textContent = text;
  };

  setInitial();

  const scheduleNext = () => {
    expeditionStatusTimer = setTimeout(() => {
      const active = state?.activeExpedition;
      if (!active || isExpeditionTimeComplete(active)) {
        stopExpeditionStatusRotation();
        return;
      }

      const el = document.getElementById('expedition-status-log');
      if (el) {
        const { text, index } = pickStatusLine(areaId, expeditionStatusIndex);
        expeditionStatusIndex = index;
        el.classList.add('expedition-status-log--changing');
        setTimeout(() => {
          el.textContent = text;
          el.classList.remove('expedition-status-log--changing');
        }, 200);
      }

      scheduleNext();
    }, randomStatusInterval());
  };

  scheduleNext();
}

function stopExpeditionStatusRotation() {
  if (expeditionStatusTimer) {
    clearTimeout(expeditionStatusTimer);
    expeditionStatusTimer = null;
  }
  expeditionStatusIndex = -1;
}

export async function handleExpeditionClick(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;

  if (action === 'open-dispatch') {
    const areaId = target.dataset.areaId;
    openExpeditionDispatchModal(areaId);
    return;
  }

  if (action === 'claim-expedition') {
    const expId = target.dataset.id;
    const expeditionPetId = state.activeExpedition?.petId ?? null;
    try {
      const result = await claimExpeditionRewards(
        expId,
        state.expeditionAreas,
        state.allPets
      );
      void recordOnboardingEvent('expedition-claimed', { expeditionId: expId, petId: expeditionPetId });
      await trackQuest('complete_expedition');
      const exploration = result.exploration;
      await onRefresh({ renderMode: ['expedition', 'tasks', 'collection'] });
      for (const petId of result.expedition.petIds || [expeditionPetId]) {
        if (petId) await notifyBondUnlocks(petId);
      }
      showExpeditionRewardModal(result);
      const matEntries = Object.entries(result.rewards.materials || {}).filter(([, amt]) => amt > 0);
      if (matEntries.length > 0) {
        const matText = matEntries.map(([id, amt]) => `${getMaterialName(id)} x${amt}`).join('、');
        showToast(`獲得 ${matText}`, 'success', 3200);
      } else {
        showToast('探險獎勵已領取', 'success', 2000);
      }
      if (exploration) {
        showToast(`${exploration.areaName}探索度 +${exploration.increment}%`, 'reward', 2600);
        for (const milestone of exploration.newlyReachedMilestones || []) {
          showToast(`探索里程碑達成：${milestone.title}`, 'info', 2800);
        }
      }
      await handleAchievementCheckAfterAction();
    } catch (err) {
      showToast(err.message || '領取失敗', 'error');
    }
    return;
  }

  if (action === 'toggle-exploration-panel') {
    explorationPanelCollapsed = !explorationPanelCollapsed;
    renderExplorationPanel();
    return;
  }

  if (action === 'upgrade-camp') {
    target.disabled = true;
    try {
      const result = await upgradeCamp();
      await onRefresh({ renderMode: ['expedition'] });
      showToast(`營地升級：${result.upgrade.name}`, 'reward');
    } catch (err) {
      target.disabled = false;
      showToast(err.message || '營地升級失敗', 'warning');
    }
    return;
  }

  if (action === 'read-journey') {
    const journey = (state.recentExpeditions || []).find((entry) => entry.id === target.dataset.id);
    if (journey) showJourneyReport(journey);
    return;
  }

  if (action === 'toggle-journey-archive') {
    journeyArchiveExpanded = !journeyArchiveExpanded;
    renderJourneyArchive();
    return;
  }

  if (action === 'toggle-exploration-story') {
    const areaId = target.dataset.areaId;
    // 值為 false 代表展開；預設（undefined）視為折疊
    explorationStoryCollapsed[areaId] = explorationStoryCollapsed[areaId] === false ? true : false;
    renderExplorationPanel();
    return;
  }

  if (action === 'toggle-exploration-milestones') {
    const areaId = target.dataset.areaId;
    explorationMilestonesCollapsed[areaId] = explorationMilestonesCollapsed[areaId] === false ? true : false;
    renderExplorationPanel();
    return;
  }

  if (action === 'claim-exploration-milestone') {
    const areaId = target.dataset.areaId;
    const percent = Number(target.dataset.percent);
    target.disabled = true;
    try {
      const result = await claimExplorationMilestone(areaId, percent);
      if (!result.success) {
        showToast(result.error || '領取失敗', 'warning');
        return;
      }
      await onRefresh({ renderMode: ['expedition'] });
      renderExplorationPanel();
      showToast(`已領取探索獎勵：${result.rewardText}`, 'reward', 3000);
      await handleAchievementCheckAfterAction();
    } catch (err) {
      showToast(err.message || '領取失敗', 'error');
    }
    return;
  }
}

function showExpeditionRewardModal(result) {
  const { rewards, pet, bond, expedition } = result;
  const displayPet = state.enrichedCollection?.find((p) => p.id === pet.id) || pet;
  const matEntries = Object.entries(rewards.materials || {});
  const rarityPct = Math.round((rewards.rarityBonus || 0) * 100);
  const bondPct = Math.round((rewards.bondBonus || 0) * 100);

  openModal(`
    <div class="expedition-reward-modal expedition-reward-modal--animate">
      <h2 class="modal-title expedition-reward-modal__title">探險歸來！</h2>
      <p class="expedition-report-event"><strong>${escapeHtml(expedition.report?.event?.title || '平安歸來')}</strong><br>${escapeHtml(expedition.report?.event?.text || '')}</p>
      <div class="expedition-reward-modal__pet">
        ${petImageHtml(displayPet, { size: 'md' })}
        <p class="expedition-reward-modal__pet-name">${escapeHtml(petDisplayName(displayPet))}</p>
        ${displayPet.nickname ? `<p class="pet-original-name pet-original-name--sm">原名：${escapeHtml(petOriginalName(displayPet))}</p>` : ''}
      </div>
      <ul class="expedition-reward-list">
        <li class="expedition-reward-item" data-reward-type="stardust">✦ 星塵 <strong class="expedition-reward-value">+${rewards.stardust}</strong>
          ${rewards.bonusStardust > 0 ? `<span class="expedition-bonus">（基礎 ${rewards.baseStardust} + 加成 ${rewards.bonusStardust}）</span>` : ''}
        </li>
        ${matEntries.map(([id, amt]) => `<li class="expedition-reward-item" data-reward-type="material">📦 ${escapeHtml(getMaterialName(id))} <strong class="expedition-reward-value">+${amt}</strong></li>`).join('')}
        <li class="expedition-reward-item" data-reward-type="bond">💜 親密度 <strong class="expedition-reward-value">+${rewards.bondExp}</strong></li>
        ${rewards.fragmentGained > 0 ? `<li class="expedition-reward-item" data-reward-type="fragment">相遇碎片 <strong class="expedition-reward-value">+${rewards.fragmentGained}</strong></li>` : ''}
      </ul>
      <p class="expedition-reward-modal__workshop-hint">旅程報告已收入營地，可隨時重讀。</p>
      ${
        rewards.bonusStardust > 0
          ? `<p class="expedition-bonus-detail">加成：稀有度 +${rarityPct}% · 親密度 Lv.${bond?.oldLevel ?? pet.bondLevel ?? 1} +${bondPct}%</p>`
          : ''
      }
      ${bond?.leveledUp ? `<p class="expedition-levelup">親密度提升至 Lv.${bond.newLevel}！</p>` : ''}
      <button class="btn btn--primary btn--block expedition-confirm-button" id="expedition-reward-close">確認</button>
    </div>
  `);

  document.getElementById('expedition-reward-close')?.addEventListener('click', closeModal);
}

/* ─── 探索地圖探索度（V2.7.0） ─── */

const MILESTONE_STATUS_LABEL = {
  claimable: '可領取',
  claimed: '已領取',
  locked: '未達成',
};

/** 渲染探索度面板（位於探險頁，介於進行中探險與探險地區之間） */
export function renderExplorationPanel() {
  const panelEl = document.getElementById('exploration-panel');
  if (!panelEl) return;

  const summary = state?.explorationSummary;
  if (!summary || !Array.isArray(summary.areas) || summary.areas.length === 0) {
    panelEl.innerHTML = '';
    return;
  }

  const collapsed = explorationPanelCollapsed;
  const cards = summary.areas.map((area) => renderExplorationAreaCard(area)).join('');

  panelEl.innerHTML = `
    <div class="exploration-panel__wrap card ${collapsed ? 'is-collapsed' : ''}">
      <div class="reward-claim-header">
      <button type="button" class="exploration-panel__toggle" data-action="toggle-exploration-panel" aria-expanded="${!collapsed}">
        <span class="exploration-panel__toggle-main">
          <span class="exploration-panel__toggle-icon" aria-hidden="true">🗺️</span>
          <span class="exploration-panel__toggle-title">地區探索度</span>
          ${
            summary.totalClaimable > 0
              ? `<span class="exploration-panel__claimable">可領取 ${summary.totalClaimable}</span>`
              : ''
          }
        </span>
        <span class="exploration-panel__toggle-chevron">${collapsed ? '▸' : '▾'}</span>
      </button>
      ${claimAllButtonHtml('exploration', summary.totalClaimable)}
      </div>
      ${
        collapsed
          ? ''
          : `<div class="exploration-panel__body">
               <p class="exploration-panel__hint">完成探險並領獎，即可推進各地區探索度，解鎖故事、徽章與稱號。</p>
               <div class="exploration-area-list">${cards}</div>
             </div>`
      }
    </div>`;
}

function renderExplorationAreaCard(area) {
  const { areaId } = area;
  const progress = area.progress;
  // 預設折疊：只有明確設為 false 才展開，保持頁面整潔
  const storyOpen = explorationStoryCollapsed[areaId] === false;
  const milestonesOpen = explorationMilestonesCollapsed[areaId] === false;

  const nextText = area.fullyExplored
    ? '已完全探索'
    : area.nextMilestone
      ? `下一個里程碑：${area.nextMilestone.percent}% ${escapeHtml(area.nextMilestone.title)}`
      : '—';

  const storyBlock = area.hasStory
    ? `<div class="exploration-story is-unlocked">
         ${area.stories.map((s) => `<p class="exploration-story__text">${escapeHtml(s.text)}</p>`).join('')}
       </div>`
    : `<div class="exploration-story is-locked">
         <p class="exploration-story__text">探索度達到 ${area.storyLockedPercent}% 後解鎖地區故事。</p>
       </div>`;

  const milestoneCards = area.milestones.map((m) => renderExplorationMilestoneCard(areaId, m)).join('');

  // 已獲得徽章 / 稱號提示（來自已領取里程碑）
  const earned = [];
  for (const m of area.milestones) {
    if (m.status !== 'claimed' || !m.reward) continue;
    if (m.reward.title) earned.push(`已獲得稱號：${m.reward.title}`);
    if (m.reward.badgeId) earned.push(`已獲得徽章：${m.title}`);
  }
  const earnedBlock = earned.length
    ? `<div class="exploration-area-card__earned">
         ${earned.map((t) => `<span class="exploration-reward-chip" data-reward-type="title">${escapeHtml(t)}</span>`).join('')}
       </div>`
    : '';

  return `
    <article class="exploration-area-card" data-area-id="${areaId}">
      <div class="exploration-area-card__header">
        <h3 class="exploration-area-title">${escapeHtml(area.name)}</h3>
        <span class="exploration-progress-label">探索度 ${progress}%</span>
      </div>
      <div class="exploration-progress-bar" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">
        <div class="exploration-progress-fill" style="width: ${progress}%;"></div>
        <span class="exploration-progress-bar__text">${progress}%</span>
      </div>
      <div class="exploration-area-card__stats">
        <span class="exploration-area-card__runs">已完成探險 ${area.completedRuns} 次</span>
        ${area.claimableCount > 0 ? `<span class="exploration-status-badge exploration-status-badge--claimable">可領取 ${area.claimableCount}</span>` : ''}
        ${area.fullyExplored ? '<span class="exploration-status-badge exploration-status-badge--done">完全探索</span>' : ''}
      </div>
      <p class="exploration-next-milestone">${escapeHtml(nextText)}</p>
      ${earnedBlock}

      <button type="button" class="exploration-collapse-toggle" data-action="toggle-exploration-story" data-area-id="${areaId}" aria-expanded="${storyOpen}">
        <span>地區故事</span>
        <span class="exploration-collapse-toggle__icon">${storyOpen ? '▾' : '▸'}</span>
      </button>
      ${storyOpen ? storyBlock : ''}

      <button type="button" class="exploration-collapse-toggle" data-action="toggle-exploration-milestones" data-area-id="${areaId}" aria-expanded="${milestonesOpen}">
        <span>里程碑</span>
        <span class="exploration-collapse-toggle__icon">${milestonesOpen ? '▾' : '▸'}</span>
      </button>
      ${milestonesOpen ? `<div class="exploration-milestone-list">${milestoneCards}</div>` : ''}
    </article>`;
}

function renderExplorationMilestoneCard(areaId, milestone) {
  const { status, percent } = milestone;
  const chips = (milestone.rewardChips || [])
    .map(
      (chip) =>
        `<span class="exploration-reward-chip" data-reward-type="${chip.type}">${escapeHtml(chip.label)}</span>`
    )
    .join('');

  let button;
  if (status === 'claimable') {
    button = `<button type="button" class="exploration-claim-button" data-action="claim-exploration-milestone" data-area-id="${areaId}" data-percent="${percent}">領取</button>`;
  } else if (status === 'claimed') {
    button = `<button type="button" class="exploration-claim-button" disabled>已領取</button>`;
  } else {
    button = `<button type="button" class="exploration-claim-button" disabled>未達成</button>`;
  }

  return `
    <div class="exploration-milestone-card is-${status}">
      <div class="exploration-milestone-card__head">
        <span class="exploration-milestone-card__percent">${percent}%</span>
        <span class="exploration-milestone-card__title">${escapeHtml(milestone.title)}</span>
        <span class="exploration-status-badge exploration-status-badge--${status}">${MILESTONE_STATUS_LABEL[status]}</span>
      </div>
      <p class="exploration-milestone-card__desc">${escapeHtml(milestone.description)}</p>
      <div class="exploration-milestone-card__rewards">${chips}</div>
      ${button}
    </div>`;
}

/* ─── V2.7.2 派遣選單 Modal ─── */

function getDispatchRecommendations() {
  const pets = getOwnedPets();
  return getExpeditionRecommendations(pets, dispatchObjective, {
    companionId: state?.companion?.id,
    unavailablePetIds: pets.filter((pet) => isPetOnExpedition(pet.id, state.activeExpedition)).map((pet) => pet.id),
  });
}

/** Match the objective first; busy pets remain visible at the end. */
function getDispatchablePetsSorted() {
  const { recommended, others } = getDispatchRecommendations();
  return [...recommended, ...others,
    ...getOwnedPets().filter((pet) => isPetOnExpedition(pet.id, state.activeExpedition))];
}

/** 開啟派遣選單 Modal */
/** Preselect pets in the open dispatch modal (used by awakening navigation). */
export function setDispatchSelectedPetIds(petIds) {
  dispatchSelectedPetIds = petIds;
}

export function openExpeditionDispatchModal(areaId) {
  const area = state.expeditionAreas.find((a) => a.id === areaId);
  if (!area) {
    showToast('找不到地區資料', 'error');
    return;
  }
  dispatchAreaId = areaId;

  // 先選目標，再用推薦或手動組隊。
  dispatchSelectedPetIds = [];
  dispatchObjective = 'explore';

  let overlay = document.getElementById('expedition-dispatch-modal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'expedition-dispatch-modal';
    overlay.className = 'expedition-dispatch-modal';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', trackUpdateActivity(handleDispatchModalClick));
  }
  rememberDialogFocus(overlay);
  document.body.classList.add('expedition-dispatch-open');
  dispatchKeydownHandler = (e) => {
    if (e.key === 'Escape' && isTopDialog(overlay)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      closeExpeditionDispatchModal();
    }
  };
  document.addEventListener('keydown', dispatchKeydownHandler);

  renderExpeditionDispatchModal();
  focusDialog(overlay);
}

/** 關閉派遣選單 Modal */
export function closeExpeditionDispatchModal() {
  const overlay = document.getElementById('expedition-dispatch-modal');
  if (overlay) overlay.remove();
  document.body.classList.remove('expedition-dispatch-open');
  if (overlay) restoreDialogFocus(overlay);
  if (dispatchKeydownHandler) {
    document.removeEventListener('keydown', dispatchKeydownHandler);
    dispatchKeydownHandler = null;
  }
  dispatchAreaId = null;
  dispatchSelectedPetIds = [];
}

/** 派遣 Modal 點擊委派（背景 / 關閉 / 選寵物 / 確認） */
function handleDispatchModalClick(e) {
  const overlay = document.getElementById('expedition-dispatch-modal');
  if (
    e.target === overlay ||
    e.target.classList.contains('expedition-dispatch-modal__backdrop')
  ) {
    closeExpeditionDispatchModal();
    return;
  }
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const action = t.dataset.action;
  if (action === 'dispatch-close') {
    closeExpeditionDispatchModal();
    return;
  }
  if (action === 'dispatch-select-pet') {
    if (t.disabled) return;
    const scrollTop = overlay.querySelector('.expedition-dispatch-modal__body')?.scrollTop || 0;
    const petId = t.dataset.petId;
    dispatchSelectedPetIds = dispatchSelectedPetIds.includes(petId)
      ? dispatchSelectedPetIds.filter((id) => id !== petId)
      : dispatchSelectedPetIds.length < 3 ? [...dispatchSelectedPetIds, petId] : dispatchSelectedPetIds;
    renderExpeditionDispatchModal();
    const scrollBody = overlay.querySelector('.expedition-dispatch-modal__body');
    if (scrollBody) scrollBody.scrollTop = scrollTop;
    overlay.querySelector(`[data-pet-id="${petId}"]`)?.focus({ preventScroll: true });
    return;
  }
  if (action === 'dispatch-objective') {
    const scrollTop = overlay.querySelector('.expedition-dispatch-modal__body')?.scrollTop || 0;
    dispatchObjective = t.dataset.objective;
    renderExpeditionDispatchModal();
    overlay.querySelector('.expedition-dispatch-modal__body').scrollTop = scrollTop;
    overlay.querySelector(`[data-objective="${dispatchObjective}"]`)?.focus({ preventScroll: true });
    return;
  }
  if (action === 'dispatch-recommend') {
    if (t.disabled) return;
    const scrollTop = overlay.querySelector('.expedition-dispatch-modal__body')?.scrollTop || 0;
    dispatchSelectedPetIds = getDispatchRecommendations().teamPetIds;
    renderExpeditionDispatchModal();
    overlay.querySelector('.expedition-dispatch-modal__body').scrollTop = scrollTop;
    overlay.querySelector('[data-action="dispatch-recommend"]')?.focus({ preventScroll: true });
    return;
  }
  if (action === 'dispatch-confirm') {
    confirmExpeditionDispatch(dispatchAreaId, dispatchSelectedPetIds);
    return;
  }
}

/** 渲染派遣 Modal 內容 */
export function renderExpeditionDispatchModal() {
  const overlay = document.getElementById('expedition-dispatch-modal');
  if (!overlay) return;
  const specialtyHelpOpen = overlay.querySelector('.expedition-specialty-help')?.open ?? false;
  const area = state.expeditionAreas.find((a) => a.id === dispatchAreaId);
  if (!area) {
    closeExpeditionDispatchModal();
    return;
  }

  const mat = area.rewards.material;
  const energy = state.wallet.adventureEnergy ?? 0;
  const terms = getDispatchTerms(area, state.firstJourneyAvailable && area.id === 'mist_forest');
  const lowEnergy = energy < terms.energyCost;
  const { unlocked, hint } = checkAreaUnlock(area, getOwnedPets());
  const exploration = (state.explorationSummary?.areas || []).find(
    (a) => a.areaId === dispatchAreaId
  );
  const pets = getDispatchablePetsSorted();
  const recommendations = getDispatchRecommendations();
  const selectedPets = pets.filter((p) => dispatchSelectedPetIds.includes(p.id));

  const petListHtml =
    pets.length === 0
      ? '<p class="expedition-dispatch-empty">目前還沒有可派遣的寵物，先去召喚夥伴吧。</p>'
      : pets.map((p) => buildDispatchPetOptionHtml(p)).join('');

  const canConfirm = selectedPets.length > 0 && unlocked && !lowEnergy && !state.activeExpedition;
  const confirmLabel = !unlocked ? '尚未解鎖'
    : state.activeExpedition ? '探險進行中'
      : lowEnergy ? '能量不足' : '確認派遣';

  const previewHtml = selectedPets.length
    ? `隊伍：<strong>${selectedPets.map((pet) => escapeHtml(petDisplayName(pet))).join('、')}</strong>　目標：${EXPEDITION_OBJECTIVES[dispatchObjective].label}<br>消耗：冒險能量 ${terms.energyCost}　預計時間：${formatDuration(terms.durationMinutes)}<br>保證帶回星塵、親密度與至少 1 份${escapeHtml(getMaterialName(mat.id))}；額外發現由隊伍專長決定。${state.campProgress?.level >= 1 ? `<br>地圖桌情報：${selectedPets.map((pet) => `${escapeHtml(petDisplayName(pet))}（${getPetSpecialty(pet).label} Lv.${getPetSpecialty(pet).level}）`).join('、')}。` : ''}`
    : '請先選擇 1～3 隻出發寵物';

  overlay.innerHTML = `
    <div class="expedition-dispatch-modal__backdrop"></div>
    <div class="expedition-dispatch-modal__content" role="dialog" aria-modal="true" aria-label="派遣探險">
      <div class="expedition-dispatch-modal__header">
        <h2 class="expedition-dispatch-modal__title">派遣探險</h2>
        <button type="button" class="expedition-dispatch-modal__close" data-action="dispatch-close" aria-label="關閉">✕</button>
      </div>
      <div class="expedition-dispatch-modal__body">
        <div class="expedition-dispatch-modal__area-summary">
          <img class="expedition-dispatch-area__image" src="${expeditionAreaImageUrl(area.id)}" alt="">
          <h3 class="expedition-dispatch-area__name">${escapeHtml(area.name)}</h3>
          <p class="expedition-dispatch-area__desc">${escapeHtml(area.description)}</p>
          <div class="expedition-dispatch-area__meta">
            <span class="expedition-dispatch-area__meta-item">⏱ ${formatDuration(terms.durationMinutes)}${terms.firstJourney ? ' · 首次短程' : ''}</span>
            <span class="expedition-dispatch-area__meta-item ${lowEnergy ? 'is-low' : ''}">⚡ 消耗 ${terms.energyCost}（目前 ${energy}）</span>
          </div>
          <div class="expedition-dispatch-area__rewards">
            <span class="expedition-reward-chip" data-reward-type="stardust">✦ 星塵 ${area.rewards.stardust.min}～${area.rewards.stardust.max}</span>
            <span class="expedition-reward-chip" data-reward-type="material">📦 ${escapeHtml(getMaterialName(mat.id))} ${mat.min}～${mat.max}</span>
            <span class="expedition-reward-chip" data-reward-type="bond">💜 親密度 +${area.rewards.bondExp}</span>
          </div>
          ${exploration ? `<p class="expedition-dispatch-area__explore">探索度 ${exploration.progress}%${exploration.fullyExplored ? ' · 已完全探索' : exploration.nextMilestone ? ` · 下一個里程碑：${exploration.nextMilestone.percent}% ${escapeHtml(exploration.nextMilestone.title)}` : ''}</p>` : ''}
          ${!unlocked ? `<p class="expedition-dispatch-area__unlock">解鎖條件：${escapeHtml(hint)}</p>` : ''}
          ${state.activeExpedition ? '<p class="expedition-dispatch-area__unlock">領取目前旅程的獎勵後，就能再次派遣。</p>' : ''}
        </div>
        <section class="expedition-dispatch-modal__objective-section" aria-labelledby="dispatch-objective-title">
          <h3 class="expedition-dispatch-modal__pet-title" id="dispatch-objective-title">1. 選擇探險目標</h3>
          <div class="expedition-objectives" role="group" aria-label="探險目標">
            ${Object.entries(EXPEDITION_OBJECTIVES).map(([id, entry]) => `<button type="button" class="expedition-objective ${dispatchObjective === id ? 'is-selected' : ''}" data-action="dispatch-objective" data-objective="${id}" aria-pressed="${dispatchObjective === id}"><strong>${entry.label}</strong><span>${entry.description}</span></button>`).join('')}
          </div>
        </section>
        <div class="expedition-dispatch-modal__pet-section">
          <h3 class="expedition-dispatch-modal__pet-title">2. 選擇 1～3 隻出發寵物</h3>
          <div class="expedition-recommendation">
            <p class="expedition-recommendation__summary" aria-live="polite">${recommendations.recommended.length
              ? `推薦${recommendations.label}專長夥伴，${recommendations.benefit}。依專長等級優先排序，可一鍵帶入前 ${recommendations.teamPetIds.length} 隻後調整隊伍。`
              : `目前沒有可派遣的${recommendations.label}專長夥伴，仍可手動選擇其他寵物出發。`}</p>
            <button type="button" class="btn btn--secondary expedition-recommendation__button" data-action="dispatch-recommend" ${recommendations.teamPetIds.length ? '' : 'disabled'}>一鍵帶入推薦隊伍${recommendations.teamPetIds.length ? `（${recommendations.teamPetIds.length} 隻）` : ''}</button>
          </div>
          <p class="expedition-dispatch-modal__pet-note">陪伴中的寵物也可以派遣，不會取消目前的陪伴設定。</p>
          <details class="expedition-specialty-help" ${specialtyHelpOpen ? 'open' : ''}>
            <summary>專長是什麼？看隊伍如何影響收穫</summary>
            <p>初識就能發揮專長，親密度成長會讓效果更強。不同專長同行，也更容易遇見額外事件。</p>
            <ul>
              <li><strong>探路</strong>：選探索目標時，增加地區探索進度。</li>
              <li><strong>採集</strong>：選採集目標時，多帶回地區素材。</li>
              <li><strong>同行</strong>：選羈絆目標時，增加隊伍親密度。</li>
              <li><strong>解讀</strong>：提高額外發現機會，帶回更多線索。</li>
              <li><strong>守護</strong>：帶回額外星塵。</li>
            </ul>
          </details>
          <div class="expedition-dispatch-modal__pet-list">
            ${petListHtml}
          </div>
        </div>
      </div>
      <div class="expedition-dispatch-modal__preview">
        <div class="expedition-dispatch-preview__full">${previewHtml}</div>
        <div class="expedition-dispatch-preview__compact">${selectedPets.length} 隻同行 · ${EXPEDITION_OBJECTIVES[dispatchObjective].label}<br>消耗 ${terms.energyCost} 能量 · ${formatDuration(terms.durationMinutes)}<details><summary>隊伍與收穫</summary><p>${previewHtml}</p></details></div>
      </div>
      <div class="expedition-dispatch-modal__footer">
        <button type="button" class="expedition-dispatch-cancel-button" data-action="dispatch-close">取消</button>
        <button type="button" class="expedition-dispatch-confirm-button" data-action="dispatch-confirm" ${canConfirm ? '' : 'disabled'}>${confirmLabel}</button>
      </div>
    </div>`;
}

/** 派遣 Modal 內單一寵物選項 */
function buildDispatchPetOptionHtml(pet) {
  const onExp = isPetOnExpedition(pet.id, state.activeExpedition);
  const selected = dispatchSelectedPetIds.includes(pet.id);
  const specialty = getPetSpecialty(pet);
  const recommended = !onExp && specialty.role === EXPEDITION_OBJECTIVES[dispatchObjective].role;
  const rarityClass = `rarity-${pet.rarity}`;
  const liberated = pet.bondLiberated;
  const isCompanion = !!pet.isCompanion || pet.id === state?.companion?.id;
  return `
    <button type="button"
      class="expedition-pet-option ${selected ? 'is-selected' : ''} ${onExp ? 'is-disabled' : ''}"
      data-action="dispatch-select-pet"
      data-pet-id="${pet.id}"
      aria-pressed="${selected}"
      ${onExp ? 'disabled' : ''}
    >
      <span class="expedition-pet-option__img">${petImageHtml(pet, { size: 'sm' })}</span>
      <span class="expedition-pet-option__info">
        <span class="expedition-pet-option__name">${escapeHtml(petDisplayName(pet))}</span>
        ${pet.nickname ? `<span class="expedition-pet-option__original">原名：${escapeHtml(petOriginalName(pet))}</span>` : ''}
        <span class="expedition-pet-option__tags">
          <span class="badge badge--rarity ${rarityClass}">${pet.rarity}</span>
          <span class="expedition-pet-option__bond">親密 Lv.${pet.bondLevel || 1}</span>
          <span class="expedition-pet-option__specialty">${specialty.label} Lv.${specialty.level}</span>
          ${recommended ? '<span class="expedition-pet-option__recommended">符合目標 · 推薦</span>' : ''}
          ${isCompanion ? '<span class="expedition-pet-option__companion">陪伴中</span>' : ''}
          ${liberated ? '<span class="expedition-pet-option__liberated">羈絆解放</span>' : ''}
          ${onExp ? '<span class="expedition-pet-option__busy">探險中</span>' : ''}
        </span>
      </span>
      ${selected ? '<span class="expedition-pet-option__check" aria-hidden="true">✓</span>' : ''}
    </button>`;
}

/** 確認派遣：完整檢查後呼叫原本 startExpedition 邏輯 */
async function confirmExpeditionDispatch(areaId, petIds) {
  if (!areaId) {
    showToast('找不到地區資料', 'error');
    return;
  }
  if (!petIds?.length) {
    showToast('請先選擇 1～3 隻出發寵物。', 'warning');
    return;
  }
  const area = state.expeditionAreas.find((a) => a.id === areaId);
  if (!area) {
    showToast('找不到地區資料', 'error');
    return;
  }
  const pets = petIds.map((id) => getOwnedPets().find((p) => p.id === id));
  if (pets.some((pet) => !pet)) {
    showToast('找不到隊伍寵物資料。', 'error');
    return;
  }
  if (state.activeExpedition) {
    showToast('目前已有探險進行中。', 'warning');
    return;
  }
  const terms = getDispatchTerms(area, state.firstJourneyAvailable && area.id === 'mist_forest');
  if ((state.wallet.adventureEnergy ?? 0) < terms.energyCost) {
    showToast('冒險能量不足。', 'warning');
    return;
  }
  if (petIds.some((id) => isPetOnExpedition(id, state.activeExpedition))) {
    showToast('這隻寵物正在探險中。', 'warning');
    return;
  }

  const confirmBtn = document.querySelector(
    '#expedition-dispatch-modal [data-action="dispatch-confirm"]'
  );
  if (confirmBtn) confirmBtn.disabled = true;

  try {
    // 呼叫原本探險開始邏輯（扣能量、建立 expedition 狀態、倒數）
    await startExpedition(petIds, areaId, state.expeditionAreas, state.allPets, dispatchObjective);
    await trackQuest('start_expedition');
    closeExpeditionDispatchModal();
    await onRefresh({ renderMode: ['expedition', 'tasks'] });
    startExpeditionTimer();
    showToast(`已派遣 ${pets.length} 隻夥伴前往${area.name}`, 'success');
    void recordOnboardingEvent('expedition-started', { areaId, petId: petIds[0] });
  } catch (err) {
    if (confirmBtn) confirmBtn.disabled = false;
    showToast(err.message || '無法開始探險', 'warning');
  }
}

/* ─── 習慣頁 ─── */
