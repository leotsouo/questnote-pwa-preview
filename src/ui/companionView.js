/**
 * Home companion card: petting, comfort effects, the feed modal, bond display and the
 * idle dialogue bubble with its timer. Bond and feeding writes go through collectionService.
 */
import {
  canPetCompanion,
  getPetCooldownRemaining,
  formatCooldown,
  petCompanion,
  getBondProgress,
} from '../collectionService.js';
import { IDLE_THRESHOLD_MS, getCompanionDialogue, randomBubbleInterval } from '../companionDialogueService.js';
import { getBondUpLine } from '../companionService.js';
import { warmPetImageCache, getPetImageSrc } from '../imagePreloadService.js';
import { recordOnboardingEvent } from '../onboardingController.js';
import { getTodayDateString } from '../taskFilterService.js';
import { reactTwilightCompanion, setTwilightCompanionLine } from '../twilightPresentation.js';
import { escapeHtml, emptyStateHtml } from '../uiHelpers.js';
import { trackUpdateActivity } from '../updateActivity.js';
import {
  getItemInventory,
  getDailyBondItemUsage,
  DAILY_BOND_ITEM_LIMIT,
  getFavoriteBonus,
  useBondItem,
  hasCraftableMaterials,
  hasBondItemsInInventory,
  companionLikesAnyGift,
  hasLowMaterials,
} from '../workshopService.js';
import { handleAchievementCheckAfterAction } from './achievementsView.js';
import { trackQuest } from './dailyBlessingView.js';

// Bound from src/ui.js by connectCompanionView() so this module never imports ui.js back.
let bondBadgeHtml, closeModal, isModalOpen, isTasksViewCurrent, notifyBondUnlocks, onRefresh, openModal, openPetImageViewer, openTeachingTarget, petDisplayName, petImageHtml, petOriginalNameHtml, showBondLevelUpToast, showToast, state;

export function connectCompanionView(deps) {
  ({ bondBadgeHtml, closeModal, isModalOpen, isTasksViewCurrent, notifyBondUnlocks, onRefresh, openModal, openPetImageViewer, openTeachingTarget, petDisplayName, petImageHtml, petOriginalNameHtml, showBondLevelUpToast, showToast, state } = deps);
}

let companionDialogueTimer = null;
let lastCompanionId = null;
let lastCompanionBondLevel = null;
let lastUserActivity = Date.now();
/** 渲染陪伴寵物區塊 */
function renderCompanionPetButton(companion) {
  const canPet = canPetCompanion(companion);
  const remaining = getPetCooldownRemaining(companion);
  const btnLabel = canPet ? '撫摸' : (remaining > 0 ? `還要 ${formatCooldown(remaining)}` : '冷卻中');
  const cooldownHint = canPet
    ? ''
    : `<p class="companion-card__cooldown">撫摸冷卻中，${escapeHtml(formatCooldown(remaining))}後可再次撫摸</p>`;

  return `
    <div class="companion-card__pet-row">
      <div class="companion-card__actions">
        <button type="button" class="btn btn--secondary btn--sm companion-pet-btn" data-action="companion-pet" ${canPet ? '' : 'disabled'}>${escapeHtml(btnLabel)}</button>
        <button type="button" class="btn btn--secondary btn--sm companion-feed-btn" data-action="companion-feed" aria-label="餵食 ${escapeHtml(petDisplayName(companion))}">餵食</button>
      </div>
      ${cooldownHint}
    </div>`;
}

const PET_COMFORT_LINES = {
  N: ['牠開心地蹭了蹭你的手。', '牠看起來精神變好了。'],
  R: ['牠開心地蹭了蹭你的手。', '牠看起來精神變好了。'],
  SR: ['牠安靜地靠近你，似乎更信任你了。', '牠接受了你的撫摸。'],
  SSR: ['牠微微低下頭，默許了你的靠近。', '牠的氣息變得溫和了一些。'],
  UR: ['牠短暫收起威壓，接受了你的觸碰。', '星光在牠身旁輕輕流動。'],
};

function getPetComfortLine(companion) {
  const pool = PET_COMFORT_LINES[companion?.rarity] || PET_COMFORT_LINES.N;
  return pool[Math.floor(Math.random() * pool.length)];
}

function playHomeCompanionPetEffect() {
  reactTwilightCompanion();
  const card = document.querySelector('.companion-card');
  const img = document.querySelector('.companion-card__image');
  triggerComfortVibration();
  if (!state?.userPreferences?.reduceMotion) {
    card?.classList.add('companion-card--bounce', 'companion-card--pet-glow');
    img?.classList.add('companion-img--bounce');
    setTimeout(() => {
      card?.classList.remove('companion-card--bounce', 'companion-card--pet-glow');
      img?.classList.remove('companion-img--bounce');
    }, 650);
  }
}

export async function handleCompanionPet() {
  if (!state?.companion) {
    showToast('尚未設定陪伴寵物。', 'warning');
    return;
  }

  try {
    const result = await petCompanion();
    if (!result.success) {
      showToast(result.message, 'warning', 3500);
      await onRefresh();
      return;
    }

    playHomeCompanionPetEffect();
    void recordOnboardingEvent('companion-petted', { petId: state.companion.id });
    showToast('你輕輕摸了摸牠，親密度 +5', 'success', 2800);
    if (result.leveledUp) {
      setTimeout(() => {
        const bondLine = getBondUpLine(state.companion);
        showBondLevelUpToast(result.newLevel, bondLine);
      }, 400);
    }

    await trackQuest('pet_companion');
    await onRefresh();
    if (result.leveledUp) {
      await notifyBondUnlocks(state.companion?.id);
    }
    const comfortLine = getPetComfortLine(state.companion);
    setCompanionBubbleText(comfortLine, true);
  } catch (err) {
    showToast(err.message || '撫摸失敗', 'error');
  }
}

/** 渲染陪伴寵物區塊 */
export function renderCompanionSection(companion, defaultLine) {
  const section = document.getElementById('companion-section');
  if (!section) return;

  if (!companion) {
    lastCompanionId = null;
    lastCompanionBondLevel = null;
    stopCompanionDialogueTimer();
    section.innerHTML = emptyStateHtml(
      '🐾',
      '尚未選擇陪伴寵物',
      '去圖鑑選一隻夥伴，讓牠陪你完成任務。',
      '前往圖鑑',
      'empty-go-collection'
    );
    return;
  }

  const sameCompanion =
    lastCompanionId === companion.id &&
    lastCompanionBondLevel === (companion.bondLevel ?? 1) &&
    section.querySelector('.companion-card');
  lastCompanionId = companion.id;
  lastCompanionBondLevel = companion.bondLevel ?? 1;

  if (sameCompanion) {
    updateCompanionBondDisplay(companion);
    updateCompanionImageIfNeeded(companion);
    return;
  }

  warmPetImageCache(getPetImageSrc(companion, 'stage')).catch(() => {});

  const progress = getBondProgress(companion.bondExp ?? 0, companion.bondLevel ?? 1);
  const rarityClass = escapeHtml(`rarity-${companion.rarity}`);
  const equippedTitle = state.achievementSummary?.equippedTitle;
  const titleHtml = equippedTitle
    ? `<p class="companion-card__player-title">稱號：${escapeHtml(equippedTitle.name)}</p>`
    : '';
  const petBtnHtml = renderCompanionPetButton(companion);

  const bondState = companion.bondUnlockState || {};
  const bondCardClasses = [
    bondState.homeEffectLv4 ? 'has-bond-effect' : '',
    bondState.bondLiberated ? 'is-bond-liberated' : '',
  ].filter(Boolean).join(' ');
  const bondEffectHtml = bondState.homeEffectLv4
    ? '<div class="companion-bond-effect is-active" aria-hidden="true"></div>'
    : '';
  const bondBadge = bondBadgeHtml(companion);

  section.innerHTML = `
    <div class="companion-wrap">
      <div class="companion-bubble companion-bubble--visible" id="companion-bubble" aria-live="polite">
        <p class="companion-bubble__text" id="companion-bubble-text">${escapeHtml(defaultLine)}</p>
      </div>
      <article class="companion-card card ${rarityClass} companion-card--breathe ${bondCardClasses}" data-pet-id="${escapeHtml(companion.id)}">
        <div class="companion-card__glow"></div>
        ${bondEffectHtml}
        ${bondBadge ? `<div class="companion-card__bond-badge">${bondBadge}</div>` : ''}
        <button type="button" class="companion-card__image companion-pet-image-button" data-action="companion-view-image" data-pet-id="${escapeHtml(companion.id)}" aria-label="查看 ${escapeHtml(petDisplayName(companion))} 原圖">
          ${petImageHtml(companion, { size: 'lg', loading: 'eager', eager: true, framed: true })}
        </button>
        <div class="companion-card__body">
          <button type="button" class="companion-card__detail-button" data-action="companion-view-detail" data-pet-id="${escapeHtml(companion.id)}" aria-label="查看陪伴寵物詳情">
            <div class="companion-card__header">
              <div class="companion-card__name-wrap">
                <span class="companion-card__name">${escapeHtml(petDisplayName(companion))}</span>
                ${petOriginalNameHtml(companion)}
              </div>
              <span class="badge badge--rarity ${rarityClass}">${escapeHtml(companion.rarity)}</span>
            </div>
            ${titleHtml}
            <span class="companion-bond-label">親密度 Lv.${companion.bondLevel || 1}</span>
            <div class="companion-bond">
              <div class="companion-bond__label">
                <span>親密度 Lv.${companion.bondLevel ?? 1}</span>
                <span>${progress.current}/${progress.max || 'MAX'}</span>
              </div>
              <div class="progress-bar progress-bar--bond">
                <div class="progress-bar__fill" style="width:${progress.percent}%"></div>
              </div>
            </div>
            <p class="companion-card__detail-hint">查看詳情</p>
          </button>
          ${petBtnHtml}
          <p class="companion-card__hint">點資訊區看詳情 · 點圖片可看原圖</p>
        </div>
      </article>
    </div>`;

  startCompanionDialogueTimer();
}

/** 輕柔震動（撫摸 / 餵食成功） */
function triggerComfortVibration() {
  if (state?.userPreferences?.reduceMotion) return;
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate([12, 40, 18]);
    } catch {
      /* 部分瀏覽器不支援 */
    }
  }
}

/** 在預覽區跳出愛心 */
function spawnCompanionHearts(container, count = 4) {
  if (!container || state?.userPreferences?.reduceMotion) return;
  const symbols = ['💜', '💗', '❤️', '✨'];
  for (let i = 0; i < count; i += 1) {
    const heart = document.createElement('span');
    heart.className = 'companion-heart-float';
    heart.textContent = symbols[i % symbols.length];
    heart.style.left = `${28 + Math.random() * 44}%`;
    heart.style.animationDelay = `${i * 0.1}s`;
    heart.setAttribute('aria-hidden', 'true');
    container.appendChild(heart);
    setTimeout(() => heart.remove(), 1400);
  }
}

/** 撫摸 / 餵食成功的視覺回饋 */
function playCompanionComfortEffect() {
  const heartsEl = document.getElementById('companion-preview-hearts');
  const frame = document.querySelector('.companion-image-preview__frame');
  triggerComfortVibration();
  spawnCompanionHearts(heartsEl);
  if (frame && !state?.userPreferences?.reduceMotion) {
    frame.classList.add('companion-image-preview__frame--comfort');
    setTimeout(() => frame.classList.remove('companion-image-preview__frame--comfort'), 650);
  }
}

function buildPetFeedSection(companion) {
  const inventory = state.inventory || { items: {} };
  const itemCounts = getItemInventory(inventory);
  const bondItems = (state.craftablesCatalog || []).filter(
    (c) =>
      (c.type === 'bond_item' || c.type === 'favorite_bond_item') &&
      (itemCounts[c.id] || 0) > 0
  );
  const today = getTodayDateString();
  const dailyUsed = getDailyBondItemUsage(companion.id, today, inventory);
  const atLimit = dailyUsed >= DAILY_BOND_ITEM_LIMIT;
  const progress = getBondProgress(companion.bondExp ?? 0, companion.bondLevel ?? 1);

  if (bondItems.length === 0) {
    return `
      <section class="companion-preview-feed card">
        <h3 class="companion-preview-feed__title">餵食</h3>
        <p class="companion-preview-feed__empty">目前沒有親密度道具。<br>可到「更多 → 工坊」用探險材料製作。</p>
        <button type="button" class="btn btn--secondary btn--block companion-preview-feed__workshop" id="companion-feed-workshop-btn">前往工坊製作</button>
      </section>
      <p class="companion-preview-bond">親密度 Lv.${companion.bondLevel ?? 1} · ${progress.current}/${progress.max || 'MAX'}</p>`;
  }

  const options = bondItems
    .map((item) => {
      const stock = itemCounts[item.id] || 0;
      const bonus = getFavoriteBonus(item, companion);
      const favMark = ` · +${bonus.bondExp} · ${bonus.reason}`;
      return `<option value="${item.id}">${escapeHtml(item.name)} ×${stock}${favMark}</option>`;
    })
    .join('');

  return `
    <section class="companion-preview-feed card">
      <h3 class="companion-preview-feed__title">餵食</h3>
      <p class="companion-preview-feed__daily">今日已餵 ${dailyUsed} / ${DAILY_BOND_ITEM_LIMIT}</p>
      <label class="companion-preview-feed__picker">
        <span class="companion-preview-feed__label">工坊食物</span>
        <select id="companion-feed-select" class="companion-preview-feed__select">${options}</select>
      </label>
      <button type="button" class="btn btn--primary btn--block" id="companion-feed-btn" ${atLimit ? 'disabled' : ''}>餵食</button>
      ${atLimit ? '<p class="companion-preview-feed__limit">今天這隻寵物已經收到足夠多禮物了，明天再來吧。</p>' : ''}
    </section>
    <p class="companion-preview-bond">親密度 Lv.${companion.bondLevel ?? 1} · ${progress.current}/${progress.max || 'MAX'}</p>`;
}

function bindPetFeedInteractions(companion) {
  const stage = document.getElementById('companion-preview-stage');
  const img = stage?.querySelector('.companion-image-preview__img--interactive');
  const feedBtn = document.getElementById('companion-feed-btn');

  // 點圖片仍可查看原圖，不會誤觸消耗道具。
  img?.addEventListener('click', (e) => {
    e.stopPropagation();
    openPetImageViewer(companion.id);
  });

  document.getElementById('companion-feed-workshop-btn')?.addEventListener('click', () => {
    closeModal();
    void openTeachingTarget({ view: 'workshop', tab: 'craft' });
  });

  feedBtn?.addEventListener('click', trackUpdateActivity(async (e) => {
    e.stopPropagation();
    if (feedBtn.disabled) return;
    const select = document.getElementById('companion-feed-select');
    const itemId = select?.value;
    if (!itemId) {
      showToast('請先選擇要餵食的食物', 'warning');
      return;
    }
    feedBtn.disabled = true;
    let consumed = false;
    try {
      const result = await useBondItem(itemId, companion.id, state.allPets);
      if (!result.success) {
        showToast(result.message, 'warning');
        feedBtn.disabled = false;
        return;
      }
      consumed = true;
      void recordOnboardingEvent('gift-given', { petId: companion.id, itemId });
      await trackQuest('gift_pet');
      closeModal();
      await onRefresh({ renderMode: ['tasks', 'collection', 'workshop'] });
      const updated = state.enrichedCollection.find((pet) => pet.id === companion.id);
      if (updated) {
        openPetFeedModal(updated);
        playCompanionComfortEffect();
      }
      if (result.isFavorite) {
        showToast(`牠很喜歡這份禮物！親密度 +${result.bondExp}`, 'success', 3200);
      } else {
        showToast(`親密度提升 +${result.bondExp}`, 'success');
      }
      if (result.leveledUp) {
        setTimeout(() => showToast(`親密度提升到 Lv.${result.newLevel}`, 'success', 2800), 400);
        await notifyBondUnlocks(companion.id);
      }
      await handleAchievementCheckAfterAction();
    } catch (err) {
      closeModal();
      console.warn('[QuestNote] 餵食後處理失敗:', err);
      showToast(consumed
        ? '餵食已完成，畫面暫時無法更新，請重新開啟 App'
        : '餵食狀態無法確認，請重新開啟 App 檢查庫存', 'warning', 4000);
    }
  }));
}

export function openPetFeedModal(companion) {
  if (!companion?.id || companion.owned === false) return;

  const src = getPetImageSrc(companion);
  if (src) warmPetImageCache(src).catch(() => {});

  const rarityClass = `rarity-${companion.rarity}`;
  const onError = `if(this.dataset.fallbackSrc&&this.src!==new globalThis.URL(this.dataset.fallbackSrc,location.href).href){this.src=this.dataset.fallbackSrc;return;}this.onerror=null;this.classList.add('companion-image-preview__img--error')`;
  const onload = "this.classList.add('is-loaded');this.closest('.pet-image-frame')?.classList.remove('is-loading')";
  const feedSection = buildPetFeedSection(companion);
  const imageHtml = src
    ? `<div class="companion-image-preview__frame pet-image-frame pet-image-frame--lg is-loading">
          <img
            class="companion-image-preview__img companion-image-preview__img--interactive is-loading"
            src="${escapeHtml(src)}"
            data-fallback-src="${escapeHtml(companion.fallbackImage || '')}"
            alt="${escapeHtml(petDisplayName(companion))}"
            loading="eager"
            decoding="async"
            onload="${onload}"
            onerror="${onError}"
          />
          <span class="pet-image-frame__fallback" aria-hidden="true">圖片載入中</span>
        </div>`
    : '<div class="companion-image-preview__frame pet-image-frame pet-image-frame--lg is-error" role="img" aria-label="圖片暫時無法載入"><span class="pet-image-frame__fallback">圖片暫時無法載入</span></div>';

  openModal(`
    <div class="companion-image-preview companion-image-preview--feed ${rarityClass}">
      <div class="companion-image-preview__stage" id="companion-preview-stage">
        <div class="companion-preview-hearts" id="companion-preview-hearts" aria-hidden="true"></div>
        ${imageHtml}
      </div>
      <h2 class="companion-image-preview__name">${escapeHtml(petDisplayName(companion))}</h2>
      ${petOriginalNameHtml(companion)}
      <div class="companion-image-preview__meta">
        <span class="badge badge--rarity ${rarityClass}">${companion.rarity}</span>
        <span class="companion-bond-label">親密度 Lv.${companion.bondLevel || 1}</span>
      </div>
      ${feedSection}
      <p class="companion-image-preview__hint">點圖片可看原圖 · 餵食會消耗一份工坊道具</p>
    </div>
  `);

  bindPetFeedInteractions(companion);
}

/** 陪伴寵物未變時只更新圖片 src（避免整卡重建） */
function updateCompanionImageIfNeeded(companion) {
  const img = document.querySelector('.companion-card__image img');
  const src = getPetImageSrc(companion, 'stage');
  if (!img || !src) return;

  const currentSrc = img.getAttribute('src') || '';
  if (currentSrc === src) return;

  const frame = img.closest('.pet-image-frame');
  frame?.classList.add('is-loading');
  frame?.classList.remove('is-error');
  img.classList.remove('is-loaded', 'is-error');
  img.classList.add('is-loading');
  img.setAttribute('src', src);
  warmPetImageCache(src).catch(() => {});
}

function updateCompanionBondDisplay(companion) {
  const progress = getBondProgress(companion.bondExp ?? 0, companion.bondLevel ?? 1);
  const labels = document.querySelector('.companion-bond__label');
  if (labels) {
    const spans = labels.querySelectorAll('span');
    if (spans[0]) spans[0].textContent = `親密度 Lv.${companion.bondLevel ?? 1}`;
    if (spans[1]) spans[1].textContent = `${progress.current}/${progress.max || 'MAX'}`;
  }
  const fill = document.querySelector('.companion-bond .progress-bar__fill');
  if (fill) fill.style.width = `${progress.percent}%`;

  const petRow = document.querySelector('.companion-card__pet-row');
  if (petRow) {
    const canPet = canPetCompanion(companion);
    const remaining = getPetCooldownRemaining(companion);
    const btnLabel = canPet ? '撫摸' : (remaining > 0 ? `還要 ${formatCooldown(remaining)}` : '冷卻中');
    const btn = petRow.querySelector('.companion-pet-btn');
    if (btn) {
      btn.textContent = btnLabel;
      btn.disabled = !canPet;
    }
    let cooldownEl = petRow.querySelector('.companion-card__cooldown');
    if (!canPet) {
      const hint = `撫摸冷卻中，${formatCooldown(remaining)}後可再次撫摸`;
      if (cooldownEl) {
        cooldownEl.textContent = hint;
      } else {
        cooldownEl = document.createElement('p');
        cooldownEl.className = 'companion-card__cooldown';
        cooldownEl.textContent = hint;
        petRow.appendChild(cooldownEl);
      }
    } else if (cooldownEl) {
      cooldownEl.remove();
    }
  }
}

function buildDialogueContext(overrides = {}) {
  const isIdle = Date.now() - lastUserActivity >= IDLE_THRESHOLD_MS;
  return {
    tasks: state.tasks,
    todayCompleted: state.todayCompleted,
    companion: state.companion,
    wallet: state.wallet,
    activeExpedition: state.activeExpedition,
    expeditionAreas: state.expeditionAreas,
    habits: state.habits || [],
    inventory: state.inventory,
    dailyCheckIn: state.dailyCheckIn,
    craftables: state.craftablesCatalog || [],
    workshopHelpers: {
      hasCraftableMaterials,
      hasBondItemsInInventory,
      companionLikesAnyGift,
      hasLowMaterials,
    },
    isIdle,
    ...overrides,
  };
}
function setCompanionBubbleText(text, animate = true) {
  setTwilightCompanionLine(text);
  const bubbleText = document.getElementById('companion-bubble-text');
  if (!bubbleText) return;

  if (!animate) {
    bubbleText.textContent = text;
    return;
  }

  bubbleText.classList.add('companion-bubble__text--changing');
  setTimeout(() => {
    bubbleText.textContent = text;
    bubbleText.classList.remove('companion-bubble__text--changing');
    bubbleText.classList.add('companion-bubble__text--show');
    setTimeout(() => bubbleText.classList.remove('companion-bubble__text--show'), 350);
  }, 180);
}

export function refreshCompanionBubble(overrides = {}) {
  if (!state?.companion) return;
  const line = getCompanionDialogue(buildDialogueContext(overrides));
  setCompanionBubbleText(line, !overrides.isWelcome);
}

function showCompanionDialogue() {
  const card = document.querySelector('.companion-card');
  const img = document.querySelector('.companion-card__image');
  if (!state.companion) return;

  trackUserActivity();
  refreshCompanionBubble();
  card?.classList.add('companion-card--bounce');
  img?.classList.add('companion-img--bounce');
  setTimeout(() => {
    card?.classList.remove('companion-card--bounce');
    img?.classList.remove('companion-img--bounce');
  }, 500);
  scheduleCompanionDialogueTimer();
}

function scheduleCompanionDialogueTimer() {
  stopCompanionDialogueTimer();
  if (!state?.companion || !isTasksViewCurrent()) return;

  companionDialogueTimer = setTimeout(() => {
    if (!isModalOpen() && state?.companion && isTasksViewCurrent()) {
      refreshCompanionBubble();
    }
    scheduleCompanionDialogueTimer();
  }, randomBubbleInterval());
}

export function startCompanionDialogueTimer() {
  if (state?.companion && isTasksViewCurrent()) {
    scheduleCompanionDialogueTimer();
  }
}

export function stopCompanionDialogueTimer() {
  if (companionDialogueTimer) {
    clearTimeout(companionDialogueTimer);
    companionDialogueTimer = null;
  }
}

export function bindActivityTracking() {
  const track = () => trackUserActivity();
  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach((evt) => {
    document.addEventListener(evt, track, { passive: true });
  });
}

export function trackUserActivity() {
  lastUserActivity = Date.now();
}
