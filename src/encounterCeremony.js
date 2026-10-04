// Presentation only. Rewards are committed by the native atomic transaction first.
import { playPoolDebutPresentation, playThemedSummon } from './themedSummonController.js';
import { playSummonReveal, isRevealQueueSkipped } from './summonRevealService.js';
import { normalizePoolDefinition } from './poolContentContract.js';
import { createLionheartScene } from './lionheartScene.js';
import { createSwordwildShanheScene } from './swordwildShanheScene.js';
import { createGlacierArrivalScene } from './glacierArrivalScene.js';
import { createHoneylightSugarScene } from './honeylightSugarScene.js';
import { createEncounterScenery } from './encounterScenery.js';

export function ceremonyPresentation(pool) {
  if (pool.id === 'standard') return { animationKey:'dream_bloom', debutLabel:`${pool.name}登場`, debutLines:['循著星圖','走向新的相遇'] };
  if (pool.id === 'eternal_slumber_bloom') return { ...normalizePoolDefinition(pool).presentation, debutLines:['月光落入鏡池','沉夢在花海綻放'] };
  return normalizePoolDefinition(pool).presentation || {
    animationKey: 'dream_bloom', debutLabel: '星光中的相遇',
    debutLines: ['循著星光', '迎接新的', '同行者'],
  };
}

export function createPoolScenery(pool) {
  if (pool.id === 'standard') return createEncounterScenery('stars');
  if (pool.id === 'eternal_slumber_bloom') return createEncounterScenery('bloom');
  const key = ceremonyPresentation(pool).animationKey;
  const factories = { lionheart_inverse_oath: createLionheartScene, swordwild_shanhe: createSwordwildShanheScene, glacier_arrival: createGlacierArrivalScene, honeylight_sugar: createHoneylightSugarScene };
  if (factories[key]) return factories[key]();
  const scene = document.createElement('div');
  scene.className = 'identity-mirror-scene';
  scene.setAttribute('aria-hidden', 'true');
  scene.innerHTML = '<div class="gacha-theme-stage__mist"></div><div class="gacha-theme-stage__moon"></div><div class="dream-bloom-bg__arch"></div><div class="dream-bloom-bg__pool"></div>';
  return scene;
}

export async function playCeremonyEntry(pool, { reduceMotion }) {
  const sceneFactory = ['standard','eternal_slumber_bloom'].includes(pool.id) ? () => createPoolScenery(pool) : undefined;
  await withLegacyScene(() => playPoolDebutPresentation({ poolName: pool.name, presentation: ceremonyPresentation(pool), reduceMotion, sceneFactory }));
}

async function withLegacyScene(play) {
  const previousFocus = document.activeElement;
  const surfaces = [...document.querySelectorAll('#app')].map((element) => [element, element.inert]);
  const scrollStyles = [document.documentElement, document.body].map((element) => [element, element.style.getPropertyValue('overflow'), element.style.getPropertyPriority('overflow')]);
  const observer = new MutationObserver(() => {
    const overlay = document.querySelector('.awakening-scene, .pool-awakening-overlay, .dream-debut-overlay, .dream-bloom-overlay, .summon-reveal-overlay');
    if (overlay?.classList.contains('pool-awakening-overlay') && !overlay.contains(document.activeElement)) overlay.querySelector('button')?.focus();
  });
  observer.observe(document.body, { childList: true });
  const trap = (event) => {
    const overlay = document.querySelector('.awakening-scene, .pool-awakening-overlay, .dream-debut-overlay, .dream-bloom-overlay, .summon-reveal-overlay');
    if (!overlay || event.key !== 'Tab') return;
    const buttons = [...overlay.querySelectorAll('button')].filter((button) => button.getClientRects().length && !button.disabled);
    const first = buttons[0];
    const last = buttons.at(-1);
    if (!first) { event.preventDefault(); return; }
    if ((!buttons.includes(document.activeElement)) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault(); (event.shiftKey ? last : first).focus();
    }
  };
  document.addEventListener('keydown', trap, true);
  surfaces.forEach(([element]) => { element.inert = true; });
  scrollStyles.forEach(([element]) => { element.style.setProperty('overflow', 'hidden'); });
  try { return await play(); }
  finally {
    observer.disconnect();
    document.removeEventListener('keydown', trap, true);
    surfaces.forEach(([element, inert]) => { element.inert = inert; });
    scrollStyles.forEach(([element, value, priority]) => { value ? element.style.setProperty('overflow', value, priority) : element.style.removeProperty('overflow'); });
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
}

export async function playCeremonyRitual(pool, results, reduceMotion) {
  return withLegacyScene(() => playThemedSummon({
    animationKey: ceremonyPresentation(pool).animationKey,
    poolName: pool.name, mode: results.length > 1 ? 'ten' : 'single',
    results: results.map((result) => ({ ...result, rarity: result.pet.rarity })),
    reduceMotion, ritualOnly: true,
    sceneFactory: ['standard','eternal_slumber_bloom'].includes(pool.id) ? () => createPoolScenery(pool) : undefined,
  }));
}

export async function playCeremonyCharacter(pool, result, { reduceMotion, index = 0, count = 1 }) {
  if (reduceMotion || !['SSR', 'UR'].includes(result.pet.rarity)) return { skipped: false, artworkShown: false };
  const startedAt = performance.now();
  await withLegacyScene(() => playSummonReveal({
    rarity: result.pet.rarity, pet: result.pet, reduceMotion,
    presentationKey: ceremonyPresentation(pool).animationKey,
    progressText: count > 1 ? `角色登場 ${index + 1} / ${count}` : '',
    identityHandoff: true,
    sceneFactory: pool.id === 'eternal_slumber_bloom' ? () => createEncounterScenery('bloom', result.pet.presentation?.revealKey || 'garden') : pool.id === 'standard' ? () => createEncounterScenery('stars') : undefined,
  }));
  return { skipped: isRevealQueueSkipped(), artworkShown: true, duration: Math.round(performance.now() - startedAt) };
}

/** A fixed invited character uses its own pool's existing winning reveal. */
export function playInvitationCharacter(pools, selected, { reduceMotion }) {
  const pool = pools.find((row) => row.id === selected.seriesId);
  if (!pool) throw new Error('角色所屬卡池的演出尚未載入。');
  return playCeremonyCharacter(pool, { pet:selected.pet, isNew:true }, { reduceMotion });
}
