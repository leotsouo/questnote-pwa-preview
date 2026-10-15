/**
 * Collection view: progress summary, collection milestones, rarity and series filters,
 * the pet grid and the pet detail modal. Companion changes and milestone claims are
 * persisted by collectionService / collectionMilestoneService.
 */
import { renderBondDetail } from '../bondJourneyView.js';
import { claimCollectionMilestone, COLLECTION_RARITY_ORDER } from '../collectionMilestoneService.js';
import { setCompanion, getBondUnlocksByLevel, clearPetNickname } from '../collectionService.js';
import { renderEncounterView } from '../encounterView.js';
import { getPetSpecialty } from '../expeditionGameplay.js';
import { preloadOwnedPetImages } from '../imagePreloadService.js';
import { intimacySummary } from '../invitationPresentation.js';
import { renderLocalIdentityView } from '../localArtPreview.js';
import { getBondUnlockText } from '../loreService.js';
import { recordOnboardingEvent } from '../onboardingController.js';
import { renderAwakeningDetail } from '../petAwakeningView.js';
import { getCompanionScene, twilightIcon } from '../twilightPresentation.js';
import { escapeHtml, emptyStateHtml } from '../uiHelpers.js';
import { trackUpdateActivity } from '../updateActivity.js';
import { getGiftAffinityTags, GIFT_TAG_LABELS } from '../workshopService.js';

// Bound from src/ui.js by connectCollectionView() so this module never imports ui.js back.
let BOND_NEXT_UNLOCK, BOND_UNLOCK_ITEM_LABELS, bondBadgeHtml, claimAllButtonHtml, closeModal, collectionRenderGate, encounterActions, onRefresh, openModal, openNicknameModal, openPetFeedModal, openPetImageViewer, petDisplayName, petImageHtml, petNameBlockHtml, petOriginalName, setText, showToast, state, switchView;

export function connectCollectionView(deps) {
  ({ BOND_NEXT_UNLOCK, BOND_UNLOCK_ITEM_LABELS, bondBadgeHtml, claimAllButtonHtml, closeModal, collectionRenderGate, encounterActions, onRefresh, openModal, openNicknameModal, openPetFeedModal, openPetImageViewer, petDisplayName, petImageHtml, petNameBlockHtml, petOriginalName, setText, showToast, state, switchView } = deps);
}

let collectionFilter = 'all';
let collectionSeriesFilter = 'all';
let lastCollectionGridKey = null;
let collectionMilestonesExpanded = false;
let collectionMilestoneFilter = 'claimable';
let collectionMilestonesShowAll = false;
export async function handleCollectionClick(e) {
  const milestoneAction = e.target.closest('[data-collection-milestone-action]');
  if (milestoneAction) {
    const action = milestoneAction.dataset.collectionMilestoneAction;
    if (action === 'toggle') {
      collectionMilestonesExpanded = !collectionMilestonesExpanded;
      collectionMilestonesShowAll = false;
      if (collectionMilestonesExpanded) {
        collectionMilestoneFilter =
          (state.collectionMilestoneSummary?.claimableCount ?? 0) > 0
            ? 'claimable'
            : 'in_progress';
      }
      renderCollectionMilestones();
      return;
    }
    if (action === 'filter') {
      collectionMilestoneFilter = milestoneAction.dataset.filter || 'in_progress';
      collectionMilestonesShowAll = false;
      renderCollectionMilestones();
      return;
    }
    if (action === 'show-all') {
      collectionMilestonesShowAll = true;
      renderCollectionMilestones();
      return;
    }
    if (action === 'claim') {
      const milestoneId = milestoneAction.dataset.milestoneId;
      if (!milestoneId || milestoneAction.disabled) return;
      milestoneAction.disabled = true;
      const result = await claimCollectionMilestone(milestoneId, state.allPets || []);
      if (!result.success) {
        showToast(result.error || '收藏里程碑領取失敗', 'warning');
        await onRefresh({ renderMode: ['collection'] });
        return;
      }
      showToast(`已領取「${result.milestone.title}」：星塵 +${result.reward.stardust}`, 'reward', 3200);
      await onRefresh({ renderMode: ['collection', 'tasks'] });
      return;
    }
  }

  const emptyBtn = e.target.closest('[data-action="empty-go-gacha"]');
  if (emptyBtn) {
    switchView('gacha');
    return;
  }

  // 圖鑑寵物圖片 → 原圖 viewer（需擋冒泡，避免同時開詳情）
  const imageBtn = e.target.closest('[data-action="view-pet-image"]');
  if (imageBtn) {
    e.preventDefault();
    e.stopPropagation();
    const petId = imageBtn.dataset.petId || imageBtn.closest('.collection-card')?.dataset.petId;
    if (petId) openPetImageViewer(petId);
    return;
  }

  const detailBtn = e.target.closest('[data-action="view-detail"]');
  if (detailBtn) {
    const card = detailBtn.closest('.collection-card');
    openPetDetailModal(card?.dataset.petId);
    return;
  }

  const setBtn = e.target.closest('[data-action="set-companion"]');
  if (setBtn) {
    const card = setBtn.closest('.collection-card');
    const petId = card?.dataset.petId;
    if (petId) {
      await setCompanion(petId);
      await onRefresh({ renderMode: ['collection', 'tasks'] });
      showToast('已設為陪伴寵物', 'success');
      void recordOnboardingEvent('companion-set', { petId });
    }
    return;
  }
}

export function setCollectionFilter(filter) {
  collectionFilter = filter;
}

export function setCollectionSeriesFilter(filter) {
  collectionSeriesFilter = filter;
}

function renderCollectionProgressSummary() {
  const container = document.getElementById('collection-progress-summary');
  if (!container) return;
  const summary = state.collectionMilestoneSummary;
  const context = summary?.context;
  if (!summary || !context) {
    container.innerHTML = '<p class="collection-summary__empty">收藏進度載入中…</p>';
    return;
  }

  const owned = Math.max(0, context.ownedCount ?? 0);
  const percent = Math.min(100, Math.max(0, summary.completionRate ?? 0));
  const next = summary.nextMilestone;
  const nextText = next
    ? `下一目標：收集 ${next.target} 隻寵物`
    : '下一目標：已完成全部收藏目標';
  const remainingText = next ? `還差 ${Math.max(0, next.target - owned)} 隻` : '完整圖鑑已達成';
  const rarityChips = COLLECTION_RARITY_ORDER.map((rarity) => {
    const rarityOwned = context.rarityOwned?.[rarity] ?? 0;
    const rarityTotal = context.rarityTotals?.[rarity] ?? 0;
    return `<span class="collection-rarity-chip collection-rarity-chip--${rarity.toLowerCase()}">
      <strong>${rarity}</strong> ${rarityOwned}/${rarityTotal}
    </span>`;
  }).join('');

  container.innerHTML = `
    <div class="collection-summary__header">
      <h2 class="collection-summary__title">下一個收藏目標</h2>
    </div>
    <div class="collection-summary__progress" role="progressbar" aria-label="總收藏完成率 ${percent}%" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
      <span class="collection-summary__progress-fill" style="width:${percent}%"></span>
    </div>
    <div class="collection-summary__next">
      <span>${escapeHtml(nextText)}</span>
      <strong>${escapeHtml(remainingText)}</strong>
    </div>
    <div class="collection-summary__rarities" aria-label="各稀有度收藏數">${rarityChips}</div>`;
}

function sortCollectionMilestones(items) {
  const statusRank = { claimable: 0, in_progress: 1, claimed: 2 };
  return [...items].sort((a, b) => {
    const rankDiff = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
    if (rankDiff !== 0) return rankDiff;
    if (a.status === 'in_progress' && b.status === 'in_progress' && a.percent !== b.percent) {
      return b.percent - a.percent;
    }
    return a.order - b.order;
  });
}

function collectionMilestoneCardHtml(item) {
  const statusLabel = item.status === 'claimable'
    ? '可領取'
    : item.status === 'claimed'
      ? '✓ 已完成'
      : '進行中';
  const actionHtml = item.status === 'claimable'
    ? `<button type="button" class="collection-milestone__claim" data-collection-milestone-action="claim" data-milestone-id="${escapeHtml(item.id)}">領取</button>`
    : `<span class="collection-milestone__status collection-milestone__status--${item.status}">${statusLabel}</span>`;
  return `
    <article class="collection-milestone collection-milestone--${item.status}" data-milestone-id="${escapeHtml(item.id)}">
      <span class="collection-milestone__icon" aria-hidden="true">${escapeHtml(item.badge?.icon || '🏅')}</span>
      <div class="collection-milestone__body">
        <h3 class="collection-milestone__title">${escapeHtml(item.title)}</h3>
        <p class="collection-milestone__description">${escapeHtml(item.description)}</p>
        <p class="collection-milestone__progress">${item.progress} / ${item.target}<span>星塵 +${item.reward?.stardust ?? 0}</span></p>
      </div>
      <div class="collection-milestone__action">${actionHtml}</div>
    </article>`;
}

export function renderCollectionMilestones() {
  const panel = document.getElementById('encounter-collection-milestones') || document.getElementById('collection-milestones-panel');
  if (!panel) return;
  const legacyPanel = document.getElementById('collection-milestones-panel');
  if (legacyPanel && legacyPanel !== panel) legacyPanel.replaceChildren();
  const summary = state.collectionMilestoneSummary;
  if (!summary) {
    panel.innerHTML = '<p class="collection-summary__empty">收藏里程碑載入中…</p>';
    return;
  }

  const filterLabels = {
    in_progress: '進行中',
    claimable: '可領取',
    claimed: '已完成',
  };
  const items = sortCollectionMilestones(summary.items || []);
  const filtered = items.filter((item) => item.status === collectionMilestoneFilter);
  const visible = collectionMilestonesShowAll ? filtered : filtered.slice(0, 5);
  const emptyText = collectionMilestoneFilter === 'claimable'
    ? '目前沒有可領取的里程碑'
    : collectionMilestoneFilter === 'claimed'
      ? '目前還沒有已領取的里程碑'
      : '目前沒有進行中的里程碑';
  const filterButtons = Object.entries(filterLabels).map(([filter, label]) => {
    const count = items.filter((item) => item.status === filter).length;
    const selected = filter === collectionMilestoneFilter;
    return `<button type="button" class="collection-milestone-filter${selected ? ' is-active' : ''}" data-collection-milestone-action="filter" data-filter="${filter}" role="tab" aria-selected="${selected}">${label} ${count}</button>`;
  }).join('');

  panel.innerHTML = `
    <div class="reward-claim-header collection-milestones-header">
    <button type="button" class="collection-milestones-toggle" data-collection-milestone-action="toggle" aria-expanded="${collectionMilestonesExpanded}" aria-controls="collection-milestones-content">
      <span class="collection-milestones-toggle__title">收藏里程碑</span>
      <span class="collection-milestones-toggle__meta">完成 ${summary.metCount} / ${summary.total}　可領取 ${summary.claimableCount}</span>
      <span class="collection-milestones-toggle__arrow" aria-hidden="true">⌄</span>
    </button>
    ${claimAllButtonHtml('collection', summary.claimableCount)}
    </div>
    <div id="collection-milestones-content" class="collection-milestones-content" ${collectionMilestonesExpanded ? '' : 'hidden'}>
      <div class="collection-milestone-filters" role="tablist" aria-label="里程碑狀態">${filterButtons}</div>
      <div class="collection-milestone-list">
        ${visible.length
          ? visible.map(collectionMilestoneCardHtml).join('')
          : `<div class="collection-milestone-empty"><strong>${emptyText}</strong><span>繼續抽卡與培養寵物吧</span></div>`}
      </div>
      ${filtered.length > 5 && !collectionMilestonesShowAll
        ? `<button type="button" class="collection-milestones-more" data-collection-milestone-action="show-all">顯示更多（${filtered.length - 5}）</button>`
        : ''}
    </div>`;
}

function getPetSeriesKey(pet) {
  return (typeof pet?.seriesId === 'string' && pet.seriesId.trim()) ? pet.seriesId.trim() : 'legacy';
}

function renderCollectionSeriesFilters() {
  const bar = document.getElementById('collection-series-filters');
  if (!bar) return;

  const seriesList = [...(state.seriesCatalog?.series || [])]
    .filter((s) => s && s.enabled !== false)
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

  const enriched = state.enrichedCollection || [];
  const buttons = [
    { id: 'all', name: '全部系列' },
    ...seriesList.map((s) => ({ id: s.id, name: s.name })),
  ];

  bar.innerHTML = buttons.map((item) => {
    let label = item.name;
    if (item.id !== 'all') {
      const seriesPets = enriched.filter((p) => getPetSeriesKey(p) === item.id);
      const owned = seriesPets.filter((p) => p.owned).length;
      label = `${item.name} ${owned}/${seriesPets.length}`;
    }
    const active = collectionSeriesFilter === item.id ? 'active' : '';
    return `<button type="button" class="filter-btn ${active}" data-series-filter="${escapeHtml(item.id)}">${escapeHtml(label)}</button>`;
  }).join('');
}

export function renderCollectionView() {
  if (renderLocalIdentityView('collection', state, onRefresh, { switchView, openPetDetail: openPetDetailModal, openNickname: openNicknameModal })) { collectionRenderGate.clear(); return; }
  if (renderEncounterView('collection', state, onRefresh, encounterActions())) { collectionRenderGate.clear(); return; }
  renderCollectionProgressSummary();
  renderCollectionMilestones();
  renderCollectionSeriesFilters();

  // 限定 #collection-filters，避免清掉成就／任務分類 filter 的 active
  const filterBtns = document.querySelectorAll('#collection-filters .filter-btn');
  filterBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter === collectionFilter);
  });

  const enriched = state.enrichedCollection || [];
  let filtered = enriched;

  if (collectionSeriesFilter !== 'all') {
    filtered = filtered.filter((p) => getPetSeriesKey(p) === collectionSeriesFilter);
  }

  if (collectionFilter === 'owned') {
    filtered = filtered.filter((p) => p.owned);
  } else if (collectionFilter === 'unowned') {
    filtered = filtered.filter((p) => !p.owned);
  } else if (collectionFilter !== 'all') {
    filtered = filtered.filter((p) => p.rarity === collectionFilter);
  }

  const { owned, total } = state.collectionProgress;
  const rate = total > 0 ? Math.round((owned / total) * 100) : 0;

  setText('collection-count', `${owned}/${total}`);
  setText('collection-rate', `${rate}%`);

  const companionEl = document.getElementById('collection-companion');
  if (companionEl) {
    if (state.companion) {
      companionEl.innerHTML = `
        <img class="qn-collection-art" src="${escapeHtml(getCompanionScene(state.companion, state.userPreferences?.theme))}" alt="" decoding="async">
        <div class="qn-collection-copy">
          <p class="collection-companion__label">與你同行</p>
          <p class="collection-companion__name">${escapeHtml(petDisplayName(state.companion))}</p>
          ${state.companion.nickname ? `<p class="pet-original-name pet-original-name--sm">原名：${escapeHtml(petOriginalName(state.companion))}</p>` : ''}
          <p class="qn-collection-bond">${twilightIcon('heart')}親密度 Lv.${state.companion.bondLevel ?? 1}</p>
        </div>
        <button type="button" class="qn-collection-image" data-action="view-pet-image" data-pet-id="${escapeHtml(state.companion.id)}" aria-label="查看 ${escapeHtml(petDisplayName(state.companion))} 原圖">${twilightIcon('eye')}</button>`;
      companionEl.classList.remove('collection-companion--empty');
    } else {
      companionEl.innerHTML = '<p class="collection-companion--empty">尚未設定陪伴寵物</p>';
    }
  }

  const grid = document.getElementById('collection-grid');
  if (grid) {
    if (owned === 0 && (collectionFilter === 'all' || collectionFilter === 'unowned') && collectionSeriesFilter === 'all') {
      grid.innerHTML = emptyStateHtml(
        '📖',
        '圖鑑還是空的',
        '完成任務獲得星塵後，就可以召喚第一隻夥伴。',
        '前往召喚',
        'empty-go-gacha'
      );
      lastCollectionGridKey = null;
    } else if (filtered.length === 0) {
      grid.innerHTML = emptyStateHtml('🔍', '沒有符合的寵物', '試試其他稀有度、系列或獲得狀態篩選。');
      lastCollectionGridKey = null;
    } else {
      const gridKey = `${collectionSeriesFilter}|${collectionFilter}|${filtered.map((p) => `${p.id}:${p.owned}:${p.isCompanion}:${p.bondLevel || 0}:${p.nickname || ''}`).join(',')}`;
      if (gridKey !== lastCollectionGridKey || !grid.querySelector('.collection-card')) {
        let ownedEagerCount = 0;
        grid.innerHTML = filtered
          .map((pet) => {
            const eager = pet.owned && ownedEagerCount < 12;
            if (eager) ownedEagerCount += 1;
            return renderCollectionCard(pet, { eager });
          })
          .join('');
        lastCollectionGridKey = gridKey;
        preloadOwnedPetImages(filtered.filter((p) => p.owned), [], 12).catch(() => {});
      }
    }
  }
  collectionRenderGate.clear();
}

function renderCollectionCard(pet, imageOptions = {}) {
  const { eager = false } = imageOptions;
  const owned = pet.owned;
  const rarityClass = `rarity-${pet.rarity}`;
  const imgOpts = owned
    ? { size: 'md', loading: eager ? 'eager' : 'lazy', eager }
    : { size: 'md', preview: true, loading: 'lazy' };
  const liberated = owned && (pet.bondLevel ?? 0) >= 5;
  const bondBadge = bondBadgeHtml(pet);
  // 已獲得：圖片獨立 button 開原圖；資訊區獨立 button 開詳情（避免巢狀 button）
  const imageBlock = owned
    ? `<button type="button" class="collection-card__image-btn" data-action="view-pet-image" data-pet-id="${pet.id}" aria-label="查看 ${escapeHtml(petDisplayName(pet))} 原圖">
         <div class="collection-card__image">
           ${petImageHtml(pet, imgOpts)}
           ${bondBadge ? `<div class="collection-card__bond-badge">${bondBadge}</div>` : ''}
         </div>
       </button>`
    : `<div class="collection-card__image">
         ${petImageHtml(pet, imgOpts)}
       </div>`;
  return `
    <article class="collection-card ${owned ? '' : 'collection-card--locked'} ${rarityClass} ${liberated ? 'is-bond-liberated' : ''}" data-pet-id="${pet.id}">
      ${owned ? imageBlock : ''}
      <button type="button" class="collection-card__tap" data-action="view-detail" aria-label="查看詳情">
        ${owned ? '' : imageBlock}
        <div class="collection-card__info">
          ${petNameBlockHtml(pet, { owned, heading: 'h3', className: 'collection-card__name' })}
          ${owned && pet.title ? `<p class="collection-card__title">${escapeHtml(pet.title)}</p>` : ''}
          <span class="badge badge--rarity ${rarityClass}">${pet.rarity}</span>
          ${
            owned
              ? `<div class="collection-card__meta"><span class="fragments">親密度 Lv.${pet.bondLevel || 1}</span></div>`
              : '<span class="locked-label">未獲得 · 點擊預覽</span>'
          }
        </div>
      </button>
      ${owned ? '<div class="collection-card__actions">' : ''}
      ${
        owned && !pet.isCompanion
          ? `<button type="button" class="btn btn--sm btn--companion" data-action="set-companion">設為陪伴</button>`
          : owned ? '<span class="collection-card__state">陪伴中</span>' : ''
      }

      ${owned ? '</div>' : ''}
    </article>`;
}

/** 圖鑑詳情彈窗 */
export function openPetDetailModal(petId) {
  const pet = state.enrichedCollection.find((p) => p.id === petId);
  if (!pet) return;

  const owned = pet.owned;
  const rarityClass = `rarity-${pet.rarity}`;
  const bondLevel = pet.bondLevel ?? 0;
  const bondLiberated = owned && bondLevel >= 5;

  let bondStatusSection = '';
  if (owned) {
    const st = pet.bondUnlockState || {};
    const unlockedItems = getBondUnlocksByLevel(bondLevel)
      .filter((k) => BOND_UNLOCK_ITEM_LABELS[k])
      .map((k) => BOND_UNLOCK_ITEM_LABELS[k]);
    const unlockedHtml = unlockedItems.length
      ? unlockedItems.map((t) => `<span class="bond-status-card__chip">${escapeHtml(t)}</span>`).join('')
      : '<span class="bond-status-card__chip bond-status-card__chip--none">尚未解鎖羈絆內容</span>';
    const nextHint = BOND_NEXT_UNLOCK[Math.min(Math.max(bondLevel, 1), 5)];
    const liberatedLabel = st.bondLiberated
      ? '<span class="bond-liberated-label">羈絆解放</span>'
      : '';
    const storyHtml = renderBondDetail(pet, state);
    bondStatusSection = `
      <section class="bond-section">
        <div class="bond-section__title-row">
          <h3 class="bond-section__title">羈絆狀態</h3>
          ${liberatedLabel}
        </div>
        <div class="bond-status-card ${st.bondLiberated ? 'is-unlocked' : 'is-locked'}">
          <p class="bond-status-card__level">目前親密度 Lv.${bondLevel || 1}</p>
          <div class="bond-status-card__chips">${unlockedHtml}</div>
          <p class="bond-status-card__next">${escapeHtml(nextHint)}</p>
        </div>
        <h3 class="bond-section__title bond-section__title--story">羈絆故事</h3>
        ${storyHtml}
      </section>`;
  }

  let bondSection = '';
  if (owned && pet.bondUnlocks && Object.keys(pet.bondUnlocks).length > 0) {
    const levels = [2, 3, 4, 5];
    bondSection = `
      <section class="pet-detail__bond">
        <h3 class="pet-detail__subtitle">親密度解鎖</h3>
        <ul class="bond-unlock-list">
          ${levels
            .map((lv) => {
              const text = getBondUnlockText(pet, lv);
              if (!text) return '';
              const unlocked = bondLevel >= lv;
              return `<li class="bond-unlock ${unlocked ? 'bond-unlock--open' : ''}">
                <span class="bond-unlock__lv">Lv.${lv}</span>
                <span class="bond-unlock__text">${unlocked ? escapeHtml(text) : '???'}</span>
              </li>`;
            })
            .join('')}
        </ul>
      </section>`;
  }

  const personalityTags =
    pet.personality?.length > 0
      ? pet.personality.map((p) => `<span class="tag">${escapeHtml(p)}</span>`).join('')
      : '';

  const nicknameSection = owned
    ? `
      <section class="pet-detail__nickname card">
        <h3 class="pet-detail__subtitle">暱稱</h3>
        ${
          pet.nickname
            ? `<p class="pet-detail__display-name">${escapeHtml(petDisplayName(pet))}</p>
               <p class="pet-original-name">原名：${escapeHtml(petOriginalName(pet))}</p>`
            : `<p class="pet-detail__display-name">${escapeHtml(petOriginalName(pet))}</p>
               <p class="pet-detail__nickname-empty">尚未設定暱稱</p>`
        }
        <div class="pet-detail__nickname-actions">
          <button type="button" class="btn btn--secondary btn--sm" data-action="edit-nickname" data-pet-id="${pet.id}">${pet.nickname ? '修改暱稱' : '設定暱稱'}</button>
          ${pet.nickname ? `<button type="button" class="btn btn--ghost btn--sm" data-action="clear-nickname" data-pet-id="${pet.id}">清除暱稱</button>` : ''}
        </div>
      </section>`
    : '';

  openModal(`
    <div class="pet-detail pet-detail-card ${rarityClass} ${bondLiberated ? 'is-bond-liberated' : ''}">
      <div class="pet-detail__hero">
        ${owned
          ? `<button type="button" class="pet-detail-image-button" data-action="detail-view-image" data-pet-id="${pet.id}" aria-label="查看 ${escapeHtml(petDisplayName(pet))} 原圖">
               ${petImageHtml(pet, { size: 'lg', loading: 'eager', eager: true })}
             </button>`
          : petImageHtml(pet, { size: 'lg', preview: true, loading: 'lazy' })}
      </div>
      ${owned ? '<p class="pet-detail__image-hint">點擊圖片查看原圖</p>' : ''}
      <h2 class="pet-detail__name">${owned ? escapeHtml(petDisplayName(pet)) : '???'}</h2>
      ${owned && pet.nickname ? `<p class="pet-original-name pet-original-name--center">原名：${escapeHtml(petOriginalName(pet))}</p>` : ''}
      ${owned && pet.title ? `<p class="pet-detail__title">${escapeHtml(pet.title)}</p>` : ''}
      <div class="pet-detail__badges">
        <span class="badge badge--rarity ${rarityClass}">${pet.rarity}</span>
        ${pet.element ? `<span class="badge badge--element">${escapeHtml(pet.element)}</span>` : ''}
      </div>
      ${personalityTags ? `<div class="pet-detail__tags">${personalityTags}</div>` : ''}
      ${owned ? intimacySummary(bondLevel || 1, getPetSpecialty(pet), pet.legacySpecialtyFloor) : ''}
      ${owned ? `<p class="pet-detail__specialty">探險專長：${escapeHtml(getPetSpecialty(pet).label)} Lv.${getPetSpecialty(pet).level}。親密度與日常同行逐步培養專長；不同稀有度都能在合適隊伍中派上用場。</p>` : ''}
      ${owned ? `<p class="pet-detail__gift-affinity">禮物喜好：${escapeHtml(getGiftAffinityTags(pet).map((tag) => GIFT_TAG_LABELS[tag]).join('、') || '通用禮物；目前沒有主題喜好')}</p>` : ''}
      ${owned ? `<p class="pet-detail__bond-lv">親密度 Lv.${bondLevel || 1}</p>` : ''}
      ${owned ? `<button type="button" class="btn btn--primary btn--block pet-detail__feed-button" data-action="detail-feed-pet" data-pet-id="${escapeHtml(pet.id)}">餵食</button>` : ''}
      <p class="pet-detail__desc">${escapeHtml(pet.description)}</p>
      ${owned && pet.lore ? `<p class="pet-detail__lore">${escapeHtml(pet.lore)}</p>` : ''}
      ${!owned ? '<p class="pet-detail__locked">召喚解鎖後，可閱讀完整背景與親密度故事。</p>' : ''}
      ${bondStatusSection}
      ${renderAwakeningDetail(pet, state)}
      ${bondSection}
      ${nicknameSection}
      ${
        owned && !pet.isCompanion
          ? `<button class="btn btn--companion btn--block" data-action="set-companion-detail" data-pet-id="${pet.id}">設為陪伴</button>`
          : ''
      }
      ${owned && pet.isCompanion ? '<p class="companion-badge companion-badge--detail">目前陪伴中</p>' : ''}
    </div>
  `);
  if (owned) void recordOnboardingEvent('pet-care-opened');

  // 詳情主圖：在詳情之上疊開原圖 viewer，關閉後焦點回到這顆按鈕
  document.querySelector('[data-action="detail-view-image"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const button = e.currentTarget;
    openPetImageViewer(button.dataset.petId, button);
  });

  document.querySelector('[data-action="detail-feed-pet"]')?.addEventListener('click', () => {
    openPetFeedModal(pet);
  });

  document.querySelector('[data-action="set-companion-detail"]')?.addEventListener('click', trackUpdateActivity(async (e) => {
    const id = e.target.dataset.petId;
    if (id) {
      await setCompanion(id);
      closeModal();
      await onRefresh({ renderMode: ['collection', 'tasks'] });
      showToast('已設為陪伴寵物', 'success');
      void recordOnboardingEvent('companion-set', { petId: id });
    }
  }));

  document.querySelector('[data-action="edit-nickname"]')?.addEventListener('click', (e) => {
    const id = e.target.dataset.petId;
    if (id) openNicknameModal(id);
  });

  document.querySelector('[data-action="clear-nickname"]')?.addEventListener('click', trackUpdateActivity(async (e) => {
    const id = e.target.dataset.petId;
    if (!id) return;
    const result = await clearPetNickname(id);
    if (!result.success) {
      showToast(result.message || '暱稱儲存失敗，請稍後再試。', 'error');
      return;
    }
    closeModal();
    await onRefresh({ renderMode: ['collection'] });
    openPetDetailModal(id);
    showToast('暱稱已清除', 'success');
  }));
}

/* ─── 探險頁 ─── */
