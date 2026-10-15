import { preloadImage, preloadImages, waitForPreloadWithTimeout } from './imagePreloadService.js';
import { fairyMotifMarkup } from './auroraFairyScene.js';
import { chaosMotifMarkup } from './chaosDemonCourtScene.js';
import { getAwakeningProfile } from './petAwakeningProfiles.js';
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const awakeningDuration = (entry, reduced = false) => reduced ? 600 : entry.rarity === 'UR' ? 5000 : 3000;
export function preloadAwakeningForms(entry, pet) {
  return preloadImages([entry.initialImage.card, entry.initialImage.stage,
    entry.awakenedImage?.card || pet.imageVariants?.card || pet.image,
    entry.awakenedImage?.stage || pet.imageVariants?.stage || pet.image], 4);
}
const motifs = {
  wing: '<path class="awakening-wing left" d="M480 300Q220 85 50 255Q230 230 335 345"/><path class="awakening-wing right" d="M480 300Q740 85 910 255Q730 230 625 345"/><path class="awakening-bridge" d="M110 440Q480 510 850 440M125 410Q480 480 835 410M160 417v38m110-24v36m110-16v35m200-35v35m110-55v36m110-60v38"/>',
  boundary: '<ellipse class="awakening-boundary" cx="480" cy="450" rx="330" ry="68"/><path class="awakening-clear-road" d="M440 560Q380 490 480 450Q570 410 525 335"/><path class="awakening-mist" d="M0 410Q200 330 380 405M580 405Q800 325 960 410"/>',
  blade: '<path class="awakening-blade" d="M190 465Q490 220 780 100"/><path class="awakening-leaf leaf-a" d="M390 325q-55-80-110-25q45 80 110 25"/><path class="awakening-leaf leaf-b" d="M590 250q55-80 110-25q-45 80-110 25"/><path class="awakening-bridge" d="M130 460Q480 505 830 450"/>',
  honey: '<path class="awakening-trace" d="M150 420Q260 310 400 375T800 260"/><g class="awakening-spark"><circle cx="300" cy="335" r="12"/><circle cx="480" cy="380" r="9"/><circle cx="660" cy="300" r="14"/></g>',
  hoof: '<path class="awakening-trace" d="M220 540Q350 380 500 380T760 200"/><g class="awakening-spark"><path d="M320 450q-30-40-45 0m180-70q-30-40-45 0m200-80q-30-40-45 0"/></g>',
  snake: '<path class="awakening-trace" d="M120 440Q170 230 350 370T660 300T830 370"/><path class="awakening-leaf" d="M660 300q50-70 95-25q-50 60-95 25"/>',
  lightning: '<path class="awakening-trace" d="M800 100L530 240L605 285L220 470L425 275L355 235Z"/>',
  moon: '<circle class="awakening-boundary" cx="690" cy="150" r="65"/><path class="awakening-trace" d="M120 420Q480 150 840 420M200 430Q480 225 760 430"/>',
  mountain: '<path class="awakening-trace" d="M80 440L290 170L480 380L690 145L890 440"/><path class="awakening-boundary" d="M100 470Q480 390 860 470"/>',
  snow: '<g class="awakening-spark"><path d="M280 280v80m-40-40h80m-65-25 50 50m0-50-50 50M650 190v80m-40-40h80m-65-25 50 50m0-50-50 50"/></g><path class="awakening-trace" d="M180 490Q450 430 800 310"/>',
  scroll: '<path class="awakening-trace" d="M220 430V170Q480 120 740 170V430Q480 380 220 430M480 145v260M270 220h150m-150 50h150m-150 50h150m140-100h130m-130 50h130m-130 50h130"/>',
  frost: '<path class="awakening-trace" d="M130 460Q440 215 820 445M130 445Q440 200 820 430M130 430Q440 185 820 415"/><g class="awakening-spark"><circle cx="290" cy="345" r="8"/><circle cx="650" cy="335" r="8"/></g>',
  river: '<path class="awakening-trace" d="M80 410Q220 320 400 410T850 380M80 440Q220 350 400 440T850 410M120 470Q480 360 830 470"/>',
};
export function awakeningSceneHtml(entry, pet) {
  const profile = getAwakeningProfile(entry.petId);
  const dark = profile?.poolId === 'darkcrown_court_release';
  const fairy = profile?.poolId === 'aurora_fairy_feast';
  const world = fairy ? '<path class="awakening-ridges" d="M0 600V480Q480 320 960 480V600ZM260 380h440L480 240ZM310 380v140m340-140v140"/>' : dark ? '<path class="awakening-ridges" d="M0 600V490l280-50V280l100-45V145l100-100 100 100v90l100 45v160l280 50v110Z"/>' : '<path class="awakening-ridges" d="M0 450 180 160 340 390 530 120 700 350 850 180 960 430V600H0Z"/>';
  const motif = fairy ? '<g class="awakening-trace">' + fairyMotifMarkup(entry.visual.replace(/^fairy_/, '')) + '</g>' : dark ? '<g class="awakening-trace">' + chaosMotifMarkup(entry.visual.replace(/^chaos_/, '')) + '</g>' : motifs[entry.visual] || motifs.honey;
  return `<section class="awakening-scene awakening-scene--${escape(entry.visual)}${fairy ? ' awakening-scene--fairy' : dark ? ' awakening-scene--darkcourt' : ''}" role="dialog" aria-modal="true" aria-label="${escape(entry.name)}覺醒演出" tabindex="-1">
    <div class="awakening-scene__sky"></div><div class="awakening-scene__clouds"></div>
    <svg class="awakening-scene__world" viewBox="0 0 960 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${world}${motif}</svg>
    <div class="awakening-scene__portraits"><img class="awakening-before" src="${escape(entry.initialImage.stage)}" alt="${escape(entry.name)}初遇相"><img class="awakening-after" src="${escape(entry.awakenedImage?.stage || pet.imageVariants?.stage || pet.image)}" alt="${escape(entry.name)}覺醒相"></div>
    <div class="awakening-scene__words"><p class="awakening-scene__eyebrow">${escape(profile?.eyebrow || '一諾同行')} · 羈絆覺醒</p><h2>${escape(entry.name)}</h2><p>${escape(entry.signature)}</p><p class="awakening-scene__title">${escape(entry.title)}</p></div>
    <button class="btn awakening-scene__skip" type="button">略過演出</button>
  </section>`;
}
/** Visual only: the caller commits awakening before invoking this function. */
export async function playAwakeningScene(entry, pet, { reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches, host = document.body } = {}) {
  await waitForPreloadWithTimeout(Promise.all([entry.initialImage.stage, entry.awakenedImage?.stage || pet.imageVariants?.stage || pet.image].map((src) => preloadImage(src, { eager: true }))));
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const wrap = document.createElement('div'); wrap.innerHTML = awakeningSceneHtml(entry, pet);
    const scene = wrap.firstElementChild;
    for (const img of scene.querySelectorAll('img')) img.addEventListener('error', () => {
      if (!img.dataset.fallbackUsed) { img.dataset.fallbackUsed = 'true'; img.src = pet.imageVariants?.stage || pet.image; }
    });
    const duration = awakeningDuration(entry, reducedMotion);
    scene.style.setProperty('--awakening-duration', `${duration}ms`);
    if (reducedMotion) scene.classList.add('awakening-scene--reduced');
    const finish = () => { clearTimeout(timer); scene.remove(); document.removeEventListener('keydown', keydown, true); if (previousFocus?.isConnected) previousFocus.focus(); resolve(); };
    const keydown = (e) => { if (['Escape', 'Enter', ' '].includes(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); finish(); } else if (e.key === 'Tab') { e.preventDefault(); scene.querySelector('button').focus(); } };
    const timer = setTimeout(finish, duration);
    scene.querySelector('button').addEventListener('click', finish, { once: true });
    document.addEventListener('keydown', keydown, true); host.append(scene); scene.focus();
  });
}
