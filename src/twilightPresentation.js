/**
 * Shared three-world presentation, evolved from the approved Twilight experiment.
 * No persistence, rewards or ownership changes.
 * Uses the same tasks, companion and progression helpers as the app.
 */
import { getTodayDateString, isInTodayPlan, isCompletedToday } from './taskFilterService.js';
import { getBondProgress, canPetCompanion, getPetCooldownRemaining, formatCooldown } from './collectionService.js';
import { getPetImageSrc } from './imagePreloadService.js';
import { getEligiblePetsForPool } from './petPoolFilter.js';
import { SUPPORTED_THEMES, THEME_DIRECTIONS } from './themeRegistry.js';
import { questIcon } from './questIcons.js';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

export function twilightIcon(name) {
  return questIcon(name);
}

/** A theme scene is never shown as an owned pet unless that actual pet is present. */
export function getCompanionScene(companion, theme = 'twilight') {
  const direction = THEME_DIRECTIONS[theme] || THEME_DIRECTIONS.twilight;
  if (companion?.id === 'pet_n01') return direction.hero;
  return companion ? getPetImageSrc(companion, 'stage') : './assets/expeditions/mist_forest.webp';
}

export function getTwilightJourney(tasks, today = getTodayDateString()) {
  const pending = tasks.filter((task) => !task.completed && isInTodayPlan(task, today)).length;
  const done = tasks.filter((task) => isInTodayPlan(task, today) && isCompletedToday(task, today)).length;
  const total = pending + done;
  return { pending, done, total, percent: total ? Math.round(done / total * 100) : 0 };
}

/** Shared navigation identity; source destinations and handlers stay intact. */
export function initTwilightChrome() {
  const add = (element, name) => {
    if (element && !element.querySelector('.twilight-icon')) element.insertAdjacentHTML('beforeend', twilightIcon(name));
  };
  const replace = (element, name) => { if (element) element.innerHTML = twilightIcon(name); };
  const navIcons = { tasks: 'book', gacha: 'spark', collection: 'cards', expedition: 'compass', more: 'more' };
  document.querySelectorAll('.nav-item').forEach((button) => add(button, navIcons[button.dataset.view]));
  document.querySelector('.nav-item.active')?.setAttribute('aria-current', 'page');
  const moreIcons = { share: 'share', guide: 'book', handbook: 'book', tasks: 'sun', achievements: 'award', habits: 'habit', workshop: 'workshop', settings: 'settings' };
  document.querySelectorAll('.more-menu-item').forEach((button) => {
    replace(button.querySelector('.more-menu-icon'), button.hasAttribute('data-style-settings') ? 'palette' : button.hasAttribute('data-feedback-open') ? 'feedback' : moreIcons[button.dataset.goto]);
  });
  document.querySelectorAll('.home-hub__icon').forEach((button) => replace(button.querySelector('.home-hub__emoji'), { blessing: 'sun', quest: 'map', titles: 'award' }[button.dataset.hub]));
  replace(document.querySelector('.mailbox-entry-btn__icon'), 'mail');
}

export function buildTwilightHome(companion, hasOwnedPets = false, theme = 'twilight') {
  const direction = THEME_DIRECTIONS[theme] || THEME_DIRECTIONS.twilight;
  const name = companion?.displayName || companion?.name || (hasOwnedPets ? '選擇同行夥伴' : '等待第一位夥伴');
  const emptyAction = hasOwnedPets ? 'empty-go-collection' : 'empty-go-gacha';
  const emptyHint = hasOwnedPets ? '到圖鑑選一位夥伴，陪你完成今天的旅程。' : '完成任務，讓第一次相遇更近一步。';
  const art = getCompanionScene(companion, theme);
  const greeting = direction.greeting.split('\n').map(escapeHtml).join('<br>');
  return `<header class="twilight-masthead"><span class="twilight-wordmark"><img class="qn-brand-mark" src="./assets/brand/questnote-icon-192.png" alt="" width="28" height="28">QuestNote</span><span class="qn-world-name">${escapeHtml(direction.name)}</span></header>
    <div class="twilight-scene ${companion ? companion.id === 'pet_n01' ? '' : 'twilight-scene--catalog' : 'twilight-scene--empty'}">
      ${art ? `<img class="twilight-companion-art" src="${escapeHtml(art)}" alt="${companion ? escapeHtml(name) : ''}" decoding="async" fetchpriority="high">` : ''}
      <div class="twilight-scene-shade" aria-hidden="true"></div>
      <div class="twilight-greeting"><p class="twilight-eyebrow" id="twilight-date"></p><h1>${greeting}</h1><p>每一件小事，都有人陪你完成。</p></div>
      <div class="twilight-companion-caption"><p class="twilight-eyebrow">${companion ? '今日同行' : '冒險的起點'}</p>
        <button type="button" class="twilight-pet-name" data-action="${companion ? 'companion-view-detail' : emptyAction}" ${companion ? `data-pet-id="${escapeHtml(companion.id)}"` : ''}>${escapeHtml(name)} ${companion ? `<span class="twilight-rarity">${escapeHtml(companion.rarity)}</span>` : ''}${twilightIcon('arrow')}</button>
        <p>${escapeHtml(companion?.title || emptyHint)}</p>
        ${companion ? `<button type="button" class="qn-companion-feed" data-action="companion-feed" aria-label="餵食 ${escapeHtml(name)}">${twilightIcon('gift')}<span>餵食</span></button>` : ''}
      </div>
    </div>
    <div class="twilight-companion-footer">
      <div class="twilight-voice"><span aria-hidden="true">“</span><p id="twilight-companion-line" aria-live="polite"></p></div>
      ${companion ? `<button type="button" class="twilight-pet-touch" data-action="companion-pet" aria-label="撫摸 ${escapeHtml(name)}"><span id="twilight-pet-label">輕觸，打個招呼</span> ${twilightIcon('arrow')}</button>` : ''}
    </div>
    <div class="twilight-journey"><div class="twilight-journey-label"><span>今日旅程</span><strong><span id="twilight-done"></span> / <span id="twilight-total"></span> <small>件完成</small></strong></div>
      <div id="twilight-progress" class="twilight-journey-track" role="progressbar" aria-label="今日任務進度" aria-valuemin="0" aria-valuemax="100"><span></span><i aria-hidden="true">✦</i></div>
      <div class="twilight-bond">${companion ? `${twilightIcon('heart')}<span id="twilight-bond-level"></span><span id="twilight-bond-progress"></span>` : '<span>從一件小事，展開你的旅程。</span>'}</div>
    </div>`;
}

export function syncTwilightHome(state) {
  const container = document.getElementById('twilight-home');
  const heading = document.getElementById('twilight-chapter-heading');
  if (!container || !heading) return;
  const theme = state.userPreferences?.theme || 'default';
  const active = SUPPORTED_THEMES.includes(theme);
  container.hidden = !active;
  heading.hidden = !active;
  if (!active) return;
  const companion = state.companion;
  const hasOwnedPets = (state.collectionProgress?.owned ?? 0) > 0;
  const key = JSON.stringify([theme, companion?.id, companion?.displayName, companion?.name, companion?.title, companion?.rarity, getCompanionScene(companion, theme), hasOwnedPets]);
  if (container.dataset.companionKey !== key) {
    container.innerHTML = buildTwilightHome(companion, hasOwnedPets, theme);
    container.dataset.companionKey = key;
    const image = container.querySelector('.twilight-companion-art');
    image?.addEventListener('error', () => {
      const original = getPetImageSrc(companion);
      if (original && image.getAttribute('src') !== original) image.src = original;
      else image.hidden = true;
    });
  }
  const set = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };
  const today = getTodayDateString();
  const chapter = heading.querySelector?.('p');
  if (chapter) chapter.textContent = THEME_DIRECTIONS[theme].chapter;
  const journey = getTwilightJourney(state.tasks || [], today);
  set('twilight-date', new Intl.DateTimeFormat('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(`${today}T12:00:00`)));
  set('twilight-done', journey.done);
  set('twilight-total', journey.total);
  set('twilight-pending', `${journey.pending} 件待完成`);
  const track = document.getElementById('twilight-progress');
  track.style.setProperty('--journey-progress', `${journey.percent}%`);
  track.setAttribute('aria-valuenow', journey.percent);
  track.setAttribute('aria-valuetext', `${journey.done} / ${journey.total} 件完成`);
  const existingLine = document.getElementById('companion-bubble-text')?.textContent;
  set('twilight-companion-line', companion ? existingLine || state.companionLine : hasOwnedPets ? '夥伴已經在圖鑑等你，選一位一起出發吧。' : '每一次完成，都在為新的相遇累積星塵。');
  if (companion) {
    const progress = getBondProgress(companion.bondExp ?? 0, companion.bondLevel ?? 1);
    set('twilight-bond-level', `親密度 Lv.${companion.bondLevel ?? 1}`);
    set('twilight-bond-progress', progress.max ? `${progress.current} / ${progress.max} EXP` : '羈絆解放');
    const touch = container.querySelector('.twilight-pet-touch');
    touch.disabled = !canPetCompanion(companion);
    const remaining = getPetCooldownRemaining(companion);
    set('twilight-pet-label', touch.disabled ? `撫摸冷卻 · ${formatCooldown(remaining)}` : '輕觸，打個招呼');
  }
}

export function setTwilightCompanionLine(line) {
  const target = document.getElementById('twilight-companion-line');
  if (target && !document.getElementById('twilight-home')?.hidden) target.textContent = line;
}

let reactionTimer;
export function reactTwilightCompanion(line) {
  const scene = document.getElementById('twilight-home');
  if (!scene || scene.hidden) return;
  if (line) setTwilightCompanionLine(line);
  clearTimeout(reactionTimer);
  scene.classList.remove('twilight-is-reacting');
  requestAnimationFrame(() => scene.classList.add('twilight-is-reacting'));
  reactionTimer = setTimeout(() => scene.classList.remove('twilight-is-reacting'), 750);
}

export function syncTwilightGacha(state, pool) {
  const container = document.getElementById('twilight-gacha-scene');
  if (!container) return;
  // Authored pool scenes retain their distinct identity and reveal contracts.
  const theme = state.userPreferences?.theme || 'default';
  const active = SUPPORTED_THEMES.includes(theme) && pool && !pool.presentation;
  container.hidden = !active;
  document.getElementById('gacha-panel')?.classList.toggle('twilight-has-gacha-scene', !!active);
  if (!active) return;
  const eligible = getEligiblePetsForPool(state.allPets, pool);
  const pet = eligible.find((entry) => entry.id === state.companion?.id) || eligible.find((entry) => entry.id === 'pet_n01') || eligible[0];
  const src = getCompanionScene(pet, theme);
  const key = JSON.stringify([theme, pool.id, pet?.id, src, pet?.name]);
  if (container.dataset.sceneKey === key) return;
  container.dataset.sceneKey = key;
  container.innerHTML = `<div class="twilight-gacha-art">${src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(pet?.name || '新的相遇')}，卡池夥伴" decoding="async">` : ''}<div></div></div><p class="twilight-eyebrow">THE NEXT ENCOUNTER</p><h2>下一次相遇<span>。</span></h2><p>每一件完成的任務，<br>都是新夥伴靠近的起點。</p>${pet ? `<span class="twilight-gacha-caption">卡池夥伴 · ${escapeHtml(pet?.name || '新的相遇')}</span>` : ''}`;
  const image = container.querySelector('img');
  image?.addEventListener('error', () => {
    const original = getPetImageSrc(pet);
    if (original && image.getAttribute('src') !== original) image.src = original;
    else image.hidden = true;
  });
}
