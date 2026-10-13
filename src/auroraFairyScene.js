/** Cloud kitchen composition; presentation only, all effects share one SVG camera. */
import { summonPreludeDurations } from './summonTiming.js';

let sceneInstance = 0;
export const FAIRY_MOTIFS = Object.freeze(['dew', 'hearth', 'petal', 'mist']);
export const fairyPreludeDurations = (reduced) => summonPreludeDurations(reduced);

export function fairyMotifMarkup(motif) {
  const shapes = {
    dew: '<path d="M340 260q-70-70-50-130m50 130q40-90 10-150m310 150q70-70 50-130m-50 130q-40-90-10-150"/><path d="M500 275q-32 45 0 60q32-15 0-60Z"/>',
    hearth: '<path d="M490 340Q310 170 170 270l100 55-65 40 155 30m150-55Q690 170 830 270l-100 55 65 40-155 30"/>',
    petal: '<path d="M500 335q-115-100-65-130q60-10 65 130q5-140 65-130q50 30-65 130q-115 10-110-45q20-45 110 45q115 10 110-45q-20-45-110 45Z"/>',
    mist: '<path d="M260 340q60-140 200-90q140 50 240-90M250 375q150-95 300-45q100 30 210-100"/>',
  };
  return shapes[FAIRY_MOTIFS.includes(motif) ? motif : 'dew'];
}

export function createAuroraFairyScene(motif = 'summon') {
  const scene = document.createElement('div');
  const prefix = `fairy-feast-${++sceneInstance}`;
  scene.className = 'fairy-feast-scene';
  scene.dataset.motif = FAIRY_MOTIFS.includes(motif) ? motif : 'summon';
  scene.setAttribute('aria-hidden', 'true');
  scene.innerHTML = `<svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" focusable="false">
    <defs><linearGradient id="${prefix}-sky"><stop stop-color="#bfcaf0"/><stop offset="1" stop-color="#58486d"/></linearGradient>
      <linearGradient id="${prefix}-ribbon"><stop stop-color="#ffddeb"/><stop offset=".5" stop-color="#def9fa"/><stop offset="1" stop-color="#bfb4ff"/></linearGradient></defs>
    <path fill="url(#${prefix}-sky)" d="M0 0h1000v1000H0Z"/>
    <g class="fairy-clouds" fill="#e7e4f8" opacity=".38"><ellipse cx="180" cy="600" rx="290" ry="85"/><ellipse cx="850" cy="540" rx="300" ry="90"/></g>
    <g fill="#615174" stroke="#dcd6ef" stroke-width="7"><path d="M160 620q340-180 680 0v50q-340-180-680 0Z"/><path d="M280 580h440l-45-200H325Z"/>
      <path d="M290 380h420L500 260Z" fill="#aea6cd"/><path d="M350 400v170m300-170v170"/></g>
    <g class="fairy-basket fairy-basket--dawn" fill="#ffd7e5" stroke="#d9b7c7" stroke-width="5"><path d="M170 535h95l-15 75h-65Z"/><path d="M175 535q43-90 85 0" fill="none"/><circle cx="215" cy="535" r="20"/></g>
    <g class="fairy-basket fairy-basket--dusk" fill="#bfb9ee" stroke="#aea5d5" stroke-width="5"><path d="M735 535h95l-15 75h-65Z"/><path d="M740 535q43-90 85 0" fill="none"/><circle cx="780" cy="535" r="20"/></g>
    <g class="fairy-fragrance" fill="none" stroke="url(#${prefix}-ribbon)" stroke-width="14" stroke-linecap="round"><path d="M215 535Q340 310 500 480Q660 310 780 535"/><path d="M500 480Q350 370 490 250T560 90"/></g>
    <g class="fairy-hearth" fill="#fff0d7" stroke="#dfc59f" stroke-width="5"><path d="M410 490h180q-8 95-90 95t-90-95Z"/><ellipse cx="500" cy="490" rx="90" ry="18"/></g>
    <g class="fairy-symbol" fill="none" stroke="#fff3ef" stroke-width="7">${fairyMotifMarkup(motif)}</g>
    <path fill="#292039" opacity=".58" d="M0 760q500-130 1000 0v240H0Z"/>
  </svg>`;
  return scene;
}
