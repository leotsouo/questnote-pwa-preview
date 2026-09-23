/**
 * SSR / UR 抽卡演出特效 — V3.4.3
 *
 * 重要原則：
 * 1. 演出只根據「已經產生」的抽卡結果播放。
 * 2. 演出不影響中獎結果、不重新抽卡、不扣星塵、不寫入任何資料。
 * 3. 只使用 CSS / DOM 動畫，不使用 canvas、不引入外部動畫庫。
 * 4. 只要結果含 SSR+，依原始順序自動播放完整 queue，再交回結果畫面。
 * 5. 主動畫略過 ≠ SSR+ queue 略過（由呼叫端區分；本模組只處理 reveal queue skip）。
 */
import { getPetImageSrc, preloadPetImage, delay } from './imagePreloadService.js';
import { resolvePetRevealKey, resolvePetRevealPresentation } from './poolContentContract.js';

const RARITY_RANK = { N: 0, R: 1, SR: 2, SSR: 3, UR: 4 };

/** 演出時間（毫秒） */
const DURATION = {
  SSR: 1500,
  UR: 2200,
  UR_MOON: 2800,
  UR_PETAL: 2800,
  reducedSsr: 550,
  reducedUr: 750,
  queueGap: 280,
  queueGapReduced: 120,
  fallbackReady: 400,
};

/** 圖片預載最長等待（毫秒），逾時就先播放 */
const PRELOAD_TIMEOUT = 550;

/** 粒子／花瓣數量上限（控制手機效能） */
const PARTICLE_COUNT = { SSR: 12, UR: 16, UR_PETAL: 14, UR_MOON: 10 };

let summonRevealPlaying = false;
let reduceMotionEnabled = false;
let activeOverlay = null;
let activeFinish = null;
/** 僅表示「略過剩餘 SSR+ reveal queue」，不可與主動畫略過共用 */
let revealQueueSkipped = false;
let activeSessionCleanup = null;
let activeRafIds = [];
let activeTimers = [];

/**
 * 由 App 設定同步 reduce motion 狀態（設定頁切換時呼叫）。
 * @param {boolean} value
 */
export function setSummonRevealReduceMotion(value) {
  reduceMotionEnabled = !!value;
}

/** 演出是否正在播放中 */
export function isSummonRevealPlaying() {
  return summonRevealPlaying;
}

/** 該稀有度是否需要播放大型演出 */
export function shouldPlayReveal(rarity) {
  return rarity === 'SSR' || rarity === 'UR';
}

/** 目前是否已略過剩餘 reveal queue */
export function isRevealQueueSkipped() {
  return revealQueueSkipped;
}

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function isReduceMotion(override) {
  const app = override ?? reduceMotionEnabled;
  return !!app || prefersReducedMotion();
}

function getItemRarity(item) {
  return item?.rarity ?? item?.pet?.rarity ?? 'N';
}

function getItemPet(item) {
  return item?.pet ?? (item && item.rarity ? item : null);
}

function getPetId(pet, item) {
  return pet?.id || item?.id || item?.petId || '';
}

function getDuplicateCompensation(item) {
  return item?.fragmentsGained ?? item?.duplicateFragments ?? 0;
}

/**
 * @param {object|null} pet
 * @param {object} item
 * @returns {'ssr'|'ur'|'moon'|'petal'}
 */
export function resolveRevealTheme(pet, item) {
  const rarity = item?.rarity ?? pet?.rarity;
  return resolvePetRevealKey({ ...pet, id: getPetId(pet, item), rarity }) || 'ssr';
}

/**
 * 取得一組結果中的最高稀有度。
 * @param {Array<{ rarity?: string, pet?: { rarity?: string } }>} results
 * @returns {string}
 */
export function getHighestRarity(results) {
  const list = Array.isArray(results) ? results : [];
  let best = 'N';
  for (const item of list) {
    const rarity = getItemRarity(item);
    if (rarity && (RARITY_RANK[rarity] ?? -1) > (RARITY_RANK[best] ?? -1)) {
      best = rarity;
    }
  }
  return best;
}

/**
 * 依原始順序收集本次所有 SSR+ 項目（不可重排、不可依 petId 去重、不可只取最高）。
 * @param {Array} results
 * @returns {Array<{
 *   item: object,
 *   pet: object|null,
 *   petId: string,
 *   rarity: string,
 *   theme: string,
 *   index: number,
 *   isNew: boolean,
 *   duplicateCompensation: number,
 * }>}
 */
export function collectSsrPlusRevealQueue(results) {
  const list = Array.isArray(results) ? results : [];
  const queue = [];
  list.forEach((item, index) => {
    const rarity = getItemRarity(item);
    if (!shouldPlayReveal(rarity)) return;
    const pet = getItemPet(item);
    queue.push({
      item,
      pet,
      petId: getPetId(pet, item),
      rarity,
      theme: resolveRevealTheme(pet, item),
      index,
      isNew: !!item?.isNew,
      duplicateCompensation: getDuplicateCompensation(item),
    });
  });
  return queue;
}

/**
 * 從結果中挑出代表寵物：優先該稀有度第一個「新獲得」，否則第一個。
 * @param {Array} results
 * @param {string} rarity
 * @returns {object|null}
 */
export function getRevealPetFromResults(results, rarity) {
  const list = Array.isArray(results) ? results : [];
  const matches = list.filter((item) => getItemRarity(item) === rarity);
  if (matches.length === 0) return null;
  const fresh = matches.find((item) => item?.isNew);
  const chosen = fresh || matches[0];
  return getItemPet(chosen);
}

/**
 * Debug 專用：從已載入 pets 中找該稀有度第一隻（找不到回傳 null）。
 * @param {string} rarity
 * @param {Array<{ rarity?: string }>} allPets
 * @returns {object|null}
 */
export function pickDebugPetByRarity(rarity, allPets) {
  const list = Array.isArray(allPets) ? allPets : [];
  return list.find((pet) => pet?.rarity === rarity) || null;
}

function trackTimer(id) {
  activeTimers.push(id);
  return id;
}

function trackRaf(id) {
  activeRafIds.push(id);
  return id;
}

function clearTrackedTimers() {
  activeTimers.forEach((id) => clearTimeout(id));
  activeTimers = [];
  activeRafIds.forEach((id) => cancelAnimationFrame(id));
  activeRafIds = [];
}

function buildParticlesHtml(theme, reduceMotion) {
  if (reduceMotion) return '';
  const countKey = theme === 'petal' ? 'UR_PETAL' : theme === 'moon' ? 'UR_MOON' : theme === 'ur' ? 'UR' : 'SSR';
  const count = PARTICLE_COUNT[countKey] ?? 12;
  return Array.from({ length: count }, (_, i) => {
    const left = Math.round(Math.random() * 100);
    const dxDeg = Math.round(Math.random() * 360);
    const dist = 30 + Math.round(Math.random() * 45);
    const dx = Math.round(Math.cos((dxDeg * Math.PI) / 180) * dist);
    const dy = Math.round(Math.sin((dxDeg * Math.PI) / 180) * dist);
    const delayMs = Math.round(Math.random() * 500);
    const durMs = 900 + Math.round(Math.random() * 700);
    const size = 4 + Math.round(Math.random() * 5);
    const cls = theme === 'petal' ? 'summon-reveal-particle summon-reveal-petal' : 'summon-reveal-particle';
    return `<span class="${cls}" style="left:${left}%;--p-dx:${dx}px;--p-dy:${dy}px;--p-delay:${delayMs}ms;--p-dur:${durMs}ms;--p-size:${size}px;--p-i:${i}"></span>`;
  }).join('');
}

function buildFallingPetalsHtml(reduceMotion) {
  if (reduceMotion) {
    return Array.from({ length: 4 }, (_, i) => (
      `<span class="summon-reveal-fall-petal is-static" style="--fp-i:${i};--fp-x:${18 + i * 18}%"></span>`
    )).join('');
  }
  return Array.from({ length: 12 }, (_, i) => {
    const x = 6 + Math.round(Math.random() * 88);
    const delayMs = Math.round(Math.random() * 900);
    const durMs = 1600 + Math.round(Math.random() * 900);
    const drift = -24 + Math.round(Math.random() * 48);
    const rot = -40 + Math.round(Math.random() * 80);
    const size = 10 + Math.round(Math.random() * 10);
    return `<span class="summon-reveal-fall-petal" style="--fp-i:${i};--fp-x:${x}%;--fp-delay:${delayMs}ms;--fp-dur:${durMs}ms;--fp-drift:${drift}px;--fp-rot:${rot}deg;--fp-size:${size}px"></span>`;
  }).join('');
}

function themeClassName(theme) {
  if (theme === 'moon') return 'is-ur is-moon-ur';
  if (theme === 'petal') return 'is-ur is-petal-ur';
  if (theme === 'ur') return 'is-ur';
  return 'is-ssr';
}

function themeCaption(theme, pet) {
  return resolvePetRevealPresentation({
    ...pet, rarity: theme === 'ssr' ? 'SSR' : 'UR',
    presentation: { ...pet?.presentation, revealKey: theme },
  }).caption;
}

function durationForTheme(theme, reduce) {
  if (reduce) {
    return theme === 'ssr' ? DURATION.reducedSsr : DURATION.reducedUr;
  }
  if (theme === 'moon') return DURATION.UR_MOON;
  if (theme === 'petal') return DURATION.UR_PETAL;
  if (theme === 'ur') return DURATION.UR;
  return DURATION.SSR;
}

/**
 * 建立演出 overlay DOM。
 * @param {{ rarity: string, pet: object|null, reduceMotion: boolean, theme?: string, progressText?: string, fallback?: boolean }} options
 * @returns {HTMLDivElement}
 */
export function createSummonRevealOverlay({ rarity, pet, reduceMotion, theme, progressText = '', fallback = false }) {
  const resolvedTheme = theme || resolveRevealTheme(pet, { rarity, pet });
  const isUR = rarity === 'UR' || resolvedTheme !== 'ssr';
  const overlay = document.createElement('div');
  overlay.className = `summon-reveal-overlay ${themeClassName(resolvedTheme)}`;
  if (reduceMotion) overlay.classList.add('is-reduced');
  if (fallback) overlay.classList.add('is-fallback');
  overlay.dataset.theme = resolvedTheme;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', isUR ? '傳說召喚演出' : '稀有召喚演出');

  const caption = fallback ? '演出簡化展示' : themeCaption(resolvedTheme, pet);
  const petName = pet?.name ? String(pet.name) : '';
  const petTitle = pet?.title ? String(pet.title) : '';
  const imgSrc = fallback ? '' : getPetImageSrc(pet, 'stage');
  const particlesHtml = fallback ? '' : buildParticlesHtml(resolvedTheme, reduceMotion);
  const petalsHtml = !fallback && resolvedTheme === 'petal' ? buildFallingPetalsHtml(reduceMotion) : '';
  const moonHtml = !fallback && resolvedTheme === 'moon'
    ? `<div class="summon-reveal-moon" aria-hidden="true">
         <div class="summon-reveal-moon__disc"></div>
         <div class="summon-reveal-moon__glow"></div>
       </div>`
    : '';

  overlay.innerHTML = `
    <div class="summon-reveal-bg"></div>
    <div class="summon-reveal-pool" aria-hidden="true"></div>
    ${moonHtml}
    <div class="summon-reveal-fall-petals" aria-hidden="true">${petalsHtml}</div>
    <div class="summon-reveal-stage">
      <div class="summon-reveal-aura" aria-hidden="true"></div>
      <div class="summon-reveal-ring" aria-hidden="true"></div>
      <div class="summon-reveal-particles" aria-hidden="true">${particlesHtml}</div>
      <div class="summon-reveal-card">
        <div class="summon-reveal-rarity">${isUR ? 'UR' : 'SSR'}</div>
        <div class="summon-reveal-pet-frame"></div>
        <div class="summon-reveal-name"></div>
        <div class="summon-reveal-title"></div>
        <div class="summon-reveal-caption"></div>
      </div>
    </div>
    <div class="summon-reveal-progress" data-role="progress" ${progressText ? '' : 'hidden'}></div>
    <div class="summon-reveal-continue" aria-hidden="true">點擊畫面繼續</div>
    <button class="summon-reveal-skip" type="button" aria-label="略過演出">略過</button>
  `;

  const captionEl = overlay.querySelector('.summon-reveal-caption');
  if (captionEl) captionEl.textContent = caption;
  const nameEl = overlay.querySelector('.summon-reveal-name');
  if (nameEl) nameEl.textContent = petName;
  const titleEl = overlay.querySelector('.summon-reveal-title');
  if (titleEl) titleEl.textContent = petTitle;
  const progressEl = overlay.querySelector('[data-role="progress"]');
  if (progressEl && progressText) progressEl.textContent = progressText;

  const frame = overlay.querySelector('.summon-reveal-pet-frame');
  if (frame && imgSrc) {
    const img = document.createElement('img');
    img.className = 'summon-reveal-pet-image';
    img.alt = petName;
    img.decoding = 'async';
    img.loading = 'eager';
    img.addEventListener('load', () => img.classList.add('is-loaded'));
    img.addEventListener('error', () => {
      const original = getPetImageSrc(pet);
      if (original && img.src !== new URL(original, location.href).href) {
        img.src = original;
        return;
      }
      img.remove();
      frame.classList.add('is-missing');
      if (!frame.querySelector('.summon-reveal-fallback-label')) {
        const label = document.createElement('span');
        label.className = 'summon-reveal-fallback-label';
        label.textContent = petName || (isUR ? 'UR' : 'SSR');
        frame.appendChild(label);
      }
    });
    img.src = imgSrc;
    frame.appendChild(img);
  } else if (frame && fallback) {
    frame.classList.add('is-missing');
    const label = document.createElement('span');
    label.className = 'summon-reveal-fallback-label';
    label.textContent = petName || (isUR ? 'UR' : 'SSR');
    frame.appendChild(label);
  }

  return overlay;
}

/** 移除 overlay，並清掉任何殘留的 overlay，避免黑幕／月亮／花瓣殘留 */
export function removeSummonRevealOverlay() {
  clearTrackedTimers();
  if (typeof activeSessionCleanup === 'function') {
    try {
      activeSessionCleanup();
    } catch {
      /* ignore */
    }
    activeSessionCleanup = null;
  }
  if (activeOverlay && activeOverlay.parentNode) {
    activeOverlay.parentNode.removeChild(activeOverlay);
  }
  document.querySelectorAll('.summon-reveal-overlay').forEach((el) => el.remove());
  document.querySelectorAll('.summon-reveal-moon').forEach((el) => {
    if (!el.closest('.summon-reveal-overlay')) el.remove();
  });
  document.querySelectorAll('.summon-reveal-fall-petal').forEach((el) => {
    if (!el.closest('.summon-reveal-overlay')) el.remove();
  });
  activeOverlay = null;
}

/** 立即跳過剩餘 SSR+ reveal queue（不影響主動畫語意） */
export function skipSummonReveal() {
  revealQueueSkipped = true;
  if (typeof activeFinish === 'function') activeFinish({ skipQueue: true });
}

/**
 * 播放單一 SSR / UR 抽卡演出。
 * 動畫播完後停留在最終畫面，等使用者點擊／按繼續後才關閉（方便截圖紀念）。
 * @param {{
 *   rarity: string,
 *   pet?: object|null,
 *   mode?: string,
 *   results?: Array,
 *   reduceMotion?: boolean,
 *   theme?: string,
 *   progressText?: string,
 *   queueMode?: boolean,
 *   forceFallback?: boolean,
 * }} options
 * @returns {Promise<void>}
 */
export async function playSummonReveal({
  rarity,
  pet = null,
  mode = 'single',
  results = [],
  reduceMotion,
  theme,
  progressText = '',
  queueMode = false,
  forceFallback = false,
} = {}) {
  void mode;
  void results;

  if (!shouldPlayReveal(rarity)) return;

  // 單次／debug 播放不得沿用上一輪 queue 的 skip 旗標
  if (!queueMode) {
    revealQueueSkipped = false;
  }

  // 若上一張殘留，先強制清場，避免卡住整條 queue
  if (summonRevealPlaying) {
    removeSummonRevealOverlay();
    document.body.classList.remove('summon-reveal-active');
    activeFinish = null;
    summonRevealPlaying = false;
  }

  if (revealQueueSkipped) return;

  summonRevealPlaying = true;
  const reduce = isReduceMotion(reduceMotion);
  const resolvedTheme = theme || resolveRevealTheme(pet, { rarity, pet });
  let overlay = null;
  let useFallback = !!forceFallback;

  try {
    if (!useFallback) {
      const src = getPetImageSrc(pet, 'stage');
      if (src) {
        try {
          await Promise.race([preloadPetImage(pet, 'stage'), delay(PRELOAD_TIMEOUT)]);
        } catch {
          useFallback = true;
        }
      }
    }

    if (revealQueueSkipped) return;

    try {
      overlay = createSummonRevealOverlay({
        rarity,
        pet,
        reduceMotion: reduce,
        theme: resolvedTheme,
        progressText,
        fallback: useFallback,
      });
    } catch (createErr) {
      console.warn('[SummonReveal] overlay 建立失敗，改用 fallback', createErr);
      overlay = createSummonRevealOverlay({
        rarity,
        pet,
        reduceMotion: true,
        theme: resolvedTheme,
        progressText,
        fallback: true,
      });
      useFallback = true;
    }

    activeOverlay = overlay;
    document.body.appendChild(overlay);
    document.body.classList.add('summon-reveal-active');

    requestAnimationFrame(() => overlay?.isConnected && overlay.classList.add('is-active'));

    const duration = useFallback
      ? DURATION.fallbackReady
      : durationForTheme(resolvedTheme, reduce);

    await new Promise((resolve) => {
      let completed = false;
      let advancing = false;
      let ready = false;
      const skipBtn = overlay.querySelector('.summon-reveal-skip');
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const signal = controller?.signal;

      const cleanup = () => {
        clearTrackedTimers();
        skipBtn?.removeEventListener('click', onButton);
        overlay.removeEventListener('click', onOverlayClick);
        document.removeEventListener('keydown', onKey, true);
        overlay.removeEventListener('animationend', onAnimationEnd);
        try {
          controller?.abort();
        } catch {
          /* ignore */
        }
      };

      activeSessionCleanup = cleanup;

      const finish = (opts = {}) => {
        if (completed || advancing) return;
        advancing = true;
        try {
          if (opts.skipQueue) revealQueueSkipped = true;
          completed = true;
          cleanup();
          activeSessionCleanup = null;
          resolve();
        } finally {
          advancing = false;
        }
      };

      /** 單一 advance 入口：點擊／按鈕／Esc／就緒後繼續 皆走這裡 */
      const advanceOnce = (opts = {}) => {
        finish(opts);
      };

      const enterReady = () => {
        if (completed) return;
        ready = true;
        overlay.classList.add('is-ready');
        if (skipBtn) {
          skipBtn.textContent = '繼續';
          skipBtn.setAttribute('aria-label', '繼續');
        }
      };

      const onButton = (e) => {
        e.preventDefault();
        e.stopPropagation();
        // 動畫未完成時按「略過」= 略過剩餘 queue；就緒後「繼續」只關閉本張
        advanceOnce({ skipQueue: !ready });
      };

      const onOverlayClick = (e) => {
        if (e.target.closest('.summon-reveal-skip')) return;
        if (!ready) return;
        advanceOnce({ skipQueue: false });
      };

      const onKey = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          advanceOnce({ skipQueue: true });
        } else if ((e.key === 'Enter' || e.key === ' ') && ready) {
          e.preventDefault();
          advanceOnce({ skipQueue: false });
        }
      };

      const onAnimationEnd = () => {
        // 僅作就緒輔助；真正關閉仍需使用者或略過，且冪等
        if (!ready) enterReady();
      };

      skipBtn?.addEventListener('click', onButton);
      overlay.addEventListener('click', onOverlayClick);
      document.addEventListener('keydown', onKey, true);
      overlay.addEventListener('animationend', onAnimationEnd);
      trackTimer(setTimeout(enterReady, duration));

      activeFinish = (opts = {}) => {
        advanceOnce({ skipQueue: opts.skipQueue !== false });
      };

      // 若在 overlay 就緒前已按下略過 queue，立即結束本張
      if (revealQueueSkipped) {
        advanceOnce({ skipQueue: true });
      }

      void signal;
    });
  } catch (err) {
    console.warn('[SummonReveal] 單張演出錯誤，顯示簡化 fallback 後繼續', err);
    // 單張失敗不得中止整條 queue：短暫 fallback 後結束本張
    try {
      removeSummonRevealOverlay();
      const fb = createSummonRevealOverlay({
        rarity,
        pet,
        reduceMotion: true,
        theme: resolvedTheme,
        progressText,
        fallback: true,
      });
      activeOverlay = fb;
      document.body.appendChild(fb);
      fb.classList.add('is-active', 'is-ready');
      await new Promise((resolve) => {
        let done = false;
        const finishFb = () => {
          if (done) return;
          done = true;
          resolve();
        };
        const btn = fb.querySelector('.summon-reveal-skip');
        if (btn) {
          btn.textContent = '繼續';
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            finishFb();
          }, { once: true });
        }
        fb.addEventListener('click', finishFb, { once: true });
        trackTimer(setTimeout(finishFb, 1200));
      });
    } catch (fbErr) {
      console.warn('[SummonReveal] fallback 亦失敗，跳過本張', fbErr);
    }
  } finally {
    removeSummonRevealOverlay();
    document.body.classList.remove('summon-reveal-active');
    activeFinish = null;
    summonRevealPlaying = false;
  }
}

/**
 * 依原始順序播放本次所有 SSR+ 出場演出。
 * 每張播完後等待使用者點擊再進下一張／結果（可截圖紀念）。
 * 略過 = 跳過剩餘 reveal，進結果；不重抽。
 * @param {{ results: Array, reduceMotion?: boolean, forceFirstFallback?: boolean }} options
 * @returns {Promise<{ played: number, skipped: boolean, failed: number }>}
 */
export async function playSsrPlusRevealQueue({
  results = [],
  reduceMotion,
  forceFirstFallback = false,
} = {}) {
  const queue = collectSsrPlusRevealQueue(results);
  if (queue.length === 0) {
    return { played: 0, skipped: false, failed: 0 };
  }

  revealQueueSkipped = false;
  const reduce = isReduceMotion(reduceMotion);
  let played = 0;
  let failed = 0;

  try {
    for (let i = 0; i < queue.length; i += 1) {
      if (revealQueueSkipped) {
        return { played, skipped: true, failed };
      }
      const entry = queue[i];
      const progressText = queue.length > 1 ? `高稀有揭露 ${i + 1} / ${queue.length}` : '';
      try {
        await playSummonReveal({
          rarity: entry.rarity,
          pet: entry.pet,
          mode: queue.length > 1 ? 'queue' : 'single',
          results,
          reduceMotion: reduce,
          theme: entry.theme,
          progressText,
          queueMode: queue.length > 1,
          forceFallback: forceFirstFallback && i === 0,
        });
        played += 1;
      } catch (itemErr) {
        failed += 1;
        console.warn(`[SummonReveal] queue item #${entry.index} 失敗，繼續下一張`, itemErr);
        // 確保殘留清乾淨再下一張
        removeSummonRevealOverlay();
        document.body.classList.remove('summon-reveal-active');
        summonRevealPlaying = false;
      }
      if (revealQueueSkipped) {
        return { played, skipped: true, failed };
      }
      if (i < queue.length - 1) {
        await delay(reduce ? DURATION.queueGapReduced : DURATION.queueGap);
      }
    }
    return { played, skipped: false, failed };
  } catch (queueErr) {
    console.warn('[SummonReveal] queue 外層 fallback，結束 queue 進結果', queueErr);
    removeSummonRevealOverlay();
    document.body.classList.remove('summon-reveal-active');
    summonRevealPlaying = false;
    return { played, skipped: revealQueueSkipped, failed: failed + 1 };
  } finally {
    removeSummonRevealOverlay();
    document.body.classList.remove('summon-reveal-active');
  }
}

/** SSR 演出（薄封裝） */
export function playSSRReveal(options = {}) {
  return playSummonReveal({ ...options, rarity: 'SSR' });
}

/** UR 演出（薄封裝） */
export function playURReveal(options = {}) {
  return playSummonReveal({ ...options, rarity: 'UR' });
}

export {
  RARITY_RANK,
  DURATION as SUMMON_REVEAL_DURATION,
};
