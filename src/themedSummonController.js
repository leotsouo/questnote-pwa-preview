/**
 * 主題召喚動畫控制器 — V3.3.0
 *
 * 嚴格原則：
 * - 只接收「已產生且不可變更」的結果陣列
 * - 不呼叫抽卡、不扣星塵、不寫收藏／保底／補償
 * - 略過／錯誤／Reduced Motion 都只能改變展示，不可重抽
 */
import { getPetImageSrc, preloadImage, delay } from './imagePreloadService.js';
import { createGlacierArrivalScene } from './glacierArrivalScene.js';
import {
  getHighestRarity,
  collectSsrPlusRevealQueue,
  playSsrPlusRevealQueue,
  skipSummonReveal,
} from './summonRevealService.js';

const RARITY_RANK = { N: 0, R: 1, SR: 2, SSR: 3, UR: 4 };

/** @typedef {'idle'|'preparing'|'dreamDust'|'mirrorRipple'|'rarityOmen'|'bloom'|'revealing'|'summary'|'complete'|'fallback'} SummonState */

const STATES = {
  IDLE: 'idle',
  PREPARING: 'preparing',
  DREAM_DUST: 'dreamDust',
  MIRROR_RIPPLE: 'mirrorRipple',
  RARITY_OMEN: 'rarityOmen',
  BLOOM: 'bloom',
  REVEALING: 'revealing',
  SUMMARY: 'summary',
  COMPLETE: 'complete',
  FALLBACK: 'fallback',
};

const PHASE_MS = {
  dreamDust: { single: 900, ten: 1200, reduced: 100 },
  mirrorRipple: { single: 850, ten: 1100, reduced: 100 },
  rarityOmen: {
    N: 550, R: 700, SR: 950, SSR: 1300, UR: 1700, reduced: 120,
  },
  bloom: {
    N: 650, R: 850, SR: 1100, SSR: 1500, UR: 1900, reduced: 140,
  },
  summaryPause: { full: 480, reduced: 100 },
};

const MAX_PARTICLES = 24;

let playing = false;
let activeAbort = null;
let activeOverlay = null;
let activeResolve = null;
let currentState = STATES.IDLE;

export function isThemedSummonPlaying() {
  return playing;
}

export function getThemedSummonState() {
  return currentState;
}

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function isReduceMotion(flag) {
  return !!flag || prefersReducedMotion();
}

function setState(next, liveEl) {
  currentState = next;
  if (activeOverlay) {
    activeOverlay.dataset.state = next;
  }
  if (liveEl && (next === 'rarityOmen' || next === 'revealing' || next === 'summary' || next === 'complete')) {
    const labels = {
      rarityOmen: '稀有度預兆顯現',
      revealing: activeOverlay?.dataset.animation === 'glacier_arrival' ? '遠航夥伴抵達' : '夥伴甦醒中',
      summary: '召喚結果整理',
      complete: '召喚演出結束',
    };
    liveEl.textContent = labels[next] || '';
  }
}

/**
 * @param {number} ms
 * @param {AbortSignal} signal
 */
function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, Math.max(0, ms));
    const onAbort = () => {
      clearTimeout(timer);
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * @param {HTMLImageElement} img
 * @param {string} src
 */
function assignPetImage(img, src, original) {
  if (!img || !src) return false;
  img.classList.remove('is-loaded');
  img.onload = () => img.classList.add('is-loaded');
  img.onerror = () => {
    if (original && img.src !== new URL(original, location.href).href) {
      img.src = original;
    } else {
      img.onerror = null;
      img.classList.add('is-error');
    }
  };
  img.src = src;
  img.decoding = 'async';
  return true;
}

function lockScroll() {
  document.body.classList.add('themed-summon-active');
  const scrollY = window.scrollY || 0;
  document.body.dataset.themedSummonScrollY = String(scrollY);
  document.body.style.top = `-${scrollY}px`;
  document.body.style.position = 'fixed';
  document.body.style.width = '100%';
}

function unlockScroll() {
  document.body.classList.remove('themed-summon-active');
  const scrollY = Number(document.body.dataset.themedSummonScrollY || 0);
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  delete document.body.dataset.themedSummonScrollY;
  window.scrollTo(0, scrollY);
}

// The pool debut does not need to move the body. Keeping its fixed-position
// bottom navigation in the viewport prevents a visible jump on iOS Safari.
function lockDebutScroll() {
  document.body.dataset.debutOverflow = document.body.style.overflow;
  document.documentElement.dataset.debutOverflow = document.documentElement.style.overflow;
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
}

function unlockDebutScroll() {
  document.body.style.overflow = document.body.dataset.debutOverflow || '';
  document.documentElement.style.overflow = document.documentElement.dataset.debutOverflow || '';
  delete document.body.dataset.debutOverflow;
  delete document.documentElement.dataset.debutOverflow;
}

function createParticles(count, className) {
  const n = Math.min(MAX_PARTICLES, Math.max(0, count));
  const frag = document.createDocumentFragment();
  for (let i = 0; i < n; i += 1) {
    const el = document.createElement('span');
    el.className = className;
    el.setAttribute('aria-hidden', 'true');
    el.style.setProperty('--p-i', String(i));
    el.style.setProperty('--p-x', `${8 + Math.round(Math.random() * 84)}%`);
    el.style.setProperty('--p-delay', `${Math.round(Math.random() * 400)}ms`);
    el.style.setProperty('--p-dur', `${900 + Math.round(Math.random() * 700)}ms`);
    frag.appendChild(el);
  }
  return frag;
}

/**
 * 建立主題召喚 overlay（文字一律 textContent）
 * @param {{ mode: string, reduceMotion: boolean, highestRarity: string }} opts
 */
function createOverlay({ mode, reduceMotion, highestRarity, poolName, animationKey }) {
  const glacier = animationKey === 'glacier_arrival';
  const overlay = document.createElement('div');
  overlay.className = 'dream-bloom-overlay';
  overlay.dataset.animation = animationKey;
  overlay.dataset.mode = mode;
  overlay.dataset.omen = highestRarity;
  overlay.dataset.state = STATES.PREPARING;
  if (reduceMotion) overlay.classList.add('is-reduced');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', `${poolName || '召喚'}演出`);

  overlay.innerHTML = `
    <div class="dream-bloom-bg" aria-hidden="true">
      <div class="dream-bloom-bg__night"></div>
      <div class="dream-bloom-bg__mist"></div>
      <div class="dream-bloom-bg__moon"></div>
      <div class="dream-bloom-bg__arch"></div>
      <div class="dream-bloom-bg__pool"></div>
      <div class="dream-bloom-particles" data-role="particles"></div>
    </div>
    <div class="dream-bloom-stage">
      <div class="dream-bloom-dust" data-role="dust" aria-hidden="true"></div>
      <div class="dream-bloom-ripple" data-role="ripple" aria-hidden="true"></div>
      <div class="dream-bloom-omen" data-role="omen" aria-hidden="true"></div>
      <div class="dream-bloom-buds" data-role="buds" aria-hidden="true"></div>
      <div class="dream-bloom-crest" data-role="crest" aria-hidden="true"></div>
      <article class="dream-bloom-seal" data-role="seal" hidden>
        <div class="dream-bloom-seal__reflect" aria-hidden="true"></div>
        <div class="dream-bloom-seal__petal" aria-hidden="true"></div>
        <div class="dream-bloom-seal__media">
          <img class="dream-bloom-seal__img" data-role="seal-img" alt="" decoding="async">
        </div>
        <p class="dream-bloom-seal__rarity" data-role="seal-rarity"></p>
        <h2 class="dream-bloom-seal__name" data-role="seal-name"></h2>
        <p class="dream-bloom-seal__title" data-role="seal-title"></p>
        <p class="dream-bloom-seal__meet" data-role="seal-meet"></p>
        <p class="dream-bloom-seal__comp" data-role="seal-comp" hidden></p>
      </article>
      <div class="dream-bloom-summary" data-role="summary" hidden>
        <p class="dream-bloom-summary__eyebrow" data-role="summary-eyebrow"></p>
        <h2 class="dream-bloom-summary__title" data-role="summary-title"></h2>
        <div class="dream-bloom-summary__grid" data-role="summary-grid"></div>
      </div>
    </div>
    <div class="dream-bloom-live" data-role="live" aria-live="polite"></div>
    <div class="dream-bloom-controls">
      <button type="button" class="dream-bloom-btn" data-action="skip" aria-label="略過演出">略過</button>
      <button type="button" class="dream-bloom-btn dream-bloom-btn--primary" data-action="close" hidden aria-label="關閉結果">關閉結果</button>
    </div>
  `;

  if (glacier) {
    overlay.querySelector('.dream-bloom-bg').replaceWith(createGlacierArrivalScene());
    overlay.querySelectorAll('[data-role="dust"], [data-role="ripple"], [data-role="buds"], [data-role="crest"]').forEach((node) => node.remove());
  }

  return overlay;
}

function fillSeal(overlay, item) {
  const pet = item?.pet || item;
  const rarity = item?.rarity || pet?.rarity || 'N';
  const isNew = !!item?.isNew;
  const fragments = item?.fragmentsGained ?? item?.duplicateFragments ?? 0;

  const rarityEl = overlay.querySelector('[data-role="seal-rarity"]');
  const nameEl = overlay.querySelector('[data-role="seal-name"]');
  const titleEl = overlay.querySelector('[data-role="seal-title"]');
  const meetEl = overlay.querySelector('[data-role="seal-meet"]');
  const compEl = overlay.querySelector('[data-role="seal-comp"]');
  const img = overlay.querySelector('[data-role="seal-img"]');
  const seal = overlay.querySelector('[data-role="seal"]');

  if (seal) {
    seal.hidden = false;
    seal.dataset.rarity = rarity;
    seal.classList.toggle('is-new', isNew);
  }
  if (rarityEl) rarityEl.textContent = rarity;
  if (nameEl) nameEl.textContent = pet?.name ? String(pet.name) : '';
  if (titleEl) titleEl.textContent = pet?.title ? String(pet.title) : '';
  if (meetEl) meetEl.textContent = isNew ? '初次相遇' : '再次相遇';
  if (compEl) {
    if (!isNew && fragments > 0) {
      compEl.hidden = false;
      compEl.textContent = `夢塵碎片 +${fragments}`;
    } else {
      compEl.hidden = true;
      compEl.textContent = '';
    }
  }
  if (img) {
    img.alt = pet?.name ? String(pet.name) : '';
    img.classList.remove('is-loaded');
    const src = getPetImageSrc(pet, 'stage');
    if (src) {
      assignPetImage(img, src, getPetImageSrc(pet));
    } else {
      img.removeAttribute('src');
    }
  }
}

function buildSummaryCards(grid, results) {
  grid.replaceChildren();
  results.forEach((item) => {
    const pet = item?.pet || item;
    const rarity = item?.rarity || pet?.rarity || 'N';
    const card = document.createElement('article');
    card.className = 'dream-bloom-mini-seal';
    card.dataset.rarity = rarity;

    const media = document.createElement('div');
    media.className = 'dream-bloom-mini-seal__media';
    const img = document.createElement('img');
    img.alt = pet?.name ? String(pet.name) : '';
    img.decoding = 'async';
    const src = getPetImageSrc(pet, 'card');
    if (src) assignPetImage(img, src, getPetImageSrc(pet));
    media.appendChild(img);

    const rarityEl = document.createElement('span');
    rarityEl.className = 'dream-bloom-mini-seal__rarity';
    rarityEl.textContent = rarity;

    const nameEl = document.createElement('span');
    nameEl.className = 'dream-bloom-mini-seal__name';
    nameEl.textContent = pet?.name ? String(pet.name) : '';

    const meetEl = document.createElement('span');
    meetEl.className = 'dream-bloom-mini-seal__meet';
    meetEl.textContent = item?.isNew ? '初次相遇' : '再次相遇';

    card.append(media, rarityEl, nameEl, meetEl);
    grid.appendChild(card);
  });
}

function setupBuds(container, count, reduceMotion) {
  container.replaceChildren();
  const n = Math.min(10, Math.max(1, count));
  for (let i = 0; i < n; i += 1) {
    const bud = document.createElement('span');
    bud.className = 'dream-bloom-bud';
    bud.setAttribute('aria-hidden', 'true');
    const angle = -90 + (180 / Math.max(1, n - 1)) * i;
    bud.style.setProperty('--bud-angle', `${angle}deg`);
    bud.style.setProperty('--bud-i', String(i));
    if (!reduceMotion) {
      bud.style.setProperty('--bud-delay', `${i * 40}ms`);
    }
    container.appendChild(bud);
  }
}

/**
 * 播放永眠花海主題召喚（純展示）
 * @param {{
 *   results: Array,
 *   poolName?: string,
 *   mode?: 'single'|'ten'|'preview',
 *   reduceMotion?: boolean,
 *   skipRitual?: boolean,
 * }} options
 * @returns {Promise<{ ok: boolean, fallback: boolean, state: string }>}
 */
export async function playThemedSummon(options = {}) {
  const animationKey = options.animationKey || 'dream_bloom';
  if (!['dream_bloom', 'glacier_arrival'].includes(animationKey)) {
    return { ok: false, fallback: true, state: STATES.FALLBACK };
  }
  const results = Array.isArray(options.results) ? options.results.slice() : [];
  if (results.length === 0) {
    return { ok: false, fallback: true, state: STATES.FALLBACK };
  }
  if (playing) {
    return { ok: false, fallback: true, state: currentState };
  }

  playing = true;
  const reduce = isReduceMotion(options.reduceMotion);
  const mode = options.mode === 'ten' || results.length > 1 ? 'ten' : 'single';
  const highestRarity = getHighestRarity(results);
  const controller = new AbortController();
  activeAbort = controller;
  let overlay = null;
  let cleanupListeners = () => {};
  /** 僅略過前置儀式（夢塵／鏡池／預兆／花苞），不可略過 SSR+ reveal */
  let introSkipped = false;
  let userClosed = false;
  const ssrPlusQueue = collectSsrPlusRevealQueue(results);

  const skipIntroRitual = () => {
    // 禁止同時標記 revealQueueSkipped：主動畫略過後仍必須自動接 SSR+
    introSkipped = true;
    if (!controller.signal.aborted) controller.abort();
  };

  try {
    setState(STATES.PREPARING, null);

    // 預載本次結果圖片（不預載全池）
    const firstPet = results.find((r) => ['SSR', 'UR'].includes(r?.rarity))?.pet || results[0]?.pet;
    const firstSrc = getPetImageSrc(firstPet, 'stage');
    await Promise.race([
      firstSrc ? preloadImage(firstSrc, { eager: true }) : Promise.resolve(),
      delay(reduce ? 100 : 200),
    ]);

    overlay = createOverlay({ mode, reduceMotion: reduce, highestRarity, poolName: options.poolName, animationKey });
    activeOverlay = overlay;
    lockScroll();
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay?.isConnected && overlay.classList.add('is-active'));

    const liveEl = overlay.querySelector('[data-role="live"]');
    const particlesHost = overlay.querySelector('[data-role="particles"]');
    const budsHost = overlay.querySelector('[data-role="buds"]');
    const sealEl = overlay.querySelector('[data-role="seal"]');
    const summaryEl = overlay.querySelector('[data-role="summary"]');
    const stageEl = overlay.querySelector('.dream-bloom-stage');
    const btnSkip = overlay.querySelector('[data-action="skip"]');
    const btnClose = overlay.querySelector('[data-action="close"]');

    if (!reduce && particlesHost) {
      particlesHost.appendChild(createParticles(mode === 'ten' ? 18 : 12, 'dream-bloom-petal'));
    }

    if (budsHost) setupBuds(budsHost, mode === 'ten' ? 10 : 1, reduce);

    const onSkip = (e) => {
      e.preventDefault();
      e.stopPropagation();
      // 結果畫面已顯示時，略過鈕應隱藏；其餘主動畫階段僅略過前置儀式
      if (currentState === STATES.SUMMARY || currentState === STATES.COMPLETE) return;
      if (currentState === STATES.REVEALING) return;
      skipIntroRitual();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (btnClose && !btnClose.hidden) {
          userClosed = true;
          if (typeof activeResolve === 'function') activeResolve();
        } else if (currentState !== STATES.REVEALING) {
          skipIntroRitual();
        }
      }
    };
    const onAccelerate = () => {
      if (currentState === STATES.SUMMARY || currentState === STATES.COMPLETE) return;
      if (currentState === STATES.REVEALING) return;
      skipIntroRitual();
    };

    btnSkip?.addEventListener('click', onSkip);
    overlay.addEventListener('click', (e) => {
      if (e.target.closest('.dream-bloom-controls')) return;
      onAccelerate();
    });
    document.addEventListener('keydown', onKey, true);

    cleanupListeners = () => {
      btnSkip?.removeEventListener('click', onSkip);
      document.removeEventListener('keydown', onKey, true);
    };

    const runPhase = async (state, ms) => {
      if (introSkipped || controller.signal.aborted) return;
      setState(state, liveEl);
      overlay.dataset.phase = state;
      try {
        await wait(ms, controller.signal);
      } catch (err) {
        if (err?.name !== 'AbortError') throw err;
      }
    };

    const omenMs = reduce
      ? PHASE_MS.rarityOmen.reduced
      : (PHASE_MS.rarityOmen[highestRarity] ?? PHASE_MS.rarityOmen.N);
    const bloomMs = reduce
      ? PHASE_MS.bloom.reduced
      : (PHASE_MS.bloom[highestRarity] ?? PHASE_MS.bloom.N);

    if (!options.skipRitual) {
      await runPhase(
        STATES.DREAM_DUST,
        reduce ? PHASE_MS.dreamDust.reduced : PHASE_MS.dreamDust[mode],
      );
      await runPhase(
        STATES.MIRROR_RIPPLE,
        reduce ? PHASE_MS.mirrorRipple.reduced : PHASE_MS.mirrorRipple[mode],
      );
      await runPhase(STATES.RARITY_OMEN, omenMs);
      await runPhase(STATES.BLOOM, bloomMs);
    } else {
      introSkipped = true;
    }

    // SSR+ 自動出場：主動畫（含略過）後、結果總覽前。introSkipped 不得跳過 queue。
    if (ssrPlusQueue.length > 0) {
      setState(STATES.REVEALING, liveEl);
      if (btnSkip) btnSkip.hidden = true;
      if (sealEl) sealEl.hidden = true;
      if (summaryEl) summaryEl.hidden = true;
      if (stageEl) stageEl.hidden = true;
      overlay.classList.add('is-ssrplus-handoff');
      try {
        await playSsrPlusRevealQueue({
          results,
          reduceMotion: reduce,
        });
      } catch (err) {
        console.warn('[DreamBloom] SSR+ reveal fallback，繼續結果畫面', err);
      }
      overlay.classList.remove('is-ssrplus-handoff');
      if (stageEl) stageEl.hidden = false;
    }

    // 收束畫面：單抽維持置中花印；十連才切到摘要網格
    setState(STATES.SUMMARY, liveEl);
    if (mode === 'single') {
      if (summaryEl) summaryEl.hidden = true;
      fillSeal(overlay, results[0]);
    } else {
      if (sealEl) sealEl.hidden = true;
      if (summaryEl) {
        summaryEl.hidden = false;
        const eyebrow = overlay.querySelector('[data-role="summary-eyebrow"]');
        const title = overlay.querySelector('[data-role="summary-title"]');
        const grid = overlay.querySelector('[data-role="summary-grid"]');
        if (eyebrow) eyebrow.textContent = animationKey === 'glacier_arrival' ? '十連遠航契約' : '十連夢境花印';
        if (title) title.textContent = animationKey === 'glacier_arrival' ? '遠航夥伴已抵達' : '沉睡生命已甦醒';
        if (grid) buildSummaryCards(grid, results);
      }
    }
    if (btnSkip) btnSkip.hidden = true;
    if (btnClose) {
      btnClose.hidden = false;
      btnClose.focus();
    }

    await new Promise((resolve) => {
      activeResolve = resolve;
      const onClose = (e) => {
        e.stopPropagation();
        userClosed = true;
        resolve();
      };
      btnClose?.addEventListener('click', onClose, { once: true });
      // 摘要停留後也可點空白關閉
      const onOverlayClose = (e) => {
        if (e.target.closest('.dream-bloom-controls')) return;
        if (e.target.closest('.dream-bloom-summary')) return;
        if (e.target.closest('.dream-bloom-seal')) return;
        userClosed = true;
        resolve();
      };
      overlay.addEventListener('click', onOverlayClose);
      const pause = reduce ? PHASE_MS.summaryPause.reduced : PHASE_MS.summaryPause.full;
      // 不自動關閉；等使用者。僅保留 pause 讓畫面先穩定。
      wait(pause, new AbortController().signal).catch(() => {});
      // 保險：若外部 skip 已觸發且 summary 顯示，仍等 close
      void userClosed;
    });

    cleanupListeners();
    setState(STATES.COMPLETE, liveEl);
    return { ok: true, fallback: false, state: STATES.COMPLETE };
  } catch (err) {
    console.warn('[DreamBloom] 演出失敗，退回簡化結果畫面', err);
    setState(STATES.FALLBACK, null);
    return { ok: false, fallback: true, state: STATES.FALLBACK };
  } finally {
    cleanupListeners();
    if (activeOverlay && activeOverlay.parentNode) {
      activeOverlay.parentNode.removeChild(activeOverlay);
    }
    document.querySelectorAll('.dream-bloom-overlay').forEach((el) => el.remove());
    activeOverlay = null;
    activeAbort = null;
    activeResolve = null;
    unlockScroll();
    playing = false;
    currentState = STATES.IDLE;
  }
}

/** Kept for existing previews; new pools dispatch through playThemedSummon. */
export function playDreamBloomSummon(options = {}) {
  return playThemedSummon({ ...options, animationKey: 'dream_bloom' });
}

/**
 * 外部強制結束。
 * - 若尚在前置儀式：只 abort 儀式（等同 introSkipped），不略過 SSR+ queue。
 * - 若已在 REVEALING：才略過剩餘 reveal queue。
 * - 若已在 SUMMARY：關閉結果。
 */
export function skipThemedSummon() {
  if (currentState === STATES.REVEALING) {
    skipSummonReveal();
  }
  if (currentState === STATES.SUMMARY || currentState === STATES.COMPLETE) {
    if (typeof activeResolve === 'function') {
      activeResolve();
    }
    return;
  }
  if (activeAbort && !activeAbort.signal.aborted) {
    activeAbort.abort();
  }
}

const DEBUT_DUST_COUNT = { full: 8, short: 3, reduced: 0 };

/**
 * 永眠花海卡池入場演出
 * 流程：長夜沉幕 → 鏡池微光 → 月皇花甦醒 → 台詞 → 停在完整畫面等待點擊 → 關閉時化開成主畫面
 * 動畫播完後需使用者點擊／Esc／繼續才關閉；略過可提早結束。
 * @param {{ poolName?: string, presentation?: object, reduceMotion?: boolean, full?: boolean }} options
 */
export async function playPoolDebutPresentation(options = {}) {
  const glacier = options.presentation?.animationKey === 'glacier_arrival';
  const reduce = isReduceMotion(options.reduceMotion);
  const full = options.full !== false;
  // 進入「可關閉」狀態前的演出時長（不含等待點擊）
  const readyMs = reduce ? (full ? 1400 : 820) : full ? 3400 : 900;
  const dissolveMs = reduce ? 240 : full ? 550 : 360;

  const panel = document.getElementById('gacha-panel');
  panel?.classList.add('is-pool-debut-veil');
  panel?.classList.remove('is-pool-debut-reveal');

  const overlay = document.createElement('div');
  overlay.className = 'dream-debut-overlay';
  overlay.dataset.animation = glacier ? 'glacier_arrival' : 'dream_bloom';
  if (reduce) overlay.classList.add('is-reduced');
  if (!full) overlay.classList.add('is-short');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', options.presentation?.debutLabel || `${options.poolName || '卡池'}登場`);
  overlay.innerHTML = `
    <div class="dream-debut-stage" aria-hidden="true">
      <div class="dream-debut-bg"></div>
      <div class="dream-debut-mist"></div>
      <div class="dream-debut-dust" data-role="dust"></div>
      <div class="dream-debut-mirror">
        <div class="dream-debut-mirror__glow"></div>
        <div class="dream-debut-mirror__ripple dream-debut-mirror__ripple--1"></div>
        <div class="dream-debut-mirror__ripple dream-debut-mirror__ripple--2"></div>
      </div>
      <div class="dream-debut-flower">
        <div class="dream-debut-flower__aura"></div>
        <span class="dream-debut-flower__petal dream-debut-flower__petal--1"></span>
        <span class="dream-debut-flower__petal dream-debut-flower__petal--2"></span>
        <span class="dream-debut-flower__petal dream-debut-flower__petal--3"></span>
        <span class="dream-debut-flower__petal dream-debut-flower__petal--4"></span>
        <span class="dream-debut-flower__petal dream-debut-flower__petal--5"></span>
        <span class="dream-debut-flower__core"></span>
      </div>
    </div>
    <div class="dream-debut-copy">
      <p class="dream-debut-line" data-role="line">
        <span class="dream-debut-line__seg" data-seg="a"></span>
        <span class="dream-debut-line__seg" data-seg="b"></span>
        <span class="dream-debut-line__seg" data-seg="c"></span>
      </p>
      <p class="dream-debut-continue" data-role="continue" hidden>點擊畫面繼續</p>
    </div>
    <button type="button" class="dream-debut-skip" data-role="skip" aria-label="略過登場演出">略過</button>
  `;

  if (glacier) overlay.querySelector('.dream-debut-stage').replaceWith(createGlacierArrivalScene());
  const lines = options.presentation?.debutLines || [];
  overlay.querySelectorAll('.dream-debut-line__seg').forEach((element, index) => {
    element.textContent = lines[index] || '';
  });

  const dustHost = overlay.querySelector('[data-role="dust"]');
  const dustCount = reduce
    ? DEBUT_DUST_COUNT.reduced
    : full
      ? DEBUT_DUST_COUNT.full
      : DEBUT_DUST_COUNT.short;
  if (dustHost && dustCount > 0) {
    dustHost.appendChild(createParticles(dustCount, 'dream-debut-dust__mote'));
  }

  const skipBtn = overlay.querySelector('[data-role="skip"]');
  const continueEl = overlay.querySelector('[data-role="continue"]');
  const timers = new Set();
  let ready = false;
  let finished = false;
  let resolveDone = null;
  const donePromise = new Promise((resolve) => {
    resolveDone = resolve;
  });

  const clearTimers = () => {
    timers.forEach((id) => clearTimeout(id));
    timers.clear();
  };

  const schedule = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  };

  const beginRevealBridge = () => {
    overlay.classList.add('is-phase-reveal');
    panel?.classList.remove('is-pool-debut-veil');
    panel?.classList.add('is-pool-debut-reveal');
  };

  const markReady = () => {
    if (finished || ready) return;
    ready = true;
    overlay.classList.add('is-ready');
    // 等待點擊期間維持完整夜幕；關閉時才淡出銜接主畫面
    if (continueEl) continueEl.hidden = false;
    if (skipBtn) {
      skipBtn.textContent = '繼續';
      skipBtn.setAttribute('aria-label', '繼續');
      try {
        skipBtn.focus();
      } catch {
        /* ignore */
      }
    }
  };

  const finish = (fromSkip = false) => {
    if (finished) return;
    finished = true;
    clearTimers();
    if (fromSkip && !ready) {
      overlay.classList.add('is-skipped');
      // 確保略過時台詞與花立刻到位
      overlay.classList.add('is-phase-pool', 'is-phase-bloom', 'is-phase-line');
    }
    beginRevealBridge();
    overlay.classList.add('is-exiting');
    overlay.classList.remove('is-active');
    const exitWait = fromSkip && !ready ? Math.min(280, dissolveMs) : dissolveMs;
    schedule(() => resolveDone?.(), exitWait);
  };

  // 避免開啟卡池的殘留 click 立刻關閉；略過鈕不受此限
  let armPointerClose = false;
  schedule(() => {
    armPointerClose = true;
  }, 420);

  const onSkip = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    finish(!ready);
  };

  const onOverlayPointer = (e) => {
    if (finished || !armPointerClose) return;
    if (e.target.closest('[data-role="skip"]')) return;
    // 演出中僅略過／Esc 可提早結束；播完後點擊畫面才關閉
    if (!ready) return;
    finish(false);
  };

  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      finish(!ready);
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && ready) {
      e.preventDefault();
      finish(false);
    }
  };

  skipBtn?.addEventListener('click', onSkip);
  overlay.addEventListener('click', onOverlayPointer);
  document.addEventListener('keydown', onKey, true);

  lockDebutScroll();
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay?.isConnected && overlay.classList.add('is-active', 'is-phase-night'));

  // 分鏡節奏：台詞完整顯現後進入可關閉狀態，等待使用者點擊
  // full line CSS：a 0–0.7s、b 0.28–0.98s、c 0.55–1.3s → 約 1.3s 跑完
  if (!reduce && full) {
    schedule(() => overlay.classList.add('is-phase-pool'), 400);
    schedule(() => overlay.classList.add('is-phase-bloom'), 1000);
    schedule(() => overlay.classList.add('is-phase-line'), 1800);
  } else if (!reduce && !full) {
    schedule(() => overlay.classList.add('is-phase-pool', 'is-phase-bloom'), 120);
    schedule(() => overlay.classList.add('is-phase-line'), 280);
  } else {
    schedule(() => overlay.classList.add('is-phase-pool', 'is-phase-bloom', 'is-phase-line'), 80);
  }

  schedule(() => {
    if (!finished) markReady();
  }, readyMs);

  try {
    await donePromise;
  } finally {
    clearTimers();
    skipBtn?.removeEventListener('click', onSkip);
    overlay.removeEventListener('click', onOverlayPointer);
    document.removeEventListener('keydown', onKey, true);
    overlay.remove();
    panel?.classList.remove('is-pool-debut-veil', 'is-pool-debut-reveal');
    unlockDebutScroll();
  }
}

export { STATES as THEMED_SUMMON_STATES, RARITY_RANK };
