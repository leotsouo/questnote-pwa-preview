/**
 * Gacha (summon) view: pool switcher, themed stage, single and ten pulls, reveal and
 * result presentation, pool debut and awakening playback. Draws are atomic in gachaService;
 * this module owns only the pull lock and the presentation session state.
 */
import { isAuthorLocalDevMode } from '../devService.js';
import { playCeremonyEntry } from '../encounterCeremony.js';
import { renderEncounterView, presentCommittedEncounters } from '../encounterView.js';
import {
  setSelectedPoolId,
  ensurePoolPity,
  getPoolPityCounters,
  pullOnce,
  performTenPull,
} from '../gachaService.js';
import {
  getPetImageSrc,
  preloadImage,
  preloadGachaResultImages,
  waitForPreloadWithTimeout,
} from '../imagePreloadService.js';
import { renderLocalIdentityView, LOCAL_ART_PREVIEW } from '../localArtPreview.js';
import { recordOnboardingEvent } from '../onboardingController.js';
import { getPoolAwakeningProfile } from '../petAwakeningProfiles.js';
import { renderAwakeningGuide, initialAwakeningPortrait } from '../petAwakeningView.js';
import { isPoolAwakeningPlaying, playPoolUnlock } from '../poolAwakeningController.js';
import {
  resolveActivePool,
  validatePoolContent,
  resolveDrawCost,
  normalizeUnlockExpansion,
  resolvePoolPresentationModel,
} from '../poolContentContract.js';
import { hasSeenPoolDebut, markPoolDebutSeen } from '../poolDebutService.js';
import { normalizePoolPresentation, shouldUseThemedSummon } from '../poolPresentation.js';
import {
  emptyPoolUnlockEntry,
  ensureUnlockRewardClaimed,
  getPoolUnlockEntry,
  markUnlockAnimationSeen,
  ensurePoolUnlockLegacyBackfillMarked,
} from '../poolUnlockService.js';
import { normalizeTheme } from '../preferencesService.js';
import { isSeniorMode } from '../seniorModeController.js';
import { createStandardUrCarousel } from '../standardUrCarousel.js';
import {
  isSummonRevealPlaying,
  pickDebugPetByRarity,
  playSummonReveal,
  playSsrPlusRevealQueue,
  getHighestRarity,
  shouldPlayReveal,
  getRevealPetFromResults,
} from '../summonRevealService.js';
import { isThemedSummonPlaying, playThemedSummon } from '../themedSummonController.js';
import { syncTwilightGacha } from '../twilightPresentation.js';
import { escapeHtml } from '../uiHelpers.js';
import { handleAchievementCheckAfterAction } from './achievementsView.js';
import { openPetDetailModal } from './collectionView.js';

// Bound from src/ui.js by connectGachaView() so this module never imports ui.js back.
let RARITY_LABELS, closeModal, collectionRenderGate, encounterActions, onRefresh, openModal, openNicknameModal, petImageHtml, renderGachaDailyBlessingEntry, setText, showToast, state, switchView;

export function connectGachaView(deps) {
  ({ RARITY_LABELS, closeModal, collectionRenderGate, encounterActions, onRefresh, openModal, openNicknameModal, petImageHtml, renderGachaDailyBlessingEntry, setText, showToast, state, switchView } = deps);
}

/** 抽卡請求／演出進行中（比 dataset.pulling 更可靠，避免殘留鎖定） */
let gachaPullInProgress = false;
let awakeningGuideExpanded = false;
let awakeningGuidePoolId = null;
/** 抽卡／解鎖視覺流程 session（不寫入 IndexedDB） */
const gachaSessionUi = {
  /** @type {'slumber'|null} 結果關閉前強制永眠期畫面 */
  visualPhaseLock: null,
  pendingAwakening: false,
  pendingAwakeningPoolId: null,
  /** @type {object|null} */
  pendingUnlockProgress: null,
};

/** @type {null|((value?: unknown) => void)} */
let gachaResultCloseResolver = null;
let latestPoolSelection = 0;

export function resolveGachaResultWait() {
  if (typeof gachaResultCloseResolver === 'function') {
    const resolve = gachaResultCloseResolver;
    gachaResultCloseResolver = null;
    resolve();
  }
}

function waitNextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

/**
 * 畫面是否顯示晨醒期（與資料 unlocked 分離）
 * @param {object|null|undefined} unlockEntry
 */
export function shouldShowAwakenedPresentation(unlockEntry) {
  if (gachaSessionUi.visualPhaseLock === 'slumber') return false;
  if (gachaSessionUi.pendingAwakening) return false;
  if (!unlockEntry?.unlocked) return false;
  if (!unlockEntry.animationSeen) return false;
  return true;
}

function beginPullVisualLock(poolId) {
  const entry = getUnlockEntryForPool(poolId);
  // 尚未看過解鎖動畫時，整段抽卡／結果維持永眠期畫面
  if (!entry.animationSeen) {
    gachaSessionUi.visualPhaseLock = 'slumber';
  }
}

function markPendingAwakening(poolId, unlockProgress) {
  const entry = unlockProgress?.entry || getUnlockEntryForPool(poolId);
  if (!entry?.unlocked || entry.animationSeen) return false;
  gachaSessionUi.pendingAwakening = true;
  gachaSessionUi.pendingAwakeningPoolId = poolId;
  gachaSessionUi.pendingUnlockProgress = unlockProgress || { entry };
  gachaSessionUi.visualPhaseLock = 'slumber';
  return true;
}

function clearPendingAwakening() {
  gachaSessionUi.pendingAwakening = false;
  gachaSessionUi.pendingAwakeningPoolId = null;
  gachaSessionUi.pendingUnlockProgress = null;
  gachaSessionUi.visualPhaseLock = null;
}
/** Pool switcher: a later selection wins over a slower earlier one. */
export async function handleGachaPoolSelectChange(e) {
  const poolId = e.target.value;
  const selection = ++latestPoolSelection;
  if (!poolId || isGachaPullInProgress()) {
    renderGachaPoolSwitcher();
    return;
  }
  try {
    const stats = await setSelectedPoolId(poolId);
    if (selection !== latestPoolSelection) return;
    state.gachaStats = stats;
    renderGachaView();
    maybePlayPoolDebut._fromSwitcher = true;
    await maybePlayPoolDebut(poolId);
  } catch (err) {
    if (selection !== latestPoolSelection) return;
    showToast(err.message || '切換卡池失敗', 'error');
  }
}

export function toggleAwakeningGuide(button) {
  awakeningGuideExpanded = !awakeningGuideExpanded;
  button.setAttribute('aria-expanded', String(awakeningGuideExpanded));
  const guide = document.getElementById('gacha-pet-awakening-guide');
  if (guide) guide.hidden = !awakeningGuideExpanded;
}

export function getSelectedGachaPool() {
  try {
    const pool = resolveActivePool(state?.poolsData, state?.gachaStats?.selectedPoolId);
    if (!pool) return null;
    return validatePoolContent({ pools: [pool] }, { pets: state?.allPets || [] }).ok ? pool : null;
  } catch {
    return null;
  }
}

export function getAvailablePullsForSelectedPool() {
  const pool = getSelectedGachaPool();
  return pool ? Math.floor((state?.wallet?.stardust || 0) / resolveDrawCost(pool, 1)) : 0;
}

function renderGachaUnavailable() {
  for (const id of ['gacha-pool-content', 'gacha-theme-stage', 'gacha-awakening-panel', 'gacha-theme-details', 'gacha-theme-details-btn', 'gacha-pet-awakening-guide', 'gacha-pet-awakening-toggle']) {
    const element = document.getElementById(id);
    if (element) element.hidden = true;
  }
  const panel = document.getElementById('gacha-panel');
  panel?.removeAttribute('data-pool-theme');
  panel?.removeAttribute('data-pool-id');
  panel?.removeAttribute('data-pool-phase');
  const name = document.getElementById('gacha-pool-name');
  if (name) { name.hidden = false; name.textContent = '目前沒有可用的召喚卡池'; }
  for (const id of ['gacha-cost', 'gacha-ten-cost', 'gacha-ssr-pity', 'gacha-ur-pity']) setText(id, '—');
  setText('gacha-stardust', state?.wallet?.stardust ?? 0);
  document.getElementById('gacha-rates')?.replaceChildren();
  for (const id of ['gacha-ssr-bar', 'gacha-ur-bar']) {
    const bar = document.getElementById(id);
    if (bar) bar.style.width = '0%';
  }
  for (const [id, label] of [['btn-pull', '召喚 1 次'], ['btn-pull-ten', '召喚 10 次']]) {
    const button = document.getElementById(id);
    if (button) { button.disabled = true; button.textContent = label; delete button.dataset.pulling; }
  }
  for (const id of ['gacha-hint-single', 'gacha-hint-ten']) {
    const hint = document.getElementById(id);
    if (hint) hint.hidden = true;
  }
  renderGachaPoolSwitcher();
}

function renderGachaPoolSwitcher() {
  const switcher = document.getElementById('gacha-pool-switcher');
  const select = document.getElementById('gacha-pool-select');
  if (!switcher || !select) return;

  const activePools = (Array.isArray(state?.poolsData?.pools) ? state.poolsData.pools : []).filter((pool) => pool?.active === true && typeof pool.id === 'string');
  if (activePools.length <= 1) {
    switcher.hidden = true;
    return;
  }

  const selectedId = getSelectedGachaPool()?.id;
  switcher.hidden = false;
  select.innerHTML = activePools
    .map((pool) => `<option value="${escapeHtml(pool.id)}" ${pool.id === selectedId ? 'selected' : ''}>${escapeHtml(pool.name)}</option>`)
    .join('');
}

export function renderGachaView() {
  if (renderLocalIdentityView('gacha', state, onRefresh, { switchView, openPetDetail: openPetDetailModal, openNickname: openNicknameModal })) return;
  if (renderEncounterView('gacha', state, onRefresh, encounterActions())) return;
  const pool = getSelectedGachaPool();
  syncTwilightGacha(state, pool);
  if (!pool) { renderGachaUnavailable(); return; }

  const stats = ensurePoolPity(state.gachaStats || {}, pool.id);
  const pityCounters = getPoolPityCounters(stats, pool.id);
  const pity = pool.pity || { ssr: 30, ur: 100 };
  const stardust = state.wallet.stardust ?? 0;
  const singleCost = resolveDrawCost(pool, 1);

  renderGachaPoolSwitcher();
  renderGachaThemeStage(pool);
  const awakeningGuide = document.getElementById('gacha-pet-awakening-guide');
  const awakeningToggle = document.getElementById('gacha-pet-awakening-toggle');
  const hasPetAwakening = !!getPoolAwakeningProfile(pool.id);
  if (awakeningGuidePoolId !== pool.id) {
    awakeningGuidePoolId = pool.id;
    awakeningGuideExpanded = false;
  }
  if (awakeningToggle) {
    awakeningToggle.hidden = !hasPetAwakening;
    awakeningToggle.setAttribute('aria-expanded', String(hasPetAwakening && awakeningGuideExpanded));
  }
  if (awakeningGuide) {
    awakeningGuide.hidden = !hasPetAwakening || !awakeningGuideExpanded;
    if (hasPetAwakening) awakeningGuide.innerHTML = renderAwakeningGuide({ compact: true, poolId: pool.id });
  }
  setText('gacha-pool-name', pool.name);
  setText('gacha-stardust', stardust);
  setText('gacha-cost', singleCost);
  setText('gacha-ten-cost', resolveDrawCost(pool, 10));
  setText('gacha-ssr-pity', `${pityCounters.ssrPity}/${pity.ssr}`);
  setText('gacha-ur-pity', `${pityCounters.urPity}/${pity.ur}`);

  const ssrBar = document.getElementById('gacha-ssr-bar');
  const urBar = document.getElementById('gacha-ur-bar');
  if (ssrBar) ssrBar.style.width = `${Math.min(100, (pityCounters.ssrPity / pity.ssr) * 100)}%`;
  if (urBar) urBar.style.width = `${Math.min(100, (pityCounters.urPity / pity.ur) * 100)}%`;

  const ratesEl = document.getElementById('gacha-rates');
  if (ratesEl && pool.rates) {
    ratesEl.innerHTML = Object.entries(pool.rates)
      .map(
        ([r, rate]) =>
          `<span class="rate-tag rate-${r}" data-rarity="${r}"><span class="rate-tag__label">${RARITY_LABELS[r]}</span> <span class="rate-tag__value">${(rate * 100).toFixed(0)}%</span></span>`
      )
      .join('');
  }

  resetStaleGachaPullState();
  updateGachaAffordability();

  renderGachaDailyBlessingEntry();
}

/**
 * Debug：保證播放指定稀有度演出，且不影響任何正式抽卡資料。
 * 不呼叫 draw / gacha / addPetToCollection / addFragments / updateGachaStats / spendStardust。
 * @param {'SSR'|'UR'} rarity
 */
export async function testSummonReveal(rarity) {
  if (!isAuthorLocalDevMode()) return;
  if (isSummonRevealPlaying()) return;
  const pet = pickDebugPetByRarity(rarity, state?.allPets);
  await playSummonReveal({
    rarity,
    pet,
    mode: 'debug',
    results: [],
    reduceMotion: state?.userPreferences?.reduceMotion ?? false,
  });
  showToast(`${rarity} 演出測試完成，未消耗星塵`, 'info');
}

/**
 * Debug：依寵物 ID 播放 SSR+ 出場（雙 UR 專屬動畫驗證）。
 * 不消耗星塵、不寫入收藏／保底。
 * @param {string} petId
 */
export async function testSummonRevealByPetId(petId) {
  if (!isAuthorLocalDevMode()) return;
  if (isSummonRevealPlaying() || isThemedSummonPlaying()) return;
  const pet = (state?.allPets || []).find((p) => p?.id === petId) || null;
  if (!pet) {
    showToast(`找不到寵物 ${petId}`, 'warning');
    return;
  }
  const rarity = pet.rarity === 'SSR' || pet.rarity === 'UR' ? pet.rarity : 'UR';
  await playSummonReveal({
    rarity,
    pet,
    mode: 'debug',
    results: [],
    reduceMotion: state?.userPreferences?.reduceMotion ?? false,
  });
  showToast(`${pet.name || petId} 演出測試完成，未消耗星塵`, 'info');
}

/** 是否有真正進行中的抽卡（模組旗標或演出） */
export function isGachaPullInProgress() {
  return gachaPullInProgress || isSummonRevealPlaying() || isThemedSummonPlaying() || isPoolAwakeningPlaying();
}

export function getUnlockEntryForPool(poolId) {
  const byPool = state.poolUnlockState?.byPool || {};
  return byPool[poolId] || emptyPoolUnlockEntry(poolId);
}

/**
 * 抽卡結果確認後：若剛解鎖或尚有未播放解鎖動畫，播放晨醒花庭演出。
 */
async function maybePlayMorningGardenAfterPull(pool, unlockProgress) {
  const expansion = normalizeUnlockExpansion(pool);
  if (!expansion) return;
  let entry = unlockProgress?.entry || getUnlockEntryForPool(pool.id);
  if (!entry?.unlocked) { clearPendingAwakening(); return; }
  try {
    const reward = await ensureUnlockRewardClaimed(pool.id, expansion, state.allPets);
    if (!reward?.ok) throw new Error(reward?.error || '無法確認解鎖獎勵');
    entry = reward.entry || await getPoolUnlockEntry(pool.id);
    state.poolUnlockState = { ...(state.poolUnlockState || {}), byPool: { ...(state.poolUnlockState?.byPool || {}), [pool.id]: entry } };
    if (!entry.unlocked || !entry.rewardClaimed || entry.animationSeen) return;
    await waitNextFrame();
    const model = resolvePoolPresentationModel(pool, state.allPets, entry);
    const outcome = await playPoolUnlock({ model, reduceMotion: state.userPreferences?.reduceMotion ?? false });
    if (outcome?.seen) {
      const latest = await markUnlockAnimationSeen(pool.id);
      state.poolUnlockState = { ...(state.poolUnlockState || {}), byPool: { ...(state.poolUnlockState?.byPool || {}), [pool.id]: latest } };
    }
  } catch (err) {
    console.warn('[PoolAwakening] 解鎖狀態尚未完成，可重新進入卡池重試', err);
    showToast('解鎖獎勵確認失敗，稍後可重新進入卡池重試', 'warning');
  } finally {
    clearPendingAwakening();
  }
}

/** Resume is independent of theme and debut state. */
async function maybeResumeMorningGarden(poolId) {
  if (isGachaPullInProgress()) return;
  const pool = getSelectedGachaPool();
  if (!pool || pool.id !== poolId || !normalizeUnlockExpansion(pool)) return;
  try {
    await ensurePoolUnlockLegacyBackfillMarked();
    const entry = await getPoolUnlockEntry(poolId);
    state.poolUnlockState = { ...(state.poolUnlockState || {}), byPool: { ...(state.poolUnlockState?.byPool || {}), [poolId]: entry } };
    if (entry.unlocked && (!entry.rewardClaimed || !entry.animationSeen)) {
      markPendingAwakening(poolId, { entry });
      await maybePlayMorningGardenAfterPull(pool, { entry });
      renderGachaView();
    }
  } catch (err) {
    console.warn('[PoolAwakening] resume 略過', err);
  }
}

/**
 * 主題卡池首次／切換皆播放完整登場（純 UI，不抽卡）
 * @param {string} poolId
 */
export async function maybePlayPoolDebut(poolId) {
  if (LOCAL_ART_PREVIEW) return;
  const pool = getSelectedGachaPool();
  if (!pool || pool.id !== poolId || isGachaPullInProgress() || maybePlayPoolDebut._inflight) return;
  const presentation = normalizePoolPresentation(pool);
  maybePlayPoolDebut._inflight = true;
  try {
    {
      const seen = await hasSeenPoolDebut(poolId);
      if (!isSeniorMode() && (!seen || maybePlayPoolDebut._fromSwitcher)) {
        await playCeremonyEntry(pool, { reduceMotion: isSeniorMode() || state.userPreferences?.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches });
        if (!seen) await markPoolDebutSeen(poolId);
      }
    }
  } catch (err) {
    console.warn('[PoolDebut] 登場演出略過', err);
  } finally {
    maybePlayPoolDebut._inflight = false;
    maybePlayPoolDebut._fromSwitcher = false;
  }
  await maybeResumeMorningGarden(poolId);
}

/**
 * 渲染主題卡池主畫面（無 presentation 時隱藏）
 * @param {object} pool
 */
let standardUrCarousel = null;

function renderGachaThemeStage(pool) {
  const panel = document.getElementById('gacha-panel');
  const stage = document.getElementById('gacha-theme-stage');
  const poolNameEl = document.getElementById('gacha-pool-name');
  const unlockEntry = getUnlockEntryForPool(pool?.id);
  const previewPets = state.allPets.map((pet) => initialAwakeningPortrait(pet, state.awakeningCatalog));
  const model = resolvePoolPresentationModel(pool, previewPets, unlockEntry, { visualLocked: !shouldShowAwakenedPresentation(unlockEntry) });
  const standardPreview = document.getElementById('gacha-standard-ur');
  if (standardPreview) {
    standardUrCarousel ||= createStandardUrCarousel(standardPreview);
    standardUrCarousel.render(model);
  }
  const presentation = model.presentation;
  const themeAttr = model.cssTheme;
  const expansion = model.unlock?.expansion;
  // 畫面 phase 與資料 unlocked 分離：結果／動畫完成前維持永眠期
  const awakened = model.awakened;

  if (panel) {
    if (pool?.id) panel.dataset.poolId = pool.id;
    else panel.removeAttribute('data-pool-id');
    if (themeAttr) panel.dataset.poolTheme = themeAttr;
    else panel.removeAttribute('data-pool-theme');
    if (awakened) panel.dataset.poolPhase = 'awakened';
    else if (themeAttr) panel.dataset.poolPhase = 'slumber';
    else panel.removeAttribute('data-pool-phase');
  }

  if (!stage) return;

  const content = document.getElementById('gacha-pool-content');
  if (content) content.hidden = !presentation && !expansion;
  stage.hidden = !presentation;
  stage.classList.toggle('is-awakened', awakened);
  if (poolNameEl) poolNameEl.hidden = false;

  const setElText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text || '';
  };

  setElText('gacha-theme-badge', presentation?.badge);
  setElText('gacha-theme-name', pool.name || '');
  if (awakened) {
    setElText('gacha-theme-eyebrow', `${expansion.title}已解鎖`);
    setElText('gacha-theme-tagline', expansion?.unlockMessage);
  } else {
    setElText('gacha-theme-eyebrow', presentation?.eyebrow);
    setElText('gacha-theme-tagline', presentation?.tagline);
  }

  const { hero } = model;
  const dawnHero = model.heroes.find((pet) => pet.id !== hero?.id) || null;
  const heroImg = document.getElementById('gacha-theme-hero-img');
  const heroFigure = document.getElementById('gacha-theme-hero');
  if (heroFigure) heroFigure.hidden = !hero;
  if (!hero && heroImg) {
    heroImg.classList.add('is-loading');
    heroImg.removeAttribute('src');
    delete heroImg.dataset.src;
  }
  const dualHost = document.getElementById('gacha-theme-dual-hero');
  if (awakened && dualHost && hero && dawnHero) {
    dualHost.hidden = false;
    dualHost.replaceChildren();
    for (const pet of [hero, dawnHero]) {
      const fig = document.createElement('figure');
      fig.className = 'gacha-theme-dual__item';
      const img = document.createElement('img');
      img.alt = pet.title || pet.name || '';
      img.decoding = 'async';
      const src = getPetImageSrc(pet, 'stage');
      if (src) {
        img.onerror = () => {
          img.onerror = null;
          const original = getPetImageSrc(pet);
          if (original && original !== src) img.src = original;
        };
        img.src = src;
        preloadImage(src, { eager: true }).catch(() => {});
      }
      const cap = document.createElement('figcaption');
      cap.textContent = pet.title || pet.name || '';
      fig.append(img, cap);
      dualHost.appendChild(fig);
    }
    if (heroImg) heroImg.closest('.gacha-theme-hero')?.classList.add('is-dimmed');
  } else if (dualHost) {
    dualHost.hidden = true;
    dualHost.replaceChildren();
    if (heroImg) heroImg.closest('.gacha-theme-hero')?.classList.remove('is-dimmed');
  }

  if (hero && heroImg) {
    const src = getPetImageSrc(hero, 'stage');
    if (src && heroImg.dataset.src !== src) {
      // The same element serves every pool. Hide its previous decoded bitmap
      // before updating the copy, then reveal only the current request.
      heroImg.classList.add('is-loading');
      heroImg.dataset.src = src;
      heroImg.onload = () => {
        if (heroImg.dataset.src === src) heroImg.classList.remove('is-loading');
      };
      heroImg.onerror = () => {
        if (heroImg.dataset.src !== src) return;
        heroImg.onerror = null;
        const original = getPetImageSrc(hero);
        if (original && original !== src) heroImg.src = original;
        else heroImg.classList.add('is-loading');
      };
      heroImg.src = src;
      preloadImage(src, { eager: true }).catch(() => {});
    } else if (!src) {
      heroImg.classList.add('is-loading');
      heroImg.removeAttribute('src');
      delete heroImg.dataset.src;
    }
    heroImg.classList.add('is-silhouette');
    heroImg.alt = hero.title || hero.rarity || '限定大獎';
  }
  setElText('gacha-theme-hero-rarity', hero?.rarity || 'UR');
  setElText('gacha-theme-hero-name', hero?.title || '');
  setElText('gacha-theme-hero-title', '');
  const heroTitleEl = document.getElementById('gacha-theme-hero-title');
  if (heroTitleEl) heroTitleEl.hidden = true;

  const featuredHost = document.getElementById('gacha-theme-featured');
  if (featuredHost) {
    featuredHost.replaceChildren();
    const featureList = model.featured;
    featureList.forEach((pet) => {
      const item = document.createElement('div');
      item.className = 'gacha-theme-featured__item';
      const img = document.createElement('img');
      img.className = 'gacha-theme-featured__img is-silhouette';
      img.alt = pet.title || pet.rarity || '焦點夥伴';
      img.decoding = 'async';
      const src = getPetImageSrc(pet, 'card');
      if (src) {
        img.onerror = () => {
          img.onerror = null;
          const original = getPetImageSrc(pet);
          if (original && original !== src) img.src = original;
        };
        img.src = src;
        preloadImage(src, { eager: true }).catch(() => {});
      }
      const meta = document.createElement('div');
      const rarity = document.createElement('span');
      rarity.className = 'gacha-theme-featured__rarity';
      rarity.textContent = pet.rarity || 'SSR';
      const title = document.createElement('span');
      title.className = 'gacha-theme-featured__name';
      title.textContent = pet.title || pet.name || '';
      meta.append(rarity, title);
      item.append(img, meta);
      featuredHost.appendChild(item);
    });
  }

  const eligible = model.eligiblePets;
  setElText(
    'gacha-theme-meta',
    awakened
      ? `候選角色 ${eligible.length} 隻 · ${expansion.title}已解鎖`
      : `候選角色 ${eligible.length} 隻${presentation?.candidateNote ? ' · ' + presentation.candidateNote : ''}`,
  );

  // 晨醒花庭進度／鎖定預覽
  const awakening = document.getElementById('gacha-awakening-panel');
  if (awakening && expansion) {
    awakening.hidden = false;
    const threshold = expansion.threshold;
    const draws = unlockEntry.lifetimeDraws || 0;
    const pct = Math.min(100, Math.round((draws / threshold) * 100));
    setElText('gacha-awakening-title', expansion.title);
    if (awakened) {
      setElText('gacha-awakening-progress', model.unlock.progressText);
      setElText('gacha-awakening-desc', expansion.unlockMessage);
      setElText('gacha-awakening-counts', `候選角色：${eligible.length}`);
    } else {
      setElText('gacha-awakening-progress', model.unlock.progressText);
      setElText(
        'gacha-awakening-desc',
        model.unlock.description,
      );
      setElText('gacha-awakening-counts', model.unlock.countsText);
    }
    const fill = document.getElementById('gacha-awakening-fill');
    if (fill) {
      fill.style.width = `${awakened ? 100 : pct}%`;
      fill.classList.toggle('is-complete', awakened);
    }
    const preview = document.getElementById('gacha-awakening-preview');
    if (preview) {
      preview.replaceChildren();
      preview.setAttribute('aria-label', `${expansion.presentation.candidateLabel}預覽`);
      for (const pet of model.unlock.previewPets) {
        const meta = pet;
        const item = document.createElement('div');
        item.className = 'gacha-awakening-preview__item' + (awakened ? ' is-unlocked' : ' is-locked');
        const img = document.createElement('img');
        img.alt = `${meta.rarity} ${meta.name}`;
        img.decoding = 'async';
        if (pet) {
          const src = getPetImageSrc(pet);
          if (src) img.src = src;
        }
        const label = document.createElement('span');
        label.textContent = `${meta.rarity} ${meta.name}`;
        item.append(img, label);
        preview.appendChild(item);
      }
    }
    const rateNote = document.getElementById('gacha-awakening-rate-note');
    if (rateNote) {
      rateNote.textContent = awakened
        ? '解鎖後各稀有度總機率不變。新增角色會與同稀有度角色依現行規則共同分配該稀有度機率。'
        : `解鎖後各稀有度總機率不變。新增角色會與同稀有度角色依現行規則共同分配該稀有度機率。固定贈送${model.unlock.rewardPet.name}不算抽卡、不推進保底。`;
    }
  } else if (awakening) {
    awakening.hidden = true;
  }

  const details = document.getElementById('gacha-theme-details');
  const detailsBtn = document.getElementById('gacha-theme-details-btn');
  if (details) {
    details.hidden = true;
    const pity = pool.pity || { ssr: 30, ur: 100 };
    const stats = ensurePoolPity(state.gachaStats || {}, pool.id);
    const counters = getPoolPityCounters(stats, pool.id);
    const rates = pool.rates || {};
    const rateText = ['N', 'R', 'SR', 'SSR', 'UR']
      .map((r) => `${r} ${((rates[r] || 0) * 100).toFixed(0)}%`)
      .join(' · ');

    details.replaceChildren();
    const dl = document.createElement('dl');
    const rows = [
      ['單抽成本', `${model.costs.single} 星塵`],
      ['十連成本', `${model.costs.ten} 星塵`],
      ['稀有度機率', rateText],
      ['SSR 保底', `${pity.ssr} 抽`],
      ['UR 保底', `${pity.ur} 抽`],
      ['目前 SSR 保底進度', `${counters.ssrPity}/${pity.ssr}`],
      ['目前 UR 保底進度', `${counters.urPity}/${pity.ur}`],
      ['候選角色', `${eligible.length} 隻`],
      ['池別說明', (awakened ? expansion.presentation.detailsNote : presentation?.detailsNote) || '依卡池設定篩選候選角色'],
      ['重複補償', '沿用現行碎片規則'],
      ['解鎖後機率', '各稀有度總機率不變；同稀有度依現行規則共同分配'],
    ];
    rows.forEach(([dtText, ddText]) => {
      const dt = document.createElement('dt');
      dt.textContent = dtText;
      const dd = document.createElement('dd');
      dd.textContent = ddText;
      dl.append(dt, dd);
    });
    details.appendChild(dl);
  }
  if (detailsBtn) {
    detailsBtn.hidden = !presentation;
    detailsBtn.setAttribute('aria-expanded', 'false');
    detailsBtn.textContent = '卡池詳情';
  }
}

/**
 * 抽卡後播放展示層（主題動畫或 SSR+ reveal queue）；失敗則 fallback。
 * 不得重抽或再次扣款。
 * @returns {Promise<'themed'|'legacy'|'none'>} 實際走的展示路徑
 */
async function playPostPullPresentation({ pool, mode, results, singleResult }) {
  const reduceMotion = state.userPreferences?.reduceMotion ?? false;
  const list = Array.isArray(results) ? results : singleResult ? [singleResult] : [];
  try {
    await presentCommittedEncounters(pool, list);
    return 'themed';
  } catch (error) { console.warn('[Encounter] Using legacy committed-result fallback', error); }

  if (shouldUseThemedSummon(pool)) {
    try {
      const outcome = await playThemedSummon({
        animationKey: normalizePoolPresentation(pool).animationKey,
        poolName: pool.name,
        results: list,
        mode,
        reduceMotion,
      });
      if (outcome?.ok && !outcome.fallback) {
        return 'themed';
      }
      // 主題動畫失敗：退回 SSR+ queue（若有）再進結果 modal
      try {
        await playSsrPlusRevealQueue({ results: list, reduceMotion });
      } catch (revealErr) {
        console.warn('[ThemedSummon] SSR+ reveal fallback skipped', revealErr);
      }
      return 'legacy';
    } catch (err) {
      console.warn('[ThemedSummon] fallback to legacy reveal/modal', err);
    }
  }

  // standard 池：有 SSR+ 則依原始順序自動播完整 queue
  try {
    const queueOutcome = await playSsrPlusRevealQueue({
      results: list,
      reduceMotion,
    });
    if (queueOutcome?.played > 0) return 'legacy';
  } catch (err) {
    console.warn('[SummonReveal] queue fallback，改播最高稀有單張', err);
    const highestRarity = singleResult?.rarity ?? getHighestRarity(list);
    if (shouldPlayReveal(highestRarity)) {
      const revealPet = singleResult?.pet ?? getRevealPetFromResults(list, highestRarity);
      await playSummonReveal({
        rarity: highestRarity,
        pet: revealPet,
        mode,
        results: list,
        reduceMotion,
      });
      return 'legacy';
    }
  }
  return 'none';
}

/**
 * 進入召喚頁／render 時清除殘留 pulling 鎖定。
 * 不可在真正抽卡進行中強制解除。
 */
function resetStaleGachaPullState() {
  if (isGachaPullInProgress()) return;
  const btnSingle = document.getElementById('btn-pull');
  const btnTen = document.getElementById('btn-pull-ten');
  if (btnSingle?.dataset.pulling === '1') {
    delete btnSingle.dataset.pulling;
  }
  if (btnTen?.dataset.pulling === '1') {
    delete btnTen.dataset.pulling;
  }
}

/**
 * 依最新 state.wallet 更新召喚按鈕狀態與星塵顯示（不重建召喚頁）。
 * 找不到召喚按鈕（不在召喚頁 / DOM 未就緒）時安全 return。
 */
export function updateGachaAffordability() {
  if (!state?.wallet) return;
  if (!LOCAL_ART_PREVIEW && document.querySelector('#view-gacha .identity-surface')) {
    renderEncounterView('gacha', state, onRefresh, encounterActions());
    return;
  }

  const btnSingle = document.getElementById('btn-pull');
  const btnTen = document.getElementById('btn-pull-ten');
  if (!btnSingle && !btnTen) return;

  resetStaleGachaPullState();

  const pool = getSelectedGachaPool();
  if (!pool) { renderGachaUnavailable(); return; }
  const singleCost = resolveDrawCost(pool, 1);
  const tenCost = resolveDrawCost(pool, 10);
  const stardust = state.wallet.stardust ?? 0;
  const canSingle = stardust >= singleCost;
  const canTen = stardust >= tenCost;

  setText('gacha-stardust', stardust);

  const hintSingle = document.getElementById('gacha-hint-single');
  const hintTen = document.getElementById('gacha-hint-ten');

  // 抽卡進行中時（按鈕標記 pulling）不覆蓋「召喚中…」狀態
  const pulling = isGachaPullInProgress();
  if (btnSingle && btnSingle.dataset.pulling !== '1') {
    btnSingle.disabled = pulling || !canSingle;
    btnSingle.textContent = '召喚 1 次';
  }
  if (btnTen && btnTen.dataset.pulling !== '1') {
    btnTen.disabled = pulling || !canTen;
    btnTen.textContent = '召喚 10 次';
  }

  const poolSelect = document.getElementById('gacha-pool-select');
  if (poolSelect && poolSelect.dataset.pulling !== '1') {
    poolSelect.disabled = pulling;
  }

  if (hintSingle) {
    if (!canSingle) {
      hintSingle.textContent = '星塵不足，完成任務可以獲得星塵。';
      hintSingle.hidden = false;
    } else {
      hintSingle.hidden = true;
    }
  }

  if (hintTen) {
    if (!canTen) {
      hintTen.textContent = `10 連抽需要 ${tenCost} 星塵。`;
      hintTen.hidden = false;
    } else {
      hintTen.hidden = true;
    }
  }
}

export async function handlePull() {
  const pool = getSelectedGachaPool();
  if (!pool) { renderGachaUnavailable(); return; }
  const cost = resolveDrawCost(pool, 1);

  if ((state.wallet.stardust ?? 0) < cost) {
    showToast('星塵不足，完成任務可以獲得星塵', 'warning');
    updateGachaAffordability();
    return;
  }

  if (isGachaPullInProgress()) return;

  const btn = document.getElementById('btn-pull');
  const poolSelect = document.getElementById('gacha-pool-select');
  gachaPullInProgress = true;
  beginPullVisualLock(pool?.id);
  if (btn) {
    btn.dataset.pulling = '1';
    btn.disabled = true;
    btn.textContent = '召喚中…';
  }
  if (poolSelect) poolSelect.disabled = true;

  try {
    const drawn = await pullOnce(state.allPets, state.poolsData, pool?.id);
    const result = { ...drawn, pet: initialAwakeningPortrait(drawn.pet, state.awakeningCatalog) };
    if (result.unlockProgress?.entry) {
      state.poolUnlockState = {
        ...(state.poolUnlockState || { key: 'poolUnlockState', schemaVersion: 1, byPool: {} }),
        byPool: {
          ...(state.poolUnlockState?.byPool || {}),
          [pool.id]: result.unlockProgress.entry,
        },
      };
      markPendingAwakening(pool.id, result.unlockProgress);
    }

    const preloadPromise = preloadGachaResultImages(result);
    collectionRenderGate.markDirty();
    await Promise.all([
      onRefresh({ renderMode: ['gacha'] }),
      waitForPreloadWithTimeout(preloadPromise, 600),
    ]);

    const presentationPath = await playPostPullPresentation({
      pool,
      mode: 'single',
      singleResult: result,
      results: [result],
    });

    const pending = gachaSessionUi.pendingAwakening;
    if (presentationPath !== 'themed') {
      await showPullResultAndWait(result, { pendingAwakening: pending });
    }

    if (pending) {
      await maybePlayMorningGardenAfterPull(pool, result.unlockProgress);
    } else {
      clearPendingAwakening();
    }

    showToast('召喚成功！', 'success', 2000);
    await handleAchievementCheckAfterAction();
    void recordOnboardingEvent('summon-completed');
  } catch (err) {
    clearPendingAwakening();
    showToast(err.message || '召喚失敗', 'error');
  } finally {
    gachaPullInProgress = false;
    const btn = document.getElementById('btn-pull');
    if (btn) delete btn.dataset.pulling;
    if (poolSelect) poolSelect.disabled = false;
    renderGachaView();
    document.querySelector('#view-gacha .identity-surface [data-identity-action="summon"]')?.focus();
  }
}

export async function handleTenPull() {
  const pool = getSelectedGachaPool();
  if (!pool) { renderGachaUnavailable(); return; }
  const tenCost = resolveDrawCost(pool, 10);
  if ((state.wallet.stardust ?? 0) < tenCost) {
    showToast(`10 連抽需要 ${tenCost} 星塵`, 'warning');
    updateGachaAffordability();
    return;
  }

  if (isGachaPullInProgress()) return;

  const btn = document.getElementById('btn-pull-ten');
  const poolSelect = document.getElementById('gacha-pool-select');
  gachaPullInProgress = true;
  beginPullVisualLock(pool?.id);
  if (btn) {
    btn.dataset.pulling = '1';
    btn.disabled = true;
    btn.textContent = '召喚中…';
  }
  if (poolSelect) poolSelect.disabled = true;

  try {
    const drawn = await performTenPull(state.allPets, state.poolsData, pool?.id);
    const result = { ...drawn, results: drawn.results?.map((r) => ({ ...r, pet: initialAwakeningPortrait(r.pet, state.awakeningCatalog) })) };
    if (!result.success) {
      clearPendingAwakening();
      showToast(result.error || '10 連抽失敗', 'warning');
      return;
    }

    if (result.unlockProgress?.entry) {
      state.poolUnlockState = {
        ...(state.poolUnlockState || { key: 'poolUnlockState', schemaVersion: 1, byPool: {} }),
        byPool: {
          ...(state.poolUnlockState?.byPool || {}),
          [pool.id]: result.unlockProgress.entry,
        },
      };
      markPendingAwakening(pool.id, result.unlockProgress);
    }

    const preloadPromise = preloadGachaResultImages(result.results);
    collectionRenderGate.markDirty();
    await Promise.all([
      onRefresh({ renderMode: ['gacha'] }),
      waitForPreloadWithTimeout(preloadPromise, 600),
    ]);

    const presentationPath = await playPostPullPresentation({
      pool,
      mode: 'ten',
      results: result.results,
    });

    const pending = gachaSessionUi.pendingAwakening;
    if (presentationPath !== 'themed') {
      await showTenPullResultAndWait(result, { pendingAwakening: pending });
    }

    if (pending) {
      await maybePlayMorningGardenAfterPull(pool, result.unlockProgress);
    } else {
      clearPendingAwakening();
    }

    showToast('10 連抽完成！', 'success', 2000);
    await handleAchievementCheckAfterAction();
    void recordOnboardingEvent('summon-completed');
  } catch (err) {
    clearPendingAwakening();
    showToast(err.message || '10 連抽失敗', 'error');
  } finally {
    gachaPullInProgress = false;
    const btn = document.getElementById('btn-pull-ten');
    if (btn) delete btn.dataset.pulling;
    if (poolSelect) poolSelect.disabled = false;
    renderGachaView();
    document.querySelector('#view-gacha .identity-surface [data-identity-action="summon-ten"]')?.focus();
  }
}

export function isSweetTheme() {
  return normalizeTheme(state?.userPreferences?.theme) === 'sweet';
}

export function getGachaAffordability() {
  const pool = getSelectedGachaPool();
  const stardust = state?.wallet?.stardust ?? 0;
  const singleCost = pool ? resolveDrawCost(pool, 1) : null;
  const tenCost = pool ? resolveDrawCost(pool, 10) : null;
  return { pool, singleCost, tenCost, stardust, canSingle: !!pool && stardust >= singleCost, canTen: !!pool && stardust >= tenCost };
}

function sweetSummonRarityBadge(rarity, extraClass = '') {
  return `<span class="sweet-summon-badge sweet-summon-badge--rarity ${extraClass}" data-rarity="${rarity}">${rarity}</span>`;
}

function sweetSummonStatusBadge(isNew, amount) {
  if (isNew) {
    return '<span class="sweet-summon-badge sweet-summon-badge--new">NEW</span>';
  }
  return `<span class="sweet-summon-badge sweet-summon-badge--fragment">碎片 +${amount}</span>`;
}

function sweetSummonRarityDesc(rarity) {
  const labels = { N: '普通夥伴', R: '稀有夥伴', SR: '超稀有夥伴', SSR: '極稀有夥伴', UR: '傳說夥伴' };
  return labels[rarity] || rarity;
}

function upgradeSingleResultImage(pet) {
  const image = document.querySelector('.summon-result-single__frame .pet-img');
  const stageSrc = getPetImageSrc(pet, 'stage');
  const cardSrc = getPetImageSrc(pet, 'card');
  if (!image || !stageSrc || stageSrc === cardSrc) return;
  void preloadImage(stageSrc, { eager: true }).then(({ ok }) => {
    if (ok && image.isConnected && document.querySelector('.summon-result-single__frame .pet-img') === image) {
      image.src = stageSrc;
    }
  });
}

function renderSweetSinglePullResult(result, options = {}) {
  const { pet, isNew, fragmentsGained, rarity, triggeredPity } = result;
  const pendingAwakening = !!options.pendingAwakening;
  const title = pet.title ? escapeHtml(pet.title) : '';
  const statusLabel = isNew ? '初次相遇' : '再次相遇';

  openModal(`
    <div class="sweet-summon-result sweet-summon-result--single summon-result-single" data-rarity="${rarity}" data-pending-awakening="${pendingAwakening ? '1' : '0'}">
      <header class="sweet-summon-result__header summon-result-single__header">
        <p class="sweet-summon-result__eyebrow">召喚結果</p>
        ${sweetSummonRarityBadge(rarity)}
        ${triggeredPity ? '<p class="sweet-summon-result__pity">保底觸發</p>' : ''}
      </header>

      <div class="sweet-summon-result__scroll summon-result-single__body">
        <section class="sweet-summon-showcase summon-result-single__showcase" data-rarity="${rarity}" aria-label="召喚寵物展示">
          <div class="sweet-summon-showcase__frame summon-result-single__frame">
            ${petImageHtml(pet, { size: 'lg', loading: 'eager', eager: true, imageVariant: 'card' })}
          </div>
          <p class="summon-result-single__status">${statusLabel}</p>
          <h3 class="sweet-summon-showcase__name summon-result-single__name">${escapeHtml(pet.name)}</h3>
          ${title ? `<p class="summon-result-single__title">${title}</p>` : ''}
          <div class="sweet-summon-showcase__badges summon-result-single__badges">
            ${isNew
              ? '<span class="sweet-summon-badge sweet-summon-badge--status sweet-summon-badge--status-new">NEW</span>'
              : `<span class="sweet-summon-badge sweet-summon-badge--status sweet-summon-badge--status-dup">相遇碎片 +${fragmentsGained}</span>`}
          </div>
          ${pet.summonLine ? `<p class="sweet-summon-showcase__line">「${escapeHtml(pet.summonLine)}」</p>` : ''}
        </section>
      </div>

      ${pendingAwakening
        ? `<footer class="sweet-summon-result__actions sweet-summon-result__actions--continue">
            <button type="button" class="sweet-summon-btn sweet-summon-btn--primary" id="pull-close" data-action="result-continue">繼續</button>
          </footer>`
        : `<footer class="sweet-summon-result__actions">
            <button type="button" class="sweet-summon-btn sweet-summon-btn--ghost" id="pull-close">關閉</button>
          </footer>`}
    </div>
  `);

  upgradeSingleResultImage(pet);
  bindGachaResultButtons('pull-close');
}

function renderSweetTenPullResult(result) {
  const { results, summary } = result;

  const cardsHtml = results
    .map(
      (r, i) => `
      <article class="sweet-summon-grid-card" data-rarity="${r.rarity}" style="animation-delay:${i * 0.05}s">
        <div class="sweet-summon-grid-card__media">${petImageHtml(r.pet, { size: 'sm', loading: 'eager', eager: true })}</div>
        <div class="sweet-summon-grid-card__body">
          ${sweetSummonRarityBadge(r.rarity)}
          <p class="sweet-summon-grid-card__name">${escapeHtml(r.pet.name)}</p>
          <div class="sweet-summon-grid-card__footer">
            ${sweetSummonStatusBadge(r.isNew, r.duplicateFragments)}
            ${r.triggeredPity ? '<span class="sweet-summon-badge sweet-summon-badge--pity">保底</span>' : ''}
          </div>
        </div>
      </article>`
    )
    .join('');

  openModal(`
    <div class="sweet-summon-result sweet-summon-result--ten" data-highest-rarity="${summary.highestRarity}">
      <header class="sweet-summon-result__header">
        <div class="sweet-summon-result__header-row">
          <p class="sweet-summon-result__eyebrow">十連召喚結果</p>
          ${sweetSummonRarityBadge(summary.highestRarity, 'sweet-summon-badge--highest')}
        </div>
        <h2 class="sweet-summon-result__title">今天的召喚成果</h2>
      </header>

      <div class="sweet-summon-result__scroll">
        <section class="sweet-summon-summary" aria-label="十連召喚摘要">
          <div class="sweet-summon-summary__item sweet-summon-summary__item--new">
            <span class="sweet-summon-summary__label">新夥伴</span>
            <span class="sweet-summon-summary__value">${summary.newCount}</span>
          </div>
          <div class="sweet-summon-summary__item sweet-summon-summary__item--dup">
            <span class="sweet-summon-summary__label">重複</span>
            <span class="sweet-summon-summary__value">${summary.duplicateCount}</span>
          </div>
          <div class="sweet-summon-summary__item sweet-summon-summary__item--frag">
            <span class="sweet-summon-summary__label">碎片</span>
            <span class="sweet-summon-summary__value">+${summary.totalFragments}</span>
          </div>
          <div class="sweet-summon-summary__item sweet-summon-summary__item--highest">
            <span class="sweet-summon-summary__label">最高稀有</span>
            <span class="sweet-summon-summary__value">${summary.highestRarity}</span>
          </div>
        </section>

        <div class="sweet-summon-grid" role="list" aria-label="十連召喚卡片">${cardsHtml}</div>
      </div>

      <footer class="sweet-summon-result__actions">
        <button type="button" class="sweet-summon-btn sweet-summon-btn--ghost" id="ten-pull-close">關閉</button>
      </footer>
    </div>
  `);

  bindGachaResultButtons('ten-pull-close');
}

function defaultSummonRarityBadge(rarity, extraClass = '') {
  return `<span class="default-summon-badge default-summon-badge--rarity ${extraClass}" data-rarity="${rarity}">${rarity}</span>`;
}

function defaultSummonStatusBadge(isNew, amount) {
  if (isNew) {
    return '<span class="default-summon-badge default-summon-badge--new">NEW</span>';
  }
  return `<span class="default-summon-badge default-summon-badge--fragment">碎片 +${amount}</span>`;
}

function defaultSummonRarityDesc(rarity) {
  const labels = { N: '普通夥伴', R: '稀有夥伴', SR: '超稀有夥伴', SSR: '極稀有夥伴', UR: '傳說夥伴' };
  return labels[rarity] || rarity;
}

function defaultSummonRarityHint(rarity) {
  if (rarity === 'UR') return '<p class="default-summon-showcase__hint default-summon-showcase__hint--ur">傳說夥伴</p>';
  if (rarity === 'SSR') return '<p class="default-summon-showcase__hint default-summon-showcase__hint--ssr">稀有夥伴</p>';
  return '';
}

function renderDefaultSinglePullResult(result, options = {}) {
  const { pet, isNew, fragmentsGained, rarity, triggeredPity } = result;
  const pendingAwakening = !!options.pendingAwakening;
  const title = pet.title ? escapeHtml(pet.title) : '';
  const statusLabel = isNew ? '初次相遇' : '再次相遇';

  openModal(`
    <div class="default-summon-result default-summon-result--single summon-result-single" data-rarity="${rarity}" data-pending-awakening="${pendingAwakening ? '1' : '0'}">
      <header class="default-summon-result__header summon-result-single__header">
        <p class="default-summon-result__eyebrow">召喚結果</p>
        ${defaultSummonRarityBadge(rarity)}
        ${triggeredPity ? '<p class="default-summon-result__pity">保底觸發</p>' : ''}
      </header>

      <div class="default-summon-result__scroll summon-result-single__body">
        <section class="default-summon-showcase summon-result-single__showcase" data-rarity="${rarity}" aria-label="召喚祭壇展示">
          <div class="default-summon-showcase__altar" aria-hidden="true"></div>
          ${defaultSummonRarityHint(rarity)}
          <div class="default-summon-showcase__frame summon-result-single__frame">
            ${petImageHtml(pet, { size: 'lg', loading: 'eager', eager: true, imageVariant: 'card' })}
          </div>
          <p class="summon-result-single__status">${statusLabel}</p>
          <h3 class="default-summon-showcase__name summon-result-single__name">${escapeHtml(pet.name)}</h3>
          ${title ? `<p class="summon-result-single__title">${title}</p>` : ''}
          <div class="default-summon-showcase__badges summon-result-single__badges">
            ${isNew
              ? '<span class="default-summon-badge default-summon-badge--status default-summon-badge--status-new">NEW</span>'
              : `<span class="default-summon-badge default-summon-badge--status default-summon-badge--status-dup">相遇碎片 +${fragmentsGained}</span>`}
          </div>
          ${pet.summonLine ? `<p class="default-summon-showcase__line">「${escapeHtml(pet.summonLine)}」</p>` : ''}
        </section>
      </div>

      ${pendingAwakening
        ? `<footer class="default-summon-result__actions default-summon-result__actions--continue">
            <button type="button" class="default-summon-btn default-summon-btn--primary" id="pull-close" data-action="result-continue">繼續</button>
          </footer>`
        : `<footer class="default-summon-result__actions">
            <button type="button" class="default-summon-btn default-summon-btn--ghost" id="pull-close">關閉</button>
          </footer>`}
    </div>
  `);

  upgradeSingleResultImage(pet);
  bindGachaResultButtons('pull-close');
}

function renderDefaultTenPullResult(result) {
  const { results, summary } = result;

  const cardsHtml = results
    .map(
      (r, i) => `
      <article class="default-summon-grid-card" data-rarity="${r.rarity}" style="animation-delay:${i * 0.05}s">
        <div class="default-summon-grid-card__media">${petImageHtml(r.pet, { size: 'sm', loading: 'eager', eager: true })}</div>
        <div class="default-summon-grid-card__body">
          ${defaultSummonRarityBadge(r.rarity)}
          <p class="default-summon-grid-card__name">${escapeHtml(r.pet.name)}</p>
          <div class="default-summon-grid-card__footer">
            ${defaultSummonStatusBadge(r.isNew, r.duplicateFragments)}
            ${r.triggeredPity ? '<span class="default-summon-badge default-summon-badge--pity">保底</span>' : ''}
          </div>
        </div>
      </article>`
    )
    .join('');

  openModal(`
    <div class="default-summon-result default-summon-result--ten" data-highest-rarity="${summary.highestRarity}">
      <header class="default-summon-result__header">
        <div class="default-summon-result__header-row">
          <p class="default-summon-result__eyebrow">十連召喚結果</p>
          ${defaultSummonRarityBadge(summary.highestRarity, 'default-summon-badge--highest')}
        </div>
        <h2 class="default-summon-result__title">召喚儀式完成</h2>
      </header>

      <div class="default-summon-result__scroll">
        <section class="default-summon-summary" aria-label="十連召喚摘要">
          <div class="default-summon-summary__item default-summon-summary__item--new">
            <span class="default-summon-summary__label">新夥伴</span>
            <span class="default-summon-summary__value">${summary.newCount}</span>
          </div>
          <div class="default-summon-summary__item default-summon-summary__item--dup">
            <span class="default-summon-summary__label">重複</span>
            <span class="default-summon-summary__value">${summary.duplicateCount}</span>
          </div>
          <div class="default-summon-summary__item default-summon-summary__item--frag">
            <span class="default-summon-summary__label">碎片</span>
            <span class="default-summon-summary__value">+${summary.totalFragments}</span>
          </div>
          <div class="default-summon-summary__item default-summon-summary__item--highest">
            <span class="default-summon-summary__label">最高稀有</span>
            <span class="default-summon-summary__value">${summary.highestRarity}</span>
          </div>
        </section>

        <div class="default-summon-grid" role="list" aria-label="十連召喚卡片">${cardsHtml}</div>
      </div>

      <footer class="default-summon-result__actions">
        <button type="button" class="default-summon-btn default-summon-btn--ghost" id="ten-pull-close">關閉</button>
      </footer>
    </div>
  `);

  bindGachaResultButtons('ten-pull-close');
}

function bindGachaResultButtons(closeId = 'pull-close') {
  const finish = () => {
    closeModal();
  };

  document.getElementById(closeId)?.addEventListener('click', (e) => {
    e.preventDefault();
    finish();
  });

  document.querySelector('[data-action="result-continue"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    finish();
  });

}

function showPullResult(result, options = {}) {
  if (isSweetTheme()) {
    renderSweetSinglePullResult(result, options);
    return;
  }
  renderDefaultSinglePullResult(result, options);
}

function showTenPullResult(result, options = {}) {
  if (isSweetTheme()) {
    renderSweetTenPullResult(result);
  } else {
    renderDefaultTenPullResult(result);
  }
  if (options.pendingAwakening) {
    const footer = document.querySelector('.sweet-summon-result__actions, .default-summon-result__actions');
    if (footer) {
      footer.classList.add('summon-result-actions--continue');
      footer.replaceChildren();
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'ten-pull-close';
      btn.dataset.action = 'result-continue';
      btn.className = isSweetTheme()
        ? 'sweet-summon-btn sweet-summon-btn--primary'
        : 'default-summon-btn default-summon-btn--primary';
      btn.textContent = '繼續';
      footer.appendChild(btn);
      bindGachaResultButtons('ten-pull-close');
    }
  }
}

/** 開啟單抽結果並等待使用者關閉／繼續 */
function showPullResultAndWait(result, options = {}) {
  return new Promise((resolve) => {
    gachaResultCloseResolver = resolve;
    showPullResult(result, options);
  });
}

/** 開啟十連結果並等待使用者關閉／繼續 */
function showTenPullResultAndWait(result, options = {}) {
  return new Promise((resolve) => {
    gachaResultCloseResolver = resolve;
    showTenPullResult(result, options);
  });
}

/* ─── 圖鑑頁 ─── */
