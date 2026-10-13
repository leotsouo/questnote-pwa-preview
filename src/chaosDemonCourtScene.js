/** Original broken crown and seven resisting routes. Display only. */
export const CHAOS_MOTIFS = Object.freeze(['crown', 'moon', 'bell', 'thorn', 'mirror', 'law', 'star']);
const marks = Object.freeze({
  crown: '<path d="m345 295 30-95 70 60 55-110 55 110 70-60 30 95Z"/>',
  moon: '<path d="M575 170a130 130 0 1 0 0 260 105 105 0 1 1 0-260Z"/>',
  bell: '<path d="M440 250q60-95 120 0l20 130H420Zm20 145q40 40 80 0M500 200v-30"/>',
  thorn: '<path d="M350 410 650 190M400 375l-30-65m90 20 60 30m35-90-15-65m40 35 60 30"/>',
  mirror: '<ellipse cx="500" cy="300" rx="110" ry="140"/><path d="m450 370 100-140m-120 70 60-70"/>',
  law: '<circle cx="500" cy="300" r="95"/><path d="M500 185v230M385 300h230m-195-80 160 160m0-160-160 160"/>',
  star: '<path d="m500 170 32 90 96 10-74 60 24 95-78-55-78 55 24-95-74-60 96-10Z"/>',
});
export const chaosMotifMarkup = (motif) => marks[CHAOS_MOTIFS.includes(motif) ? motif : 'crown'];
export function createChaosDemonCourtScene(motif = 'crown') {
  const scene = document.createElement('div');
  scene.className = 'chaos-court-scene';
  scene.dataset.motif = CHAOS_MOTIFS.includes(motif) ? motif : 'crown';
  scene.setAttribute('aria-hidden', 'true');
  const colors = ['#e7b369', '#91d5ea', '#b09dea', '#e5a0bd', '#72d5af', '#c8d9eb', '#d5d588'];
  scene.innerHTML = '<svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" focusable="false">'
    + '<path class="chaos-tower" d="M0 900 220 730 320 850V470l90-45V300l90-125 90 125v125l90 45v380l100-120 220 170v100H0Z"/>'
    + '<g class="chaos-routes" fill="none" stroke-width="5">'
    + colors.map((color, i) => '<path stroke="' + color + '" d="M' + (70 + i * 143) + ' 1000Q' + (170 + i * 110) + ' 730 500 510"/>').join('')
    + '</g><circle class="chaos-crown" cx="500" cy="300" r="190" fill="none" stroke-dasharray="340 60 190 70 270 260"/>'
    + '<g class="chaos-mark" fill="none">' + marks[scene.dataset.motif] + '</g>'
    + '<path class="chaos-rift" d="m500 470-40 90 70 65-40 90 60 75-50 120" fill="none"/>'
    + '</svg><div class="chaos-court-vignette"></div>';
  return scene;
}
